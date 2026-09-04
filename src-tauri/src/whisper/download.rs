// whisper/download.rs — Model download and deletion
//
// Handles downloading whisper models from Hugging Face with resume support,
// progress events, and Core ML bundle extraction on macOS.

use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc,
};
use tauri::{AppHandle, Emitter, Runtime};

use crate::state::WhisperModelType;

use super::model_cache::unload_model;
#[cfg(target_os = "macos")]
use super::paths::{coreml_filename, coreml_url};
use super::paths::{get_model_dir, min_model_size, model_filename, model_url};

// ── Download ────────────────────────────────────────────────────────────────

/// Downloads a Whisper model from Hugging Face.
/// Supports resume (Range headers), pause/cancel, and progress events.
/// On macOS, also downloads and extracts the Core ML encoder bundle.
pub async fn download_model(
    app: AppHandle<impl Runtime>,
    model_type: WhisperModelType,
    paused: Arc<AtomicBool>,
    cancelled: Arc<AtomicBool>,
) -> Result<(), String> {
    let model_dir = get_model_dir();
    std::fs::create_dir_all(&model_dir).map_err(|e| format!("Create dir: {}", e))?;

    let filename = model_filename(model_type);
    let model_path = model_dir.join(filename);
    let tmp_path = model_dir.join(format!("{}.tmp", filename));

    let mut downloaded: u64 = 0;
    if tmp_path.exists() {
        downloaded = std::fs::metadata(&tmp_path).map(|m| m.len()).unwrap_or(0);
    }

    let url = model_url(model_type);

    let _ = app.emit("download-progress", "Starting model download...");

    let client = reqwest::Client::builder()
        .user_agent("NYX-Vox-App/1.0")
        .build()
        .map_err(|e| format!("Client error: {}", e))?;

    let response = client
        .get(url)
        .header("Range", format!("bytes={}-", downloaded))
        .send()
        .await
        .map_err(|e| format!("Download error: {}", e))?;

    if response.status() == reqwest::StatusCode::RANGE_NOT_SATISFIABLE {
        log::info!("Range not satisfiable, file might be complete.");
    } else if !response.status().is_success()
        && response.status() != reqwest::StatusCode::PARTIAL_CONTENT
    {
        return Err(format!(
            "Server error: {}. Please try again later.",
            response.status()
        ));
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
            return Err("Download cancelled".to_string());
        }

        while paused.load(Ordering::SeqCst) {
            if cancelled.load(Ordering::SeqCst) {
                drop(file);
                let _ = std::fs::remove_file(&tmp_path);
                return Err("Download cancelled".to_string());
            }
            tokio::time::sleep(std::time::Duration::from_millis(500)).await;
        }

        let chunk = chunk.map_err(|e| format!("Stream error: {}", e))?;
        file.write_all(&chunk)
            .map_err(|e| format!("Write error: {}", e))?;
        downloaded += chunk.len() as u64;

        if total > 0 {
            let pct = (downloaded as f64 / total as f64 * 100.0) as u32;
            let _ = app.emit("download-progress", pct);
        }
    }

    // Explicitly finish writing to ensure all data is flushed
    drop(file);

    // Verify file size
    let min_size = min_model_size(model_type);

    if total > 0 && downloaded != total {
        let _ = std::fs::remove_file(&tmp_path);
        return Err(format!(
            "Download interrupted: received {} of {} bytes. Please try again.",
            downloaded, total
        ));
    }

    if downloaded < min_size {
        let _ = std::fs::remove_file(&tmp_path);
        return Err(format!(
            "Error: downloaded file is too small ({} bytes). Download likely failed.",
            downloaded
        ));
    }

    // Rename temp file to actual model file
    std::fs::rename(&tmp_path, &model_path).map_err(|e| {
        format!(
            "Rename error: {}. File may be in use by another process.",
            e
        )
    })?;

    // Core ML download (macOS only)
    #[cfg(target_os = "macos")]
    {
        download_coreml_bundle(&app, &client, model_type, &model_dir, &cancelled).await;
    }

    let _ = app.emit("download-progress", "Done!");
    Ok(())
}

// ── Core ML bundle (macOS) ──────────────────────────────────────────────────

