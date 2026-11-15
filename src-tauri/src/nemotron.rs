use futures_util::StreamExt;
use serde::Serialize;
use sha2::{Digest, Sha256};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use tauri::{AppHandle, Emitter, Runtime};

const MODEL_FILENAME: &str = "nemotron-3.5-asr-streaming-0.6b.q8_0.gguf";
const MODEL_URL: &str = "https://huggingface.co/nvidia/nemotron-3.5-asr-streaming-0.6b/resolve/main/nemotron-3.5-asr-streaming-0.6b.q8_0.gguf";
const MODEL_SIZE_BYTES: u64 = 742_090_464;
const MODEL_SHA256: &str = "3fc991d3badad7277c11030a7519832cddaf2057aafed6d4b25147e953a070b1";
const PROGRESS_EVENT: &str = "nemotron-download-progress";

#[derive(Default)]
pub struct NemotronDownloadState {
    active: AtomicBool,
    downloaded_bytes: AtomicU64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NemotronModelStatus {
    available: bool,
    downloading: bool,
    progress: u8,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct DownloadProgress {
    downloaded_bytes: u64,
    total_bytes: u64,
    percent: u8,
}

struct DownloadGuard<'a>(&'a NemotronDownloadState);

impl Drop for DownloadGuard<'_> {
    fn drop(&mut self) {
        self.0.downloaded_bytes.store(0, Ordering::SeqCst);
        self.0.active.store(false, Ordering::SeqCst);
    }
}

pub fn model_status(state: &NemotronDownloadState) -> NemotronModelStatus {
    let available = model_path().is_file()
        && std::fs::metadata(model_path())
            .map(|metadata| metadata.len() == MODEL_SIZE_BYTES)
            .unwrap_or(false);
    let downloading = state.active.load(Ordering::SeqCst);
    let downloaded = state.downloaded_bytes.load(Ordering::SeqCst);
    NemotronModelStatus {
        available,
        downloading,
        progress: if available {
            100
        } else if downloading {
            progress_percent(downloaded)
        } else {
            0
        },
    }
}

pub async fn download_model<R: Runtime>(
    app: AppHandle<R>,
    state: &NemotronDownloadState,
) -> Result<(), String> {
    state
        .active
        .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
        .map_err(|_| "Загрузка Nemotron уже выполняется.".to_string())?;
    let _guard = DownloadGuard(state);

    if model_status(state).available {
        return Err("Модель Nemotron уже скачана.".to_string());
    }

    state.downloaded_bytes.store(0, Ordering::SeqCst);
    let temp_path = model_temp_path();
    let result = download_to_temp(&app, state, &temp_path).await;
    if result.is_err() {
        if let Err(error) = std::fs::remove_file(&temp_path) {
            if error.kind() != std::io::ErrorKind::NotFound {
                log::warn!("Could not remove partial Nemotron model: {error}");
            }
        }
    }
    result
}

