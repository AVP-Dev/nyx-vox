use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc, Mutex,
};
use tauri::{AppHandle, Emitter, Manager, Runtime};

use crate::state::AudioBuffer;

pub type SharedDeepgramState = Arc<Mutex<AudioBuffer>>;

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
            None => {
                let _ = app_stream.emit("recording-error", "Микрофон не найден");
                return;
            }
        };
        let config = match device.default_input_config() {
            Ok(c) => c,
            Err(e) => {
                let _ = app_stream.emit("recording-error", e.to_string());
                return;
            }
        };

        let channels = config.channels() as usize;
        let actual_sample_rate = config.sample_rate().0;

        if let Ok(mut lock) = sample_store.lock() {
            lock.sample_rate = actual_sample_rate;
        }

        let samples_ref = Arc::clone(&sample_store);
        let flag_inner = Arc::clone(&flag_cpal);
        let emit_handle = app_stream.clone();
        let mut vad_tracker = crate::utils::VadTracker::new();

        let stream = device.build_input_stream(
            &config.into(),
            move |data: &[f32], _: &cpal::InputCallbackInfo| {
                if !flag_inner.load(Ordering::SeqCst) {
                    return;
                }

                // Mono conversion
                let mono: Vec<f32> = data
                    .chunks(channels)
                    .map(|f| f.iter().sum::<f32>() / channels as f32)
                    .collect();

                // Visual feedback (audio levels) — throttled to 50ms
                let rms = (mono.iter().map(|s| s * s).sum::<f32>() / mono.len() as f32).sqrt();
                let level = (rms * 10.0).min(1.0_f32);

                use std::sync::atomic::AtomicU64;
                static LAST_EMIT_MS: AtomicU64 = AtomicU64::new(0);
                let now_ms = std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_millis() as u64;

                let last = LAST_EMIT_MS.load(Ordering::Relaxed);
                if now_ms - last > 50 {
                    let _ = emit_handle.emit("audio-level", level);
                    LAST_EMIT_MS.store(now_ms, Ordering::Relaxed);
                }

                // VAD Silence Auto-Stop
                let vad_enabled = emit_handle
                    .try_state::<crate::state::VadAutoStop>()
                    .and_then(|s| s.0.lock().ok().map(|l| *l))
                    .unwrap_or(false);

                if vad_enabled {
                    let noise_threshold = emit_handle
                        .try_state::<crate::state::NoiseGateThreshold>()
                        .and_then(|s| s.0.lock().ok().map(|l| *l))
                        .unwrap_or(0.002);
                    let timeout_sec = emit_handle
                        .try_state::<crate::state::VadSilenceTimeout>()
                        .and_then(|s| s.0.lock().ok().map(|l| *l))
                        .unwrap_or(7.0);

                    if vad_tracker.update(&mono, noise_threshold, timeout_sec) {
                        log::info!(
                            "Deepgram VAD: Continuous silence for {:.1}s detected, triggering auto-stop",
                            timeout_sec
                        );
                        let _ = emit_handle.emit("vad-auto-stop", ());
                    }
                }

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

    spawn_interim_stream_worker(app, state, recording_flag);

    Ok(())
}

fn spawn_interim_stream_worker<R: Runtime>(
    app: AppHandle<R>,
    state: SharedDeepgramState,
    flag_cpal: Arc<AtomicBool>,
) {
    tauri::async_runtime::spawn(async move {
        tokio::time::sleep(std::time::Duration::from_millis(1500)).await;

        let client = match reqwest::Client::builder()
            .timeout(std::time::Duration::from_millis(2000))
            .build()
        {
            Ok(c) => c,
            Err(_) => return,
        };

        while flag_cpal.load(Ordering::SeqCst) {
            let (dg_key, groq_key): (String, String) = {
                let keys_state = app.try_state::<crate::keys::ApiKeys>();
                let dg = keys_state
                    .as_ref()
                    .and_then(|k| k.0.lock().ok())
                    .and_then(
                        |m: std::sync::MutexGuard<
                            '_,
                            std::collections::HashMap<crate::keys::Service, Option<String>>,
                        >| {
                            m.get(&crate::keys::Service::Deepgram).cloned().flatten()
                        },
                    )
                    .unwrap_or_default();
                let groq = keys_state
                    .as_ref()
                    .and_then(|k| k.0.lock().ok())
                    .and_then(
                        |m: std::sync::MutexGuard<
                            '_,
                            std::collections::HashMap<crate::keys::Service, Option<String>>,
                        >| {
                            m.get(&crate::keys::Service::Groq).cloned().flatten()
                        },
                    )
                    .unwrap_or_default();
                (dg, groq)
            };

            let data_opt = {
                state
                    .lock()
                    .ok()
                    .map(|lock| (lock.samples.clone(), lock.sample_rate))
            };

            let (samples, sample_rate) = match data_opt {
                Some(d) => d,
                None => {
                    tokio::time::sleep(std::time::Duration::from_millis(800)).await;
                    continue;
                }
            };

            if sample_rate > 0 && samples.len() >= (sample_rate as usize) {
                // Speech presence check: do not query STT on silence to prevent hallucinations
                let frame_size = (sample_rate / 20).max(1) as usize;
                let mut peak_rms: f32 = 0.0;
                for chunk in samples.chunks(frame_size) {
                    let chunk_rms =
                        (chunk.iter().map(|s| s * s).sum::<f32>() / chunk.len() as f32).sqrt();
                    if chunk_rms > peak_rms {
                        peak_rms = chunk_rms;
                    }
                }
                if peak_rms < 0.0012 {
                    tokio::time::sleep(std::time::Duration::from_millis(800)).await;
                    continue;
                }

                let resampled = crate::utils::resample_to_16k(&samples, sample_rate, 16000);
                let trimmed_audio = crate::utils::trim_silence(&resampled, 0.0025, 16000);
                if trimmed_audio.len() >= 6400 {
                    if let Ok(wav_data) = crate::utils::samples_to_wav(trimmed_audio, 16000) {
                        if !groq_key.is_empty() {
                            let part = reqwest::multipart::Part::bytes(wav_data)
                                .file_name("interim.wav")
                                .mime_str("audio/wav")
                                .unwrap();
                            let form = reqwest::multipart::Form::new()
                                .part("file", part)
                                .text("model", "whisper-large-v3-turbo")
                                .text("language", "ru".to_string());
                            if let Ok(res) = client
                                .post("https://api.groq.com/openai/v1/audio/transcriptions")
                                .header("Authorization", format!("Bearer {}", groq_key))
                                .multipart(form)
                                .send()
                                .await
                            {
                                if res.status().is_success() {
                                    if let Ok(json) = res.json::<serde_json::Value>().await {
                                        if let Some(text) = json["text"].as_str() {
                                            let cleaned =
                                                crate::utils::clean_repetitive_phrases(text);
                                            let cleaned =
                                                crate::utils::remove_hallucinations(&cleaned);
                                            let trimmed = cleaned.trim();
                                            if !trimmed.is_empty()
                                                && flag_cpal.load(Ordering::SeqCst)
                                            {
                                                let _ = app.emit("interim-transcription", trimmed);
                                            }
                                        }
                                    }
                                }
                            }
                        } else if !dg_key.is_empty() {
                            let url = "https://api.deepgram.com/v1/listen?model=nova-2&language=ru&smart_format=true";
                            if let Ok(res) = client
                                .post(url)
                                .header("Authorization", format!("Token {}", dg_key))
                                .header("Content-Type", "audio/wav")
                                .body(wav_data)
                                .send()
                                .await
                            {
                                if res.status().is_success() {
                                    if let Ok(json) = res.json::<serde_json::Value>().await {
                                        if let Some(text) = json["results"]["channels"][0]
                                            ["alternatives"][0]["transcript"]
                                            .as_str()
                                        {
                                            let cleaned =
                                                crate::utils::clean_repetitive_phrases(text);
                                            let cleaned =
                                                crate::utils::remove_hallucinations(&cleaned);
                                            let trimmed = cleaned.trim();
                                            if !trimmed.is_empty()
                                                && flag_cpal.load(Ordering::SeqCst)
                                            {
                                                let _ = app.emit("interim-transcription", trimmed);
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }

            tokio::time::sleep(std::time::Duration::from_millis(1600)).await;
        }
    });
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
        crate::utils::emit_skip_reason(
            app,
            crate::utils::RecordingSkipReason::NoSamples,
            &app_lang,
        );
        return Ok(String::new());
    }

    // Minimum duration: ~0.3s of audio at given sample rate
    let min_samples = (src_rate as f64 * 0.3) as usize;
    if samples.len() < min_samples {
        log::debug!(
            "Deepgram: audio too short: {} samples (need {}), src_rate={}",
            samples.len(),
            min_samples,
            src_rate
        );
        crate::utils::emit_skip_reason(app, crate::utils::RecordingSkipReason::TooShort, &app_lang);
        return Ok(String::new());
    }

    // Apply software gain to boost quiet microphone signals
    let samples: Vec<f32> = samples
        .iter()
        .map(|s| (s * gain).clamp(-1.0, 1.0))
        .collect();

    // Noise gate check: detect speech presence via peak frame energy (50ms)
    let frame_size = (src_rate / 20).max(1) as usize;
    let mut peak_frame_rms: f32 = 0.0;
    for chunk in samples.chunks(frame_size) {
        let chunk_rms = (chunk.iter().map(|s| s * s).sum::<f32>() / chunk.len() as f32).sqrt();
        if chunk_rms > peak_frame_rms {
            peak_frame_rms = chunk_rms;
        }
    }
    if peak_frame_rms < (threshold * 0.25).max(0.0003) {
        log::debug!(
            "Deepgram: audio too quiet (Peak RMS: {:.6} < min: {:.6}), skipping",
            peak_frame_rms,
            (threshold * 0.25).max(0.0003)
        );
        crate::utils::emit_skip_reason(app, crate::utils::RecordingSkipReason::TooQuiet, &app_lang);
        return Ok(String::new());
    }
    log::debug!(
        "Deepgram: processing {} samples (Peak RMS: {:.6}, lang: {}, src_rate: {})",
        samples.len(),
        peak_frame_rms,
        language,
        src_rate
    );

    // Resample to 16k (Deepgram standard)
    let processed_samples = crate::utils::resample_to_16k(&samples, src_rate, 16000);
    let wav_data = crate::utils::samples_to_wav(&processed_samples, 16000)?;

    // REST API Request
    let client = reqwest::Client::builder()
        .connect_timeout(std::time::Duration::from_secs(8))
        .timeout(std::time::Duration::from_secs(25))
        .build()
        .map_err(|e| format!("Deepgram client init failed: {}", e))?;

    // Build query params
    let mut query_params: Vec<(&str, &str)> = vec![
        ("model", "nova-2-general"),
        ("smart_format", "true"),
        ("punctuate", "true"),
    ];

    if language == "mixed" {
        // native multilingual code-switching: language=multi handles
        // Russian+English automatically. Using a custom `prompt` here would
        // be rejected ("No such model/language/tier combination found").
        query_params.push(("language", "multi"));
    } else {
        query_params.push(("language", language));
    }

    let api_key = api_key
        .trim_matches('"')
        .trim_matches('\'')
        .trim()
        .to_string();
    if api_key.is_empty() {
        return Err("API ключ Deepgram не найден. Пожалуйста, проверьте настройки.".to_string());
    }

    // Try the configured model first; some account tiers reject a specific
    // model/language combination, so fall back to the other nova generation.
    let models = ["nova-2-general", "nova-3-general"];
    let mut last_err = String::new();
    let mut response = None;

    for model in models {
        let mut params = query_params.clone();
        for (k, v) in params.iter_mut() {
            if *k == "model" {
                *v = model;
            }
        }

        match tokio::time::timeout(
            std::time::Duration::from_secs(20),
            client
                .post("https://api.deepgram.com/v1/listen")
                .header("Authorization", format!("Token {}", api_key))
                .header("Content-Type", "audio/wav")
                .query(&params)
                .body(wav_data.clone())
                .send(),
        )
        .await
        {
            Ok(Ok(resp)) => {
                if resp.status().is_success() {
                    response = Some(resp);
                    break;
                }
                let err_text = resp.text().await.unwrap_or_default();
                // If the combination is invalid, try the other model; otherwise stop.
                if !err_text.contains("No such model/language/tier combination") {
                    return Err(format!("Deepgram API Error: {}", err_text));
                }
                last_err = err_text;
            }
            Ok(Err(e)) => {
                last_err = format!("Deepgram request failed: {}", e);
                break;
            }
            Err(_) => {
                last_err = "Deepgram: таймаут запроса (20с). Попробуйте ещё раз.".to_string();
                break;
            }
        }
    }

    let Some(res) = response else {
        return Err(format!("Deepgram API Error: {}", last_err));
    };

    // Parse JSON: results.channels[0].alternatives[0].transcript
    let json: serde_json::Value = res
        .json()
        .await
        .map_err(|e| format!("Parse json failed: {}", e))?;
    let text = json["results"]["channels"][0]["alternatives"][0]["transcript"]
        .as_str()
        .unwrap_or("")
        .trim()
        .to_string();

    Ok(crate::utils::strip_filler_phrases(
        &crate::utils::clean_repetitive_phrases(&text),
    ))
}
