use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc, Mutex,
};
use tauri::{AppHandle, Emitter, Runtime};
use futures_util::{SinkExt, StreamExt};
use tokio_tungstenite::{connect_async, tungstenite::Message};


// ── Start Deepgram streaming ──────────────────────────────────────────────────
pub fn start_deepgram<R: Runtime>(
    app: AppHandle<R>,
    api_key: String,
    recording_flag: Arc<AtomicBool>,
    language: &str,
) -> Result<(), String> {

    recording_flag.store(true, Ordering::SeqCst);

    let flag_ws = Arc::clone(&recording_flag);
    let app_ws = app.clone();
    let lang_str = language.to_string();

    // ── cpal mic capture → send to Deepgram via WebSocket ─────────────────
    std::thread::spawn(move || {
        let rt = tokio::runtime::Runtime::new().expect("tokio runtime");
        rt.block_on(async move {
            let dg_lang = if lang_str == "auto" { "multi" } else { &lang_str };

            // Build WebSocket URL with all needed params
            let ws_url = format!(
                "wss://api.deepgram.com/v1/listen?\
                 model=nova-2&\
                 language={}&\
                 punctuate=true&\
                 smart_format=true&\
                 interim_results=true&\
                 endpointing=300&\
                 encoding=linear16&\
                 sample_rate=16000&\
                 channels=1",
                 dg_lang
            );

            // Connection to Deepgram. 
            // Using into_client_request() ensures all standard WS headers (Key, Version, Host, etc.)
            // are correctly pre-filled by the library, avoiding duplicates or omissions.
            use tokio_tungstenite::tungstenite::client::IntoClientRequest;
            let mut request = ws_url.into_client_request().map_err(|e| format!("URL error: {}", e)).unwrap();
            request.headers_mut().insert("Authorization", format!("Token {}", api_key.trim()).parse().unwrap());

            let (ws_stream, _) = match connect_async(request).await {
                Ok(conn) => conn,
                Err(e) => {
                    let _ = app_ws.emit("deepgram-error", format!("Connection failed: {}", e));
                    return;
                }
            };

            let (mut ws_sink, mut ws_reader) = ws_stream.split();

            // Accumulated final transcript
            let final_text = Arc::new(Mutex::new(String::new()));
            let final_text_reader = Arc::clone(&final_text);
            let app_reader = app_ws.clone();
            let flag_reader = Arc::clone(&flag_ws);

            // ── Task 1: Read WebSocket responses ──────────────────────────
            let reader_task = tokio::spawn(async move {
                while let Some(msg) = ws_reader.next().await {
                    if !flag_reader.load(Ordering::SeqCst) { break; }

                    let Ok(msg) = msg else { continue };
                    let Message::Text(text) = msg else { continue };

                    // Parse Deepgram JSON response
                    if let Ok(resp) = serde_json::from_str::<serde_json::Value>(&text) {
                        if resp.get("type").and_then(|t| t.as_str()) == Some("Results") {
                            let channel = &resp["channel"]["alternatives"][0];
                            let transcript = channel["transcript"].as_str().unwrap_or("");

                            if transcript.is_empty() { continue; }

                            let is_final = resp["is_final"].as_bool().unwrap_or(false);

                            if is_final {
                                // Accumulate final segments
                                if let Ok(mut ft) = final_text_reader.lock() {
                                    if !ft.is_empty() { ft.push(' '); }
                                    ft.push_str(transcript);
                                    let _ = app_reader.emit("transcript-partial", ft.clone());
                                }
                            } else {
                                // Interim: show accumulated + current interim
                                let prefix = final_text_reader.lock()
                                    .map(|ft| ft.clone())
                                    .unwrap_or_default();
                                let display = if prefix.is_empty() {
                                    transcript.to_string()
                                } else {
                                    format!("{} {}", prefix, transcript)
                                };
                                let _ = app_reader.emit("transcript-partial", display);
                            }
                        }
                    }
                }
            });

            // ── Task 2: Capture mic → send PCM to WebSocket ──────────────
            let flag_mic = Arc::clone(&flag_ws);
            let (tx, mut rx) = tokio::sync::mpsc::channel::<Vec<u8>>(64);

            // cpal thread
            let flag_cpal = Arc::clone(&flag_ws);
            let flag_cpal_loop = Arc::clone(&flag_cpal);
            std::thread::spawn(move || {
                let host = cpal::default_host();
                let device = match cpal::traits::HostTrait::default_input_device(&host) {
                    Some(d) => d,
                    None => return,
                };
                let config = match cpal::traits::DeviceTrait::default_input_config(&device) {
                    Ok(c) => c,
                    Err(_) => return,
                };

                let channels = config.channels() as usize;
                let src_rate = config.sample_rate().0;
                let tx = tx;

                let stream = cpal::traits::DeviceTrait::build_input_stream(
                    &device,
                    &config.into(),
                    move |data: &[f32], _: &cpal::InputCallbackInfo| {
                        if !flag_cpal.load(Ordering::SeqCst) { return; }

                        // Mono conversion
                        let mono: Vec<f32> = data
                            .chunks(channels)
                            .map(|f| f.iter().sum::<f32>() / channels as f32)
                            .collect();

                        // Resample to 16kHz
                        let resampled = super::resample_to_16k(&mono, src_rate, 16000);

                        // Convert f32 → i16 PCM bytes (little-endian)
                        let pcm_bytes: Vec<u8> = resampled.iter()
                            .flat_map(|&s| {
                                let sample = (s * 32767.0).clamp(-32768.0, 32767.0) as i16;
                                sample.to_le_bytes()
                            })
                            .collect();

                        let _ = tx.try_send(pcm_bytes);
                    },
                    |err| eprintln!("cpal error: {}", err),
                    None,
                );

                if let Ok(s) = stream {
                    cpal::traits::StreamTrait::play(&s).ok();
                    while flag_cpal_loop.load(Ordering::SeqCst) {
                        std::thread::sleep(std::time::Duration::from_millis(50));
                    }
                }
            });

            // Forward mic data to WebSocket
            let sender_task = tokio::spawn(async move {
                while let Some(pcm) = rx.recv().await {
                    if !flag_mic.load(Ordering::SeqCst) { break; }
                    if ws_sink.send(Message::Binary(pcm.into())).await.is_err() {
                        break;
                    }
                }
                // Send close message
                let close_msg = serde_json::json!({"type": "CloseStream"}).to_string();
                let _ = ws_sink.send(Message::Text(close_msg.into())).await;
            });

            // Wait for both tasks
            let _ = tokio::join!(reader_task, sender_task);

            // Emit final text
            {
                let ft = final_text.lock().unwrap_or_else(|e| e.into_inner());
                if !ft.is_empty() {
                    let _ = app_ws.emit("deepgram-final", ft.clone());
                }
            }
        });
    });

    Ok(())
}
