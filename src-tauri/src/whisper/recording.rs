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
    pub committed_samples_len: usize,
    pub committed_text: String,
    pub overlap_samples: Vec<f32>,
    pub sample_rate: u32,
    pub is_committing: Arc<AtomicBool>,
}

pub type SharedState = Arc<Mutex<RecordingState>>;

// ── Constants ───────────────────────────────────────────────────────────────

/// Audio-tail padding before killing the mic (ms). Prevents cutoff hallucination.
const AUDIO_TAIL_PADDING_MS: u64 = 150;
/// Minimum useful audio duration in seconds required by Acoustic Guard.
const ACOUSTIC_GUARD_MIN_SECS: f32 = 0.350;
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
    language: &str,
    model_type: WhisperModelType,
) -> Result<(), String> {
    // Reset state before starting
    {
        let mut lock = state.lock().map_err(|e| e.to_string())?;
        lock.samples.clear();
        lock.committed_samples_len = 0;
        lock.committed_text.clear();
        lock.overlap_samples.clear();
        lock.sample_rate = 0;
        lock.is_committing = Arc::new(AtomicBool::new(false));
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
    spawn_interim_stream_worker(app, state, flag_cpal, language.to_string(), model_type);

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
    language: String,
    model_type: WhisperModelType,
) {
    tauri::async_runtime::spawn(async move {
        tokio::time::sleep(std::time::Duration::from_millis(300)).await;

        let client = crate::utils::shared_http_client();
        let is_inflight = Arc::new(AtomicBool::new(false));
        let mut cloud_first_chunk_sent = false;

        while flag_cpal.load(Ordering::SeqCst) {
            let groq_key = {
                let keys_state = app.try_state::<crate::keys::ApiKeys>();
                keys_state
                    .as_ref()
                    .and_then(|k| k.0.lock().ok())
                    .and_then(|m| m.get(&crate::keys::Service::Groq).cloned().flatten())
                    .unwrap_or_default()
            };

            let has_groq = !groq_key.is_empty();

            if has_groq {
                // ── Cloud API STT Interim Worker (Groq priority, as in main) ──
                let interval_ms = if !cloud_first_chunk_sent { 450 } else { 600 };
                tokio::time::sleep(std::time::Duration::from_millis(interval_ms)).await;

                if is_inflight.load(Ordering::SeqCst) {
                    continue;
                }

                let (samples, sample_rate) = {
                    match state.lock().ok() {
                        Some(lock) => (lock.samples.clone(), lock.sample_rate),
                        None => (Vec::new(), 0),
                    }
                };

                let min_samples = (sample_rate as usize * 35) / 100;
                if sample_rate > 0 && samples.len() >= min_samples {
                    let resampled = crate::utils::resample_to_16k(&samples, sample_rate, 16000);
                    let trimmed = crate::utils::trim_silence(&resampled, 0.0025, 16000);
                    if trimmed.len() as f32 / 16000.0 >= 0.350 {
                        let overall_rms = (trimmed.iter().map(|s| s * s).sum::<f32>()
                            / trimmed.len().max(1) as f32)
                            .sqrt();
                        if overall_rms >= 0.003 {
                            if let Ok(wav_data) = crate::utils::samples_to_wav(trimmed, 16000) {
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
                                    cloud_first_chunk_sent = true;

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
                                            if res.status().is_success() {
                                                if let Ok(json) = res.json::<serde_json::Value>().await {
                                                    if let Some(text) = json["text"].as_str() {
                                                        let trimmed = crate::utils::remove_hallucinations(
                                                            &crate::utils::clean_repetitive_phrases(text),
                                                        )
                                                        .trim()
                                                        .to_string();
                                                        if flag_check.load(Ordering::SeqCst) && !trimmed.is_empty() {
                                                            let _ = app_emit.emit("interim-transcription", trimmed);
                                                        }
                                                    }
                                                }
                                            } else if res.status().as_u16() == 429 {
                                                tokio::time::sleep(std::time::Duration::from_millis(1500)).await;
                                            }
                                        }
                                        inflight_guard.store(false, Ordering::SeqCst);
                                    });
                                }
                            }
                        }
                    }
                }
            } else {
                // ── Offline Whisper Local Stream Fallback (800 ms interval) ──
                tokio::time::sleep(std::time::Duration::from_millis(800)).await;

                if is_inflight.load(Ordering::SeqCst) {
                    continue;
                }

                let data_opt = {
                    state.lock().ok().map(|lock| {
                        let tail = if lock.committed_samples_len < lock.samples.len() {
                            lock.samples[lock.committed_samples_len..].to_vec()
                        } else {
                            Vec::new()
                        };
                        (
                            tail,
                            lock.committed_samples_len,
                            lock.committed_text.clone(),
                            lock.overlap_samples.clone(),
                            lock.sample_rate,
                            Arc::clone(&lock.is_committing),
                        )
                    })
                };

                let (
                    uncommitted,
                    current_c_len,
                    committed_snap,
                    overlap_snap,
                    sample_rate,
                    is_committing_flag,
                ) = match data_opt {
                    Some(d) => d,
                    None => continue,
                };

                if sample_rate == 0 || uncommitted.is_empty() {
                    continue;
                }

                // Window fixed to last 2.5–3.0 seconds to prevent growing audio array
                let max_window_samples = sample_rate as usize * 3;
                let chunk_raw = if uncommitted.len() > max_window_samples {
                    uncommitted[uncommitted.len() - max_window_samples..].to_vec()
                } else {
                    uncommitted.clone()
                };

                // Acoustic Guard
                let resampled = crate::utils::resample_to_16k(&chunk_raw, sample_rate, 16000);
                let trimmed = crate::utils::trim_silence(&resampled, 0.0025, 16000).to_vec();
                if trimmed.len() as f32 / 16000.0 < 0.350 {
                    continue;
                }
                let overall_rms = (trimmed.iter().map(|s| s * s).sum::<f32>()
                    / trimmed.len().max(1) as f32)
                    .sqrt();
                if overall_rms < 0.003 {
                    continue;
                }

                // Check pause or hard cutoff for rolling commit
                let pause_window = (sample_rate as usize * 6) / 10;
                let pause_slice = &uncommitted[uncommitted.len().saturating_sub(pause_window)..];
                let pause_rms = (pause_slice.iter().map(|s| s * s).sum::<f32>()
                    / pause_slice.len().max(1) as f32)
                    .sqrt();
                let is_paused = pause_rms < 0.0022;
                let is_hard_cutoff = uncommitted.len() >= (sample_rate as usize * 12);
                let min_commit_samples = (sample_rate as usize * 12) / 10;

                is_inflight.store(true, Ordering::SeqCst);
                let should_commit =
                    uncommitted.len() >= min_commit_samples && (is_paused || is_hard_cutoff);
                if should_commit {
                    is_committing_flag.store(true, Ordering::SeqCst);
                }

                let state_ref = Arc::clone(&state);
                let app_emit = app.clone();
                let lang_str = language.clone();
                let flag_check = flag_cpal.clone();
                let inflight_guard = is_inflight.clone();
                let committing_guard = is_committing_flag.clone();

                tauri::async_runtime::spawn(async move {
                    let mut input = Vec::with_capacity(overlap_snap.len() + trimmed.len());
                    input.extend_from_slice(&overlap_snap);
                    input.extend_from_slice(&trimmed);

                    let context_prompt = crate::utils::get_last_n_words(&committed_snap, 10);
                    let result = tokio::task::spawn_blocking(move || {
                        super::transcribe::run_whisper_with_prompt(
                            &input,
                            &lang_str,
                            model_type,
                            if context_prompt.is_empty() {
                                None
                            } else {
                                Some(&context_prompt)
                            },
                        )
                    })
                    .await;

                    if let Ok(Ok(chunk_text)) = result {
                        let trimmed_draft = chunk_text.trim();
                        if !trimmed_draft.is_empty() {
                            // Concatenate committed base + active draft for seamless unbroken display
                            let live_display_text = if committed_snap.is_empty() {
                                trimmed_draft.to_string()
                            } else {
                                crate::utils::safe_space_concatenate(&committed_snap, trimmed_draft)
                            };

                            if flag_check.load(Ordering::SeqCst) {
                                let _ = app_emit.emit("interim-transcription", live_display_text);
                            }

                            // Advance committed index if pause or hard cutoff occurred
                            if should_commit {
                                let cut_offset = if is_hard_cutoff {
                                    crate::utils::find_local_energy_minimum(
                                        &uncommitted,
                                        sample_rate,
                                        10.0,
                                        12.0,
                                    )
                                } else {
                                    uncommitted.len().saturating_sub(pause_window / 2)
                                };

                                if cut_offset >= (sample_rate as usize * 8) / 10 {
                                    let new_committed_len = current_c_len + cut_offset;
                                    let overlap_keep = if trimmed.len() >= 6400 {
                                        trimmed[trimmed.len() - 6400..].to_vec()
                                    } else {
                                        trimmed.to_vec()
                                    };
                                    let combined = crate::utils::deduplicate_chunk_boundary(
                                        &committed_snap,
                                        trimmed_draft,
                                    );
                                    if let Ok(mut lock) = state_ref.lock() {
                                        lock.committed_text = combined;
                                        lock.committed_samples_len = new_committed_len;
                                        lock.overlap_samples = overlap_keep;
                                    }
                                }
                            }
                        }
                    }

                    committing_guard.store(false, Ordering::SeqCst);
                    inflight_guard.store(false, Ordering::SeqCst);
                });
            }
        }
    });
}

