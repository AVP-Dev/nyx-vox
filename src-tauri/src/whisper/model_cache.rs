// whisper/model_cache.rs — Whisper model lifecycle (load, cache, unload)
//
// Keeps a cached WhisperContext per model type to avoid re-initializing
// the Metal/GPU backend on every transcription (~47s cold start).

use std::sync::Mutex;
use whisper_rs::{FullParams, SamplingStrategy, WhisperContext, WhisperContextParameters};

use crate::state::WhisperModelType;

use super::paths::get_model_path;

// ── Cached model wrapper ────────────────────────────────────────────────────

pub(super) struct WhisperModel {
    pub(super) ctx: WhisperContext,
}

static WHISPER_MODEL_SMALL: Mutex<Option<WhisperModel>> = Mutex::new(None);
static WHISPER_MODEL_MEDIUM: Mutex<Option<WhisperModel>> = Mutex::new(None);
static WHISPER_MODEL_TURBO: Mutex<Option<WhisperModel>> = Mutex::new(None);

// ── Mutex lookup (deduplicates 3-way match) ─────────────────────────────────

/// Returns a reference to the static mutex for the given model type.
fn model_mutex(model_type: WhisperModelType) -> &'static Mutex<Option<WhisperModel>> {
    match model_type {
        WhisperModelType::Small => &WHISPER_MODEL_SMALL,
        WhisperModelType::Medium => &WHISPER_MODEL_MEDIUM,
        WhisperModelType::Turbo => &WHISPER_MODEL_TURBO,
    }
}

// ── Initialization ──────────────────────────────────────────────────────────

/// Loads a Whisper model from disk, creates the context, and pre-warms
/// Metal/GPU shaders with a 1-second silence pass.
fn init_whisper_model(model_type: WhisperModelType) -> Result<WhisperModel, String> {
    let t0 = std::time::Instant::now();
    log::info!("Loading Whisper model {:?}...", model_type);
    let model_path = get_model_path(model_type, true)?;
    log::debug!("Model path: {}", model_path);

    let mut ctx_params = WhisperContextParameters::default();
    ctx_params.use_gpu(true);
    let ctx = WhisperContext::new_with_params(&model_path, ctx_params).map_err(|e| {
        format!(
            "Whisper context creation failed: {}. Try re-downloading the model in Settings.",
            e
        )
    })?;
    log::info!(
        "Whisper model {:?} loaded in {:?} (GPU: enabled)",
        model_type,
        t0.elapsed()
    );

    // Pre-warm Metal: create a temporary state to compile all GPU shaders once.
    log::debug!("Pre-warming Metal shaders...");
    let t_warmup = std::time::Instant::now();
    if let Ok(mut warmup_state) = ctx.create_state() {
        let params = FullParams::new(SamplingStrategy::Greedy { best_of: 1 });
        let silence = vec![0.0f32; 16000]; // 1 second of silence
        let _ = warmup_state.full(params, &silence);
    }
    log::debug!("Metal pre-warmed in {:?}", t_warmup.elapsed());

    Ok(WhisperModel { ctx })
}

// ── Public API ──────────────────────────────────────────────────────────────

/// Returns a reference to the cached WhisperContext, loading from disk if needed.
/// Acquires the model mutex for the duration of the call.
pub(super) fn get_or_load_model(
    model_type: WhisperModelType,
) -> Result<std::sync::MutexGuard<'static, Option<WhisperModel>>, String> {
    let mutex = model_mutex(model_type);
    let mut lock = mutex.lock().unwrap_or_else(|e| {
        log::warn!("Mutex poisoned, recovering: {}", e);
        e.into_inner()
    });
    if lock.is_none() {
        log::debug!("Model not cached, loading from disk...");
        let t0 = std::time::Instant::now();
        *lock = Some(init_whisper_model(model_type)?);
        log::debug!("Model loaded in {:?}", t0.elapsed());
    } else {
        log::debug!("Model already cached (load took 0ms)");
    }
    Ok(lock)
}

/// Preloads the model into the cache (non-blocking, called at app startup).
#[allow(dead_code)]
pub fn preload_model(model_type: WhisperModelType) {
    let mutex = model_mutex(model_type);
    if let Ok(mut lock) = mutex.lock() {
        if lock.is_none() {
            match init_whisper_model(model_type) {
                Ok(model) => {
                    *lock = Some(model);
                    log::info!("Model {:?} preloaded successfully.", model_type);
                }
                Err(e) => {
                    log::error!("Model preload failed for {:?}: {}", model_type, e);
                }
            }
        }
    }
}

/// Unloads a single model from memory, freeing GPU resources.
pub fn unload_model(model_type: WhisperModelType) {
    log::debug!("Attempting to unload model {:?}", model_type);
    let mutex = model_mutex(model_type);
    match mutex.lock() {
        Ok(mut lock) => {
            if lock.is_some() {
                *lock = None;
                log::info!("Model {:?} successfully unloaded from memory.", model_type);
            } else {
                log::debug!("Model {:?} was already unloaded.", model_type);
            }
        }
        Err(e) => {
            log::error!(
                "Failed to acquire lock to unload model {:?}: {}",
                model_type,
                e
            );
        }
    }
}

/// Unloads all cached models from memory.
#[allow(dead_code)]
pub fn unload_all_models() {
    unload_model(WhisperModelType::Small);
    unload_model(WhisperModelType::Medium);
    unload_model(WhisperModelType::Turbo);
}
