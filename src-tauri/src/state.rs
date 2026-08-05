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

// ── Shared audio buffer (used by Deepgram, Groq, Gemini) ─────────────────
#[derive(Default)]
pub struct AudioBuffer {
    pub samples: Vec<f32>,
    pub sample_rate: u32,
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

pub struct WhisperModel(pub Mutex<WhisperModelType>);

// Auto-Pause Media flag
pub struct AutoPause(pub Mutex<bool>);

// Auto-Paste flag
pub struct AutoPaste(pub Mutex<bool>);

// Noise Gate Threshold
pub struct NoiseGateThreshold(pub Mutex<f32>);

// Audio Gain multiplier (1.0-5.0, default 2.0)
pub struct AudioGain(pub Mutex<f32>);

// Always-on-top flag
pub struct AlwaysOnTop(pub Mutex<bool>);

// Target application info (Name, Bundle ID)
pub struct TargetApp(pub Mutex<(String, String)>);

// APP Language ("ru" or "en")
pub struct AppLanguage(pub Mutex<String>);

// Formatting mode ("none", "gemini", "deepseek")
pub struct FormattingMode(pub Mutex<String>);

// Formatting style ("casual", "professional")
pub struct FormattingStyleState(pub Mutex<FormattingStyle>);

// Enigo instance (cached to avoid IOHID initialization delay on every call)
#[allow(dead_code)]
pub struct EnigoWrapper(pub enigo::Enigo);

#[allow(dead_code)]
pub struct EnigoState(pub Arc<Mutex<EnigoWrapper>>);

// Semaphore to limit concurrent AI API calls
pub struct AiSemaphore(pub tokio::sync::Semaphore);