/// Downloads and extracts the Core ML encoder bundle for the given model type.
/// Failures are logged as warnings — the main model download still succeeds.
#[cfg(target_os = "macos")]
async fn download_coreml_bundle(
    app: &AppHandle<impl Runtime>,
    client: &reqwest::Client,
    model_type: WhisperModelType,
    model_dir: &std::path::Path,
    cancelled: &Arc<AtomicBool>,
) {
    let mlmodelc_name = coreml_filename(model_type);
    let mlmodelc_path = model_dir.join(mlmodelc_name);

    if mlmodelc_path.exists() {
        log::debug!("Core ML bundle already exists: {:?}", mlmodelc_path);
        return;
    }

    let coreml_dl_url = coreml_url(model_type);
    let zip_tmp_path = model_dir.join(format!("{}.zip.tmp", mlmodelc_name));

    let _ = app.emit("download-progress", "Downloading Core ML accelerator...");

    let coreml_res: Result<(), String> = async {
        let response = client
            .get(coreml_dl_url)
            .send()
            .await
            .map_err(|e| e.to_string())?;
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
                let _ = app.emit("download-progress", format!("Core ML: {}%", pct));
            }
        }
        drop(zip_file);

        // Extract using zip crate
        log::debug!("Extracting Core ML bundle: {:?}", zip_tmp_path);
        let zip_file_to_extract =
            std::fs::File::open(&zip_tmp_path).map_err(|e| format!("Failed to open zip: {}", e))?;
        let mut archive = zip::ZipArchive::new(zip_file_to_extract)
            .map_err(|e| format!("Failed to read zip archive: {}", e))?;

        for i in 0..archive.len() {
            let mut file = archive
                .by_index(i)
                .map_err(|e| format!("Failed to get zip entry {}: {}", i, e))?;
            let outpath = match file.enclosed_name() {
                Some(path) => model_dir.join(path),
                None => continue,
            };

            if file.is_dir() {
                log::debug!("Creating directory: {:?}", outpath);
                std::fs::create_dir_all(&outpath)
                    .map_err(|e| format!("Failed to create dir {:?}: {}", outpath, e))?;
            } else {
                if let Some(p) = outpath.parent() {
                    if !p.exists() {
                        std::fs::create_dir_all(p)
                            .map_err(|e| format!("Failed to create parent dir {:?}: {}", p, e))?;
                    }
                }
                log::debug!("Extracting file: {:?}", outpath);
                let mut outfile = std::fs::File::create(&outpath)
                    .map_err(|e| format!("Failed to create file {:?}: {}", outpath, e))?;
                std::io::copy(&mut file, &mut outfile)
                    .map_err(|e| format!("Failed to copy file {:?}: {}", outpath, e))?;
            }
        }
        log::info!("Core ML bundle extracted successfully");
        Ok(())
    }
    .await;

    if let Err(e) = coreml_res {
        log::warn!("Core ML download/extract warning: {}", e);
        let _ = app.emit(
            "download-progress",
            "Warning: Core ML not downloaded (CPU fallback will be used)",
        );
    }

    if zip_tmp_path.exists() {
        let _ = std::fs::remove_file(&zip_tmp_path);
    }
}

// ── Delete ──────────────────────────────────────────────────────────────────

/// Deletes a downloaded model and its Core ML bundle from disk.
pub fn delete_model(model_type: WhisperModelType) -> Result<(), String> {
    log::info!("delete_model called for {:?}", model_type);
    unload_model(model_type);

    let model_dir = get_model_dir();
    let filename = model_filename(model_type);
    let model_path = model_dir.join(filename);
    let tmp_path = model_dir.join(format!("{}.tmp", filename));

    log::debug!("Target file to delete: {:?}", model_path);

    if model_path.exists() {
        match std::fs::remove_file(&model_path) {
            Ok(_) => log::info!("Successfully deleted model file: {:?}", model_path),
            Err(e) => {
                log::error!("Failed to delete model file {:?}: {}", model_path, e);
                return Err(format!("Error deleting file: {}", e));
            }
        }
    } else {
        log::debug!("Model file does not exist: {:?}", model_path);
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

    // Core ML cleanup (macOS only)
    #[cfg(target_os = "macos")]
    {
        let mlmodelc_name = coreml_filename(model_type);
        let mlmodelc_path = model_dir.join(mlmodelc_name);
        let mlmodelc_tmp_zip = model_dir.join(format!("{}.zip.tmp", mlmodelc_name));

        if mlmodelc_path.exists() {
            log::debug!("Deleting Core ML bundle: {:?}", mlmodelc_path);
            let _ = std::fs::remove_dir_all(mlmodelc_path);
        }
        if mlmodelc_tmp_zip.exists() {
            let _ = std::fs::remove_file(mlmodelc_tmp_zip);
        }
    }

    Ok(())
}
