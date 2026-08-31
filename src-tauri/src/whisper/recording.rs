// whisper/recording.rs — Microphone capture and stop+transcribe orchestration
//
// Owns the recording state, the cpal capture thread, and the async
// stop_recording flow that hands off audio to the transcription engine.

use std::sync::{
    atomic::{AtomicBool, AtomicU64, Ordering},
    Arc, Mutex,
};
use tauri::{AppHandle, Emitter, Manager, Runtime};

use crate::state::WhisperModelType;

// ── Recording state ─────────────────────────────────────────────────────────

#[derive(Default)]
pub struct RecordingState {
    pub samples: Vec<f32>,
    pub committed: usize,
    pub sample_rate: u32,
}

pub type SharedState = Arc<Mutex<RecordingState>>;

// ── Constants ───────────────────────────────────────────────────────────────

/// Audio-tail padding before killing the mic (ms). Prevents cutoff hallucination.
const AUDIO_TAIL_PADDING_MS: u64 = 500;
/// Minimum recording duration in seconds to consider for transcription.
const MIN_DURATION_SECS: f64 = 0.3;
/// Audio level emit throttle interval (ms).
const LEVEL_EMIT_INTERVAL_MS: u64 = 50;
/// Mic polling interval while recording (ms).
const MIC_POLL_INTERVAL_MS: u64 = 50;

// ── Start recording ─────────────────────────────────────────────────────────

/// Starts microphone capture. The audio is buffered in `state` until
/// `stop_recording` is called.
pub fn start_recording<R: Runtime>(
    app: AppHandle<R>,
    state: SharedState,
    recording_flag: Arc<AtomicBool>,
    processing_flag: Arc<AtomicBool>,
    _language: &str,
    _model_type: WhisperModelType,
) -> Result<(), String> {
    // Reset state before starting
    {
        let mut lock = state.lock().map_err(|e| e.to_string())?;
        lock.samples.clear();
        lock.committed = 0;
        lock.sample_rate = 0;
    }

    recording_flag.store(true, Ordering::SeqCst);
    processing_flag.store(false, Ordering::SeqCst);

    let sample_store = Arc::clone(&state);
    let flag_cpal = Arc::clone(&recording_flag);
    let app_stream = app.clone();

    // IMPORTANT: start the microphone first. Local Whisper/Metal/Core ML model
    // initialization can take seconds on cold start; doing it before cpal meant
    // the UI looked like recording while the mic was not yet capturing audio.
    // We capture immediately and warm the model in parallel because inference is
    // only needed after stop.

    spawn_capture_thread(sample_store, flag_cpal, app_stream);
    spawn_interim_stream_worker(app, state, recording_flag);

    // Do not warm the model here. On 8GB Macs, loading a large local model while
    // recording can cause memory pressure and even process termination. The mic
    // must start immediately; model loading happens after stop if it is not
    // already cached from a previous transcription.

    Ok(())
}

// ── Capture thread (extracted from start_recording) ─────────────────────────

/// Spawns the cpal microphone capture thread.
/// Reads audio in real-time, converts to mono, and stores samples in shared state.
/// Also emits audio level events to the frontend for the waveform visualizer.
fn spawn_capture_thread(
    sample_store: SharedState,
    flag_cpal: Arc<AtomicBool>,
    app_stream: AppHandle<impl Runtime>,
) {
    use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};

    std::thread::spawn(move || {
        let host = cpal::default_host();
        let device = match host.default_input_device() {
            Some(d) => d,
            None => {
                let _ = app_stream.emit("recording-error", "No mic");
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

        let stream = device.build_input_stream(
            &config.into(),
            move |data: &[f32], _: &cpal::InputCallbackInfo| {
                if !flag_inner.load(Ordering::SeqCst) {
                    return;
                }

                let mono: Vec<f32> = data
                    .chunks(channels)
                    .map(|f| f.iter().sum::<f32>() / channels as f32)
                    .collect();

                let rms = (mono.iter().map(|s| s * s).sum::<f32>() / mono.len() as f32).sqrt();
                let level = (rms * 10.0).min(1.0_f32);

                static LAST_EMIT_MS: AtomicU64 = AtomicU64::new(0);
                let now_ms = std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_millis() as u64;

                let last = LAST_EMIT_MS.load(Ordering::Relaxed);
                if now_ms - last > LEVEL_EMIT_INTERVAL_MS {
                    let _ = emit_handle.emit("audio-level", level);
                    LAST_EMIT_MS.store(now_ms, Ordering::Relaxed);
                }

                // ── VAD Silence Auto-Stop Detection ──────────────────────
                static SPEECH_STARTED: AtomicBool = AtomicBool::new(false);
                static LAST_SPEECH_TIME_MS: AtomicU64 = AtomicU64::new(0);

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

                    if rms >= noise_threshold {
                        SPEECH_STARTED.store(true, Ordering::SeqCst);
                        LAST_SPEECH_TIME_MS.store(now_ms, Ordering::Relaxed);
                    } else if SPEECH_STARTED.load(Ordering::SeqCst) {
                        let last_speech = LAST_SPEECH_TIME_MS.load(Ordering::Relaxed);
                        if last_speech > 0 && now_ms.saturating_sub(last_speech) >= (timeout_sec * 1000.0) as u64 {
                            SPEECH_STARTED.store(false, Ordering::SeqCst);
                            LAST_SPEECH_TIME_MS.store(0, Ordering::Relaxed);
                            log::info!("Whisper VAD: Continuous silence for {:.1}s detected, triggering auto-stop", timeout_sec);
                            let _ = emit_handle.emit("vad-auto-stop", ());
                        }
                    }
                } else {
                    SPEECH_STARTED.store(false, Ordering::Relaxed);
                    LAST_SPEECH_TIME_MS.store(0, Ordering::Relaxed);
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
                    std::thread::sleep(std::time::Duration::from_millis(MIC_POLL_INTERVAL_MS));
                }
            }
            Err(e) => {
                log::error!("Failed to build microphone stream: {}", e);
                let _ = app_stream.emit("recording-error", "Не удалось запустить микрофон");
                flag_cpal.store(false, Ordering::SeqCst);
            }
        }
    });
}