async fn download_to_temp<R: Runtime>(
    app: &AppHandle<R>,
    state: &NemotronDownloadState,
    temp_path: &Path,
) -> Result<(), String> {
    let model_dir = crate::whisper::get_model_dir();
    std::fs::create_dir_all(&model_dir).map_err(|e| format!("Create models directory: {e}"))?;
    remove_existing_temp(temp_path)?;

    let client = reqwest::Client::builder()
        .user_agent("NYX-Vox-App/1.6")
        .build()
        .map_err(|e| format!("Create download client: {e}"))?;
    let response = client
        .get(MODEL_URL)
        .send()
        .await
        .map_err(|e| format!("Download Nemotron model: {e}"))?
        .error_for_status()
        .map_err(|e| format!("Nemotron server response: {e}"))?;
    if response
        .content_length()
        .is_some_and(|length| length != MODEL_SIZE_BYTES)
    {
        return Err("Размер файла Nemotron не совпадает с ожидаемым.".to_string());
    }

    let mut file = tokio::fs::File::create(temp_path)
        .await
        .map_err(|e| format!("Create temporary model file: {e}"))?;
    let mut stream = response.bytes_stream();
    let mut hasher = Sha256::new();
    let mut downloaded = 0_u64;
    use tokio::io::AsyncWriteExt;

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| format!("Read Nemotron download: {e}"))?;
        downloaded = downloaded.saturating_add(chunk.len() as u64);
        if downloaded > MODEL_SIZE_BYTES {
            return Err("Файл Nemotron превышает ожидаемый размер.".to_string());
        }
        file.write_all(&chunk)
            .await
            .map_err(|e| format!("Write Nemotron model: {e}"))?;
        hasher.update(&chunk);
        state.downloaded_bytes.store(downloaded, Ordering::SeqCst);
        emit_progress(app, downloaded);
    }

    file.flush()
        .await
        .map_err(|e| format!("Flush Nemotron model: {e}"))?;
    file.sync_all()
        .await
        .map_err(|e| format!("Sync Nemotron model: {e}"))?;
    drop(file);

    let actual_hash = format!("{:x}", hasher.finalize());
    validate_download(downloaded, &actual_hash)?;

    let final_path = model_path();
    if final_path.exists() {
        std::fs::remove_file(&final_path)
            .map_err(|e| format!("Remove outdated Nemotron file: {e}"))?;
    }
    std::fs::rename(temp_path, &final_path)
        .map_err(|e| format!("Install Nemotron model file: {e}"))?;
    emit_progress(app, MODEL_SIZE_BYTES);
    Ok(())
}

fn remove_existing_temp(path: &Path) -> Result<(), String> {
    match std::fs::remove_file(path) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(format!("Remove previous partial Nemotron file: {error}")),
    }
}

fn emit_progress<R: Runtime>(app: &AppHandle<R>, downloaded_bytes: u64) {
    let progress = DownloadProgress {
        downloaded_bytes,
        total_bytes: MODEL_SIZE_BYTES,
        percent: progress_percent(downloaded_bytes),
    };
    let _ = app.emit(PROGRESS_EVENT, progress);
}

pub fn delete_model(state: &NemotronDownloadState) -> Result<(), String> {
    state
        .active
        .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
        .map_err(|_| "Нельзя удалить модель Nemotron во время загрузки.".to_string())?;
    let _guard = DownloadGuard(state);
    match std::fs::remove_file(model_path()) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(format!("Delete Nemotron model file: {error}")),
    }
}

fn model_path() -> PathBuf {
    crate::whisper::get_model_dir().join(MODEL_FILENAME)
}

fn model_temp_path() -> PathBuf {
    crate::whisper::get_model_dir().join(format!("{MODEL_FILENAME}.part"))
}

fn progress_percent(downloaded_bytes: u64) -> u8 {
    (downloaded_bytes.saturating_mul(100) / MODEL_SIZE_BYTES).min(100) as u8
}

fn validate_download(downloaded_bytes: u64, actual_hash: &str) -> Result<(), String> {
    if downloaded_bytes != MODEL_SIZE_BYTES {
        return Err(format!(
            "Загрузка Nemotron прервалась: получено {downloaded_bytes} из {MODEL_SIZE_BYTES} байт."
        ));
    }
    if actual_hash != MODEL_SHA256 {
        return Err("Контрольная сумма Nemotron не совпала.".to_string());
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{progress_percent, validate_download, MODEL_SHA256, MODEL_SIZE_BYTES};

    #[test]
    fn progress_percent_is_bounded_and_monotonic_at_boundaries() {
        assert_eq!(progress_percent(0), 0);
        assert_eq!(progress_percent(MODEL_SIZE_BYTES / 2), 50);
        assert_eq!(progress_percent(MODEL_SIZE_BYTES), 100);
        assert_eq!(progress_percent(MODEL_SIZE_BYTES + 1), 100);
    }

    #[test]
    fn download_validation_accepts_only_expected_size_and_checksum() {
        assert!(validate_download(MODEL_SIZE_BYTES, MODEL_SHA256).is_ok());
        assert!(validate_download(MODEL_SIZE_BYTES - 1, MODEL_SHA256).is_err());
        assert!(validate_download(MODEL_SIZE_BYTES, "invalid-checksum").is_err());
    }
}
