// whisper/recording.rs — Microphone capture and stop+transcribe orchestration
//
// Owns the recording state, the cpal capture thread, and the async
// stop_recording flow that hands off audio to the transcription engine.

use std::sync::{
    atomic::{AtomicBool, Ordering},
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
const AUDIO_TAIL_PADDING_MS: u64 = 150;
/// Minimum recording duration in seconds to consider for transcription.
const MIN_DURATION_SECS: f64 = 0.3;
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

    spawn_capture_thread(sample_store, flag_cpal.clone(), app_stream.clone());
    spawn_interim_stream_worker(app, state, flag_cpal);

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
                log::error!("No input audio device found");
                let _ = app_stream.emit("recording-error", "Микрофон не найден");
                flag_cpal.store(false, Ordering::SeqCst);
                return;
            }
        };
        let config = match device.default_input_config() {
            Ok(c) => c,
            Err(e) => {
                log::error!("Failed to get default input config: {}", e);
                let _ = app_stream.emit("recording-error", "Ошибка настройки микрофона");
                flag_cpal.store(false, Ordering::SeqCst);
                return;
            }
        };

        let channels = config.channels() as usize;
        let sample_rate = config.sample_rate().0;

        {
            if let Ok(mut lock) = sample_store.lock() {
                lock.sample_rate = sample_rate;
            }
        }

        let samples_ref = Arc::clone(&sample_store);
        let emit_handle = app_stream.clone();

        let mut vad_tracker = crate::utils::VadTracker::new();
        let mut pre_speech_ring = crate::utils::PreSpeechRingBuffer::new(300, sample_rate);
        let mut speech_flushed = false;

        let stream = device.build_input_stream(
            &config.into(),
            move |data: &[f32], _: &cpal::InputCallbackInfo| {
                let mono: Vec<f32> = data
                    .chunks(channels)
                    .map(|chunk| chunk.iter().sum::<f32>() / channels as f32)
                    .collect();

                let frame_size = (sample_rate / 20).max(1) as usize;
                let mut peak_rms: f32 = 0.0;
                for chunk in mono.chunks(frame_size) {
                    let rms =
                        (chunk.iter().map(|s| s * s).sum::<f32>() / chunk.len() as f32).sqrt();
                    if rms > peak_rms {
                        peak_rms = rms;
                    }
                }
                let _ = emit_handle.emit("audio-level", peak_rms);

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
                            "Local VAD: Continuous silence for {:.1}s detected, triggering auto-stop",
                            timeout_sec
                        );
                        let _ = emit_handle.emit("vad-auto-stop", ());
                    }
                }

                if let Ok(mut lock) = samples_ref.lock() {
                    // Pre-speech padding: if speech just started, flush the rolling 300ms pre-speech buffer
                    if vad_tracker.speech_started && !speech_flushed {
                        let pre_samples = pre_speech_ring.extract();
                        if !pre_samples.is_empty() && lock.samples.is_empty() {
                            lock.samples.extend_from_slice(&pre_samples);
                        }
                        speech_flushed = true;
                    } else if !vad_tracker.speech_started {
                        pre_speech_ring.push(&mono);
                    }
                    lock.samples.extend_from_slice(&mono);
                }
            },
            |err| log::error!("cpal error: {}", err),
            None,
        );

        match stream {
            Ok(s) => {
                let _ = s.play();
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
        tokio::time::sleep(std::time::Duration::from_millis(400)).await;

        let client = crate::utils::shared_http_client();
        let is_inflight = Arc::new(AtomicBool::new(false));

        while flag_cpal.load(Ordering::SeqCst) {
            let groq_key = {
                let keys_state = app.try_state::<crate::keys::ApiKeys>();
                keys_state
                    .as_ref()
                    .and_then(|k| k.0.lock().ok())
                    .and_then(|m| m.get(&crate::keys::Service::Groq).cloned().flatten())
                    .unwrap_or_default()
            };

            if groq_key.is_empty() {
                break;
            }

            // Backpressure check: if previous interim request is still in flight, skip this tick
            if is_inflight.load(Ordering::SeqCst) {
                tokio::time::sleep(std::time::Duration::from_millis(150)).await;
                continue;
            }

            let data_opt = {
                state
                    .lock()
                    .ok()
                    .map(|lock| (lock.samples.clone(), lock.sample_rate))
            };

            let (samples, sample_rate) = match data_opt {
                Some(d) => d,
                None => {
                    tokio::time::sleep(std::time::Duration::from_millis(250)).await;
                    continue;
                }
            };

            if sample_rate > 0 && samples.len() >= (sample_rate as usize / 3) {
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
                    tokio::time::sleep(std::time::Duration::from_millis(350)).await;
                    continue;
                }

                let resampled = crate::utils::resample_to_16k(&samples, sample_rate, 16000);
                let trimmed_audio = crate::utils::trim_silence(&resampled, 0.0025, 16000);
                if trimmed_audio.len() >= 4800 && !groq_key.is_empty() {
                    if let Ok(wav_data) = crate::utils::samples_to_wav(trimmed_audio, 16000) {
                        if let Ok(part) = reqwest::multipart::Part::bytes(wav_data)
                            .file_name("interim.wav")
                            .mime_str("audio/wav")
                        {
                            let form = reqwest::multipart::Form::new()
                                .part("file", part)
                                .text("model", "whisper-large-v3-turbo")
                                .text("language", "ru".to_string())
                                .text("prompt", crate::prompts::GROQ_STT_PROMPT.to_string())
                                .text("temperature", "0.0");

                            let app_emit = app.clone();
                            let flag_check = flag_cpal.clone();
                            let inflight_guard = is_inflight.clone();
                            inflight_guard.store(true, Ordering::SeqCst);

                            let client_req = client.clone();
                            let key = groq_key.clone();

                            tauri::async_runtime::spawn(async move {
                                if let Ok(res) = client_req
                                    .post("https://api.groq.com/openai/v1/audio/transcriptions")
                                    .header("Authorization", format!("Bearer {}", key))
                                    .multipart(form)
                                    .send()
                                    .await
                                {
                                    let status = res.status();
                                    if status.is_success() {
                                        if let Ok(json) = res.json::<serde_json::Value>().await {
                                            if let Some(text) = json["text"].as_str() {
                                                let cleaned =
                                                    crate::utils::clean_repetitive_phrases(text);
                                                let cleaned =
                                                    crate::utils::remove_hallucinations(&cleaned);
                                                let trimmed = cleaned.trim();
                                                if !trimmed.is_empty()
                                                    && flag_check.load(Ordering::SeqCst)
                                                {
                                                    let _ = app_emit
                                                        .emit("interim-transcription", trimmed);
                                                }
                                            }
                                        }
                                    } else if status.as_u16() == 429 {
                                        log::warn!("Groq interim STT: rate limited (429), pausing interim stream for 1.5s");
                                        tokio::time::sleep(std::time::Duration::from_millis(1500))
                                            .await;
                                    }
                                }
                                inflight_guard.store(false, Ordering::SeqCst);
                            });
                        }
                    }
                }
            }

            tokio::time::sleep(std::time::Duration::from_millis(650)).await;
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

    // Noise gate: detect speech presence via peak frame energy (50ms)
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
            "Whisper: audio too quiet (Peak RMS: {:.6} < min: {:.6}), skipping",
            peak_frame_rms,
            (threshold * 0.25).max(0.0003)
        );
        crate::utils::emit_skip_reason(app, crate::utils::RecordingSkipReason::TooQuiet, &app_lang);
        return Ok(String::new());
    }

    let whisper_samples = crate::utils::resample_to_16k(&samples, src_rate, 16000);
    let lang_str = language.to_string();
    log::debug!(
        "Processing {} samples (Peak RMS: {:.6}, lang: {}, src_rate: {})",
        whisper_samples.len(),
        peak_frame_rms,
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
