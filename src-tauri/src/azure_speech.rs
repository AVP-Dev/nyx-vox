use crate::cloud_stt::{self, AudioChunkReceiver};
use base64::{engine::general_purpose::STANDARD, Engine as _};
use futures_util::SinkExt;
use serde_json::{json, Value};
use tauri::{AppHandle, Runtime};
use tokio::time::{timeout, Duration};
use tokio_tungstenite::{connect_async, tungstenite::Message};

pub async fn stream_realtime<R: Runtime>(
    app: AppHandle<R>,
    endpoint: &str,
    deployment: &str,
    api_key: &str,
    mut audio: AudioChunkReceiver,
) -> Result<String, String> {
    let url = realtime_url(endpoint)?;
    let request = cloud_stt::authorized_websocket_request(&url, "api-key", api_key)?;
    let (mut socket, _) = connect_async(request)
        .await
        .map_err(|e| format!("Azure Speech WebSocket connection failed: {e}"))?;
    await_session_created(&mut socket).await?;
    configure_session(&mut socket, deployment).await?;

    let mut transcript = String::new();
    let mut segment_delta = String::new();
    let mut audio_ended = false;
    while !audio_ended {
        tokio::select! {
            chunk = audio.recv() => match chunk {
                Some(bytes) => send_audio(&mut socket, bytes).await?,
                None => audio_ended = true,
            },
            event = cloud_stt::next_json(&mut socket, "Azure Speech") => {
                let Some(event) = event? else { return Ok(transcript.trim().to_string()); };
                apply_event(&app, &event, &mut transcript, &mut segment_delta)?;
            }
        }
    }

    socket
        .send(Message::Text(
            json!({"type": "input_audio_buffer.commit"})
                .to_string()
                .into(),
        ))
        .await
        .map_err(|e| format!("Azure Speech commit failed: {e}"))?;
    await_completed(&app, &mut socket, &mut transcript, &mut segment_delta).await?;
    Ok(transcript.trim().to_string())
}

fn realtime_url(endpoint: &str) -> Result<String, String> {
    let mut url = url::Url::parse(endpoint).map_err(|e| format!("Azure endpoint: {e}"))?;
    if url.scheme() != "https" {
        return Err("Azure endpoint must use HTTPS".to_string());
    }
    url.set_scheme("wss")
        .map_err(|_| "Invalid Azure endpoint scheme".to_string())?;
    url.set_path("/mai/v1/realtime");
    url.set_query(Some("intent=transcription"));
    Ok(url.to_string())
}

async fn await_session_created<S>(socket: &mut S) -> Result<(), String>
where
    S: futures_util::Stream<Item = Result<Message, tokio_tungstenite::tungstenite::Error>> + Unpin,
{
    let event = timeout(
        Duration::from_secs(10),
        cloud_stt::next_json(socket, "Azure Speech"),
    )
    .await
    .map_err(|_| "Azure Speech session creation timed out".to_string())??
    .ok_or_else(|| "Azure Speech closed before session.created".to_string())?;
    ensure_event(&event, "session.created")
}

async fn configure_session<S>(socket: &mut S, deployment: &str) -> Result<(), String>
where
    S: futures_util::Stream<Item = Result<Message, tokio_tungstenite::tungstenite::Error>>
        + futures_util::Sink<Message, Error = tokio_tungstenite::tungstenite::Error>
        + Unpin,
{
    let message = json!({
        "type": "session.update",
        "event_id": "nyx-configure-transcription",
        "session": {
            "type": "transcription",
            "audio": {"input": {
                "format": {"type": "audio/pcm", "rate": 16000},
                "transcription": {"model": deployment, "language": null},
                "turn_detection": null,
                "noise_reduction": null
            }}
        }
    });
    socket
        .send(Message::Text(message.to_string().into()))
        .await
        .map_err(|e| format!("Azure Speech session setup failed: {e}"))?;
    let event = timeout(
        Duration::from_secs(10),
        cloud_stt::next_json(socket, "Azure Speech"),
    )
    .await
    .map_err(|_| "Azure Speech session configuration timed out".to_string())??
    .ok_or_else(|| "Azure Speech closed before session.updated".to_string())?;
    ensure_event(&event, "session.updated")
}

