use crate::cloud_stt::{self, AudioChunkReceiver};
use base64::{engine::general_purpose::STANDARD, Engine as _};
use futures_util::SinkExt;
use serde_json::{json, Value};
use tauri::{AppHandle, Runtime};
use tokio::time::{timeout, Duration, Instant};
use tokio_tungstenite::{connect_async, tungstenite::Message};

const REALTIME_URL: &str = "wss://api.elevenlabs.io/v1/speech-to-text/realtime";
const BATCH_URL: &str = "https://api.elevenlabs.io/v1/speech-to-text";

pub async fn transcribe_batch(
    audio: Vec<u8>,
    api_key: &str,
    language: Option<&str>,
) -> Result<String, String> {
    let file = reqwest::multipart::Part::bytes(audio)
        .file_name("recording.wav")
        .mime_str("audio/wav")
        .map_err(|e| e.to_string())?;
    let mut form = reqwest::multipart::Form::new()
        .part("file", file)
        .text("model_id", "scribe_v3");
    if let Some(code) = language.filter(|value| !value.is_empty()) {
        form = form.text("language_code", code.to_string());
    }

    let response = crate::utils::shared_http_client()
        .post(BATCH_URL)
        .header("xi-api-key", api_key)
        .multipart(form)
        .send()
        .await
        .map_err(|e| format!("ElevenLabs request failed: {e}"))?;
    let status = response.status();
    let body = response.text().await.map_err(|e| e.to_string())?;
    if !status.is_success() {
        return Err(cloud_stt::response_error("ElevenLabs", status, &body));
    }
    batch_text(&body)
}

pub async fn stream_realtime<R: Runtime>(
    app: AppHandle<R>,
    api_key: &str,
    language: Option<&str>,
    mut audio: AudioChunkReceiver,
) -> Result<String, String> {
    let url = realtime_url(language)?;
    let request = cloud_stt::authorized_websocket_request(&url, "xi-api-key", api_key)?;
    let (mut socket, _) = connect_async(request)
        .await
        .map_err(|e| format!("ElevenLabs WebSocket connection failed: {e}"))?;
    await_session_started(&mut socket).await?;
    let mut final_text = String::new();
    let mut audio_ended = false;
    let mut pending_chunk = None;

    while !audio_ended {
        tokio::select! {
            chunk = audio.recv() => match chunk {
                Some(bytes) => {
                    if let Some(previous) = pending_chunk.replace(bytes) {
                        send_audio(&mut socket, previous, false).await?;
                    }
                }
                None => audio_ended = true,
            },
            event = cloud_stt::next_json(&mut socket, "ElevenLabs") => {
                if let Some(event) = event? {
                    apply_event(&app, &event, &mut final_text)?;
                } else {
                    return Ok(final_text);
                }
            }
        }
    }

    let Some(last_chunk) = pending_chunk else {
        return Ok(final_text.trim().to_string());
    };
    send_audio(&mut socket, last_chunk, true).await?;
    finish_stream(&app, &mut socket, &mut final_text).await
}

async fn await_session_started<S>(socket: &mut S) -> Result<(), String>
where
    S: futures_util::Stream<Item = Result<Message, tokio_tungstenite::tungstenite::Error>> + Unpin,
{
    loop {
        let event = timeout(
            Duration::from_secs(10),
            cloud_stt::next_json(socket, "ElevenLabs"),
        )
        .await
        .map_err(|_| "ElevenLabs session start timed out".to_string())??
        .ok_or_else(|| "ElevenLabs closed before session_started".to_string())?;
        match event.get("message_type").and_then(Value::as_str) {
            Some("session_started") => return Ok(()),
            Some("error" | "input_error" | "rate_limited") => {
                return Err(format!("ElevenLabs: {event}"));
            }
            _ => {}
        }
    }
}

fn realtime_url(language: Option<&str>) -> Result<String, String> {
    let mut url = url::Url::parse(REALTIME_URL).map_err(|e| e.to_string())?;
    {
        let mut query = url.query_pairs_mut();
        query.append_pair("model_id", "scribe_v3_live");
        query.append_pair("audio_format", "pcm_16000");
        if let Some(code) = language.filter(|value| !value.is_empty()) {
            query.append_pair("language_code", code);
        }
    }
    Ok(url.to_string())
}

fn batch_text(body: &str) -> Result<String, String> {
    let value: Value =
        serde_json::from_str(body).map_err(|e| format!("ElevenLabs returned invalid JSON: {e}"))?;
    value
        .get("text")
        .and_then(Value::as_str)
        .map(str::to_string)
        .ok_or_else(|| "ElevenLabs response has no transcript text".to_string())
}

#[cfg(test)]
mod tests {
    use super::{batch_text, realtime_url};

    #[test]
    fn parses_batch_transcript() {
        assert_eq!(
            batch_text(r#"{"text":"recognized speech"}"#).unwrap(),
            "recognized speech"
        );
    }

    #[test]
    fn builds_realtime_url_with_language() {
        let url = realtime_url(Some("ru")).unwrap();
        assert!(url.contains("model_id=scribe_v3_live"));
        assert!(url.contains("audio_format=pcm_16000"));
        assert!(url.contains("language_code=ru"));
    }
}

async fn send_audio<S>(socket: &mut S, bytes: Vec<u8>, commit: bool) -> Result<(), String>
where
    S: futures_util::Sink<Message, Error = tokio_tungstenite::tungstenite::Error> + Unpin,
{
    let message = json!({
        "message_type": "input_audio_chunk",
        "audio_base_64": STANDARD.encode(bytes),
        "sample_rate": 16000,
        "commit": commit
    });
    socket
        .send(Message::Text(message.to_string().into()))
        .await
        .map_err(|e| format!("ElevenLabs audio send failed: {e}"))
}

fn apply_event<R: Runtime>(
    app: &AppHandle<R>,
    event: &Value,
    final_text: &mut String,
) -> Result<bool, String> {
    match event
        .get("message_type")
        .and_then(Value::as_str)
        .unwrap_or_default()
    {
        "partial_transcript" => {
            let text = event
                .get("text")
                .and_then(Value::as_str)
                .unwrap_or_default();
            cloud_stt::emit_interim(app, &format!("{final_text}{text}"))?;
        }
        "committed_transcript" => {
            let text = event
                .get("text")
                .and_then(Value::as_str)
                .unwrap_or_default();
            *final_text = crate::utils::safe_space_concatenate(final_text, text);
            cloud_stt::emit_interim(app, final_text)?;
            return Ok(true);
        }
        "error" | "input_error" | "rate_limited" => {
            return Err(format!("ElevenLabs: {}", event));
        }
        _ => {}
    }
    Ok(false)
}

async fn finish_stream<R: Runtime>(
    app: &AppHandle<R>,
    socket: &mut tokio_tungstenite::WebSocketStream<
        tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>,
    >,
    final_text: &mut String,
) -> Result<String, String> {
    let deadline = Instant::now() + Duration::from_secs(10);
    loop {
        let remaining = deadline.saturating_duration_since(Instant::now());
        if remaining.is_zero() {
            break;
        }
        match timeout(remaining, cloud_stt::next_json(socket, "ElevenLabs")).await {
            Ok(Ok(Some(event))) if apply_event(app, &event, final_text)? => break,
            Ok(Ok(Some(_))) => {}
            Ok(Ok(None)) | Err(_) => break,
            Ok(Err(error)) => return Err(error),
        }
    }
    Ok(final_text.trim().to_string())
}
