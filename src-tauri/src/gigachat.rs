use crate::state::{FormattingStyle, FormattingStyleState};
use serde_json::json;
use std::sync::Mutex;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Manager, Runtime};

/// GigaChat (Sber) text refinement.
///
/// Auth model: the user pastes an *authorization key* (Base64 of
/// `client_id:client_secret`) into the API-key field. GigaChat then issues a
/// short-lived OAuth access token (30 minutes) which is cached here and
/// refreshed automatically on expiry or on a 401/403 response.
///
/// Endpoints (current as of 2026-07-17):
/// - OAuth:  POST https://api.giga.chat/api/v2/oauth
/// - Chat:   POST https://api.giga.chat/v1/chat/completions (OpenAI-compatible)
const OAUTH_URL: &str = "https://api.giga.chat/api/v2/oauth";
const CHAT_URL: &str = "https://api.giga.chat/v1/chat/completions";
const MODEL: &str = "GigaChat-2";
const TOKEN_TTL: Duration = Duration::from_secs(30 * 60); // 30 minutes
const TOKEN_REFRESH_MARGIN: Duration = Duration::from_secs(60);

/// Cached access token + when it was obtained. Guarded by a static mutex so
/// repeated refinements reuse the token instead of hitting the OAuth endpoint.
static TOKEN_CACHE: Mutex<Option<(String, Instant)>> = Mutex::new(None);

/// The authorization key the user pastes is already `base64(client_id:client_secret)`.
fn auth_header_value(auth_key: &str) -> String {
    format!("Basic {}", auth_key.trim())
}

/// Builds an HTTP client. GigaChat's certificate chain is issued by the
/// Russian Trusted Sub CA (Минцифры), which macOS does not trust by default.
/// We first try the system trust store; if TLS verification fails at runtime,
/// callers fall back to `insecure_client()` so the integration still works
/// until the user installs the root certificate.
fn client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .connect_timeout(Duration::from_secs(8))
        .timeout(Duration::from_secs(30))
        .build()
        .map_err(|e| format!("Client build failed: {}", e))
}

/// Fallback client that skips certificate verification. Needed because the
/// GigaChat cert is signed by a Russian CA that macOS doesn't trust out of the
/// box. Prefer installing the root cert; this is a pragmatic fallback.
fn insecure_client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .connect_timeout(Duration::from_secs(8))
        .timeout(Duration::from_secs(30))
        .danger_accept_invalid_certs(true)
        .build()
        .map_err(|e| format!("Client build failed: {}", e))
}

/// Runs `f` with the secure client; retries once with the insecure client on a
/// TLS/connect failure, so a missing Russian root CA doesn't block the feature.
async fn send_with_fallback<F>(
    secure: &reqwest::Client,
    insecure: &reqwest::Client,
    f: F,
) -> Result<reqwest::Response, reqwest::Error>
where
    F: Fn(&reqwest::Client) -> reqwest::RequestBuilder,
{
    match f(secure).send().await {
        Ok(resp) => Ok(resp),
        Err(e) => {
            // Retry with certificate validation disabled only for TLS/cert errors.
            if e.is_connect() || e.is_timeout() {
                log::warn!("GigaChat TLS/connect failed, retrying without cert verification: {}", e);
                f(insecure).send().await
            } else {
                Err(e)
            }
        }
    }
}

/// Returns a valid access token, fetching (or refreshing) it if needed.
async fn get_access_token(auth_key: &str) -> Result<String, String> {
    // Fast path: cached, still fresh.
    if let Ok(cache) = TOKEN_CACHE.lock() {
        if let Some((token, obtained)) = cache.as_ref() {
            if obtained.elapsed() < TOKEN_TTL - TOKEN_REFRESH_MARGIN {
                return Ok(token.clone());
            }
        }
    }

    let secure = client()?;
    let insecure = insecure_client()?;
    let rquid = uuid::Uuid::new_v4().to_string();

    let res = send_with_fallback(&secure, &insecure, |c| {
        c.post(OAUTH_URL)
            .header("Content-Type", "application/x-www-form-urlencoded")
            .header("Accept", "application/json")
            .header("RqUID", &rquid)
            .header("Authorization", auth_header_value(auth_key))
            .body("scope=GIGACHAT_API_PERS")
    })
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
    let user_instruction =
        instruction.unwrap_or_else(|| crate::prompts::REFINEMENT_USER_INSTRUCTION_GENERIC.to_string());
    format!(
        "{}{}{}{}",
        user_instruction,
        crate::prompts::REFINEMENT_USER_DELIMITER,
        text,
        crate::prompts::REFINEMENT_USER_SUFFIX
    )
}

async fn chat_once(
    secure: &reqwest::Client,
    insecure: &reqwest::Client,
    access_token: &str,
    system_prompt: &str,
    user_content: &str,
) -> Result<String, String> {
    let body = json!({
        "model": MODEL,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content}
        ],
        "temperature": crate::prompts::DEFAULT_TEMPERATURE,
        "top_p": crate::prompts::DEFAULT_TOP_P
    });

    let res = send_with_fallback(secure, insecure, |c| {
        c.post(CHAT_URL)
            .header("Authorization", format!("Bearer {}", access_token))
            .header("Content-Type", "application/json")
            .json(&body)
    })
    .await
    .map_err(|e| format!("GigaChat request failed: {}", e))?;

    let status = res.status();
    let body_text = res.text().await.unwrap_or_default();

    if !status.is_success() {
        return Err(format!("{}|{}", status.as_u16(), body_text));
    }

    let json: serde_json::Value = serde_json::from_str(&body_text)
        .map_err(|e| format!("GigaChat parse error: {}", e))?;
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

    let secure = client()?;
    let insecure = insecure_client()?;
    let system_prompt = build_system_prompt(&app);
    let user_content = build_user_content(instruction, &text);

    // Attempt with a fresh token (the fast path in get_access_token may return
    // a cached one; force-invalidation on auth failure happens via the retry).
    let token = get_access_token(&auth_key).await?;
    match chat_once(&secure, &insecure, &token, &system_prompt, &user_content).await {
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
                let token = get_access_token(&auth_key).await?;
                match chat_once(&secure, &insecure, &token, &system_prompt, &user_content).await {
                    Ok(out) => {
                        let cleaned = crate::utils::clean_repetitive_phrases(&out);
                        return Ok(crate::utils::strip_filler_phrases(&cleaned));
                    }
                    Err(e2) => {
                        let code2 = e2.split('|').next().unwrap_or("").to_string();
                        if code2 == "429" {
                            return Err("GigaChat: превышен лимит запросов (429). Попробуйте позже.".to_string());
                        }
                        return Err(format!("GigaChat AI Refinement Failed: {}", e2));
                    }
                }
            }
            if code == "429" {
                return Err("GigaChat: превышен лимит запросов (429). Попробуйте позже.".to_string());
            }
            Err(format!("GigaChat AI Refinement Failed: {}", e))
        }
    }
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
