use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc, Mutex,
};
use tauri::{AppHandle, Emitter, Runtime};
use reqwest::multipart;
use std::io::Cursor;

// ── Shared recording state ────────────────────────────────────────────────────
pub struct RecordingState {
    pub samples: Vec<f32>,
    pub sample_rate: u32,
}

impl Default for RecordingState {
    fn default() -> Self {
        Self { samples: Vec::new(), sample_rate: 0 }
    }
}

pub type SharedGroqState = Arc<Mutex<RecordingState>>;

// ── Start recording ───────────────────────────────────────────────────────────
pub fn start_recording<R: Runtime>(
    app: AppHandle<R>,
    state: SharedGroqState,
    recording_flag: Arc<AtomicBool>,
) -> Result<(), String> {
    use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};

    // Reset state
    {
        let mut lock = state.lock().map_err(|e| e.to_string())?;
        lock.samples.clear();
        lock.sample_rate = 0;
    }
    recording_flag.store(true, Ordering::SeqCst);

    let sample_store = Arc::clone(&state);
    let flag_cpal = Arc::clone(&recording_flag);
    let app_stream = app.clone();

    std::thread::spawn(move || {
        let host = cpal::default_host();
        let device = match host.default_input_device() {
            Some(d) => d,
            None => { let _ = app_stream.emit("recording-error", "No mic"); return; }
        };
        let config = match device.default_input_config() {
            Ok(c) => c,
            Err(e) => { let _ = app_stream.emit("recording-error", e.to_string()); return; }
        };

        let channels = config.channels() as usize;
        let actual_sample_rate = config.sample_rate().0;

        if let Ok(mut lock) = sample_store.lock() {
            lock.sample_rate = actual_sample_rate;
        }

        let samples_ref = Arc::clone(&sample_store);
        let flag_inner = Arc::clone(&flag_cpal);

        let stream = device.build_input_stream(
            &config.into(),
            move |data: &[f32], _: &cpal::InputCallbackInfo| {
                if !flag_inner.load(Ordering::SeqCst) { return; }

                let mono: Vec<f32> = data
                    .chunks(channels)
                    .map(|f| f.iter().sum::<f32>() / channels as f32)
                    .collect();

                let rms = (mono.iter().map(|s| s * s).sum::<f32>() / mono.len() as f32).sqrt();
                let level = (rms * 10.0).min(1.0_f32);
                let _ = app_stream.emit("audio-level", level);

                if let Ok(mut lock) = samples_ref.lock() {
                    lock.samples.extend_from_slice(&mono);
                }
            },
            |err| eprintln!("cpal error: {}", err),
            None,
        );

        if let Ok(s) = stream {
            s.play().ok();
            while flag_cpal.load(Ordering::SeqCst) {
                std::thread::sleep(std::time::Duration::from_millis(50));
            }
        }
    });

    Ok(())
}

// ── Stop recording & send to Groq API ─────────────────────────────────────────
pub async fn stop_recording(
    state: SharedGroqState,
    recording_flag: Arc<AtomicBool>,
    api_key: String,
    language: &str,
) -> Result<String, String> {
    tokio::time::sleep(std::time::Duration::from_millis(400)).await;
    recording_flag.store(false, Ordering::SeqCst);

    let (samples, src_rate) = {
        let mut lock = state.lock().map_err(|e| e.to_string())?;
        let tail = lock.samples.clone();
        let rate = lock.sample_rate;
        lock.samples.clear();
        (tail, rate)
    };

    if samples.is_empty() { return Ok(String::new()); }

    let rms = (samples.iter().map(|s| s * s).sum::<f32>() / samples.len() as f32).sqrt();
    if rms < 0.00005 { return Ok(String::new()); }

    // Resample to 16k
    let whisper_samples = super::resample_to_16k(&samples, src_rate, 16000);

    // Convert to WAV in memory
    let mut wav_cursor = Cursor::new(Vec::new());
    {
        let spec = hound::WavSpec {
            channels: 1,
            sample_rate: 16000,
            bits_per_sample: 16,
            sample_format: hound::SampleFormat::Int,
        };
        let mut writer = hound::WavWriter::new(&mut wav_cursor, spec)
            .map_err(|e| format!("WavWriter error: {}", e))?;

        for &sample in &whisper_samples {
            let amplitude = (sample * 32767.0).clamp(-32768.0, 32767.0) as i16;
            writer.write_sample(amplitude).map_err(|e| format!("Write sample error: {}", e))?;
        }
        writer.finalize().map_err(|e| format!("Wav finalize error: {}", e))?;
    }

    let wav_data = wav_cursor.into_inner();

    // Spawn blocking to make the HTTP reqwest synchronous or just use async directly
    // Actually, reqwest has an async client, but for simplicity here we'll use blocking if not inside a localset, 
    // or just the async reqwest client since we are in `stop_recording` (which is an async function).
    
    let client = reqwest::Client::new();
    let part = multipart::Part::bytes(wav_data)
        .file_name("audio.wav")
        .mime_str("audio/wav")
        .map_err(|e| e.to_string())?;

    let mut form = multipart::Form::new()
        .part("file", part)
        .text("model", "whisper-large-v3-turbo")
        .text("prompt", "Диктовка. Привет, как дела? Сегодня хорошая погода. Я записываю важный текст. Пунктуация важна. Пожалуйста, расставляй запятые.");
        
    if language != "auto" {
        form = form.text("language", language.to_string());
    }

    let res = client
        .post("https://api.groq.com/openai/v1/audio/transcriptions")
        .header("Authorization", format!("Bearer {}", api_key))
        .multipart(form)
        .send()
        .await
        .map_err(|e| format!("Groq request failed: {}", e))?;

    if !res.status().is_success() {
        let err_text = res.text().await.unwrap_or_default();
        return Err(format!("Groq API Error: {}", err_text));
    }

    // Expected JSON: { "text": "..." }
    let json: serde_json::Value = res.json().await.map_err(|e| format!("Parse json failed: {}", e))?;
    let text = json["text"].as_str().unwrap_or("").trim().to_string();

    Ok(text)
}
