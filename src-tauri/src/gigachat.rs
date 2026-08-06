use crate::state::{FormattingStyle, FormattingStyleState};
use serde_json::json;
use std::sync::Mutex;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, Manager, Runtime};

/// GigaChat (Sber) text refinement & transcription.
///
/// Auth model: the user pastes an *authorization key* (Base64 of
/// `client_id:client_secret`) into the API-key field. GigaChat then issues a
/// short-lived OAuth access token (30 minutes) which is cached here and
/// refreshed automatically on expiry or on a 401/403 response.
///
/// TLS: both GigaChat endpoints serve certificates issued by the Russian
/// Trusted Sub CA (Минцифры), which macOS does not trust by default. Per the
/// official docs we download the root certificate once and use it as a custom
/// CA bundle instead of disabling verification.
///
/// Endpoints (current as of 2026-08-05):
/// - OAuth:  POST https://ngw.devices.sberbank.ru:9443/api/v2/oauth
/// - Chat:   POST https://api.giga.chat/v1/chat/completions (unified URL since 2026-07-17)
const OAUTH_URL: &str = "https://ngw.devices.sberbank.ru:9443/api/v2/oauth";
const CHAT_URL: &str = "https://api.giga.chat/v1/chat/completions";
const MODEL_FORMAT: &str = "GigaChat-2";
const MODEL_STT: &str = "GigaChat-2-Pro"; // multimodal: text + audio
const TOKEN_TTL: Duration = Duration::from_secs(30 * 60); // 30 minutes
const TOKEN_REFRESH_MARGIN: Duration = Duration::from_secs(60);

/// Russian Trusted Root CA — official download link (gosuslugi.ru).
const ROOT_CA_URL: &str = "https://gu-st.ru/content/lending/russian_trusted_root_ca_pem.crt";
const ROOT_CA_FILE: &str = "russian_trusted_root_ca.pem";

/// Cached access token + when it was obtained. Guarded by a static mutex so
/// repeated refinements reuse the token instead of hitting the OAuth endpoint.
static TOKEN_CACHE: Mutex<Option<(String, Instant)>> = Mutex::new(None);

/// The authorization key the user pastes is already `base64(client_id:client_secret)`.
fn auth_header_value(auth_key: &str) -> String {
    format!("Basic {}", auth_key.trim())
}

/// Path to the downloaded Russian Trusted Root CA (app data dir).
fn root_ca_path<R: Runtime>(app: &AppHandle<R>) -> Result<std::path::PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("App data dir error: {}", e))?;
    std::fs::create_dir_all(&dir).map_err(|e| format!("Create app data dir: {}", e))?;
    Ok(dir.join(ROOT_CA_FILE))
}

/// Ensures the Russian Trusted Root CA is present locally, downloading it once
/// from the official source. Returns the path to the PEM file.
async fn ensure_root_ca<R: Runtime>(app: &AppHandle<R>) -> Result<std::path::PathBuf, String> {
    let path = root_ca_path(app)?;
    if path.exists() {
        return Ok(path);
    }

    log::info!("GigaChat: downloading Russian Trusted Root CA");
    let resp = reqwest::get(ROOT_CA_URL)
        .await
        .map_err(|e| format!("Failed to download root CA: {}", e))?;
    if !resp.status().is_success() {
        return Err(format!(
            "Failed to download root CA: HTTP {}",
            resp.status()
        ));
    }
    let bytes = resp
        .bytes()
        .await
        .map_err(|e| format!("Failed to read root CA: {}", e))?;
    std::fs::write(&path, &bytes).map_err(|e| format!("Failed to write root CA: {}", e))?;
    log::info!("GigaChat: root CA saved to {:?}", path);
    Ok(path)
}

/// Builds an HTTP client with the Russian Trusted Root CA as the trust anchor.
async fn client_with_ca<R: Runtime>(app: &AppHandle<R>) -> Result<reqwest::Client, String> {
    let ca_path = ensure_root_ca(app).await?;
    let ca_pem = std::fs::read(&ca_path).map_err(|e| format!("Read root CA: {}", e))?;
    let ca =
        reqwest::Certificate::from_pem(&ca_pem).map_err(|e| format!("Parse root CA: {}", e))?;

    reqwest::Client::builder()
        .connect_timeout(Duration::from_secs(8))
        .timeout(Duration::from_secs(30))
        .add_root_certificate(ca)
        .build()
        .map_err(|e| format!("Client build failed: {}", e))
}

