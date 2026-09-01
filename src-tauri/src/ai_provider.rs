use base64::{engine::general_purpose, Engine as _};
use serde_json::json;
use std::sync::{
    atomic::{AtomicBool, AtomicU64, Ordering},
    Arc, Mutex,
};
use tauri::{AppHandle, Emitter, Manager, Runtime};

use crate::state::{AiSemaphore, AudioBuffer, FormattingStyle, FormattingStyleState};

// ── Models ───────────────────────────────────────────────────────────────────
const GROQ_STT_MODEL: &str = "whisper-large-v3-turbo";
const GROQ_REFINEMENT_MODEL: &str = "llama-3.3-70b-versatile";
const GEMINI_MODEL: &str = "gemini-2.5-flash";

// ── Shared recording state ────────────────────────────────────────────────────
pub type SharedAiState = Arc<Mutex<AudioBuffer>>;

fn build_refinement_user_content(instruction: Option<String>, text: &str) -> String {
    let instruction = instruction
        .unwrap_or_else(|| crate::prompts::REFINEMENT_USER_INSTRUCTION_GENERIC.to_string());
    format!(
        "{}{}{}{}",
        instruction,
        crate::prompts::REFINEMENT_USER_DELIMITER,
        text,
        crate::prompts::REFINEMENT_USER_SUFFIX
    )
}

pub(crate) fn take_recording_wav<R: Runtime>(
    app: &AppHandle<R>,
    state: &SharedAiState,
    threshold: f32,
    gain: f32,
) -> Result<Option<Vec<u8>>, String> {
    let (samples, src_rate) = {
        let mut lock = state.lock().map_err(|e| e.to_string())?;
        let tail = lock.samples.clone();
        let rate = lock.sample_rate;
        lock.samples.clear();
        (tail, rate)
    };

    let app_lang = crate::utils::app_language(app);

    if samples.is_empty() {
        log::debug!("Groq/Gemini: no audio samples captured");
        crate::utils::emit_skip_reason(
            app,
            crate::utils::RecordingSkipReason::NoSamples,
            &app_lang,
        );
        return Ok(None);
    }

    let min_samples = (src_rate as f64 * 0.3) as usize;
    if samples.len() < min_samples {
        log::debug!(
            "Groq/Gemini: audio too short: {} samples (need {}), src_rate={}",
            samples.len(),
            min_samples,
            src_rate
        );
        crate::utils::emit_skip_reason(app, crate::utils::RecordingSkipReason::TooShort, &app_lang);
        return Ok(None);
    }

    // Apply software gain to boost quiet microphone signals
    let samples: Vec<f32> = samples
        .iter()
        .map(|s| (s * gain).clamp(-1.0, 1.0))
        .collect();

    // Check speech presence via peak frame energy (50ms windows) so that pauses
    // in speech do not dilute total RMS and falsely drop audible recordings.
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
            "Groq/Gemini: audio too quiet (Peak RMS: {:.6} < min: {:.6}), skipping",
            peak_frame_rms,
            (threshold * 0.25).max(0.0003)
        );
        crate::utils::emit_skip_reason(app, crate::utils::RecordingSkipReason::TooQuiet, &app_lang);
        return Ok(None);
    }
    log::info!("Groq/Gemini audio: {} samples, Peak RMS: {:.6}, threshold: {:.6}, gain: {:.1}, src_rate: {}, duration: {:.1}s",
        samples.len(), peak_frame_rms, threshold, gain, src_rate, samples.len() as f64 / src_rate as f64);

    let processed_samples = crate::utils::resample_to_16k(&samples, src_rate, 16000);
    let trimmed = crate::utils::trim_silence(&processed_samples, threshold.max(0.002), 16000);
    let final_samples = if trimmed.len() >= 3200 {
        trimmed
    } else {
        &processed_samples
    };
    let wav_data = crate::utils::samples_to_wav(final_samples, 16000)?;
    Ok(Some(wav_data))
}

// ── Start recording ───────────────────────────────────────────────────────────
pub fn start_recording<R: Runtime>(
    app: AppHandle<R>,
    state: SharedAiState,
    recording_flag: Arc<AtomicBool>,
) -> Result<(), String> {
    let lang = app
        .state::<crate::state::AppLanguage>()
        .0
        .lock()
        .map(|l| l.clone())
        .unwrap_or_else(|_| "ru".to_string());
    let _ = app.emit(
        "ai-status",
        if lang == "ru" {
            "🎙️ Запись..."
        } else {
            "🎙️ Recording..."
        },
    );
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
        let mut vad_tracker = crate::utils::VadTracker::new();

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
                            "AI Provider VAD: Continuous silence for {:.1}s detected, triggering auto-stop",
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

    Ok(())
}

