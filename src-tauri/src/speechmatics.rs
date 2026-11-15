use crate::cloud_stt::{self, AudioChunkReceiver};
use futures_util::SinkExt;
use serde_json::{json, Value};
use tauri::{AppHandle, Runtime};
use tokio::time::{timeout, Duration};
use tokio_tungstenite::{connect_async, tungstenite::Message};

const REALTIME_URL: &str = "wss://global.rt.speechmatics.com/v2/";

pub async fn stream_realtime<R: Runtime>(
    app: AppHandle<R>,
    api_key: &str,
    language: &str,
    mut audio: AudioChunkReceiver,
) -> Result<String, String> {
    let request = cloud_stt::authorized_websocket_request(
        REALTIME_URL,
        "authorization",
        &format!("Bearer {api_key}"),
    )?;
    let (mut socket, _) = connect_async(request)
        .await
        .map_err(|e| format!("Speechmatics WebSocket connection failed: {e}"))?;
    start_session(&mut socket, language).await?;

    let mut transcript = String::new();
    let mut chunk_count = 0u64;
    let mut audio_ended = false;
    while !audio_ended {
        tokio::select! {
            chunk = audio.recv() => match chunk {
                Some(bytes) => {
                    socket.send(Message::Binary(bytes.into())).await
                        .map_err(|e| format!("Speechmatics audio send failed: {e}"))?;
                    chunk_count += 1;
                }
                None => audio_ended = true,
            },
            event = cloud_stt::next_json(&mut socket, "Speechmatics") => {
                let Some(event) = event? else { return Ok(transcript.trim().to_string()); };
                apply_event(&app, &event, &mut transcript)?;
            }
        }
    }

    socket
        .send(Message::Text(
            json!({"message": "EndOfStream", "last_seq_no": chunk_count})
                .to_string()
                .into(),
        ))
        .await
        .map_err(|e| format!("Speechmatics EndOfStream failed: {e}"))?;
    await_end(&app, &mut socket, &mut transcript).await?;
    Ok(transcript.trim().to_string())
}

async fn start_session<S>(socket: &mut S, language: &str) -> Result<(), String>
where
    S: futures_util::Stream<Item = Result<Message, tokio_tungstenite::tungstenite::Error>>
        + futures_util::Sink<Message, Error = tokio_tungstenite::tungstenite::Error>
        + Unpin,
{
    let transcription_config = if language == "multi" {
        json!({
            "language": language,
            "model": "melia-1",
            "language_hints": ["ru", "en"],
            "enable_partials": true
        })
    } else {
        json!({
            "language": language,
            "model": "enhanced",
            "enable_partials": true
        })
    };
    let message = json!({
        "message": "StartRecognition",
        "audio_format": {"type": "raw", "encoding": "pcm_s16le", "sample_rate": 16000},
        "transcription_config": transcription_config
    });
    socket
        .send(Message::Text(message.to_string().into()))
        .await
        .map_err(|e| format!("Speechmatics StartRecognition failed: {e}"))?;
    let event = timeout(
        Duration::from_secs(10),
        cloud_stt::next_json(socket, "Speechmatics"),
    )
    .await
    .map_err(|_| "Speechmatics recognition start timed out".to_string())??
    .ok_or_else(|| "Speechmatics closed before RecognitionStarted".to_string())?;
    match event
        .get("message")
        .and_then(Value::as_str)
        .unwrap_or_default()
    {
        "RecognitionStarted" => Ok(()),
        "Error" => Err(format!("Speechmatics: {event}")),
        value => Err(format!(
            "Speechmatics expected RecognitionStarted, received {value}"
        )),
    }
}

fn apply_event<R: Runtime>(
    app: &AppHandle<R>,
    event: &Value,
    transcript: &mut String,
) -> Result<(), String> {
    if let Some((text, partial)) = transcript_from_event(event) {
        if partial {
            cloud_stt::emit_interim(app, &format!("{transcript}{text}"))?;
        } else {
            *transcript = crate::utils::safe_space_concatenate(transcript, text);
            cloud_stt::emit_interim(app, transcript)?;
        }
    } else if event.get("message").and_then(Value::as_str) == Some("Error") {
        return Err(format!("Speechmatics: {event}"));
    }
    Ok(())
}

fn transcript_from_event(event: &Value) -> Option<(&str, bool)> {
    let partial = match event.get("message").and_then(Value::as_str)? {
        "AddPartialTranscript" => true,
        "AddTranscript" => false,
        _ => return None,
    };
    let text = event.get("metadata")?.get("transcript")?.as_str()?;
    Some((text, partial))
}

async fn await_end<R: Runtime>(
    app: &AppHandle<R>,
    socket: &mut tokio_tungstenite::WebSocketStream<
        tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>,
    >,
    transcript: &mut String,
) -> Result<(), String> {
    let deadline = tokio::time::Instant::now() + Duration::from_secs(20);
    loop {
        let remaining = deadline.saturating_duration_since(tokio::time::Instant::now());
        if remaining.is_zero() {
            return Err("Speechmatics final transcript timed out".to_string());
        }
        let event = timeout(remaining, cloud_stt::next_json(socket, "Speechmatics"))
            .await
            .map_err(|_| "Speechmatics final transcript timed out".to_string())??
            .ok_or_else(|| "Speechmatics closed before EndOfTranscript".to_string())?;
        if event.get("message").and_then(Value::as_str) == Some("EndOfTranscript") {
            return Ok(());
        }
        apply_event(app, &event, transcript)?;
    }
}

#[cfg(test)]
mod tests {
    use super::transcript_from_event;
    use serde_json::json;

    #[test]
    fn distinguishes_partial_and_final_transcripts() {
        assert_eq!(
            transcript_from_event(&json!({
                "message":"AddPartialTranscript",
                "metadata":{"transcript":"hello"}
            })),
            Some(("hello", true))
        );
        assert_eq!(
            transcript_from_event(&json!({
                "message":"AddTranscript",
                "metadata":{"transcript":"hello there"}
            })),
            Some(("hello there", false))
        );
    }
}
