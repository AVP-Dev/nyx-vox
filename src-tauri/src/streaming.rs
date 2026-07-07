#![allow(dead_code)] // streaming module: WIP, functions will be called from commands

use futures_util::{SinkExt, StreamExt};
use serde_json::json;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, Manager, Runtime};
use tokio_tungstenite::{connect_async, tungstenite::Message};

// ── Groq Streaming ───────────────────────────────────────────────────────────

pub async fn stream_groq<R: Runtime>(
    app: AppHandle<R>,
    audio_samples: Arc<Mutex<Vec<f32>>>,
    sample_rate: u32,
    recording_flag: Arc<AtomicBool>,
    api_key: String,
    language: &str,
) -> Result<String, String> {
    let api_key = api_key.trim_matches('"').trim_matches('\'').trim().to_string();
    if api_key.is_empty() {
        return Err("API ключ Groq не найден.".to_string());
    }

    let (ws_stream, _) = connect_async("wss://api.groq.com/openai/v1/audio/transcriptions")
        .await
        .map_err(|e| format!("WebSocket connection failed: {}", e))?;

    let (mut write, mut read) = ws_stream.split();

    // Send config with auth
    let config = json!({
        "authorization": format!("Bearer {}", api_key),
        "model": "whisper-large-v3-turbo",
        "language": if language == "auto" || language == "mixed" { serde_json::Value::Null } else { json!(language) },
        "prompt": crate::prompts::GROQ_STT_PROMPT,
        "response_format": "verbose_json"
    });
    write.send(Message::Text(config.to_string())).await
        .map_err(|e| format!("Failed to send config: {}", e))?;

    let lang_pref = app.state::<crate::state::AppLanguage>()
        .0.lock().map(|l| l.clone()).unwrap_or_else(|_| "ru".to_string());
    let _ = app.emit("ai-status", if lang_pref == "ru" { "🎙️ Стриминг..." } else { "🎙️ Streaming..." });

    let chunk_size = (sample_rate as usize) / 5; // 200ms chunks
    let audio_clone = Arc::clone(&audio_samples);
    let flag_clone = Arc::clone(&recording_flag);

    // Audio sender: reads from shared buffer, sends WAV chunks
    let sender = tokio::spawn(async move {
        let mut offset = 0;
        loop {
            if !flag_clone.load(Ordering::SeqCst) {
                let samples: Vec<f32> = {
                    let mut lock = audio_clone.lock().unwrap_or_else(|e| e.into_inner());
                    lock.drain(..).collect()
                };
                if !samples.is_empty() {
                    let wav = encode_wav(&samples, sample_rate);
                    let _ = write.send(Message::Binary(wav)).await;
                }
                let _ = write.send(Message::Close(None)).await;
                break;
            }
            let chunk: Vec<f32> = {
                let lock = audio_clone.lock().unwrap_or_else(|e| e.into_inner());
                if lock.len() > offset + chunk_size {
                    lock[offset..offset + chunk_size].to_vec()
                } else {
                    continue;
                }
            };
            offset += chunk_size;
            let wav = encode_wav(&chunk, sample_rate);
            if write.send(Message::Binary(wav)).await.is_err() {
                break;
            }
        }
    });

    // Receive partial results
    let mut full_text = String::new();
    let mut partial_text = String::new();
    let mut last_emit = std::time::Instant::now();

    while let Some(msg) = read.next().await {
        match msg {
            Ok(Message::Text(text)) => {
                if let Ok(val) = serde_json::from_str::<serde_json::Value>(&text) {
                    if let Some(t) = val["transcript"].as_str() {
                        if !t.is_empty() {
                            partial_text = t.to_string();
                            if last_emit.elapsed().as_millis() > 100 {
                                let _ = app.emit("streaming-partial", &partial_text);
                                last_emit = std::time::Instant::now();
                            }
                        }
                    }
                    if let Some(t) = val["text"].as_str() {
                        full_text = t.to_string();
                    }
                    if let Some(alts) = val["results"]["channels"][0]["alternatives"].as_array() {
                        if let Some(alt) = alts.first() {
                            if let Some(t) = alt["transcript"].as_str() {
                                full_text = t.to_string();
                            }
                        }
                    }
                }
            }
            Ok(Message::Close(_)) => break,
            Err(e) => {
                log::error!("WebSocket error: {}", e);
                break;
            }
            _ => {}
        }
    }

    let _ = sender.await;
    let _ = app.emit("streaming-partial", "");

    let result = if !full_text.is_empty() { full_text } else { partial_text };
    Ok(json!({ "content": crate::utils::clean_repetitive_phrases(&result) }).to_string())
}

// ── Deepgram Streaming ───────────────────────────────────────────────────────