// ── Stop recording & transcribe ─────────────────────────────────────────────

/// Stops recording, waits for audio tail padding, transcribes ONLY uncommitted tail (Rolling Commit),
/// applies Acoustic Guard & Tail Guard, and performs Suffix-Prefix deduplication.
pub async fn stop_recording<R: Runtime>(
    _app: &AppHandle<R>,
    state: SharedState,
    recording_flag: Arc<AtomicBool>,
    language: &str,
    model_type: WhisperModelType,
    threshold: f32,
    gain: f32,
) -> Result<String, String> {
    // VAD FIX: Wait for audio tail padding (150-200ms) before stopping capture
    tokio::time::sleep(std::time::Duration::from_millis(AUDIO_TAIL_PADDING_MS)).await;
    recording_flag.store(false, Ordering::SeqCst);

    // Nuance 2: Wait if background worker is currently committing a chunk on Metal
    let is_committing_flag = state.lock().ok().map(|l| Arc::clone(&l.is_committing));
    if let Some(flag) = is_committing_flag {
        let wait_start = std::time::Instant::now();
        while flag.load(Ordering::SeqCst) && wait_start.elapsed().as_millis() < 600 {
            tokio::time::sleep(std::time::Duration::from_millis(25)).await;
        }
    }

    let (committed_text, overlap_samples, tail_samples, src_rate) = {
        let mut lock = state.lock().map_err(|e| e.to_string())?;
        let committed = std::mem::take(&mut lock.committed_text);
        let overlap = std::mem::take(&mut lock.overlap_samples);
        let c_len = lock.committed_samples_len;
        let tail = if c_len < lock.samples.len() {
            lock.samples[c_len..].to_vec()
        } else {
            Vec::new()
        };
        let rate = lock.sample_rate;
        lock.samples.clear();
        lock.committed_samples_len = 0;
        (committed, overlap, tail, rate)
    };

    // Apply software gain to boost quiet microphone signals.
    let samples: Vec<f32> = tail_samples
        .iter()
        .map(|s| (s * gain).clamp(-1.0, 1.0))
        .collect();

    // Resample raw tail to 16 kHz
    let resampled_tail = crate::utils::resample_to_16k(&samples, src_rate, 16000);

    // VAD Silence Trimming: Trim trailing silence accumulated by VAD auto-stop or user pause.
    let trimmed_tail = crate::utils::trim_silence(&resampled_tail, threshold.max(0.0025), 16000);

    // Acoustic Guard: If uncommitted tail is empty or < ACOUSTIC_GUARD_MIN_SECS (350ms) after trimming silence,
    // skip Whisper inference entirely. Return committed text directly in 0ms!
    let tail_duration_secs = trimmed_tail.len() as f32 / 16000.0;
    if trimmed_tail.is_empty() || tail_duration_secs < ACOUSTIC_GUARD_MIN_SECS {
        log::debug!(
            "stop_recording: Acoustic Guard / Tail Guard (duration {:.3}s < {:.3}s), returning committed text directly (len={})",
            tail_duration_secs,
            ACOUSTIC_GUARD_MIN_SECS,
            committed_text.len()
        );
        return Ok(committed_text);
    }

    // Acoustic Guard: detect speech presence via overall RMS energy
    let overall_rms =
        (trimmed_tail.iter().map(|s| s * s).sum::<f32>() / trimmed_tail.len().max(1) as f32).sqrt();
    if overall_rms < 0.003 {
        log::debug!(
            "Whisper: tail audio too quiet (RMS: {:.6} < 0.003), returning committed text",
            overall_rms
        );
        return Ok(committed_text);
    }

    // Acoustic Overlap: Prepend last 300-400 ms from previous segment if available
    let mut whisper_input = Vec::with_capacity(overlap_samples.len() + trimmed_tail.len());
    whisper_input.extend_from_slice(&overlap_samples);
    whisper_input.extend_from_slice(trimmed_tail);

    let lang_str = language.to_string();
    let context_prompt = crate::utils::get_last_n_words(&committed_text, 10);

    log::debug!(
        "Whisper Tail Finalization: processing {} samples (overlap: {}, tail: {}, RMS: {:.6}, lang: {})",
        whisper_input.len(),
        overlap_samples.len(),
        trimmed_tail.len(),
        overall_rms,
        lang_str
    );
    let t_total = std::time::Instant::now();
    let tail_result = tokio::task::spawn_blocking(move || {
        super::transcribe::run_whisper_with_prompt(
            &whisper_input,
            &lang_str,
            model_type,
            if context_prompt.is_empty() {
                None
            } else {
                Some(&context_prompt)
            },
        )
    })
    .await
    .map_err(|e| format!("Thread error: {}", e))??;
    log::debug!("Tail run_whisper time: {:?}", t_total.elapsed());

    // Suffix-Prefix Deduplication and Safe Space Normalization
    let final_text = crate::utils::deduplicate_chunk_boundary(&committed_text, &tail_result);
    Ok(final_text)
}
