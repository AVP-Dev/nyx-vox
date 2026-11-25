use crate::state::AudioBuffer;
use futures_util::StreamExt;
use serde_json::Value;
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc, Mutex,
};
use tauri::{AppHandle, Emitter, Runtime};
use tokio::sync::mpsc;
use tokio_tungstenite::tungstenite::{
    client::IntoClientRequest,
    http::{HeaderName, HeaderValue, Request},
    Message,
};

pub type AudioChunkReceiver = mpsc::Receiver<Vec<u8>>;

pub async fn pipe_audio_chunks(
    source: Arc<Mutex<AudioBuffer>>,
    recording_flag: Arc<AtomicBool>,
    sender: mpsc::Sender<Vec<u8>>,
    noise_gate: f32,
) -> Result<(), String> {
    let mut copied_len = 0usize;
    let mut stopped_empty_ticks = 0u8;
    let mut speech_hangover_frames = 0u8;

    loop {
        let (delta, sample_rate) = {
            let lock = source.lock().map_err(|e| e.to_string())?;
            let sample_rate = lock.sample_rate;
            let delta = if sample_rate == 0 {
                Vec::new()
            } else {
                crate::utils::copy_audio_delta(&lock.samples, &mut copied_len)
            };
            (delta, sample_rate)
        };

        if delta.is_empty() {
            if !recording_flag.load(Ordering::SeqCst) {
                stopped_empty_ticks += 1;
                if stopped_empty_ticks >= 2 {
                    return Ok(());
                }
            }
            tokio::time::sleep(std::time::Duration::from_millis(80)).await;
            continue;
        }

        stopped_empty_ticks = 0;
        let resampled = crate::utils::resample_to_16k(&delta, sample_rate, 16_000);
        let chunk_rms =
            (resampled.iter().map(|s| s * s).sum::<f32>() / resampled.len().max(1) as f32).sqrt();

        // If chunk energy is above noise gate, maintain a ~320ms (4 frames @ 80ms) speech hangover
        // to ensure trailing consonants, pauses and fading syllables are never clipped.
        let is_speech = chunk_rms >= noise_gate;
        if is_speech {
            speech_hangover_frames = 4;
        } else if speech_hangover_frames > 0 {
            speech_hangover_frames -= 1;
        }

        // If speech is active or within hangover window, stream true audio.
        // Otherwise, stream clean digital silence (16-bit zeros) so background TV or ambient
        // noise does not bleed into realtime cloud STT while preserving timing & socket sync.
        let pcm = if is_speech || speech_hangover_frames > 0 || noise_gate <= 0.0005 {
            crate::utils::samples_to_i16_pcm(&resampled)
        } else {
            vec![0u8; resampled.len() * 2]
        };

        sender
            .send(pcm)
            .await
            .map_err(|_| "Cloud STT session closed".to_string())?;
    }
}

pub fn emit_interim<R: Runtime>(app: &AppHandle<R>, text: &str) -> Result<(), String> {
    app.emit("interim-transcription", text)
        .map_err(|e| format!("Не удалось отправить промежуточную транскрипцию в интерфейс: {e}"))
}

pub fn response_error(provider: &str, status: reqwest::StatusCode, body: &str) -> String {
    let detail = body.trim();
    let detail = if detail.is_empty() {
        "без описания ошибки"
    } else {
        detail
    };
    format!("{provider}: HTTP {status}: {detail}")
}

pub fn authorized_websocket_request(
    url: &str,
    header: &'static str,
    value: &str,
) -> Result<Request<()>, String> {
    let mut request = url
        .into_client_request()
        .map_err(|e| format!("WebSocket URL: {e}"))?;
    let name = HeaderName::from_static(header);
    let value = HeaderValue::from_str(value).map_err(|e| format!("WebSocket auth header: {e}"))?;
    request.headers_mut().insert(name, value);
    Ok(request)
}

pub async fn next_json<S>(stream: &mut S, provider: &str) -> Result<Option<Value>, String>
where
    S: futures_util::Stream<Item = Result<Message, tokio_tungstenite::tungstenite::Error>> + Unpin,
{
    while let Some(frame) = stream.next().await {
        let frame = frame.map_err(|e| format!("{provider} WebSocket: {e}"))?;
        if let Message::Text(text) = frame {
            let value = serde_json::from_str(&text)
                .map_err(|e| format!("{provider}: invalid JSON response: {e}"))?;
            return Ok(Some(value));
        }
    }
    Ok(None)
}
