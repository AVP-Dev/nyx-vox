use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc, Mutex, OnceLock,
};
use tauri::{AppHandle, Emitter, Runtime};
use whisper_rs::{FullParams, SamplingStrategy, WhisperContext, WhisperContextParameters};

// ── Globals ───────────────────────────────────────────────────────────────────
static WHISPER_CONTEXT: OnceLock<WhisperContext> = OnceLock::new();

// Common Whisper hallucination patterns to filter out
const HALLUCINATION_PATTERNS: &[&str] = &[
    "[music]", "[silence]", "[noise]", "[ music ]", "[ silence ]",
    "♪", "♫", "♬", "♭", "♮", "[ ♪ ]",
    "(музыка)", "(тишина)", "(шум)", "(аплодисменты)",
    "(Music)", "(Silence)", "(Laughter)",
    "subtitles by", "transcribed by", "copyright",
    "www.", "http", ".com", ".ru",
    "редактор субтитров", "кулакова", "игорь негода", "игорь не года",
    "а. кулаков", "а. кулакова", "диктор", "подпишитесь на канал",
    "спасибо за просмотр", "с вами был",
];

// ── Recording state ───────────────────────────────────────────────────────────
pub struct RecordingState {
    pub samples: Vec<f32>,
    pub committed: usize,
    pub sample_rate: u32,
}

impl Default for RecordingState {
    fn default() -> Self {
        Self { samples: Vec::new(), committed: 0, sample_rate: 0 }
    }
}

pub type SharedState = Arc<Mutex<RecordingState>>;

// ── Model path (lazy, from Application Support) ──────────────────────────────
pub fn get_model_dir() -> std::path::PathBuf {
    // Try Application Support first (production)
    if let Some(dir) = dirs_next::data_dir() {
        return dir.join("com.nyx.vox").join("models");
    }
    // Fallback to cargo manifest dir (dev)
    std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("models")
}

pub fn get_model_path() -> Result<String, String> {
    // First try Application Support
    let app_support = get_model_dir().join("ggml-medium.bin");
    if app_support.exists() {
        return Ok(app_support.to_string_lossy().to_string());
    }
    // Fallback: check src-tauri/models/ (dev mode)
    let dev_path = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("models")
        .join("ggml-medium.bin");
    if dev_path.exists() {
        return Ok(dev_path.to_string_lossy().to_string());
    }
    Err("Модель не найдена. Скачайте модель в Настройках (Офлайн режим).".to_string())
}

pub fn is_model_available() -> bool {
    get_model_path().is_ok()
}

fn get_whisper_context() -> Result<&'static WhisperContext, String> {
    WHISPER_CONTEXT.get_or_init(|| {
        println!("NYX Vox: Loading Whisper model...");
        let model_path = get_model_path().expect("Model path failed");
        WhisperContext::new_with_params(&model_path, WhisperContextParameters::default())
            .expect("Whisper context creation failed")
    });
    WHISPER_CONTEXT.get().ok_or("Failed to get Whisper context".to_string())
}

// ── Start Whisper recording ──────────────────────────────────────────────────
pub fn start_recording<R: Runtime>(
    app: AppHandle<R>,
    state: SharedState,
    recording_flag: Arc<AtomicBool>,
    processing_flag: Arc<AtomicBool>,
    language: &str,
) -> Result<(), String> {
    use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};

    // Pre-init whisper
    let _ = get_whisper_context();

    // Reset state
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

    // ── cpal mic capture thread ───────────────────────────────────────────────
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
        let emit_handle = app_stream.clone();

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
                let _ = emit_handle.emit("audio-level", level);

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

    let _app_streamer = app.clone();
    let _lang_str = language.to_string();

    // The sliding window has been removed for performance reasons. Offline Whisper is too heavy
    // to run continuously every 800ms on most Macs. We will process once at the very end.

    Ok(())
}

// ── Stop recording & final transcribe ─────────────────────────────────────────
pub async fn stop_recording(
    state: SharedState,
    recording_flag: Arc<AtomicBool>,
    language: &str,
) -> Result<String, String> {
    // VAD FIX: Wait 700ms (Audio-tail padding) before killing the microphone 
    // to capture the trailing audio of the last word, preventing the model 
    // from hallucinating a cutoff word.
    tokio::time::sleep(std::time::Duration::from_millis(700)).await;
    recording_flag.store(false, Ordering::SeqCst);

    let (samples, src_rate) = {
        let mut lock = state.lock().map_err(|e| e.to_string())?;
        let tail = lock.samples.clone();
        let rate = lock.sample_rate;
        lock.samples.clear();
        lock.committed = 0;
        (tail, rate)
    };

    if samples.is_empty() { return Ok(String::new()); }

    let rms = (samples.iter().map(|s| s * s).sum::<f32>() / samples.len() as f32).sqrt();
    if rms < 0.00005 { return Ok(String::new()); }

    let whisper_samples = super::resample_to_16k(&samples, src_rate, 16000);
    let lang_str = language.to_string();
    tokio::task::spawn_blocking(move || run_whisper(&whisper_samples, 2, &lang_str))
        .await
        .map_err(|e| format!("Thread error: {}", e))?
}

