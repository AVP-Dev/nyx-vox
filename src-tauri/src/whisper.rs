use std::sync::{
    atomic::{AtomicBool, AtomicU64, Ordering},
    Arc, Mutex,
};
use tauri::{AppHandle, Emitter, Runtime};
use whisper_rs::{FullParams, SamplingStrategy, WhisperContext, WhisperContextParameters};

// ── Globals ───────────────────────────────────────────────────────────────────
static WHISPER_CONTEXT_SMALL: Mutex<Option<WhisperContext>> = Mutex::new(None);
static WHISPER_CONTEXT_MEDIUM: Mutex<Option<WhisperContext>> = Mutex::new(None);
static WHISPER_CONTEXT_TURBO: Mutex<Option<WhisperContext>> = Mutex::new(None);

use crate::state::WhisperModelType;

// Common Whisper hallucination patterns to filter out
const HALLUCINATION_PATTERNS: &[&str] = &[
    "[music]", "[silence]", "[noise]", "[ music ]", "[ silence ]",
    "♪", "♫", "♬", "♭", "♮", "[ ♪ ]",
    "(музыка)", "(тишина)", "(шум)", "(аплодисменты)",
    "(Music)", "(Silence)", "(Laughter)", "(Applause)",
    "subtitles by", "transcribed by", "copyright", "subtitles",
    "www.", "http", ".com", ".ru", "https://",
    "редактор субтитров", "кулакова", "игорь негода", "игорь не года",
    "а. кулаков", "а. кулакова", "диктор", "подпишитесь на канал",
    "спасибо за просмотр", "с вами был", "диктовка", "диктовка.",
    "DimaTorzok", "Dima Torzok", "Hoje pursui", "pursui", "uvoir",
    "продолжение следует", "to be continued", "continued",
    "subtitles by amara.org", "amara.org", "amara",
    "субтитры", "перевод", "translated by", "translation",
    "специально для", "благодарим за", "автор субтитров",
    "в выпуске", "следующий выпуск", "смотрите далее",
    "реклама", "спонсор", "партнёр", "sponsor",
    "end of transcript", "transcript end", "конец записи",
    "тишина", "пауза", "pause", "silence",
    "неразборчиво", "не разборчиво", "inaudible", "unclear",
    "аплодисменты", "смех", "laughter", "applause",
    "music fades", "music plays", "играет музыка",
    "ИНТРИГУЮЩАЯ МУЗЫКА", "интригующая музыка", "intriguing music",
    "[ИНТРИГУЮЩАЯ МУЗЫКА]", "[интригующая музыка]", "[intriguing music]",
    "НАПРЯЖЁННАЯ МУЗЫКА", "напряжённая музыка", "tense music",
    "[НАПРЯЖЁННАЯ МУЗЫКА]", "[напряжённая музыка]", "[tense music]",
];

// ── Recording state ───────────────────────────────────────────────────────────
#[derive(Default)]
pub struct RecordingState {
    pub samples: Vec<f32>,
    pub committed: usize,
    pub sample_rate: u32,
}

pub type SharedState = Arc<Mutex<RecordingState>>;

// ── Model path (lazy, from Application Support) ──────────────────────────────
pub fn get_model_dir() -> std::path::PathBuf {
    // Try Application Support first (production)
    if let Some(dir) = ::dirs_next::data_dir() {
        return dir.join("com.nyx.vox").join("models");
    }
    // Fallback to cargo manifest dir (dev)
    std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("models")
}

pub fn get_model_path(model_type: WhisperModelType, allow_fallback: bool) -> Result<String, String> {
    let filename = match model_type {
        WhisperModelType::Small => "ggml-small.bin",
        WhisperModelType::Medium => "ggml-medium.bin",
        WhisperModelType::Turbo => "ggml-large-v3-turbo-q8_0.bin",
    };

    // First try Application Support
    let app_support = get_model_dir().join(filename);
    if app_support.exists() {
        return Ok(app_support.to_string_lossy().to_string());
    }

    if allow_fallback {
        // Fallback: check src-tauri/models/ (dev mode)
        let dev_path = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("models")
            .join(filename);
        if dev_path.exists() {
            return Ok(dev_path.to_string_lossy().to_string());
        }
    }

    Err(format!("Модель {} не найдена. Скачайте модель в Настройках.", filename))
}

