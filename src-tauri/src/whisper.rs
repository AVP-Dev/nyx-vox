use std::sync::{
    atomic::{AtomicBool, AtomicU64, Ordering},
    Arc, Mutex,
};
use tauri::{AppHandle, Emitter, Runtime};
use whisper_rs::{FullParams, SamplingStrategy, WhisperContext, WhisperContextParameters, WhisperState};

// ── Globals ───────────────────────────────────────────────────────────────────
// Cache both context AND state to keep Metal/GPU initialized across transcriptions.
// Recreating WhisperState triggers full Metal backend reinit (~47s on first call).
struct WhisperModel {
    #[allow(dead_code)] // kept alive: WhisperState references this
    ctx: WhisperContext,
    state: WhisperState,
}
static WHISPER_MODEL_SMALL: Mutex<Option<WhisperModel>> = Mutex::new(None);
static WHISPER_MODEL_MEDIUM: Mutex<Option<WhisperModel>> = Mutex::new(None);
static WHISPER_MODEL_TURBO: Mutex<Option<WhisperModel>> = Mutex::new(None);

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

fn init_whisper_model(model_type: WhisperModelType) -> Result<WhisperModel, String> {
    let t0 = std::time::Instant::now();
    println!("NYX Vox: Loading Whisper model {:?}...", model_type);
    let model_path = get_model_path(model_type, true)?;
    println!("NYX Vox: Model path: {}", model_path);
    let mut ctx_params = WhisperContextParameters::default();
    ctx_params.use_gpu(true);
    let ctx = WhisperContext::new_with_params(&model_path, ctx_params)
        .map_err(|e| format!("Whisper context creation failed: {}. Попробуйте перекачать модель в настройках.", e))?;
    println!("NYX Vox: Whisper model {:?} loaded in {:?} (GPU: enabled)", model_type, t0.elapsed());

    // Create state and pre-warm Metal to compile all GPU shaders once
    println!("NYX Vox: Pre-warming Metal shaders...");
    let t_warmup = std::time::Instant::now();
    let mut state = ctx.create_state()
        .map_err(|e| format!("Failed to create WhisperState: {:?}", e))?;
    let params = FullParams::new(SamplingStrategy::Greedy { best_of: 1 });
    let silence = vec![0.0f32; 16000]; // 1 second of silence
    let _ = state.full(params, &silence);
    println!("NYX Vox: Metal pre-warmed in {:?}", t_warmup.elapsed());

    Ok(WhisperModel { ctx, state })
}

pub fn preload_model(model_type: WhisperModelType) {
    let mutex = match model_type {
        WhisperModelType::Small => &WHISPER_MODEL_SMALL,
        WhisperModelType::Medium => &WHISPER_MODEL_MEDIUM,
        WhisperModelType::Turbo => &WHISPER_MODEL_TURBO,
    };
    if let Ok(mut lock) = mutex.lock() {
        if lock.is_none() {
            match init_whisper_model(model_type) {
                Ok(model) => {
                    *lock = Some(model);
                    println!(">>> NYX Vox: Model {:?} preloaded successfully.", model_type);
                }
                Err(e) => {
                    eprintln!(">>> NYX Vox: Model preload failed for {:?}: {}", model_type, e);
                }
            }
        }
    }
}

