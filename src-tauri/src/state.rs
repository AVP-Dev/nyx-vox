use serde::{Deserialize, Serialize};
use std::sync::{atomic::AtomicBool, Arc, Mutex};

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Default)]
#[serde(rename_all = "lowercase")]
pub enum WhisperModelType {
    #[default]
    Small,
    Medium,
    Turbo,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Default)]
#[serde(rename_all = "lowercase")]
pub enum FormattingStyle {
    #[default]
    Casual,
    Professional,
}

// ── Shared state types ────────────────────────────────────────────────────────
#[derive(Default)]
pub struct DidPauseMedia(pub AtomicBool);

#[derive(Default)]
pub struct WhisperDownloadFlag(pub Arc<AtomicBool>);

#[derive(Default)]
pub struct WhisperDownloadPaused(pub Arc<AtomicBool>);

#[derive(Default)]
pub struct WhisperDownloadCancelled(pub Arc<AtomicBool>);

#[derive(Default)]
pub struct ProcessingFlag(pub Arc<AtomicBool>);

#[derive(Default)]
pub struct RecordingFlag(pub Arc<AtomicBool>);

// Active STT mode used for the current recording session.
// This can differ from configured SttMode when runtime fallback is applied.
pub struct ActiveSttMode(pub Mutex<String>);

// STT Mode: "deepgram" or "whisper" or "groq"
pub struct SttMode(pub Mutex<String>);

// STT Languages (per mode)
pub struct DeepgramLanguage(pub Mutex<String>);
pub struct WhisperLanguage(pub Mutex<String>);
pub struct WhisperModel(pub Mutex<WhisperModelType>);
pub struct GroqLanguage(pub Mutex<String>);

// Auto-Pause Media flag
pub struct AutoPause(pub Mutex<bool>);

// Auto-Paste flag
pub struct AutoPaste(pub Mutex<bool>);

// Always-on-top flag
pub struct AlwaysOnTop(pub Mutex<bool>);

// Target application info (Name, Bundle ID)
pub struct TargetApp(pub Mutex<(String, String)>);

// Position initialized flag (to only center once on launch)
#[derive(Default)]
#[allow(dead_code)]
pub struct PositionInitialized(pub AtomicBool);

// APP Language ("ru" or "en")
pub struct AppLanguage(pub Mutex<String>);

// Formatting mode ("none", "gemini", "deepseek")
pub struct FormattingMode(pub Mutex<String>);

// Formatting style ("casual", "professional")
pub struct FormattingStyleState(pub Mutex<FormattingStyle>);

// Enigo instance (cached to avoid IOHID initialization delay on every call)
#[allow(dead_code)]
pub struct EnigoWrapper(pub enigo::Enigo);
unsafe impl Send for EnigoWrapper {}
unsafe impl Sync for EnigoWrapper {}

#[allow(dead_code)]
pub struct EnigoState(pub Arc<Mutex<EnigoWrapper>>);

// Semaphore to limit concurrent AI API calls
pub struct AiSemaphore(pub tokio::sync::Semaphore);
