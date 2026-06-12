use std::collections::HashMap;
use std::sync::{Arc, atomic::Ordering};
use tauri::{AppHandle, State, Manager, Emitter};
use tauri_plugin_store::StoreExt;
use crate::state::*;
use crate::{keys, whisper, tray};

#[tauri::command]
pub async fn get_all_settings(
    app: AppHandle,
    stt_mode: State<'_, SttMode>,
    dg_lang: State<'_, DeepgramLanguage>,
    whisper_lang: State<'_, WhisperLanguage>,
    groq_lang: State<'_, GroqLanguage>,
    auto_paste: State<'_, AutoPaste>,
    always_on_top: State<'_, AlwaysOnTop>,
    formatting_mode: State<'_, FormattingMode>,
    formatting_style: State<'_, FormattingStyleState>,
    auto_pause: State<'_, AutoPause>,
    whisper_model: State<'_, WhisperModel>,
) -> Result<serde_json::Value, String> {
    let stt = stt_mode.0.lock().map_err(|e| e.to_string())?.clone();
    let dg = dg_lang.0.lock().map_err(|e| e.to_string())?.clone();
    let wl = whisper_lang.0.lock().map_err(|e| e.to_string())?.clone();
    let gl = groq_lang.0.lock().map_err(|e| e.to_string())?.clone();
    let ap = *auto_paste.0.lock().map_err(|e| e.to_string())?;
    let aot = *always_on_top.0.lock().map_err(|e| e.to_string())?;
    let fm = formatting_mode.0.lock().map_err(|e| e.to_string())?.clone();
    let fs = *formatting_style.0.lock().map_err(|e| e.to_string())?;
    let auto_p = *auto_pause.0.lock().map_err(|e| e.to_string())?;
    let wm = *whisper_model.0.lock().map_err(|e| e.to_string())?;

    let store = app.store("settings.json").map_err(|e: tauri_plugin_store::Error| e.to_string())?;
    let clear_on_paste = store.get("clear_on_paste").and_then(|v| v.as_bool()).unwrap_or(false);
    let start_minimized = store.get("start_minimized").and_then(|v| v.as_bool()).unwrap_or(false);
    let app_lang = store.get("app_language").and_then(|v| v.as_str().map(|s| s.to_string())).unwrap_or_else(|| "ru".to_string());
    let model_available = whisper::is_model_available(wm);

    Ok(serde_json::json!({
        "sttMode": stt,
        "deepgramLanguage": dg,
        "whisperLanguage": wl,
        "groqLanguage": gl,
        "autoPaste": ap,
        "clearOnPaste": clear_on_paste,
        "startMinimized": start_minimized,
        "alwaysOnTop": aot,
        "autoPause": auto_p,
        "formattingMode": fm,
        "formattingStyle": fs,
        "appLanguage": app_lang,
        "whisperModel": wm,
        "modelAvailable": model_available,
    }))
}

#[tauri::command]
pub async fn set_app_language(app: AppHandle, lang: String, state: State<'_, AppLanguage>) -> Result<(), String> {
    let store = app.store("settings.json").map_err(|e: tauri_plugin_store::Error| e.to_string())?;
    store.set("app_language", serde_json::json!(lang));
    store.save().map_err(|e: tauri_plugin_store::Error| e.to_string())?;
    *state.0.lock().map_err(|e| e.to_string())? = lang.clone();
    tray::update_tray_lang(app.clone(), lang.clone());
    let _ = Emitter::emit(&app, "language-changed", lang);
    Ok(())
}

#[tauri::command]
pub async fn get_app_language(state: State<'_, AppLanguage>) -> Result<String, String> {
    Ok(state.0.lock().map_err(|e| e.to_string())?.clone())
}

#[tauri::command]
pub async fn set_stt_mode(mode: String, stt_mode: State<'_, SttMode>, app: AppHandle) -> Result<(), String> {
    let store = app.store("settings.json").map_err(|e: tauri_plugin_store::Error| e.to_string())?;
    store.set("stt_mode", serde_json::json!(mode));
    store.save().map_err(|e: tauri_plugin_store::Error| e.to_string())?;
    *stt_mode.0.lock().map_err(|e| e.to_string())? = mode;
    Ok(())
}