pub fn is_model_available(model_type: WhisperModelType) -> bool {
    // UI check: only consider it "available" if it's in the managed Application Support dir.
    // This ensures consistency with the "Delete" button.
    get_model_path(model_type, false).is_ok()
}

fn init_whisper_context(model_type: WhisperModelType) -> Result<WhisperContext, String> {
    println!("NYX Vox: Loading Whisper model {:?}...", model_type);
    let model_path = get_model_path(model_type, true)?;
    WhisperContext::new_with_params(&model_path, WhisperContextParameters::default())
        .map_err(|e| format!("Whisper context creation failed: {}. Попробуйте перекачать модель в настройках.", e))
}

pub fn unload_model(model_type: WhisperModelType) {
    println!(">>> NYX Vox: Attempting to unload model {:?}", model_type);
    let mutex = match model_type {
        WhisperModelType::Small => &WHISPER_CONTEXT_SMALL,
        WhisperModelType::Medium => &WHISPER_CONTEXT_MEDIUM,
        WhisperModelType::Turbo => &WHISPER_CONTEXT_TURBO,
    };
    match mutex.lock() {
        Ok(mut lock) => {
            if lock.is_some() {
                *lock = None;
                println!(">>> NYX Vox: Model {:?} successfully unloaded from memory.", model_type);
            } else {
                println!(">>> NYX Vox: Model {:?} was already unloaded.", model_type);
            }
        }
        Err(e) => {
            println!(">>> NYX Vox ERROR: Failed to acquire lock to unload model {:?}: {}", model_type, e);
        }
    }
}

// ── Start Whisper recording ──────────────────────────────────────────────────
pub fn start_recording<R: Runtime>(
    app: AppHandle<R>,
    state: SharedState,
    recording_flag: Arc<AtomicBool>,
    processing_flag: Arc<AtomicBool>,
    language: &str,
    model_type: WhisperModelType,
) -> Result<(), String> {
    use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};

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

    // ── Pre-init whisper in background to avoid blocking the mic start ───────
    let m_type = model_type;
    std::thread::spawn(move || {
        let mutex = match m_type {
            WhisperModelType::Small => &WHISPER_CONTEXT_SMALL,
            WhisperModelType::Medium => &WHISPER_CONTEXT_MEDIUM,
            WhisperModelType::Turbo => &WHISPER_CONTEXT_TURBO,
        };
        if let Ok(mut lock) = mutex.lock() {
            if lock.is_none() {
                if let Ok(ctx) = init_whisper_context(m_type) {
                    *lock = Some(ctx);
                }
            }
        }
    });

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
    model_type: WhisperModelType,
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

    // Lowered RMS threshold from 0.0004 to 0.0001 to capture quieter speech
    let rms = (samples.iter().map(|s| s * s).sum::<f32>() / samples.len() as f32).sqrt();
    if rms < 0.0001 { 
        println!(">>> [WHISPER] Audio too quiet (RMS: {}), skipping", rms);
        return Ok(String::new()); 
    }

    let whisper_samples = crate::utils::resample_to_16k(&samples, src_rate, 16000);
    let lang_str = language.to_string();
    println!(">>> [WHISPER] Processing {} samples (RMS: {}, lang: {})", whisper_samples.len(), rms, lang_str);
    tokio::task::spawn_blocking(move || run_whisper(&whisper_samples, 2, &lang_str, model_type))
        .await
        .map_err(|e| format!("Thread error: {}", e))?
}