// ── Stop recording & send to Groq STT ─────────────────────────────────────────
pub async fn stop_recording<R: Runtime>(
    app: tauri::AppHandle<R>,
    state: SharedAiState,
    recording_flag: Arc<AtomicBool>,
    api_key: String,
    language: &str,
    threshold: f32,
    gain: f32,
) -> Result<String, String> {
    tokio::time::sleep(std::time::Duration::from_millis(60)).await;
    recording_flag.store(false, Ordering::SeqCst);

    // 1. Acquisition of Semaphore — with a timeout so a stuck previous request
    // (e.g. one that hit the network timeout) can't block transcription forever.
    let semaphore = app.state::<AiSemaphore>();
    let _permit = tokio::time::timeout(std::time::Duration::from_secs(5), semaphore.0.acquire())
        .await
        .map_err(|_| "Предыдущий запрос к ИИ не завершился. Попробуйте ещё раз.".to_string())?
        .map_err(|e| format!("Semaphore error: {}", e))?;
    let lang_pref = app
        .state::<crate::state::AppLanguage>()
        .0
        .lock()
        .map(|l| l.clone())
        .unwrap_or_else(|_| "ru".to_string());
    let _ = app.emit(
        "ai-status",
        if lang_pref == "ru" {
            "🎙️ Транскрибирую..."
        } else {
            "🎙️ Transcribing..."
        },
    );

    let Some(wav_data) = take_recording_wav(&app, &state, threshold, gain)? else {
        return Ok(String::new());
    };

    let api_key = api_key
        .trim_matches('"')
        .trim_matches('\'')
        .trim()
        .to_string();

    if api_key.is_empty() {
        return Err("API ключ Groq не найден.".to_string());
    }

    let client = crate::utils::shared_http_client();
    let part = reqwest::multipart::Part::bytes(wav_data)
        .file_name("audio.wav")
        .mime_str("audio/wav")
        .map_err(|e| e.to_string())?;

    let stt_prompt = if language == "mixed" {
        format!(
            "{}\n\nVocabulary: {}",
            crate::prompts::MIXED_RU_EN_STT_PROMPT,
            crate::prompts::GROQ_STT_PROMPT
        )
    } else {
        crate::prompts::GROQ_STT_PROMPT.to_string()
    };
    // Truncate at word boundary to avoid cutting mid-sentence
    let stt_prompt = if stt_prompt.len() > 896 {
        let truncated = &stt_prompt[..896];
        match truncated.rfind(' ') {
            Some(pos) => truncated[..pos].to_string(),
            None => truncated.to_string(),
        }
    } else {
        stt_prompt
    };
    // For "mixed" mode, send "ru" as base language (Russian with occasional English)
    let effective_lang = if language == "mixed" { "ru" } else { language };
    log::info!(
        "Groq STT: language={}, effective_lang={}, prompt_len={}",
        language,
        effective_lang,
        stt_prompt.len()
    );
    log::debug!("Groq STT prompt: {}", stt_prompt);

    let stt_model = app
        .try_state::<crate::state::CustomModels>()
        .and_then(|s| s.0.lock().ok().and_then(|m| m.get("groq_stt").cloned()))
        .unwrap_or_else(|| GROQ_STT_MODEL.to_string());

    let form = reqwest::multipart::Form::new()
        .part("file", part)
        .text("model", stt_model)
        .text("prompt", stt_prompt)
        .text("language", effective_lang.to_string());

    let res = tokio::time::timeout(
        std::time::Duration::from_secs(30),
        client
            .post("https://api.groq.com/openai/v1/audio/transcriptions")
            .header("Authorization", format!("Bearer {}", api_key))
            .multipart(form)
            .send(),
    )
    .await
    .map_err(|_| "Groq STT: таймаут запроса (30с). Попробуйте ещё раз.".to_string())?
    .map_err(|e| {
        log::error!("Groq STT Network Error: {}", e);
        format!("Network error: {}", e)
    })?;

    let status = res.status();
    let body = res.text().await.map_err(|e| format!("Body error: {}", e))?;

    if !status.is_success() {
        // 403 usually means the API key lacks access to the model or the
        // region is blocked. Give the user an actionable hint instead of the
        // raw JSON error body.
        if status.as_u16() == 403 {
            return Err(
                "Groq вернул 403 Forbidden. Проверьте: (1) ключ имеет доступ к модели whisper-large-v3-turbo в console.groq.com → Model Permissions, (2) ваш регион не заблокирован (Groq недоступен из РФ/РБ без VPN).".to_string(),
            );
        }
        return Err(format!("Groq API error: {}", body));
    }

    let json: serde_json::Value =
        serde_json::from_str(&body).map_err(|e| format!("JSON parse error: {}", e))?;
    let text = json["text"].as_str().unwrap_or("").to_string();
    log::info!(
        "Groq STT raw response: {}",
        text.chars().take(200).collect::<String>()
    );
    let cleaned = crate::utils::clean_repetitive_phrases(&text);

    // Унифицируем ответ для фронтенда
    let result = json!({ "content": cleaned });
    Ok(result.to_string())
}