/// Returns a valid access token, fetching (or refreshing) it if needed.
async fn get_access_token<R: Runtime>(
    app: &AppHandle<R>,
    auth_key: &str,
) -> Result<String, String> {
    // Fast path: cached, still fresh.
    if let Ok(cache) = TOKEN_CACHE.lock() {
        if let Some((token, obtained)) = cache.as_ref() {
            if obtained.elapsed() < TOKEN_TTL - TOKEN_REFRESH_MARGIN {
                return Ok(token.clone());
            }
        }
    }

    // OAuth endpoint requires the Russian Trusted Root CA. The client built
    // with `client_with_ca` already has it as a trust anchor.
    let client = client_with_ca(app).await?;
    let rquid = uuid::Uuid::new_v4().to_string();

    let res = client
        .post(OAUTH_URL)
        .header("Content-Type", "application/x-www-form-urlencoded")
        .header("Accept", "application/json")
        .header("RqUID", &rquid)
        .header("Authorization", auth_header_value(auth_key))
        .body("scope=GIGACHAT_API_PERS")
        .send()
        .await
        .map_err(|e| format!("GigaChat OAuth request failed: {}", e))?;

    let status = res.status();
    let body = res.text().await.unwrap_or_default();
    if !status.is_success() {
        return Err(format!("GigaChat OAuth failed ({}): {}", status, body));
    }

    let json: serde_json::Value =
        serde_json::from_str(&body).map_err(|e| format!("OAuth parse error: {}", e))?;
    let token = json["access_token"]
        .as_str()
        .ok_or_else(|| "GigaChat OAuth response missing access_token".to_string())?
        .to_string();

    if let Ok(mut cache) = TOKEN_CACHE.lock() {
        *cache = Some((token.clone(), Instant::now()));
    }

    Ok(token)
}

fn build_system_prompt<R: Runtime>(app: &AppHandle<R>) -> String {
    let style_state = app.state::<FormattingStyleState>();
    let style = *style_state.0.lock().unwrap_or_else(|e| e.into_inner());

    let style_prompt = match style {
        FormattingStyle::Casual => crate::prompts::FORMAT_STYLE_LIGHT,
        FormattingStyle::Professional => crate::prompts::FORMAT_STYLE_DEEP,
    };

    format!(
        "{}\n\n{}\n\n{}",
        crate::prompts::REFINEMENT_SYSTEM_PROMPT,
        style_prompt,
        crate::prompts::FORMAT_STYLE_UNIVERSAL_RULE
    )
}

fn build_user_content(instruction: Option<String>, text: &str) -> String {
    let user_instruction = instruction
        .unwrap_or_else(|| crate::prompts::REFINEMENT_USER_INSTRUCTION_GENERIC.to_string());
    format!(
        "{}{}{}{}",
        user_instruction,
        crate::prompts::REFINEMENT_USER_DELIMITER,
        text,
        crate::prompts::REFINEMENT_USER_SUFFIX
    )
}

async fn chat_once(
    client: &reqwest::Client,
    access_token: &str,
    model: &str,
    system_prompt: &str,
    user_content: &str,
) -> Result<String, String> {
    let body = json!({
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content}
        ],
        "temperature": crate::prompts::DEFAULT_TEMPERATURE,
        "top_p": crate::prompts::DEFAULT_TOP_P
    });

    let res = client
        .post(CHAT_URL)
        .header("Authorization", format!("Bearer {}", access_token))
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("GigaChat request failed: {}", e))?;

    let status = res.status();
    let body_text = res.text().await.unwrap_or_default();

    if !status.is_success() {
        return Err(format!("{}|{}", status.as_u16(), body_text));
    }

    let json: serde_json::Value =
        serde_json::from_str(&body_text).map_err(|e| format!("GigaChat parse error: {}", e))?;
    let content = json["choices"][0]["message"]["content"]
        .as_str()
        .unwrap_or("");

    Ok(content.to_string())
}

/// Formats raw dictation text through GigaChat.
pub async fn refine_text<R: Runtime>(
    app: AppHandle<R>,
    text: String,
    api_key: String,
    instruction: Option<String>,
) -> Result<String, String> {
    let auth_key = api_key.trim().to_string();
    if auth_key.is_empty() {
        return Err("API ключ GigaChat не найден.".to_string());
    }

    let client = client_with_ca(&app).await?;
    let system_prompt = build_system_prompt(&app);
    let user_content = build_user_content(instruction, &text);

    // Attempt with a fresh token (the fast path in get_access_token may return
    // a cached one; force-invalidation on auth failure happens via the retry).
    let token = get_access_token(&app, &auth_key).await?;
    match chat_once(&client, &token, MODEL_FORMAT, &system_prompt, &user_content).await {
        Ok(out) => {
            let cleaned = crate::utils::clean_repetitive_phrases(&out);
            Ok(crate::utils::strip_filler_phrases(&cleaned))
        }
        Err(e) => {
            // Distinguish auth failures (401/403) — token expired → refresh once.
            let code = e.split('|').next().unwrap_or("").to_string();
            if code == "401" || code == "403" {
                if let Ok(mut cache) = TOKEN_CACHE.lock() {
                    *cache = None; // invalidate
                }
                let token = get_access_token(&app, &auth_key).await?;
                match chat_once(&client, &token, MODEL_FORMAT, &system_prompt, &user_content).await
                {
                    Ok(out) => {
                        let cleaned = crate::utils::clean_repetitive_phrases(&out);
                        return Ok(crate::utils::strip_filler_phrases(&cleaned));
                    }
                    Err(e2) => {
                        let code2 = e2.split('|').next().unwrap_or("").to_string();
                        if code2 == "429" {
                            return Err(
                                "GigaChat: превышен лимит запросов (429). Попробуйте позже."
                                    .to_string(),
                            );
                        }
                        return Err(format!("GigaChat AI Refinement Failed: {}", e2));
                    }
                }
            }
            if code == "429" {
                return Err(
                    "GigaChat: превышен лимит запросов (429). Попробуйте позже.".to_string()
                );
            }
            Err(format!("GigaChat AI Refinement Failed: {}", e))
        }
    }
}