#[tauri::command]
pub async fn get_stt_mode(stt_mode: State<'_, SttMode>) -> Result<String, String> {
    Ok(stt_mode.0.lock().map_err(|e| e.to_string())?.clone())
}

#[tauri::command]
pub async fn set_formatting_mode(app: AppHandle, state: State<'_, FormattingMode>, mode: String) -> Result<(), String> {
    let store = app.store("settings.json").map_err(|e: tauri_plugin_store::Error| e.to_string())?;
    store.set("formatting_mode", serde_json::json!(mode));
    store.save().map_err(|e: tauri_plugin_store::Error| e.to_string())?;
    if let Ok(mut lock) = state.0.lock() { *lock = mode; }
    Ok(())
}

#[tauri::command]
pub async fn get_formatting_mode(state: State<'_, FormattingMode>) -> Result<String, String> {
    if let Ok(lock) = state.0.lock() { return Ok(lock.clone()); }
    Ok("none".to_string())
}

#[tauri::command]
pub async fn set_formatting_style(app: AppHandle, state: State<'_, FormattingStyleState>, style: FormattingStyle) -> Result<(), String> {
    let store = app.store("settings.json").map_err(|e: tauri_plugin_store::Error| e.to_string())?;
    store.set("formatting_style", serde_json::json!(style));
    store.save().map_err(|e: tauri_plugin_store::Error| e.to_string())?;
    *state.0.lock().map_err(|e| e.to_string())? = style;
    Ok(())
}

#[tauri::command]
pub async fn get_formatting_style(state: State<'_, FormattingStyleState>) -> Result<FormattingStyle, String> {
    Ok(*state.0.lock().map_err(|e| e.to_string())?)
}

#[tauri::command]
pub async fn set_deepgram_language(lang: String, state: State<'_, DeepgramLanguage>, app: AppHandle) -> Result<(), String> {
    let store = app.store("settings.json").map_err(|e: tauri_plugin_store::Error| e.to_string())?;
    store.set("deepgram_language", serde_json::json!(lang));
    store.save().map_err(|e: tauri_plugin_store::Error| e.to_string())?;
    *state.0.lock().map_err(|e| e.to_string())? = lang;
    Ok(())
}

#[tauri::command]
pub async fn get_deepgram_language(state: State<'_, DeepgramLanguage>) -> Result<String, String> {
    Ok(state.0.lock().map_err(|e| e.to_string())?.clone())
}

#[tauri::command]
pub async fn set_whisper_language(lang: String, state: State<'_, WhisperLanguage>, app: AppHandle) -> Result<(), String> {
    let store = app.store("settings.json").map_err(|e: tauri_plugin_store::Error| e.to_string())?;
    store.set("whisper_language", serde_json::json!(lang));
    store.save().map_err(|e: tauri_plugin_store::Error| e.to_string())?;
    *state.0.lock().map_err(|e| e.to_string())? = lang;
    Ok(())
}

#[tauri::command]
pub async fn get_whisper_language(state: State<'_, WhisperLanguage>) -> Result<String, String> {
    Ok(state.0.lock().map_err(|e| e.to_string())?.clone())
}

#[tauri::command]
pub async fn set_whisper_model_type(model: WhisperModelType, state: State<'_, WhisperModel>, app: AppHandle) -> Result<(), String> {
    let store = app.store("settings.json").map_err(|e: tauri_plugin_store::Error| e.to_string())?;
    store.set("whisper_model", serde_json::json!(model));
    store.save().map_err(|e: tauri_plugin_store::Error| e.to_string())?;
    *state.0.lock().map_err(|e| e.to_string())? = model;
    Ok(())
}

#[tauri::command]
pub async fn get_whisper_model_type(state: State<'_, WhisperModel>) -> Result<WhisperModelType, String> {
    Ok(*state.0.lock().map_err(|e| e.to_string())?)
}

#[tauri::command]
pub async fn set_groq_language(lang: String, state: State<'_, GroqLanguage>, app: AppHandle) -> Result<(), String> {
    let store = app.store("settings.json").map_err(|e: tauri_plugin_store::Error| e.to_string())?;
    store.set("groq_language", serde_json::json!(lang));
    store.save().map_err(|e: tauri_plugin_store::Error| e.to_string())?;
    *state.0.lock().map_err(|e| e.to_string())? = lang;
    Ok(())
}

