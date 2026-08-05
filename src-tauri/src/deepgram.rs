use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc, Mutex,
};
use tauri::{AppHandle, Emitter, Runtime};
use std::io::Cursor;

// ── Shared recording state (Same structure as Groq for batch processing) ──────
#[derive(Default)]
pub struct DeepgramState {
    pub samples: Vec<f32>,
    pub sample_rate: u32,
}

pub type SharedDeepgramState = Arc<Mutex<DeepgramState>>;

// ── Start capturing (Batch mode) ──────────────────────────────────────────────
pub fn start_recording<R: Runtime>(
    app: AppHandle<R>,
    state: SharedDeepgramState,
    recording_flag: Arc<AtomicBool>,
) -> Result<(), String> {
    use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};

    // Reset buffer
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
            None => { let _ = app_stream.emit("recording-error", "Микрофон не найден"); return; }
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
        let emit_handle = app_stream.clone();

        let stream = device.build_input_stream(
            &config.into(),
            move |data: &[f32], _: &cpal::InputCallbackInfo| {
                if !flag_inner.load(Ordering::SeqCst) { return; }

                // Mono conversion
                let mono: Vec<f32> = data
                    .chunks(channels)
                    .map(|f| f.iter().sum::<f32>() / channels as f32)
                    .collect();

                // Visual feedback (audio levels)
                let rms = (mono.iter().map(|s| s * s).sum::<f32>() / mono.len() as f32).sqrt();
                let level = (rms * 10.0).min(1.0_f32);
                let _ = emit_handle.emit("audio-level", level);

                if let Ok(mut lock) = samples_ref.lock() {
                    lock.samples.extend_from_slice(&mono);
                }
            },
            |err| log::error!("cpal error: {}", err),
            None,
        );

        match stream {
            Ok(s) => {
                if let Err(e) = s.play() {
                    log::error!("Failed to start microphone stream: {}", e);
                    let _ = app_stream.emit("recording-error", "Не удалось запустить микрофон");
                    flag_cpal.store(false, Ordering::SeqCst);
                    return;
                }
                while flag_cpal.load(Ordering::SeqCst) {
                    std::thread::sleep(std::time::Duration::from_millis(50));
                }
            }
            Err(e) => {
                log::error!("Failed to build microphone stream: {}", e);
                let _ = app_stream.emit("recording-error", "Не удалось запустить микрофон");
                flag_cpal.store(false, Ordering::SeqCst);
            }
        }
    });

    Ok(())
}

// ── Stop recording & send to Deepgram REST API ────────────────────────────────
pub async fn stop_recording<R: Runtime>(
    app: &AppHandle<R>,
    state: SharedDeepgramState,
    recording_flag: Arc<AtomicBool>,
    api_key: String,
    language: &str,
    threshold: f32,
    gain: f32,
) -> Result<String, String> {
    // Small sleep to catch the last buffer segments
    tokio::time::sleep(std::time::Duration::from_millis(300)).await;
    recording_flag.store(false, Ordering::SeqCst);

    let (samples, src_rate) = {
        let mut lock = state.lock().map_err(|e| e.to_string())?;
        let data = lock.samples.clone();
        let rate = lock.sample_rate;
        lock.samples.clear();
        (data, rate)
    };

    let app_lang = crate::utils::app_language(app);

    if samples.is_empty() {
        log::debug!("Deepgram: no audio samples captured");
        crate::utils::emit_skip_reason(app, crate::utils::RecordingSkipReason::NoSamples, &app_lang);
        return Ok(String::new());
    }

    // Minimum duration: ~0.3s of audio at given sample rate
    let min_samples = (src_rate as f64 * 0.3) as usize;
    if samples.len() < min_samples {
        log::debug!("Deepgram: audio too short: {} samples (need {}), src_rate={}", samples.len(), min_samples, src_rate);
        crate::utils::emit_skip_reason(app, crate::utils::RecordingSkipReason::TooShort, &app_lang);
        return Ok(String::new());
    }

    // Apply software gain to boost quiet microphone signals
    let samples: Vec<f32> = samples.iter().map(|s| (s * gain).clamp(-1.0, 1.0)).collect();

    // Noise gate check
    let rms = (samples.iter().map(|s| s * s).sum::<f32>() / samples.len() as f32).sqrt();
    if rms < threshold {
        log::debug!("Deepgram: audio too quiet (RMS: {:.6} < threshold: {:.6}), skipping", rms, threshold);
        crate::utils::emit_skip_reason(app, crate::utils::RecordingSkipReason::TooQuiet, &app_lang);
        return Ok(String::new());
    }
    log::debug!("Deepgram: processing {} samples (RMS: {:.6}, lang: {}, src_rate: {})", samples.len(), rms, language, src_rate);

    // Resample to 16k (Deepgram standard)
    let processed_samples = crate::utils::resample_to_16k(&samples, src_rate, 16000);

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

        for &sample in &processed_samples {
            let val: f32 = sample * 32767.0;
            let amplitude = val.clamp(-32768.0, 32767.0) as i16;
            writer.write_sample(amplitude).map_err(|e| format!("Write sample error: {}", e))?;
        }
        writer.finalize().map_err(|e| format!("Wav finalize error: {}", e))?;
    }

    let wav_data = wav_cursor.into_inner();
    
    // REST API Request
    let client = reqwest::Client::builder()
        .connect_timeout(std::time::Duration::from_secs(8))
        .timeout(std::time::Duration::from_secs(25))
        .build()
        .map_err(|e| format!("Deepgram client init failed: {}", e))?;
    
    // Build query params
    let mut query_params: Vec<(&str, &str)> = vec![
        ("model", "nova-3-general"),
        ("smart_format", "true"),
        ("punctuate", "true"),
    ];
    
    if language == "mixed" {
        // nova-3 native multilingual code-switching: language=multi handles
        // Russian+English automatically. Using a custom `prompt` here would
        // be rejected ("No such model/language/tier combination found").
        query_params.push(("language", "multi"));
    } else {
        query_params.push(("language", language));
    }

    let api_key = api_key.trim_matches('"').trim_matches('\'').trim().to_string();
    if api_key.is_empty() {
        return Err("API ключ Deepgram не найден. Пожалуйста, проверьте настройки.".to_string());
    }

    let res = tokio::time::timeout(
        std::time::Duration::from_secs(20),
        client
            .post("https://api.deepgram.com/v1/listen")
            .header("Authorization", format!("Token {}", api_key))
            .header("Content-Type", "audio/wav")
            .query(&query_params)
            .body(wav_data)
            .send(),
    )
    .await
    .map_err(|_| "Deepgram: таймаут запроса (20с). Попробуйте ещё раз.".to_string())?
    .map_err(|e| format!("Deepgram request failed: {}", e))?;

    if !res.status().is_success() {
        let err_text = res.text().await.unwrap_or_default();
        return Err(format!("Deepgram API Error: {}", err_text));
    }

    // Parse JSON: results.channels[0].alternatives[0].transcript
    let json: serde_json::Value = res.json().await.map_err(|e| format!("Parse json failed: {}", e))?;
    let text = json["results"]["channels"][0]["alternatives"][0]["transcript"]
        .as_str()
        .unwrap_or("")
        .trim()
        .to_string();

    Ok(crate::utils::strip_filler_phrases(&crate::utils::clean_repetitive_phrases(&text)))
}