// ── Stop recording & send to Gemini STT ──────────────────────────────────────
pub async fn gemini_stop_recording<R: Runtime>(
    app: tauri::AppHandle<R>,
    state: SharedAiState,
    recording_flag: Arc<AtomicBool>,
    api_key: String,
    language: &str,
    threshold: f32,
    gain: f32,
) -> Result<String, String> {
    tokio::time::sleep(std::time::Duration::from_millis(60)).await;
    recording_flag.store(false, Ordering::SeqCst);

    let semaphore = app.state::<AiSemaphore>();
    let _permit = semaphore
        .0
        .acquire()
        .await
        .map_err(|e| format!("Semaphore error: {}", e))?;
    let lang_pref = app
        .state::<crate::state::AppLanguage>()
        .0
        .lock()
        .map(|l| l.clone())
        .unwrap_or_else(|_| "ru".to_string());
    let _ = app.emit(
        "ai-status",
        if lang_pref == "ru" {
            "🎙️ Транскрибирую..."
        } else {
            "🎙️ Transcribing..."
        },
    );

    let Some(wav_data) = take_recording_wav(&app, &state, threshold, gain)? else {
        return Ok(String::new());
    };

    let api_key = api_key
        .trim_matches('"')
        .trim_matches('\'')
        .trim()
        .to_string();
    if api_key.is_empty() {
        return Err("API ключ Gemini не найден.".to_string());
    }

    let client = crate::utils::shared_http_client();

    let stt_model = app
        .try_state::<crate::state::CustomModels>()
        .and_then(|s| s.0.lock().ok().and_then(|m| m.get("gemini_stt").cloned()))
        .unwrap_or_else(|| GEMINI_MODEL.to_string());

    let url = format!(
        "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent?key={}",
        stt_model, api_key
    );
    let audio_b64 = general_purpose::STANDARD.encode(wav_data);
    let body = json!({
        "systemInstruction": {
            "parts": [{ "text": crate::prompts::GEMINI_STT_PROMPT }]
        },
        "contents": [{
            "role": "user",
            "parts": [
                { "text": if language == "mixed" { crate::prompts::MIXED_RU_EN_STT_PROMPT } else { crate::prompts::GEMINI_STT_PROMPT } },
                { "inlineData": { "mimeType": "audio/wav", "data": audio_b64 } }
            ]
        }],
        "generationConfig": {
            "temperature": 0.0,
            "topP": crate::prompts::DEFAULT_TOP_P,
            "maxOutputTokens": 2048
        }
    });

    let res = tokio::time::timeout(
        std::time::Duration::from_secs(30),
        client.post(&url).json(&body).send(),
    )
    .await
    .map_err(|_| "Gemini STT: таймаут запроса (30с). Попробуйте ещё раз.".to_string())?
    .map_err(|e| format!("Gemini STT request failed: {}", e))?;

    let status = res.status();
    let body_text = res
        .text()
        .await
        .map_err(|e| format!("Gemini STT read body: {}", e))?;
    if !status.is_success() {
        return Err(format!("Gemini STT Failed ({}): {}", status, body_text));
    }

    let json: serde_json::Value =
        serde_json::from_str(&body_text).map_err(|e| format!("JSON parse error: {}", e))?;
    let text = json["candidates"][0]["content"]["parts"][0]["text"]
        .as_str()
        .unwrap_or("")
        .to_string();
    let cleaned = crate::utils::clean_repetitive_phrases(&text);
    Ok(json!({ "content": cleaned }).to_string())
}

