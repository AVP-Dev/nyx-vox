use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};
use tauri_plugin_store::StoreExt;
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct HistoryEntry {
    pub id: String,
    pub timestamp: u64,
    pub final_text: String,
    pub raw_text: String,
    pub engine: String,
    pub target_app: String,
}

#[tauri::command]
pub async fn get_history(app: AppHandle) -> Result<Vec<HistoryEntry>, String> {
    let store = app.store("history.json").map_err(|e| e.to_string())?;
    let history: Vec<HistoryEntry> = store.get("entries")
        .and_then(|v| serde_json::from_value(v.clone()).ok())
        .unwrap_or_default();
    Ok(history)
}

#[tauri::command]
pub async fn add_history_entry(
    app: AppHandle,
    final_text: String,
    raw_text: String,
    engine: String,
    target_app: String,
) -> Result<(), String> {
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_secs();

    let entry = HistoryEntry {
        id: uuid::Uuid::new_v4().to_string(),
        timestamp,
        final_text,
        raw_text,
        engine,
        target_app,
    };

    let store = app.store("history.json").map_err(|e| e.to_string())?;
    let mut history: Vec<HistoryEntry> = store.get("entries")
        .and_then(|v| serde_json::from_value(v.clone()).ok())
        .unwrap_or_default();

    // 1000 items limit (circular buffer logic)
    if history.len() >= 1000 {
        history.remove(0);
    }
    history.push(entry);

    store.set("entries", serde_json::to_value(history).map_err(|e| e.to_string())?);
    store.save().map_err(|e| e.to_string())?;
    
    // Notify frontend that history changed
    let _ = app.emit("history-updated", ());
    
    Ok(())
}

#[tauri::command]
pub async fn clear_history(app: AppHandle) -> Result<(), String> {
    let store = app.store("history.json").map_err(|e| e.to_string())?;
    store.set("entries", serde_json::json!([]));
    store.save().map_err(|e| e.to_string())?;
    let _ = app.emit("history-updated", ());
    Ok(())
}

#[tauri::command]
pub async fn delete_history_item(app: AppHandle, id: String) -> Result<(), String> {
    let store = app.store("history.json").map_err(|e| e.to_string())?;
    let mut history: Vec<HistoryEntry> = store.get("entries")
        .and_then(|v| serde_json::from_value(v.clone()).ok())
        .unwrap_or_default();

    history.retain(|item| item.id != id);

    store.set("entries", serde_json::to_value(history).map_err(|e| e.to_string())?);
    store.save().map_err(|e| e.to_string())?;
    let _ = app.emit("history-updated", ());
    Ok(())
}

/// Convert a retention period string to seconds.
/// Returns None for "never" or unknown periods.
pub fn retention_period_to_seconds(period: &str) -> Option<u64> {
    match period {
        "1d" => Some(86400),
        "1w" => Some(604800),
        "1m" => Some(2592000),
        "3m" => Some(7776000),
        "6m" => Some(15552000),
        "1y" => Some(31536000),
        "never" => None,
        _ => None,
    }
}

/// "Smart Cleanup" logic
/// periods: "1d", "1w", "1m", "3m", "6m", "1y", "never"
pub fn perform_smart_cleanup(app: &AppHandle) -> Result<(), String> {
    let settings_store = app.store("settings.json").map_err(|e| e.to_string())?;
    
    let cleanup_enabled = settings_store.get("history_smart_cleanup")
        .and_then(|v| v.as_bool())
        .unwrap_or(false);
        
    if !cleanup_enabled {
        return Ok(());
    }
    
    let period = settings_store.get("history_retention_period")
        .and_then(|v| v.as_str().map(|s| s.to_string()))
        .unwrap_or_else(|| "never".to_string());
        
    if period == "never" {
        return Ok(());
    }
    
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_secs();
        
    let seconds_to_keep = match retention_period_to_seconds(&period) {
        Some(s) => s,
        None => return Ok(()),
    };
    
    let history_store = app.store("history.json").map_err(|e| e.to_string())?;
    let mut history: Vec<HistoryEntry> = history_store.get("entries")
        .and_then(|v| serde_json::from_value(v.clone()).ok())
        .unwrap_or_default();
        
    let initial_len = history.len();
    history.retain(|item| (now - item.timestamp) < seconds_to_keep);
    
    if history.len() != initial_len {
        let final_count = history.len();
        history_store.set("entries", serde_json::to_value(&history).map_err(|e| e.to_string())?);
        history_store.save().map_err(|e| e.to_string())?;
        log::info!("Smart Cleanup removed {} old entries", initial_len - final_count);
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn retention_1d_is_86400_seconds() {
        assert_eq!(retention_period_to_seconds("1d"), Some(86400));
    }

    #[test]
    fn retention_1w_is_604800_seconds() {
        assert_eq!(retention_period_to_seconds("1w"), Some(604800));
    }

    #[test]
    fn retention_1m_is_2592000_seconds() {
        assert_eq!(retention_period_to_seconds("1m"), Some(2592000));
    }

    #[test]
    fn retention_3m_is_7776000_seconds() {
        assert_eq!(retention_period_to_seconds("3m"), Some(7776000));
    }

    #[test]
    fn retention_6m_is_15552000_seconds() {
        assert_eq!(retention_period_to_seconds("6m"), Some(15552000));
    }

    #[test]
    fn retention_1y_is_31536000_seconds() {
        assert_eq!(retention_period_to_seconds("1y"), Some(31536000));
    }

    #[test]
    fn retention_never_returns_none() {
        assert_eq!(retention_period_to_seconds("never"), None);
    }

    #[test]
    fn retention_unknown_returns_none() {
        assert_eq!(retention_period_to_seconds("2y"), None);
        assert_eq!(retention_period_to_seconds(""), None);
        assert_eq!(retention_period_to_seconds("invalid"), None);
    }

    #[test]
    fn retention_periods_are_monotonically_increasing() {
        let periods = ["1d", "1w", "1m", "3m", "6m", "1y"];
        let values: Vec<u64> = periods.iter()
            .map(|p| retention_period_to_seconds(p).unwrap())
            .collect();
        for window in values.windows(2) {
            assert!(window[0] < window[1], "Periods must be monotonically increasing");
        }
    }

    #[test]
    fn history_entry_serializes_and_deserializes() {
        let entry = HistoryEntry {
            id: "test-id".to_string(),
            timestamp: 1700000000,
            final_text: "hello world".to_string(),
            raw_text: "hello world".to_string(),
            engine: "deepgram".to_string(),
            target_app: "Safari".to_string(),
        };
        let json = serde_json::to_string(&entry).unwrap();
        let deserialized: HistoryEntry = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.id, "test-id");
        assert_eq!(deserialized.timestamp, 1700000000);
        assert_eq!(deserialized.final_text, "hello world");
    }
}