/// Transcribe audio via GigaChat 2 Pro (multimodal: audio → text).
/// Reuses the same OAuth token cache as formatting.
pub async fn transcribe<R: Runtime>(
    app: AppHandle<R>,
    wav_data: Vec<u8>,
    api_key: String,
    language: &str,
) -> Result<String, String> {
    let auth_key = api_key.trim().to_string();
    if auth_key.is_empty() {
        return Err("API ключ GigaChat не найден.".to_string());
    }

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

    let client = client_with_ca(&app).await?;
    let token = get_access_token(&app, &auth_key).await?;

    // GigaChat doesn't accept inline audio like OpenAI. Audio must be uploaded
    // to /v1/files first, then referenced by id via `attachments`.
    let file_part = reqwest::multipart::Part::bytes(wav_data)
        .file_name("recording.wav")
        .mime_str("audio/wav")
        .map_err(|e| e.to_string())?;
    let form = reqwest::multipart::Form::new()
        .part("file", file_part)
        .text("purpose", "general");

    let file_res = client
        .post("https://api.giga.chat/v1/files")
        .header("Authorization", format!("Bearer {}", token))
        .multipart(form)
        .send()
        .await
        .map_err(|e| format!("GigaChat file upload failed: {}", e))?;
    let file_status = file_res.status();
    let file_body = file_res.text().await.unwrap_or_default();
    if !file_status.is_success() {
        return Err(format!(
            "GigaChat file upload failed ({}): {}",
            file_status, file_body
        ));
    }
    let file_json: serde_json::Value = serde_json::from_str(&file_body)
        .map_err(|e| format!("GigaChat file upload parse error: {}", e))?;
    let file_id = file_json["id"]
        .as_str()
        .ok_or_else(|| format!("GigaChat file upload missing id: {}", file_body))?
        .to_string();
    log::info!("GigaChat: audio uploaded, file_id={}", file_id);

    let stt_prompt = if language == "mixed" {
        crate::prompts::MIXED_RU_EN_STT_PROMPT
    } else {
        crate::prompts::GEMINI_STT_PROMPT
    };

    let body = json!({
        "model": MODEL_STT,
        "function_call": "auto",
        "messages": [
            {
                "role": "user",
                "content": stt_prompt,
                "attachments": [file_id]
            }
        ],
        "temperature": 0.0,
        "max_tokens": 2048
    });

    let res = client
        .post(CHAT_URL)
        .header("Authorization", format!("Bearer {}", token))
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("GigaChat STT request failed: {}", e))?;

    let status = res.status();
    if status == reqwest::StatusCode::UNAUTHORIZED || status == reqwest::StatusCode::FORBIDDEN {
        if let Ok(mut cache) = TOKEN_CACHE.lock() {
            *cache = None;
        }
        let token = get_access_token(&app, &auth_key).await?;
        let res2 = client
            .post(CHAT_URL)
            .header("Authorization", format!("Bearer {}", token))
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("GigaChat STT retry failed: {}", e))?;
        let status2 = res2.status();
        let body2 = res2.text().await.unwrap_or_default();
        if !status2.is_success() {
            return Err(format!("GigaChat STT Failed ({}): {}", status2, body2));
        }
        let json2: serde_json::Value =
            serde_json::from_str(&body2).map_err(|e| format!("JSON parse error: {}", e))?;
        let text = json2["choices"][0]["message"]["content"]
            .as_str()
            .unwrap_or("")
            .to_string();
        let cleaned = crate::utils::clean_repetitive_phrases(&text);
        return Ok(json!({ "content": cleaned }).to_string());
    }

    let body_text = res.text().await.unwrap_or_default();
    if !status.is_success() {
        return Err(format!("GigaChat STT Failed ({}): {}", status, body_text));
    }

    let json: serde_json::Value =
        serde_json::from_str(&body_text).map_err(|e| format!("JSON parse error: {}", e))?;
    let text = json["choices"][0]["message"]["content"]
        .as_str()
        .unwrap_or("")
        .to_string();
    let cleaned = crate::utils::clean_repetitive_phrases(&text);
    Ok(json!({ "content": cleaned }).to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn auth_header_is_basic() {
        let v = auth_header_value("abc123");
        assert!(v.starts_with("Basic "));
        assert_eq!(v, "Basic abc123");
    }

    #[test]
    fn auth_header_trims_whitespace() {
        let v = auth_header_value("  abc123  ");
        assert_eq!(v, "Basic abc123");
    }

    #[test]
    fn user_content_wraps_text_with_delimiters() {
        let c = build_user_content(None, "привет мир");
        assert!(c.contains("привет мир"));
        assert!(c.contains(crate::prompts::REFINEMENT_USER_DELIMITER));
        assert!(c.ends_with(crate::prompts::REFINEMENT_USER_SUFFIX));
    }
}