fn ensure_event(event: &Value, expected: &str) -> Result<(), String> {
    match event
        .get("type")
        .and_then(Value::as_str)
        .unwrap_or_default()
    {
        value if value == expected => Ok(()),
        "error" => Err(format!("Azure Speech: {event}")),
        value => Err(format!(
            "Azure Speech expected {expected}, received {value}"
        )),
    }
}

#[cfg(test)]
mod tests {
    use super::{ensure_event, realtime_url};
    use serde_json::json;

    #[test]
    fn builds_foundry_realtime_endpoint() {
        assert_eq!(
            realtime_url("https://example.services.ai.azure.com").unwrap(),
            "wss://example.services.ai.azure.com/mai/v1/realtime?intent=transcription"
        );
    }

    #[test]
    fn validates_session_handshake_events() {
        assert!(ensure_event(&json!({"type":"session.created"}), "session.created").is_ok());
        assert!(ensure_event(
            &json!({"type":"error","message":"denied"}),
            "session.created"
        )
        .is_err());
    }
}

async fn send_audio<S>(socket: &mut S, bytes: Vec<u8>) -> Result<(), String>
where
    S: futures_util::Sink<Message, Error = tokio_tungstenite::tungstenite::Error> + Unpin,
{
    let message = json!({"type": "input_audio_buffer.append", "audio": STANDARD.encode(bytes)});
    socket
        .send(Message::Text(message.to_string().into()))
        .await
        .map_err(|e| format!("Azure Speech audio send failed: {e}"))
}

fn apply_event<R: Runtime>(
    app: &AppHandle<R>,
    event: &Value,
    transcript: &mut String,
    segment_delta: &mut String,
) -> Result<(), String> {
    match event
        .get("type")
        .and_then(Value::as_str)
        .unwrap_or_default()
    {
        "conversation.item.input_audio_transcription.delta" => {
            segment_delta.push_str(
                event
                    .get("delta")
                    .and_then(Value::as_str)
                    .unwrap_or_default(),
            );
            cloud_stt::emit_interim(app, &format!("{transcript}{segment_delta}"))?;
        }
        "conversation.item.input_audio_transcription.intermediate" => {
            let partial = event
                .get("intermediate")
                .and_then(Value::as_str)
                .unwrap_or_default();
            cloud_stt::emit_interim(app, &format!("{transcript}{segment_delta}{partial}"))?;
        }
        "conversation.item.input_audio_transcription.completed" => {
            let final_segment = event
                .get("transcript")
                .and_then(Value::as_str)
                .unwrap_or(&segment_delta);
            *transcript = crate::utils::safe_space_concatenate(transcript, final_segment);
            segment_delta.clear();
            cloud_stt::emit_interim(app, transcript)?;
        }
        "error" => return Err(format!("Azure Speech: {event}")),
        _ => {}
    }
    Ok(())
}

async fn await_completed<R: Runtime>(
    app: &AppHandle<R>,
    socket: &mut tokio_tungstenite::WebSocketStream<
        tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>,
    >,
    transcript: &mut String,
    segment_delta: &mut String,
) -> Result<(), String> {
    let deadline = tokio::time::Instant::now() + Duration::from_secs(20);
    loop {
        let remaining = deadline.saturating_duration_since(tokio::time::Instant::now());
        if remaining.is_zero() {
            return Err("Azure Speech final transcription timed out".to_string());
        }
        let event = timeout(remaining, cloud_stt::next_json(socket, "Azure Speech"))
            .await
            .map_err(|_| "Azure Speech final transcription timed out".to_string())??
            .ok_or_else(|| "Azure Speech closed before transcription.completed".to_string())?;
        let completed = event.get("type").and_then(Value::as_str)
            == Some("conversation.item.input_audio_transcription.completed");
        apply_event(app, &event, transcript, segment_delta)?;
        if completed {
            return Ok(());
        }
    }
}