#[tauri::command]
pub async fn get_groq_language(state: State<'_, GroqLanguage>) -> Result<String, String> {
    Ok(state.0.lock().map_err(|e| e.to_string())?.clone())
}

#[tauri::command]
pub async fn set_auto_pause(pause: bool, auto_pause: State<'_, AutoPause>, app: AppHandle) -> Result<(), String> {
    let store = app.store("settings.json").map_err(|e: tauri_plugin_store::Error| e.to_string())?;
    store.set("auto_pause", serde_json::json!(pause));
    store.save().map_err(|e: tauri_plugin_store::Error| e.to_string())?;
    *auto_pause.0.lock().map_err(|e| e.to_string())? = pause;
    Ok(())
}

#[tauri::command]
pub async fn get_auto_pause(auto_pause: State<'_, AutoPause>) -> Result<bool, String> {
    Ok(*auto_pause.0.lock().map_err(|e| e.to_string())?)
}

#[tauri::command]
pub async fn set_auto_paste(app_handle: AppHandle, state: State<'_, AutoPaste>, enabled: bool) -> Result<(), String> {
    if let Ok(mut lock) = state.0.lock() { *lock = enabled; }
    let store = app_handle.store("settings.json").map_err(|e: tauri_plugin_store::Error| e.to_string())?;
    store.set("auto_paste", serde_json::Value::Bool(enabled));
    let _ = store.save();
    Ok(())
}

#[tauri::command]
pub fn get_auto_paste(state: State<'_, AutoPaste>) -> bool { 
    state.0.lock().map(|l| *l).unwrap_or(true) 
}

#[tauri::command]
pub async fn set_always_on_top(app_handle: AppHandle, state: State<'_, AlwaysOnTop>, enabled: bool) -> Result<(), String> {
    if let Ok(mut lock) = state.0.lock() { *lock = enabled; }
    if let Some(w) = app_handle.get_webview_window("main") { let _ = w.set_always_on_top(enabled); }
    let store = app_handle.store("settings.json").map_err(|e: tauri_plugin_store::Error| e.to_string())?;
    store.set("always_on_top", serde_json::Value::Bool(enabled));
    let _ = store.save();
    Ok(())
}

#[tauri::command]
pub fn get_always_on_top(state: State<'_, AlwaysOnTop>) -> bool { 
    state.0.lock().map(|l| *l).unwrap_or(true) 
}