fn run_whisper(samples: &[f32], beam_size: i32, language: &str, model_type: WhisperModelType) -> Result<String, String> {
    println!(">>> [WHISPER] Using model: {:?}", model_type);
    
    let mutex = match model_type {
        WhisperModelType::Small => &WHISPER_CONTEXT_SMALL,
        WhisperModelType::Medium => &WHISPER_CONTEXT_MEDIUM,
        WhisperModelType::Turbo => &WHISPER_CONTEXT_TURBO,
    };

    let mut lock = mutex.lock().map_err(|e| format!("Lock failed: {}", e))?;
    if lock.is_none() {
        *lock = Some(init_whisper_context(model_type)?);
    }
    let ctx = lock.as_ref().ok_or("Failed to initialize Whisper context")?;

    let mut params = FullParams::new(SamplingStrategy::BeamSearch {
        beam_size: if model_type == WhisperModelType::Medium || model_type == WhisperModelType::Turbo { 5 } else { beam_size },
        patience: 1.0,
    });
    let lang_code = if language == "auto" { None } else { Some(language) };
    params.set_language(lang_code);
    params.set_print_progress(false);
    params.set_print_realtime(false);
    params.set_print_timestamps(false);
    params.set_suppress_blank(false); // Disabled to prevent cutting off quiet speech
    params.set_suppress_nst(false); // Disabled to allow all speech patterns
    params.set_single_segment(false);
    params.set_split_on_word(false); // Disabled to prevent artifacts in short segments
    params.set_n_threads(4);
    
    // More sensitive initial prompt for better detection
    if language == "en" {
        params.set_initial_prompt("Transcribe all speech accurately, including quiet words.");
    } else if language == "auto" {
        params.set_initial_prompt("Распознай всю речь. Русский или английский. Записывай всё, даже тихие слова.");
    } else {
        params.set_initial_prompt("Распознай всю речь точно, включая тихие слова. Записывай всё.");
    }

    let mut wstate = ctx.create_state().map_err(|e| format!("{:?}", e))?;
    wstate.full(params, samples).map_err(|e| format!("{:?}", e))?;

    let lang_id = wstate.full_lang_id_from_state();
    println!(">>> [WHISPER] Detected language ID: {}", lang_id);

    let n = wstate.full_n_segments();
    let mut result = String::new();

    for i in 0..n {
        if let Some(seg) = wstate.get_segment(i) {
            if let Ok(text) = seg.to_str() {
                let text = text.trim();
                if is_hallucination(text) { continue; }
                result.push_str(text);
                result.push(' ');
            }
        }
    }
    
    Ok(convert_all_caps_to_normal(crate::utils::clean_repetitive_phrases(result.trim())))
}

