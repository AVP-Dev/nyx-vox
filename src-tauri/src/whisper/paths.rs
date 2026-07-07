// whisper/paths.rs — Model path resolution and filename/URL mappings
//
// Deduplicates model filename, Core ML filename, and download URL
// which were previously repeated in 3+ places across whisper.rs.

use crate::state::WhisperModelType;
use std::path::PathBuf;

// ── Filename mappings (single source of truth) ──────────────────────────────

/// Returns the ggml model filename for a given model type.
pub fn model_filename(model_type: WhisperModelType) -> &'static str {
    match model_type {
        WhisperModelType::Small => "ggml-small.bin",
        WhisperModelType::Medium => "ggml-medium.bin",
        WhisperModelType::Turbo => "ggml-large-v3-turbo-q8_0.bin",
    }
}

/// Returns the Core ML encoder bundle directory name for a given model type.
#[cfg(target_os = "macos")]
pub fn coreml_filename(model_type: WhisperModelType) -> &'static str {
    match model_type {
        WhisperModelType::Small => "ggml-small-encoder.mlmodelc",
        WhisperModelType::Medium => "ggml-medium-encoder.mlmodelc",
        WhisperModelType::Turbo => "ggml-large-v3-turbo-encoder.mlmodelc",
    }
}

/// Returns the Hugging Face download URL for a given model type.
pub fn model_url(model_type: WhisperModelType) -> &'static str {
    match model_type {
        WhisperModelType::Small => {
            "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin"
        }
        WhisperModelType::Medium => {
            "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.bin"
        }
        WhisperModelType::Turbo => {
            "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo-q8_0.bin"
        }
    }
}

/// Returns the Core ML encoder zip download URL for a given model type.
#[cfg(target_os = "macos")]
pub fn coreml_url(model_type: WhisperModelType) -> &'static str {
    match model_type {
        WhisperModelType::Small => "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small-encoder.mlmodelc.zip",
        WhisperModelType::Medium => "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium-encoder.mlmodelc.zip",
        WhisperModelType::Turbo => "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo-encoder.mlmodelc.zip",
    }
}

/// Minimum expected file size per model type (bytes).
/// Used to verify download integrity.
pub fn min_model_size(model_type: WhisperModelType) -> u64 {
    match model_type {
        WhisperModelType::Small => 450_000_000,    // ~465MB
        WhisperModelType::Medium => 1_400_000_000, // ~1.42GB
        WhisperModelType::Turbo => 800_000_000,    // ~830MB (q8_0 version)
    }
}

// ── Path resolution ─────────────────────────────────────────────────────────

/// Returns the Application Support directory for whisper models.
/// Falls back to CARGO_MANIFEST_DIR/models in development.
pub fn get_model_dir() -> PathBuf {
    if let Some(dir) = dirs_next::data_dir() {
        return dir.join("com.nyx.vox").join("models");
    }
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("models")
}

/// Resolves the full path to a model file.
/// When `allow_fallback` is true, also checks the dev-mode src-tauri/models/ directory.
pub fn get_model_path(
    model_type: WhisperModelType,
    allow_fallback: bool,
) -> Result<String, String> {
    let filename = model_filename(model_type);

    let app_support = get_model_dir().join(filename);
    if app_support.exists() {
        return Ok(app_support.to_string_lossy().to_string());
    }

    if allow_fallback {
        let dev_path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("models")
            .join(filename);
        if dev_path.exists() {
            return Ok(dev_path.to_string_lossy().to_string());
        }
    }

    Err(format!(
        "Model {} not found. Download it in Settings.",
        filename
    ))
}

/// Returns true when the model file exists in the managed Application Support directory.
/// Only checks the managed dir (not dev fallback) so the UI "Delete" button stays consistent.
pub fn is_model_available(model_type: WhisperModelType) -> bool {
    get_model_path(model_type, false).is_ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn model_filenames_are_distinct() {
        let small = model_filename(WhisperModelType::Small);
        let medium = model_filename(WhisperModelType::Medium);
        let turbo = model_filename(WhisperModelType::Turbo);
        assert_ne!(small, medium);
        assert_ne!(small, turbo);
        assert_ne!(medium, turbo);
    }

    #[test]
    fn model_urls_are_valid() {
        for mt in [
            WhisperModelType::Small,
            WhisperModelType::Medium,
            WhisperModelType::Turbo,
        ] {
            let url = model_url(mt);
            assert!(url.starts_with("https://"));
            assert!(url.contains("huggingface.co"));
        }
    }

    #[test]
    fn min_sizes_are_nonzero() {
        for mt in [
            WhisperModelType::Small,
            WhisperModelType::Medium,
            WhisperModelType::Turbo,
        ] {
            assert!(min_model_size(mt) > 0);
        }
    }
}