// ── Groq Text Refinement (Formatting) ─────────────────────────────────────────
pub async fn groq_refine_text<R: Runtime>(
    app: AppHandle<R>,
    text: String,
    api_key: String,
    instruction: Option<String>,
) -> Result<String, String> {
    let lang_pref = app
        .state::<crate::state::AppLanguage>()
        .0
        .lock()
        .map(|l| l.clone())
        .unwrap_or_else(|_| "ru".to_string());
    let _ = app.emit(
        "ai-status",
        if lang_pref == "ru" {
            "✨ Форматирую..."
        } else {
            "✨ Formatting..."
        },
    );
    // 1. Acquisition of Semaphore — with a timeout so a stuck previous request
    // (e.g. one that hit the network timeout) can't block transcription forever.
    let semaphore = app.state::<AiSemaphore>();
    let _permit = tokio::time::timeout(std::time::Duration::from_secs(5), semaphore.0.acquire())
        .await
        .map_err(|_| "Предыдущий запрос к ИИ не завершился. Попробуйте ещё раз.".to_string())?
        .map_err(|e| format!("Semaphore error: {}", e))?;
    let api_key = api_key
        .trim_matches('"')
        .trim_matches('\'')
        .trim()
        .to_string();

    if api_key.is_empty() {
        return Err("API ключ Groq не найден.".to_string());
    }

    let client = crate::utils::shared_http_client();
    let url = "https://api.groq.com/openai/v1/chat/completions";

    let style_state = app.state::<FormattingStyleState>();
    let style = *style_state.0.lock().unwrap_or_else(|e| e.into_inner());

    let style_prompt = match style {
        FormattingStyle::Casual => crate::prompts::FORMAT_STYLE_LIGHT,
        FormattingStyle::Professional => crate::prompts::FORMAT_STYLE_DEEP,
    };

    let system_prompt = format!(
        "{}\n\n{}\n\n{}",
        crate::prompts::REFINEMENT_SYSTEM_PROMPT,
        style_prompt,
        crate::prompts::FORMAT_STYLE_UNIVERSAL_RULE
    );
    let user_content = build_refinement_user_content(instruction, &text);

    let format_model = app
        .try_state::<crate::state::CustomModels>()
        .and_then(|s| s.0.lock().ok().and_then(|m| m.get("groq_format").cloned()))
        .unwrap_or_else(|| GROQ_REFINEMENT_MODEL.to_string());

    let body = json!({
        "model": format_model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content}
        ],
        "temperature": crate::prompts::DEFAULT_TEMPERATURE,
        "top_p": crate::prompts::DEFAULT_TOP_P
    });

    let res = client
        .post(url)
        .header("Authorization", format!("Bearer {}", api_key))
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Groq Refinement request failed: {}", e))?;

    let status = res.status();
    let body_text = res.text().await.unwrap_or_default();

    if !status.is_success() {
        log::error!("Groq refinement error: {}", status);
        return Err(format!(
            "Groq AI Refinement Failed ({}): {}",
            status, body_text
        ));
    }

    let json: serde_json::Value =
        serde_json::from_str(&body_text).map_err(|e| format!("JSON parse error: {}", e))?;
    let content = json["choices"][0]["message"]["content"]
        .as_str()
        .unwrap_or("");

    let cleaned = crate::utils::clean_repetitive_phrases(content);
    let final_text = crate::utils::strip_filler_phrases(&cleaned);

    let _ = app.emit("ai-result", &final_text);

    Ok(final_text)
}