#[tauri::command]
pub async fn set_start_minimized(app: AppHandle, minimized: bool) -> Result<(), String> {
    let store = app.store("settings.json").map_err(|e: tauri_plugin_store::Error| e.to_string())?;
    store.set("start_minimized", serde_json::json!(minimized));
    store.save().map_err(|e: tauri_plugin_store::Error| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn get_start_minimized(app: AppHandle) -> Result<bool, String> {
    let store = app.store("settings.json").map_err(|e: tauri_plugin_store::Error| e.to_string())?;
    match store.get("start_minimized") {
        Some(val) => Ok(val.as_bool().unwrap_or(false)),
        None => Ok(false),
    }
}

#[tauri::command]
pub async fn set_clear_on_paste(app: AppHandle, enabled: bool) -> Result<(), String> {
    let store = app.store("settings.json").map_err(|e: tauri_plugin_store::Error| e.to_string())?;
    store.set("clear_on_paste", serde_json::json!(enabled));
    store.save().map_err(|e: tauri_plugin_store::Error| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn get_clear_on_paste(app: AppHandle) -> Result<bool, String> {
    let store = app.store("settings.json").map_err(|e: tauri_plugin_store::Error| e.to_string())?;
    match store.get("clear_on_paste") {
        Some(val) => Ok(val.as_bool().unwrap_or(false)),
        None => Ok(false),
    }
}

#[tauri::command]
pub async fn cmd_set_api_key(app: AppHandle, state: State<'_, keys::ApiKeys>, service: keys::Service, key: String) -> Result<(), String> {
    state.save_to_store(&app, service, key)
}

#[tauri::command]
pub async fn get_api_key(state: State<'_, keys::ApiKeys>, service: keys::Service) -> Result<String, String> {
    if let Ok(lock) = state.0.lock() {
        if let Some(Some(key)) = lock.get(&service) { return Ok(key.clone()); }
    }
    Ok(String::new())
}

#[tauri::command]
pub async fn get_services_status(state: State<'_, keys::ApiKeys>) -> Result<HashMap<keys::Service, bool>, String> {
    let mut status = HashMap::new();
    if let Ok(lock) = state.0.lock() {
        for (service, key_opt) in lock.iter() {
            status.insert(service.clone(), key_opt.is_some() && !key_opt.as_ref().unwrap().is_empty());
        }
    }
    Ok(status)
}

#[tauri::command]
pub async fn check_model_available(whisper_model: State<'_, WhisperModel>) -> Result<bool, String> {
    let model_type = *whisper_model.0.lock().map_err(|e| e.to_string())?;
    Ok(whisper::is_model_available(model_type))
}

#[tauri::command]
pub async fn download_whisper_model(
    app: AppHandle, 
    whisper_model: State<'_, WhisperModel>,
    download_flag: State<'_, WhisperDownloadFlag>,
    paused_flag: State<'_, WhisperDownloadPaused>,
    cancelled_flag: State<'_, WhisperDownloadCancelled>,
) -> Result<(), String> {
    if download_flag.0.load(Ordering::SeqCst) {
        return Err("Загрузка уже идет.".to_string());
    }
    
    // Reset flags
    download_flag.0.store(true, Ordering::SeqCst);
    paused_flag.0.store(false, Ordering::SeqCst);
    cancelled_flag.0.store(false, Ordering::SeqCst);

    let model_type = *whisper_model.0.lock().map_err(|e| e.to_string())?;
    let res = whisper::download_model(
        app, 
        model_type, 
        Arc::clone(&paused_flag.0), 
        Arc::clone(&cancelled_flag.0)
    ).await;
    
    download_flag.0.store(false, Ordering::SeqCst);
    res
}

#[tauri::command]
pub fn pause_whisper_download(paused_flag: State<'_, WhisperDownloadPaused>) {
    paused_flag.0.store(true, Ordering::SeqCst);
}

#[tauri::command]
pub fn resume_whisper_download(paused_flag: State<'_, WhisperDownloadPaused>) {
    paused_flag.0.store(false, Ordering::SeqCst);
}

#[tauri::command]
pub fn cancel_whisper_download(cancelled_flag: State<'_, WhisperDownloadCancelled>) {
    cancelled_flag.0.store(true, Ordering::SeqCst);
}

#[tauri::command]
pub async fn delete_whisper_model(whisper_model: State<'_, WhisperModel>) -> Result<(), String> {
    let model_type = *whisper_model.0.lock().map_err(|e| e.to_string())?;
    whisper::delete_model(model_type)
}

#[tauri::command]
pub async fn get_history_settings(app: AppHandle) -> Result<(bool, String), String> {
    let store = app.store("settings.json").map_err(|e: tauri_plugin_store::Error| e.to_string())?;
    let cleanup = store.get("history_smart_cleanup").and_then(|v| v.as_bool()).unwrap_or(false);
    let period = store.get("history_retention_period")
        .and_then(|v| v.as_str().map(|s| s.to_string()))
        .unwrap_or_else(|| "never".to_string());
    Ok((cleanup, period))
}

#[tauri::command]
pub async fn set_history_settings(app: AppHandle, cleanup: bool, period: String) -> Result<(), String> {
    let store = app.store("settings.json").map_err(|e: tauri_plugin_store::Error| e.to_string())?;
    store.set("history_smart_cleanup", serde_json::json!(cleanup));
    store.set("history_retention_period", serde_json::json!(period));
    store.save().map_err(|e: tauri_plugin_store::Error| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn open_history_window(app: AppHandle) -> Result<(), String> {
    if let Some(win) = app.get_webview_window("history") {
        let _ = win.show();
        let _ = win.unminimize();
        let _ = win.set_focus();
        return Ok(());
    }
    let _ = tauri::WebviewWindowBuilder::new(&app, "history", tauri::WebviewUrl::App("/history".into()))
        .title("NYX Vox - History")
        .inner_size(800.0, 600.0)
        .resizable(true)
        .decorations(false)
        .transparent(true)
        .shadow(true)
        .always_on_top(true)
        .build();
    Ok(())
}