pub fn unload_model(model_type: WhisperModelType) {
    println!(">>> NYX Vox: Attempting to unload model {:?}", model_type);
    let mutex = match model_type {
        WhisperModelType::Small => &WHISPER_MODEL_SMALL,
        WhisperModelType::Medium => &WHISPER_MODEL_MEDIUM,
        WhisperModelType::Turbo => &WHISPER_MODEL_TURBO,
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

pub fn unload_all_models() {
    unload_model(WhisperModelType::Small);
    unload_model(WhisperModelType::Medium);
    unload_model(WhisperModelType::Turbo);
}

// ── Start Whisper recording ──────────────────────────────────────────────────
pub fn start_recording<R: Runtime>(
    app: AppHandle<R>,
    state: SharedState,
    recording_flag: Arc<AtomicBool>,
    processing_flag: Arc<AtomicBool>,
    language: &str,
    _model_type: WhisperModelType,
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

    // IMPORTANT: start the microphone first. Local Whisper/Metal/Core ML model
    // initialization can take seconds on cold start; doing it before cpal meant
    // the UI looked like recording while the mic was not yet capturing audio.
    // We capture immediately and warm the model in parallel because inference is
    // only needed after stop.

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

    // Do not warm the model here. On 8GB Macs, loading a large local model while
    // recording can cause memory pressure and even process termination. The mic
    // must start immediately; model loading happens after stop if it is not
    // already cached from a previous transcription.

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
    threshold: f32,
) -> Result<String, String> {
    // VAD FIX: Wait 700ms (Audio-tail padding) before killing the microphone 
    // to capture the trailing audio of the last word, preventing the model 
    // from hallucinating a cutoff word.
    tokio::time::sleep(std::time::Duration::from_millis(300)).await;
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

    // Minimum duration: ~0.8s
    let min_samples = (src_rate as f64 * 0.8) as usize;
    if samples.len() < min_samples { return Ok(String::new()); }

    // Noise gate
    let rms = (samples.iter().map(|s| s * s).sum::<f32>() / samples.len() as f32).sqrt();
    if rms < threshold { 
        println!(">>> [WHISPER] Audio too quiet (RMS: {}), skipping", rms);
        return Ok(String::new()); 
    }

    let whisper_samples = crate::utils::resample_to_16k(&samples, src_rate, 16000);
    let lang_str = language.to_string();
    println!(">>> [WHISPER] Processing {} samples (RMS: {}, lang: {}, src_rate: {})", whisper_samples.len(), rms, lang_str, src_rate);
    let t_total = std::time::Instant::now();
    let result = tokio::task::spawn_blocking(move || run_whisper(&whisper_samples, 2, &lang_str, model_type))
        .await
        .map_err(|e| format!("Thread error: {}", e))?;
    println!(">>> [WHISPER] Total stop_recording time: {:?}", t_total.elapsed());
    result
}

fn run_whisper(samples: &[f32], _beam_size: i32, language: &str, model_type: WhisperModelType) -> Result<String, String> {
    let t0 = std::time::Instant::now();
    println!(">>> [WHISPER] Using model: {:?}", model_type);
    
    let mutex = match model_type {
        WhisperModelType::Small => &WHISPER_MODEL_SMALL,
        WhisperModelType::Medium => &WHISPER_MODEL_MEDIUM,
        WhisperModelType::Turbo => &WHISPER_MODEL_TURBO,
    };

    let mut lock = mutex.lock().map_err(|e| format!("Lock failed: {}", e))?;
    if lock.is_none() {
        println!(">>> [WHISPER] Model not cached, loading from disk...");
        *lock = Some(init_whisper_model(model_type)?);
        println!(">>> [WHISPER] Model loaded in {:?}", t0.elapsed());
    } else {
        println!(">>> [WHISPER] Model already cached (load took 0ms)");
    }
    let model = lock.as_mut().ok_or("Failed to initialize Whisper model")?;

    // Local dictation is latency-sensitive. Greedy decoding is much faster than
    // beam search and is accurate enough for short command/dictation snippets,
    // especially with the mixed RU+EN prompt and technical vocabulary hints.
    let mut params = FullParams::new(SamplingStrategy::Greedy { best_of: 1 });
    let lang_code = match language {
        "auto" => None,
        // Mixed mode: use auto-detection so Whisper doesn't force Russian
        // and transliterate English tech terms. The initial_prompt below
        // guides the decoder toward preserving English IT vocabulary.
        "mixed" => None,
        _ => Some(language),
    };
    params.set_language(lang_code);
    params.set_print_progress(false);
    params.set_print_realtime(false);
    params.set_print_timestamps(false);
    params.set_suppress_blank(true);  // Enable: prevents blank/non-speech token output
    params.set_suppress_nst(true);    // Enable: suppresses [music], [noise], ♪ hallucinations
    params.set_single_segment(true);
    params.set_split_on_word(false);
    params.set_no_context(true);
    params.set_translate(false);
    params.set_temperature(0.0);
    params.set_temperature_inc(0.2);
    params.set_entropy_thold(2.4);
    params.set_logprob_thold(-1.0);
    params.set_max_initial_ts(1.0);
    let n_threads = std::thread::available_parallelism().map(|n| n.get() as i32).unwrap_or(4);
    params.set_n_threads(n_threads);
    println!(">>> [WHISPER] Using {} threads, {} samples ({:.1}s audio)", n_threads, samples.len(), samples.len() as f64 / 16000.0);

    // Системный контекст (initial_prompt) с базовым IT-словарем.
    // Промпт для русского языка пишется на русском, чтобы исключить
    // смещение внимания (bias) декодера Whisper в сторону английских галлюцинаций.
    let vocab_hint = "GitHub, GitLab, Node, Node.js, Bun, npm, API, CLI, JSON, TypeScript, JavaScript, React, Next.js, Docker, Linux, macOS, Tauri, DeepSeek, Groq, Whisper, Antigravity";
    let initial_prompt = match language {
        "en" => format!("Transcribe all speech accurately. Tech terms: {}", vocab_hint),
        "mixed" => format!("{}. Extra vocabulary: {}", crate::prompts::MIXED_RU_EN_STT_PROMPT, vocab_hint),
        "auto" => format!("Точная транскрипция речи на русском или английском языке. Термины: {}", vocab_hint),
        _ => format!("Точная транскрипция русской речи. Сохраняйте английские технические термины. Словарь: {}", vocab_hint),
    };
    params.set_initial_prompt(&initial_prompt);

    let t_infer = std::time::Instant::now();
    model.state.full(params, samples).map_err(|e| format!("{:?}", e))?;
    println!(">>> [WHISPER] Inference completed in {:?}", t_infer.elapsed());

    let lang_id = model.state.full_lang_id_from_state();
    println!(">>> [WHISPER] Detected language ID: {}", lang_id);

    let n = model.state.full_n_segments();
    let mut result = String::new();

    for i in 0..n {
        if let Some(seg) = model.state.get_segment(i) {
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

    // --- Core ML download start (macOS only) ---
    #[cfg(target_os = "macos")]
    {
        let mlmodelc_name = match model_type {
            WhisperModelType::Small => "ggml-small-encoder.mlmodelc",
            WhisperModelType::Medium => "ggml-medium-encoder.mlmodelc",
            WhisperModelType::Turbo => "ggml-large-v3-turbo-encoder.mlmodelc",
        };
        let mlmodelc_path = model_dir.join(mlmodelc_name);

        if !mlmodelc_path.exists() {
            let coreml_url = match model_type {
                WhisperModelType::Small => "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small-encoder.mlmodelc.zip",
                WhisperModelType::Medium => "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium-encoder.mlmodelc.zip",
                WhisperModelType::Turbo => "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo-encoder.mlmodelc.zip",
            };

            let _ = app.emit("download-progress", "Загрузка Core ML ускорителя...");
            
            let zip_tmp_path = model_dir.join(format!("{}.zip.tmp", mlmodelc_name));
            
            // Nested logic to catch errors without failing the main model download
            let coreml_res: Result<(), String> = async {
                let response = client.get(coreml_url).send().await.map_err(|e| e.to_string())?;
                if !response.status().is_success() {
                    return Err(format!("Server error: {}", response.status()));
                }
                
                let total = response.content_length().unwrap_or(0);
                let mut downloaded_coreml = 0u64;
                let mut zip_file = std::fs::File::create(&zip_tmp_path).map_err(|e| e.to_string())?;
                let mut stream = response.bytes_stream();

                use futures_util::StreamExt;
                while let Some(chunk) = stream.next().await {
                    if cancelled.load(Ordering::SeqCst) {
                        return Err("Cancelled".to_string());
                    }
                    let chunk = chunk.map_err(|e| e.to_string())?;
                    std::io::Write::write_all(&mut zip_file, &chunk).map_err(|e| e.to_string())?;
                    downloaded_coreml += chunk.len() as u64;
                    
                    if total > 0 {
                        let pct = (downloaded_coreml as f64 / total as f64 * 100.0) as u32;
                        // Use string to distinguish from main download percentage
                        let _ = app.emit("download-progress", format!("Core ML: {}%", pct));
                    }
                }
                drop(zip_file);

                // Extraction using zip crate
                println!(">>> [WHISPER] Extracting Core ML bundle: {:?}", zip_tmp_path);
                let zip_file_to_extract = std::fs::File::open(&zip_tmp_path).map_err(|e| format!("Failed to open zip: {}", e))?;
                let mut archive = zip::ZipArchive::new(zip_file_to_extract).map_err(|e| format!("Failed to read zip archive: {}", e))?;
                
                for i in 0..archive.len() {
                    let mut file = archive.by_index(i).map_err(|e| format!("Failed to get zip entry {}: {}", i, e))?;
                    let outpath = match file.enclosed_name() {
                        Some(path) => model_dir.join(path),
                        None => continue,
                    };

                    if file.is_dir() {
                        println!(">>> [WHISPER] Creating directory: {:?}", outpath);
                        std::fs::create_dir_all(&outpath).map_err(|e| format!("Failed to create dir {:?}: {}", outpath, e))?;
                    } else {
                        if let Some(p) = outpath.parent() {
                            if !p.exists() {
                                std::fs::create_dir_all(p).map_err(|e| format!("Failed to create parent dir {:?}: {}", p, e))?;
                            }
                        }
                        println!(">>> [WHISPER] Extracting file: {:?}", outpath);
                        let mut outfile = std::fs::File::create(&outpath).map_err(|e| format!("Failed to create file {:?}: {}", outpath, e))?;
                        std::io::copy(&mut file, &mut outfile).map_err(|e| format!("Failed to copy file {:?}: {}", outpath, e))?;
                    }
                }
                println!(">>> [WHISPER] Core ML bundle extracted successfully");
                Ok(())
            }.await;

            if let Err(e) = coreml_res {
                eprintln!(">>> [WHISPER] Core ML download/extract warning: {}", e);
                let _ = app.emit("download-progress", "Внимание: Core ML не загружен (будет CPU fallback)");
            }
            
            if zip_tmp_path.exists() {
                let _ = std::fs::remove_file(&zip_tmp_path).ok();
            }
        }
    }
    // --- Core ML download end ---

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

    // --- Core ML cleanup (macOS only) ---
    #[cfg(target_os = "macos")]
    {
        let mlmodelc_name = match model_type {
            WhisperModelType::Small => "ggml-small-encoder.mlmodelc",
            WhisperModelType::Medium => "ggml-medium-encoder.mlmodelc",
            WhisperModelType::Turbo => "ggml-large-v3-turbo-encoder.mlmodelc",
        };
        let mlmodelc_path = model_dir.join(mlmodelc_name);
        let mlmodelc_tmp_zip = model_dir.join(format!("{}.zip.tmp", mlmodelc_name));

        if mlmodelc_path.exists() {
            println!(">>> NYX Vox: Deleting Core ML bundle: {:?}", mlmodelc_path);
            let _ = std::fs::remove_dir_all(mlmodelc_path);
        }
        if mlmodelc_tmp_zip.exists() {
            let _ = std::fs::remove_file(mlmodelc_tmp_zip);
        }
    }

    Ok(())
}