// ── Gemini Text Refinement (Formatting) ───────────────────────────────────────
pub async fn gemini_refine_text<R: Runtime>(
    app: AppHandle<R>,
    text: String,
    api_key: String,
    instruction: Option<String>,
) -> Result<String, String> {
    let lang_pref = app
        .state::<crate::state::AppLanguage>()
        .0
        .lock()
        .map(|l| l.clone())
        .unwrap_or_else(|_| "ru".to_string());
    let _ = app.emit(
        "ai-status",
        if lang_pref == "ru" {
            "✨ Форматирую..."
        } else {
            "✨ Formatting..."
        },
    );
    let semaphore = app.state::<AiSemaphore>();
    let _permit = tokio::time::timeout(std::time::Duration::from_secs(5), semaphore.0.acquire())
        .await
        .map_err(|_| "Предыдущий запрос к ИИ не завершился. Попробуйте ещё раз.".to_string())?
        .map_err(|e| format!("Semaphore error: {}", e))?;
    let api_key = api_key
        .trim_matches('"')
        .trim_matches('\'')
        .trim()
        .to_string();
    if api_key.is_empty() {
        return Err("Gemini key empty".to_string());
    }

    let client = crate::utils::shared_http_client();

    let format_model = app
        .try_state::<crate::state::CustomModels>()
        .and_then(|s| {
            s.0.lock()
                .ok()
                .and_then(|m| m.get("gemini_format").cloned())
        })
        .unwrap_or_else(|| GEMINI_MODEL.to_string());

    let url = format!(
        "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent?key={}",
        format_model, api_key
    );

    let style_state = app.state::<FormattingStyleState>();
    let style = *style_state.0.lock().unwrap_or_else(|e| e.into_inner());

    let style_prompt = match style {
        FormattingStyle::Casual => crate::prompts::FORMAT_STYLE_LIGHT,
        FormattingStyle::Professional => crate::prompts::FORMAT_STYLE_DEEP,
    };

    let system_prompt = format!(
        "{}\n\n{}\n\n{}",
        crate::prompts::REFINEMENT_SYSTEM_PROMPT,
        style_prompt,
        crate::prompts::FORMAT_STYLE_UNIVERSAL_RULE
    );
    let combined_user_text = build_refinement_user_content(instruction, &text);

    let body = json!({
        "systemInstruction": {
            "parts": [{ "text": system_prompt }]
        },
        "contents": [{
            "role": "user",
            "parts": [{ "text": combined_user_text }]
        }],
        "generationConfig": {
            "temperature": crate::prompts::DEFAULT_TEMPERATURE,
            "topP": crate::prompts::DEFAULT_TOP_P,
            "maxOutputTokens": 2048
        }
    });

    let res = client
        .post(&url)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Gemini Request failed: {}", e))?;

    let status = res.status();
    let body_text = res.text().await.unwrap_or_default();

    if !status.is_success() {
        log::error!("Gemini refinement error: {} ({})", status, GEMINI_MODEL);
        return Err(format!(
            "Gemini AI Refinement Failed ({}): {}",
            status, body_text
        ));
    }

    let json: serde_json::Value =
        serde_json::from_str(&body_text).map_err(|e| format!("JSON parse error: {}", e))?;
    let content = json["candidates"][0]["content"]["parts"][0]["text"]
        .as_str()
        .unwrap_or("");

    let cleaned = crate::utils::clean_repetitive_phrases(content);
    let final_text = crate::utils::strip_filler_phrases(&cleaned);

    let _ = app.emit("ai-result", &final_text);

    Ok(final_text)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn build_refinement_with_custom_instruction() {
        let result =
            build_refinement_user_content(Some("Clean this text".to_string()), "hello world");
        assert!(result.starts_with("Clean this text"));
        assert!(result.contains("hello world"));
        assert!(result.contains(crate::prompts::REFINEMENT_USER_DELIMITER));
        assert!(result.ends_with(crate::prompts::REFINEMENT_USER_SUFFIX));
    }

    #[test]
    fn build_refinement_with_default_instruction() {
        let result = build_refinement_user_content(None, "test text");
        assert!(result.contains(crate::prompts::REFINEMENT_USER_INSTRUCTION_GENERIC));
        assert!(result.contains("test text"));
    }

    #[test]
    fn build_refinement_preserves_text_content() {
        let result = build_refinement_user_content(None, "привет мир, hello world");
        assert!(result.contains("привет мир, hello world"));
    }

    #[test]
    fn build_refinement_empty_text() {
        let result = build_refinement_user_content(None, "");
        assert!(!result.is_empty()); // instruction + delimiters still present
        assert!(result.contains(crate::prompts::REFINEMENT_USER_DELIMITER));
    }

    #[test]
    fn model_defaults_are_valid_non_empty_strings() {
        assert!(!GROQ_STT_MODEL.is_empty());
        assert!(!GROQ_REFINEMENT_MODEL.is_empty());
        assert!(!GEMINI_MODEL.is_empty());
        assert!(GROQ_STT_MODEL.contains("whisper"));
        assert!(GEMINI_MODEL.contains("gemini"));
    }
}
