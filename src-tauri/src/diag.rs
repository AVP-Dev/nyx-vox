use tauri::{AppHandle, Manager};
use crate::state::{ProcessingFlag, RecordingFlag, TargetApp};

#[tauri::command]
pub async fn run_self_diagnosis(app: AppHandle) -> Result<serde_json::Value, String> {
    let mut results = serde_json::Map::new();
    
    // 1. Check states
    results.insert("processing_flag".to_string(), serde_json::json!(app.try_state::<ProcessingFlag>().is_some()));
    results.insert("recording_flag".to_string(), serde_json::json!(app.try_state::<RecordingFlag>().is_some()));
    results.insert("target_app_state".to_string(), serde_json::json!(app.try_state::<TargetApp>().is_some()));
    
    // 2. Check model
    let whisper_model_available = if let Some(m_state) = app.try_state::<crate::state::WhisperModel>() {
        if let Ok(m) = m_state.0.lock() {
            crate::whisper::is_model_available(*m)
        } else {
            crate::whisper::is_model_available(crate::state::WhisperModelType::Small)
        }
    } else {
        crate::whisper::is_model_available(crate::state::WhisperModelType::Small)
    };
    results.insert("whisper_model_available".to_string(), serde_json::json!(whisper_model_available));
    
    // 3. Check App Path
    results.insert("executable_exists".to_string(), serde_json::json!(app.path().executable_dir().is_ok()));
    
    Ok(serde_json::Value::Object(results))
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_resample_logic() {
        let input = vec![1.0, 2.0, 3.0, 4.0];
        let output = crate::utils::resample_to_16k(&input, 16000, 16000);
        assert_eq!(input, output);
    }

    #[test]
    fn test_app_info_structure() {
        // Just verify it doesn't crash
        let (name, id) = crate::utils::get_frontmost_app_info();
        assert!(!name.is_empty());
        assert!(!id.is_empty());
    }
}
