// whisper/recording.rs — Microphone capture and stop+transcribe orchestration
//
// Owns the recording state, the cpal capture thread, and the async
// stop_recording flow that hands off audio to the transcription engine.

use std::sync::{
    atomic::{AtomicBool, AtomicU64, Ordering},
    Arc, Mutex,
};
use tauri::{AppHandle, Emitter, Runtime};

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

                if let Ok(mut lock) = samples_ref.lock() {
                    lock.samples.extend_from_slice(&mono);
                }
            },
            |err| log::error!("cpal error: {}", err),
            None,
        );

        if let Ok(s) = stream {
            s.play().ok();
            while flag_cpal.load(Ordering::SeqCst) {
                std::thread::sleep(std::time::Duration::from_millis(MIC_POLL_INTERVAL_MS));
            }
        }
    });
}

// ── Stop recording & transcribe ─────────────────────────────────────────────

/// Stops recording, waits for audio tail, resamples to 16kHz, and runs Whisper.
pub async fn stop_recording(
    state: SharedState,
    recording_flag: Arc<AtomicBool>,
    language: &str,
    model_type: WhisperModelType,
    threshold: f32,
) -> Result<String, String> {
    // VAD FIX: Wait for audio tail padding before killing the microphone
    // to capture the trailing audio of the last word, preventing the model
    // from hallucinating a cutoff word.
    tokio::time::sleep(std::time::Duration::from_millis(AUDIO_TAIL_PADDING_MS)).await;
    recording_flag.store(false, Ordering::SeqCst);

    let (samples, src_rate) = {
        let mut lock = state.lock().map_err(|e| e.to_string())?;
        let tail = lock.samples.clone();
        let rate = lock.sample_rate;
        lock.samples.clear();
        lock.committed = 0;
        (tail, rate)
    };

    if samples.is_empty() {
        log::debug!("No audio samples captured");
        return Ok(String::new());
    }

    // Minimum duration check
    let min_samples = (src_rate as f64 * MIN_DURATION_SECS) as usize;
    if samples.len() < min_samples {
        log::debug!(
            "Audio too short: {} samples (need {}), src_rate={}",
            samples.len(),
            min_samples,
            src_rate
        );
        return Ok(String::new());
    }

    // Noise gate
    let rms = (samples.iter().map(|s| s * s).sum::<f32>() / samples.len() as f32).sqrt();
    if rms < threshold {
        log::debug!(
            "Audio too quiet (RMS: {} < threshold: {}), skipping",
            rms,
            threshold
        );
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