pub async fn stream_deepgram<R: Runtime>(
    app: AppHandle<R>,
    audio_samples: Arc<Mutex<Vec<f32>>>,
    sample_rate: u32,
    recording_flag: Arc<AtomicBool>,
    api_key: String,
    language: &str,
) -> Result<String, String> {
    let api_key = api_key.trim_matches('"').trim_matches('\'').trim().to_string();
    if api_key.is_empty() {
        return Err("API ключ Deepgram не найден.".to_string());
    }

    let lang_param = match language {
        "mixed" => "&language=multi",
        "auto" => "&detect_language=true",
        _ => "",
    };

    let url = format!(
        "wss://api.deepgram.com/v1/listen?model=nova-3&smart_format=true&punctuate=true{}&encoding=linear16&sample_rate={}",
        lang_param, sample_rate
    );

    let (ws_stream, _) = connect_async(&url)
        .await
        .map_err(|e| format!("WebSocket connection failed: {}", e))?;

    let (mut write, mut read) = ws_stream.split();

    // Send auth
    let auth = json!({ "authorization": format!("Token {}", api_key) });
    write.send(Message::Text(auth.to_string())).await
        .map_err(|e| format!("Failed to send auth: {}", e))?;

    let lang_pref = app.state::<crate::state::AppLanguage>()
        .0.lock().map(|l| l.clone()).unwrap_or_else(|_| "ru".to_string());
    let _ = app.emit("ai-status", if lang_pref == "ru" { "🎙️ Стриминг..." } else { "🎙️ Streaming..." });

    let chunk_size = (sample_rate as usize) / 5;
    let audio_clone = Arc::clone(&audio_samples);
    let flag_clone = Arc::clone(&recording_flag);

    let sender = tokio::spawn(async move {
        let mut offset = 0;
        loop {
            if !flag_clone.load(Ordering::SeqCst) {
                let samples: Vec<f32> = {
                    let mut lock = audio_clone.lock().unwrap_or_else(|e| e.into_inner());
                    lock.drain(..).collect()
                };
                if !samples.is_empty() {
                    let pcm = f32_to_i16_pcm(&samples);
                    let _ = write.send(Message::Binary(pcm)).await;
                }
                let _ = write.send(Message::Close(None)).await;
                break;
            }
            let chunk: Vec<f32> = {
                let lock = audio_clone.lock().unwrap_or_else(|e| e.into_inner());
                if lock.len() > offset + chunk_size {
                    lock[offset..offset + chunk_size].to_vec()
                } else {
                    continue;
                }
            };
            offset += chunk_size;
            let pcm = f32_to_i16_pcm(&chunk);
            if write.send(Message::Binary(pcm)).await.is_err() {
                break;
            }
        }
    });

    let full_text = String::new();
    let mut partial_text = String::new();
    let mut last_emit = std::time::Instant::now();

    while let Some(msg) = read.next().await {
        match msg {
            Ok(Message::Text(text)) => {
                if let Ok(val) = serde_json::from_str::<serde_json::Value>(&text) {
                    if let Some(t) = val["transcript"].as_str() {
                        if !t.is_empty() {
                            partial_text = t.to_string();
                            if last_emit.elapsed().as_millis() > 100 {
                                let _ = app.emit("streaming-partial", &partial_text);
                                last_emit = std::time::Instant::now();
                            }
                        }
                    }
                }
            }
            Ok(Message::Close(_)) => break,
            Err(e) => {
                log::error!("WebSocket error: {}", e);
                break;
            }
            _ => {}
        }
    }

    let _ = sender.await;
    let _ = app.emit("streaming-partial", "");

    let result = if !full_text.is_empty() { full_text } else { partial_text };
    Ok(crate::utils::strip_filler_phrases(&crate::utils::clean_repetitive_phrases(&result)))
}

// ── Helpers ──────────────────────────────────────────────────────────────────

fn encode_wav(samples: &[f32], sample_rate: u32) -> Vec<u8> {
    let mut buf = std::io::Cursor::new(Vec::new());
    {
        let spec = hound::WavSpec {
            channels: 1,
            sample_rate,
            bits_per_sample: 16,
            sample_format: hound::SampleFormat::Int,
        };
        if let Ok(mut writer) = hound::WavWriter::new(&mut buf, spec) {
            for &s in samples {
                let _ = writer.write_sample((s * 32767.0).clamp(-32768.0, 32767.0) as i16);
            }
            let _ = writer.finalize();
        }
    }
    buf.into_inner()
}

fn f32_to_i16_pcm(samples: &[f32]) -> Vec<u8> {
    let mut buf = Vec::with_capacity(samples.len() * 2);
    for &s in samples {
        let val = (s * 32767.0).clamp(-32768.0, 32767.0) as i16;
        buf.extend_from_slice(&val.to_le_bytes());
    }
    buf
}
