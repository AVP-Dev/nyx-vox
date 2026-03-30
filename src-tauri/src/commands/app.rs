use tauri::{AppHandle, Manager, Emitter};
use crate::window::*;
use tauri_plugin_store::StoreExt;

#[tauri::command]
pub fn reset_window_position(app: AppHandle) {
    reset_window_position_inner(&app);
}

#[tauri::command]
pub fn dismiss_overlay(app: AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.hide();
    }
}

#[tauri::command]
pub async fn show_welcome_window(app: AppHandle) -> Result<(), String> {
    let _ = app.emit("open-welcome", ());
    show_overlay(&app);
    Ok(())
}

#[tauri::command]
pub async fn hide_welcome_window(app: AppHandle) -> Result<(), String> {
    dismiss_overlay(app);
    Ok(())
}

#[tauri::command]
pub async fn fix_quarantine(app: AppHandle) -> Result<(), String> {
    let app_path = app.path().executable_dir().map_err(|e| e.to_string())?
        .parent().ok_or("Invalid path")?
        .parent().ok_or("Invalid path")?
        .parent().ok_or("Invalid path")?.to_string_lossy().to_string();
    let _ = std::process::Command::new("xattr").arg("-d").arg("com.apple.quarantine").arg(&app_path).spawn();
    Ok(())
}

#[tauri::command]
pub async fn get_update_dismissed_at(app: AppHandle) -> Result<Option<u64>, String> {
    let store = app.store("settings.json").map_err(|e| e.to_string())?;
    Ok(store.get("update_dismissed_at").and_then(|v| v.as_u64()))
}

#[tauri::command]
pub async fn set_update_dismissed_at(app: AppHandle, timestamp: Option<u64>) -> Result<(), String> {
    let store = app.store("settings.json").map_err(|e| e.to_string())?;
    store.set("update_dismissed_at", serde_json::json!(timestamp));
    store.save().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn get_ignored_update(app: AppHandle) -> Result<Option<String>, String> {
    let store = app.store("settings.json").map_err(|e| e.to_string())?;
    Ok(store.get("ignored_update").and_then(|v| v.as_str().map(|s| s.to_string())))
}

#[tauri::command]
pub async fn set_ignored_update(app: AppHandle, version: Option<String>) -> Result<(), String> {
    let store = app.store("settings.json").map_err(|e| e.to_string())?;
    store.set("ignored_update", serde_json::json!(version));
    store.save().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn open_url(_app: AppHandle, url: String) -> Result<(), String> {
    let parsed = url::Url::parse(&url).map_err(|_| "Invalid URL".to_string())?;
    let scheme = parsed.scheme();

    let allowed_scheme = matches!(scheme, "https" | "mailto" | "x-apple.systempreferences")
        || (scheme == "http" && matches!(parsed.host_str(), Some("localhost") | Some("127.0.0.1")));

    if !allowed_scheme {
        return Err("Blocked URL scheme".to_string());
    }

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&url)
            .spawn()
            .map_err(|e| format!("Failed to open URL: {}", e))?;
    }

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(["/C", "start", "", &url])
            .spawn()
            .map_err(|e| format!("Failed to open URL: {}", e))?;
    }

    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&url)
            .spawn()
            .map_err(|e| format!("Failed to open URL: {}", e))?;
    }

    Ok(())
}

#[tauri::command]
pub async fn show_update_window(app: AppHandle, version: String, lang: String) -> Result<(), String> {
    let url = format!("/update?version={}&lang={}", version, lang);
    if let Some(win) = app.get_webview_window("update") {
        let _ = win.show();
        let _ = win.set_focus();
        return Ok(());
    }
    let _ = tauri::WebviewWindowBuilder::new(&app, "update", tauri::WebviewUrl::App(url.into()))
        .title("NYX Vox - Update")
        .inner_size(420.0, 380.0)
        .resizable(false)
        .decorations(false)
        .transparent(true)
        .shadow(true)
        .always_on_top(true)
        .center()
        .build();
    Ok(())
}

#[tauri::command]
pub async fn resize_window(app: AppHandle, width: f64, height: f64, center: bool) -> Result<(), String> {
    show_window_at_size(&app, width, height, center);
    Ok(())
}

#[tauri::command]
pub async fn get_welcome_seen(app: AppHandle, version: String) -> Result<bool, String> {
    let store = app.store("settings.json").map_err(|e| e.to_string())?;
    let seen_key = format!("welcome_seen_{}", version.replace('.', "_"));
    Ok(store.get(seen_key).and_then(|v| v.as_bool()).unwrap_or(false))
}

#[tauri::command]
pub async fn set_welcome_seen(app: AppHandle, version: String, seen: bool) -> Result<(), String> {
    let store = app.store("settings.json").map_err(|e| e.to_string())?;
    let seen_key = format!("welcome_seen_{}", version.replace('.', "_"));
    store.set(seen_key, serde_json::json!(seen));
    store.save().map_err(|e| e.to_string())?;
    Ok(())
}
