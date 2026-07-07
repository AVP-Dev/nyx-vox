// whisper/mod.rs — Module root with re-exports for backward compatibility
//
// All public types and functions from the whisper submodules are re-exported
// here so that external callers (commands/audio.rs, commands/settings.rs,
// lib.rs, diag.rs) can use `whisper::` paths unchanged.

mod download;
mod model_cache;
pub mod paths;
pub mod recording;
mod transcribe;

// Re-export public API for backward compatibility
pub use download::{delete_model, download_model};
#[allow(unused_imports)]
pub use model_cache::{preload_model, unload_all_models, unload_model};
#[allow(unused_imports)]
pub use paths::{get_model_dir, get_model_path, is_model_available};
pub use recording::{start_recording, stop_recording, RecordingState, SharedState};