// Convert ALL CAPS text to normal case (first letter capital, rest lowercase)
fn convert_all_caps_to_normal(text: String) -> String {
    // If text is mostly uppercase (>80% caps), convert to normal case
    let alpha_chars: Vec<char> = text.chars().filter(|c| c.is_alphabetic()).collect();
    if alpha_chars.is_empty() { return text; }
    
    let uppercase_count = alpha_chars.iter().filter(|c| c.is_uppercase()).count();
    let uppercase_ratio = uppercase_count as f32 / alpha_chars.len() as f32;
    
    if uppercase_ratio > 0.8 {
        // Convert to sentence case: first letter uppercase, rest lowercase
        let mut result = String::new();
        let mut capitalize_next = true;
        
        for c in text.chars() {
            if c.is_alphabetic() {
                if capitalize_next {
                    result.push(c.to_uppercase().next().unwrap_or(c));
                    capitalize_next = false;
                } else {
                    result.push(c.to_lowercase().next().unwrap_or(c));
                }
            } else {
                result.push(c);
                // Capitalize after sentence-ending punctuation
                if c == '.' || c == '?' || c == '!' {
                    capitalize_next = true;
                }
            }
        }
        
        println!(">>> [WHISPER] Converted ALL CAPS to normal case");
        return result;
    }
    
    text
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
pub async fn download_model(
    app: AppHandle<impl Runtime>, 
    model_type: WhisperModelType,
    paused: Arc<AtomicBool>,
    cancelled: Arc<AtomicBool>,
) -> Result<(), String> {
    let model_dir = get_model_dir();
    std::fs::create_dir_all(&model_dir).map_err(|e| format!("Create dir: {}", e))?;
    
    let filename = match model_type {
        WhisperModelType::Small => "ggml-small.bin",
        WhisperModelType::Medium => "ggml-medium.bin",
        WhisperModelType::Turbo => "ggml-large-v3-turbo-q8_0.bin",
    };
    let model_path = model_dir.join(filename);
    let tmp_path = model_dir.join(format!("{}.tmp", filename));

    let mut downloaded: u64 = 0;
    if tmp_path.exists() {
        downloaded = std::fs::metadata(&tmp_path).map(|m| m.len()).unwrap_or(0);
    }


    let url = match model_type {
        WhisperModelType::Small => "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin",
        WhisperModelType::Medium => "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.bin",
        WhisperModelType::Turbo => "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo-q8_0.bin",
    };

    let _ = app.emit("download-progress", "Начинаю загрузку модели...");

    let client = reqwest::Client::builder()
        .user_agent("NYX-Vox-App/1.0")
        .build()
        .map_err(|e| format!("Client error: {}", e))?;

    let response = client.get(url)
        .header("Range", format!("bytes={}-", downloaded))
        .send()
        .await
        .map_err(|e| format!("Download error: {}", e))?;
    
    if response.status() == reqwest::StatusCode::RANGE_NOT_SATISFIABLE {
        // Already downloaded or invalid range, just finish
        println!("NYX Vox: Range not satisfiable, file might be complete.");
    } else if !response.status().is_success() && response.status() != reqwest::StatusCode::PARTIAL_CONTENT {
        return Err(format!("Ошибка сервера: {}. Попробуйте позже.", response.status()));
    }

    let total = downloaded + response.content_length().unwrap_or(0);
    
    let mut file = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&tmp_path)
        .map_err(|e| format!("File open error: {}", e))?;

    use futures_util::StreamExt;
    use std::io::Write;
    let mut stream = response.bytes_stream();

    while let Some(chunk) = stream.next().await {
        if cancelled.load(Ordering::SeqCst) {
            drop(file);
            let _ = std::fs::remove_file(&tmp_path);
            return Err("Загрузка отменена".to_string());
        }

        while paused.load(Ordering::SeqCst) {
            if cancelled.load(Ordering::SeqCst) {
                drop(file);
                let _ = std::fs::remove_file(&tmp_path);
                return Err("Загрузка отменена".to_string());
            }
            tokio::time::sleep(std::time::Duration::from_millis(500)).await;
        }

        let chunk = chunk.map_err(|e| format!("Stream error: {}", e))?;
        file.write_all(&chunk).map_err(|e| format!("Write error: {}", e))?;
        downloaded += chunk.len() as u64;

        if total > 0 {
            let pct = (downloaded as f64 / total as f64 * 100.0) as u32;
            let _ = app.emit("download-progress", pct);
        }
    }

    // Explicitly finish writing to ensure all data is flushed
    drop(file);

    // Verify file size
    let min_size = match model_type {
        WhisperModelType::Small => 450_000_000,   // ~465MB
        WhisperModelType::Medium => 1_400_000_000, // ~1.42GB
        WhisperModelType::Turbo => 800_000_000,   // ~830MB (q8_0 version)
    };

    if total > 0 && downloaded != total {
        let _ = std::fs::remove_file(&tmp_path);
        return Err(format!("Загрузка прервана: получено {} из {} байт. Пожалуйста, попробуйте еще раз.", downloaded, total));
    }
    
    if downloaded < min_size {
        let _ = std::fs::remove_file(&tmp_path);
        return Err(format!("Ошибка: скачанный файл слишком мал ({} байт). Вероятно, загрузка оборвалась.", downloaded));
    }

    // Rename temp file to actual model file
    std::fs::rename(&tmp_path, &model_path)
        .map_err(|e| format!("Rename error: {}. Возможно, файл занят другим процессом.", e))?;

    let _ = app.emit("download-progress", "Готово!");
    Ok(())
}

pub fn delete_model(model_type: WhisperModelType) -> Result<(), String> {
    println!(">>> NYX Vox: delete_model called for {:?}", model_type);
    unload_model(model_type); // Unload from memory first to release file lock

    let model_dir = get_model_dir();
    let filename = match model_type {
        WhisperModelType::Small => "ggml-small.bin",
        WhisperModelType::Medium => "ggml-medium.bin",
        WhisperModelType::Turbo => "ggml-large-v3-turbo-q8_0.bin",
    };
    let model_path = model_dir.join(filename);
    let tmp_path = model_dir.join(format!("{}.tmp", filename));
    
    println!(">>> NYX Vox: Target file to delete: {:?}", model_path);

    if model_path.exists() {
        match std::fs::remove_file(&model_path) {
            Ok(_) => println!(">>> NYX Vox: Successfully deleted model file: {:?}", model_path),
            Err(e) => {
                println!(">>> NYX Vox ERROR: Failed to delete model file {:?}: {}", model_path, e);
                return Err(format!("Ошибка при удалении файла: {}", e));
            }
        }
    } else {
        println!(">>> NYX Vox: Model file does not exist: {:?}", model_path);
    }
    
    // Clean up old legacy turbo model if it exists
    if model_type == WhisperModelType::Turbo {
        let old_path = model_dir.join("ggml-large-v3-turbo.bin");
        if old_path.exists() {
            let _ = std::fs::remove_file(old_path);
        }
    }
    
    if tmp_path.exists() {
        let _ = std::fs::remove_file(tmp_path);
    }
    Ok(())
}
