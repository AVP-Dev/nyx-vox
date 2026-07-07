use base64::{engine::general_purpose, Engine as _};
use serde_json::json;
use std::io::Cursor;
use std::sync::{
    atomic::{AtomicBool, AtomicU64, Ordering},
    Arc, Mutex,
};
use tauri::{AppHandle, Emitter, Manager, Runtime};

use crate::state::{AiSemaphore, FormattingStyle, FormattingStyleState};

// ── Models ───────────────────────────────────────────────────────────────────
const GROQ_STT_MODEL: &str = "whisper-large-v3-turbo";
const GROQ_REFINEMENT_MODEL: &str = "llama-3.3-70b-versatile";
const GEMINI_MODEL: &str = "gemini-2.5-flash";

// ── Shared recording state ────────────────────────────────────────────────────
#[derive(Default)]
pub struct RecordingState {
    pub samples: Vec<f32>,
    pub sample_rate: u32,
}

pub type SharedAiState = Arc<Mutex<RecordingState>>;

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

fn take_recording_wav(state: &SharedAiState, threshold: f32) -> Result<Option<Vec<u8>>, String> {
    let (samples, src_rate) = {
        let mut lock = state.lock().map_err(|e| e.to_string())?;
        let tail = lock.samples.clone();
        let rate = lock.sample_rate;
        lock.samples.clear();
        (tail, rate)
    };

    if samples.is_empty() {
        return Ok(None);
    }

    let min_samples = (src_rate as f64 * 0.8) as usize;
    if samples.len() < min_samples {
        return Ok(None);
    }

    let rms = (samples.iter().map(|s| s * s).sum::<f32>() / samples.len() as f32).sqrt();
    if rms < threshold {
        return Ok(None);
    }

    let processed_samples = crate::utils::resample_to_16k(&samples, src_rate, 16000);
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
            writer
                .write_sample(amplitude)
                .map_err(|e| format!("Write sample error: {}", e))?;
        }
        writer
            .finalize()
            .map_err(|e| format!("Wav finalize error: {}", e))?;
    }

    let wav_data = wav_cursor.into_inner();
    if wav_data.is_empty() {
        return Err("WAV data empty".to_string());
    }

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
                    let _ = app_stream.emit("audio-level", level);
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
                std::thread::sleep(std::time::Duration::from_millis(50));
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
) -> Result<String, String> {
    tokio::time::sleep(std::time::Duration::from_millis(500)).await;
    recording_flag.store(false, Ordering::SeqCst);

    // 1. Acquisition of Semaphore
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

    let Some(wav_data) = take_recording_wav(&state, threshold)? else {
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

    let client = reqwest::Client::builder()
        .connect_timeout(std::time::Duration::from_secs(8))
        .timeout(std::time::Duration::from_secs(45))
        .build()
        .map_err(|e| format!("Client build failed: {}", e))?;
    let part = reqwest::multipart::Part::bytes(wav_data)
        .file_name("audio.wav")
        .mime_str("audio/wav")
        .map_err(|e| e.to_string())?;

    let stt_prompt = if language == "auto" || language == "mixed" {
        format!("{}\n\nVocabulary: {}", crate::prompts::MIXED_RU_EN_STT_PROMPT, crate::prompts::GROQ_STT_PROMPT)
    } else {
        crate::prompts::GROQ_STT_PROMPT.to_string()
    };
    let stt_prompt = if stt_prompt.len() > 896 {
        stt_prompt[..896].to_string()
    } else {
        stt_prompt
    };
    let mut form = reqwest::multipart::Form::new()
        .part("file", part)
        .text("model", GROQ_STT_MODEL)
        .text("prompt", stt_prompt);

    if language != "auto" && language != "mixed" {
        form = form.text("language", language.to_string());
    }

    let res = client
        .post("https://api.groq.com/openai/v1/audio/transcriptions")
        .header("Authorization", format!("Bearer {}", api_key))
        .multipart(form)
        .send()
        .await
        .map_err(|e| {
            log::error!("Groq STT Network Error: {}", e);
            format!("Network error: {}", e)
        })?;

    let status = res.status();
    let body = res.text().await.map_err(|e| format!("Body error: {}", e))?;

    if !status.is_success() {
        return Err(format!("Groq API error: {}", body));
    }

    let json: serde_json::Value =
        serde_json::from_str(&body).map_err(|e| format!("JSON parse error: {}", e))?;
    let text = json["text"].as_str().unwrap_or("").to_string();
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
    _language: &str,
    threshold: f32,
) -> Result<String, String> {
    tokio::time::sleep(std::time::Duration::from_millis(500)).await;
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

    let Some(wav_data) = take_recording_wav(&state, threshold)? else {
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

    let client = reqwest::Client::builder()
        .connect_timeout(std::time::Duration::from_secs(8))
        .timeout(std::time::Duration::from_secs(45))
        .build()
        .map_err(|e| format!("Client build failed: {}", e))?;

    let url = format!(
        "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent?key={}",
        GEMINI_MODEL, api_key
    );
    let audio_b64 = general_purpose::STANDARD.encode(wav_data);
    let body = json!({
        "systemInstruction": {
            "parts": [{ "text": crate::prompts::GEMINI_STT_PROMPT }]
        },
        "contents": [{
            "role": "user",
            "parts": [
                { "text": if _language == "mixed" { crate::prompts::MIXED_RU_EN_STT_PROMPT } else { "Transcribe this audio. Return only the transcript text." } },
                { "inlineData": { "mimeType": "audio/wav", "data": audio_b64 } }
            ]
        }],
        "generationConfig": {
            "temperature": 0.0,
            "topP": crate::prompts::DEFAULT_TOP_P,
            "maxOutputTokens": 2048
        }
    });

    let res = client
        .post(&url)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Gemini STT request failed: {}", e))?;

    let status = res.status();
    let body_text = res.text().await.unwrap_or_default();
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
    let _ = app.emit("ai-status", "✨ Форматирование...");
    // 1. Acquisition of Semaphore
    let semaphore = app.state::<AiSemaphore>();
    let _permit = semaphore
        .0
        .acquire()
        .await
        .map_err(|e| format!("Semaphore error: {}", e))?;
    let api_key = api_key
        .trim_matches('"')
        .trim_matches('\'')
        .trim()
        .to_string();

    if api_key.is_empty() {
        return Err("API ключ Groq не найден.".to_string());
    }

    let client = reqwest::Client::builder()
        .connect_timeout(std::time::Duration::from_secs(8))
        .timeout(std::time::Duration::from_secs(20))
        .build()
        .map_err(|e| format!("Client build failed: {}", e))?;
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

    let body = json!({
        "model": GROQ_REFINEMENT_MODEL,
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
    let _ = app.emit("ai-status", "✨ Форматирование...");
    let semaphore = app.state::<AiSemaphore>();
    let _permit = semaphore
        .0
        .acquire()
        .await
        .map_err(|e| format!("Semaphore error: {}", e))?;
    let api_key = api_key
        .trim_matches('"')
        .trim_matches('\'')
        .trim()
        .to_string();
    if api_key.is_empty() {
        return Err("Gemini key empty".to_string());
    }

    let client = reqwest::Client::builder()
        .connect_timeout(std::time::Duration::from_secs(8))
        .timeout(std::time::Duration::from_secs(20))
        .build()
        .map_err(|e| format!("Client build failed: {}", e))?;
    let url = format!(
        "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent?key={}",
        GEMINI_MODEL, api_key
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
        let result = build_refinement_user_content(
            Some("Clean this text".to_string()),
            "hello world",
        );
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
}