fn spawn_interim_stream_worker<R: Runtime>(
    app: AppHandle<R>,
    state: SharedState,
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
            let groq_key = {
                let keys_state = app.try_state::<crate::keys::ApiKeys>();
                keys_state
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
                    .unwrap_or_default()
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
                let resampled = crate::utils::resample_to_16k(&samples, sample_rate, 16000);
                let trimmed_audio = crate::utils::trim_silence(&resampled, 0.0025, 16000);
                if trimmed_audio.len() >= 6400 && !groq_key.is_empty() {
                    if let Ok(wav_data) = crate::utils::samples_to_wav(trimmed_audio, 16000) {
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
                                        let cleaned = crate::utils::clean_repetitive_phrases(text);
                                        let cleaned = crate::utils::remove_hallucinations(&cleaned);
                                        let trimmed = cleaned.trim();
                                        if !trimmed.is_empty() && flag_cpal.load(Ordering::SeqCst) {
                                            let _ = app.emit("interim-transcription", trimmed);
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

// ── Stop recording & transcribe ─────────────────────────────────────────────

/// Stops recording, waits for audio tail, resamples to 16kHz, and runs Whisper.
pub async fn stop_recording<R: Runtime>(
    app: &AppHandle<R>,
    state: SharedState,
    recording_flag: Arc<AtomicBool>,
    language: &str,
    model_type: WhisperModelType,
    threshold: f32,
    gain: f32,
) -> Result<String, String> {
    // VAD FIX: Wait for audio tail padding before killing the microphone
    // to capture the trailing audio of the last word, preventing the model
    // from hallucinating a cutoff word.
    tokio::time::sleep(std::time::Duration::from_millis(AUDIO_TAIL_PADDING_MS)).await;
    recording_flag.store(false, Ordering::SeqCst);

    let (raw_samples, src_rate) = {
        let mut lock = state.lock().map_err(|e| e.to_string())?;
        let tail = lock.samples.clone();
        let rate = lock.sample_rate;
        lock.samples.clear();
        lock.committed = 0;
        (tail, rate)
    };

    let app_lang = crate::utils::app_language(app);

    if raw_samples.is_empty() {
        log::debug!("No audio samples captured");
        crate::utils::emit_skip_reason(
            app,
            crate::utils::RecordingSkipReason::NoSamples,
            &app_lang,
        );
        return Ok(String::new());
    }

    // Minimum duration check
    let min_samples = (src_rate as f64 * MIN_DURATION_SECS) as usize;
    if raw_samples.len() < min_samples {
        log::debug!(
            "Audio too short: {} samples (need {}), src_rate={}",
            raw_samples.len(),
            min_samples,
            src_rate
        );
        crate::utils::emit_skip_reason(app, crate::utils::RecordingSkipReason::TooShort, &app_lang);
        return Ok(String::new());
    }

    // Apply software gain to boost quiet microphone signals.
    // This helps speech at arm's distance pass the noise gate threshold.
    let samples: Vec<f32> = raw_samples
        .iter()
        .map(|s| (s * gain).clamp(-1.0, 1.0))
        .collect();

    // Noise gate
    let rms = (samples.iter().map(|s| s * s).sum::<f32>() / samples.len() as f32).sqrt();
    if rms < threshold {
        log::debug!(
            "Audio too quiet (RMS: {} < threshold: {}), skipping",
            rms,
            threshold
        );
        crate::utils::emit_skip_reason(app, crate::utils::RecordingSkipReason::TooQuiet, &app_lang);
        return Ok(String::new());
    }

    let whisper_samples = crate::utils::resample_to_16k(&samples, src_rate, 16000);
    let lang_str = language.to_string();
    log::debug!(
        "Processing {} samples (RMS: {}, lang: {}, src_rate: {})",
        whisper_samples.len(),
        rms,
        lang_str,
        src_rate
    );
    let t_total = std::time::Instant::now();
    let result = tokio::task::spawn_blocking(move || {
        super::transcribe::run_whisper(&whisper_samples, &lang_str, model_type)
    })
    .await
    .map_err(|e| format!("Thread error: {}", e))?;
    log::debug!("Total stop_recording time: {:?}", t_total.elapsed());
    result
}