// ── Core Whisper runner ──────────────────────────────────────────────────────
fn run_whisper(samples: &[f32], beam_size: i32, language: &str) -> Result<String, String> {
    let ctx = get_whisper_context()?;

    let mut params = FullParams::new(SamplingStrategy::BeamSearch {
        beam_size,
        patience: 1.0, // Enable beam search patience for better quality
    });
    params.set_language(Some(language));
    params.set_temperature(0.0); // Strict zero temperature to block creativity
    params.set_temperature_inc(0.0); // Disable temperature fallback
    params.set_no_speech_thold(0.6); // Strict silence threshold to block hallucinations
    params.set_entropy_thold(2.4);
    params.set_print_progress(false);
    params.set_print_realtime(false);
    params.set_print_timestamps(false);
    params.set_suppress_blank(true);
    params.set_suppress_non_speech_tokens(true);
    params.set_single_segment(false);
    params.set_split_on_word(true);
    params.set_n_threads(4);
    
    // Dynamic Prompt based on language to avoid hallucinating in the wrong language
    if language == "en" {
        params.set_initial_prompt("Dictation. Hello, how are you? The weather is nice today. I am dictating an important text. Punctuation and grammar are important.");
    } else {
        // Fallback or "ru" - since "auto" is unpredictable, giving it Russian by default is safest for the primary use case, but the model will actually obey the detected language better if the prompt isn't forcing completely wrong characters.
        params.set_initial_prompt("Диктовка. Привет, как дела? Сегодня хорошая погода. Я записываю важный текст. Пожалуйста, расставляй запятые и точки правильно.");
    }

    let mut wstate = ctx.create_state().map_err(|e| format!("{:?}", e))?;
    wstate.full(params, samples).map_err(|e| format!("{:?}", e))?;

    let n = wstate.full_n_segments().map_err(|e| format!("{:?}", e))?;
    let mut result = String::new();

    for i in 0..n {
        let Ok(seg) = wstate.full_get_segment_text(i) else { continue };
        let text = seg.trim();
        if is_hallucination(text) { continue; }
        result.push_str(text);
        result.push(' ');
    }

    Ok(result.trim().to_string())
}

fn is_hallucination(text: &str) -> bool {
    if text.is_empty() { return true; }
    let lower = text.to_lowercase();
    for pattern in HALLUCINATION_PATTERNS {
        if lower.contains(pattern) { return true; }
    }
    let alpha_count = text.chars().filter(|c| c.is_alphabetic()).count();
    if alpha_count == 0 { return true; }
    false
}

// ── Model download ───────────────────────────────────────────────────────────
pub async fn download_model(app: AppHandle<impl Runtime>) -> Result<(), String> {
    let model_dir = get_model_dir();
    std::fs::create_dir_all(&model_dir).map_err(|e| format!("Create dir: {}", e))?;
    let model_path = model_dir.join("ggml-medium.bin");

    if model_path.exists() {
        return Ok(());
    }

    let url = "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.bin";

    let _ = app.emit("model-download-progress", "Начинаю загрузку модели...");

    let response = reqwest::get(url).await.map_err(|e| format!("Download error: {}", e))?;
    let total = response.content_length().unwrap_or(0);
    let mut downloaded: u64 = 0;

    let mut file = std::fs::File::create(&model_path)
        .map_err(|e| format!("File create error: {}", e))?;

    use futures_util::StreamExt;
    use std::io::Write;
    let mut stream = response.bytes_stream();

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| format!("Stream error: {}", e))?;
        file.write_all(&chunk).map_err(|e| format!("Write error: {}", e))?;
        downloaded += chunk.len() as u64;

        if total > 0 {
            let pct = (downloaded as f64 / total as f64 * 100.0) as u32;
            let _ = app.emit("model-download-progress", format!("{}%", pct));
        }
    }

    let _ = app.emit("model-download-progress", "Готово!");
    Ok(())
}

pub fn delete_model() -> Result<(), String> {
    let model_dir = get_model_dir();
    let model_path = model_dir.join("ggml-medium.bin");
    if model_path.exists() {
        std::fs::remove_file(model_path).map_err(|e| format!("Delete error: {}", e))?;
    }
    Ok(())
}
