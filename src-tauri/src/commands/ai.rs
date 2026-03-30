use tauri::{AppHandle, State};
use crate::keys;
use crate::ai_provider;
use crate::qwen;
use crate::deepseek;

#[tauri::command]
pub async fn refine_transcription(
    _app: AppHandle,
    text: String,
    service: keys::Service,
    instruction: Option<String>,
    api_keys: State<'_, keys::ApiKeys>,
) -> Result<String, String> {
    let key = api_keys.0.lock().map_err(|e| e.to_string())?.get(&service).cloned().flatten();
    let key = key.ok_or_else(|| format!("API key for {:?} not found", service))?;

    match service {
        keys::Service::Gemini => ai_provider::gemini_refine_text(_app.clone(), text, key, instruction).await,
        keys::Service::Deepseek => deepseek::refine_text(text, key, instruction).await,
        keys::Service::Groq => ai_provider::groq_refine_text(_app.clone(), text, key, instruction).await,
        keys::Service::Qwen => qwen::refine_text(text, key, instruction).await,
        _ => Err("Unsupported service".to_string()),
    }
}
