mod deepgram;
mod whisper;
mod groq;

use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc, Mutex,
};
// use std::thread;
// use std::time::Duration;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, Runtime, State,
};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};
use tauri_plugin_store::StoreExt;

// ── Shared state types ────────────────────────────────────────────────────────
#[derive(Default)]
struct ProcessingFlag(Arc<AtomicBool>);

// STT Mode: "deepgram" or "whisper" or "groq"
struct SttMode(Mutex<String>);

// STT Languages (per mode)
struct DeepgramLanguage(Mutex<String>);
struct WhisperLanguage(Mutex<String>);
struct GroqLanguage(Mutex<String>);

// Auto-Pause Media flag
struct AutoPause(Mutex<bool>);

// Auto-Paste flag
struct AutoPaste(Mutex<bool>);

// Always-on-top flag
struct AlwaysOnTop(Mutex<bool>);

// Target application info (Name, Bundle ID)
struct TargetApp(Mutex<(String, String)>);

// Position initialized flag (to only center once on launch)
struct PositionInitialized(AtomicBool);

// APP Language ("ru" or "en")
struct AppLanguage(Mutex<String>);

// Deepgram API key (cached from store)
struct DgApiKey(Mutex<Option<String>>);

// Groq API key (cached from store)
struct GroqApiKey(Mutex<Option<String>>);

// Enigo instance (cached to avoid IOHID initialization delay on every call)
#[allow(dead_code)]
struct EnigoWrapper(pub enigo::Enigo);
unsafe impl Send for EnigoWrapper {}
unsafe impl Sync for EnigoWrapper {}

struct EnigoState(pub Arc<Mutex<EnigoWrapper>>);

// ── Resample utility (used by both modules) ──────────────────────────────────
pub fn resample_to_16k(samples: &[f32], src_rate: u32, dst_rate: u32) -> Vec<f32> {
    if src_rate == dst_rate { return samples.to_vec(); }
    let ratio = src_rate as f64 / dst_rate as f64;
    let dst_len = (samples.len() as f64 / ratio) as usize;
    (0..dst_len)
        .map(|i| {
            let src = i as f64 * ratio;
            let lo = src.floor() as usize;
            let hi = (lo + 1).min(samples.len() - 1);
            let frac = src - src.floor();
            samples[lo] * (1.0 - frac as f32) + samples[hi] * frac as f32
        })
        .collect()
}

// ── Helper to detect frontmost app ───────────────────────────────────────────
fn get_frontmost_app_info() -> (String, String) {
    #[cfg(target_os = "macos")]
    {
        // Get name and bundle identifier safely concatenated
        let script = "tell application \"System Events\" to tell (first process whose frontmost is true) to return name & \", \" & bundle identifier";
        let output = std::process::Command::new("osascript").arg("-e").arg(script).output();
        if let Ok(o) = output {
            let out = String::from_utf8_lossy(&o.stdout).trim().to_string();
            let parts: Vec<&str> = out.split(", ").collect();
            if parts.len() >= 2 {
                let name = parts[0].to_string();
                let bundle_id = parts[1].to_string();
                
                // Don't report ourselves. We check both name and bundle ID.
                // Our bundle ID is com.nyx.vox2
                if !name.is_empty() && 
                   name != "NYX Vox" && 
                   name != "nyx-vox" && 
                   bundle_id != "com.nyx.vox2" &&
                   bundle_id != "com.tauri.dev" {
                    return (name, bundle_id);
                }
            }
        }
    }
    ("Unknown".to_string(), "Unknown".to_string())
}

fn activate_app_by_id(bundle_id: &str) -> bool {
    #[cfg(target_os = "macos")]
    {
        if bundle_id != "Unknown" && !bundle_id.is_empty() {
            let script = format!("tell application id \"{}\" to activate", bundle_id);
            return std::process::Command::new("osascript").arg("-e").arg(script).status().map(|s| s.success()).unwrap_or(false);
        }
    }
    false
}

// ── Position overlay at top-center ────────────────────────────────────────────
fn show_overlay<R: Runtime>(app: &AppHandle<R>) {
    // 1. Capture target app BEFORE we show our window and take focus
    let info = get_frontmost_app_info();
    if info.0 != "Unknown" {
        if let Ok(mut lock) = app.state::<TargetApp>().0.lock() {
            *lock = info;
        }
    }

    if let Some(window) = app.get_webview_window("main") {
        // Only position the window if it's the first time being shown
        let init_state = app.state::<PositionInitialized>();
        if !init_state.0.load(Ordering::SeqCst) {
            if let Ok(Some(monitor)) = window.primary_monitor() {
                let scale = monitor.scale_factor();
                let screen_w = monitor.size().width as f64 / scale;
                
                let win_w = window.outer_size().unwrap_or_default().width as f64 / scale;
                let actual_win_w = if win_w > 0.0 { win_w } else { 140.0 };
                let x = ((screen_w - actual_win_w) / 2.0 * scale) as i32;
                let y = 0; // Cling to the top menu bar
                let _ = window.set_position(tauri::PhysicalPosition::new(x, y));
                
                // Mark as initialized so user positioning is respected from now on
                init_state.0.store(true, Ordering::SeqCst);
            }
        }
        
        let _ = window.show();
        let _ = window.set_focus();
        let _ = app.emit("app-summon", ());
    }
}

// ── Reset Position ───────────────────────────────────────────────────────────
#[tauri::command]
fn reset_window_position(app: AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        if let Ok(Some(monitor)) = window.primary_monitor() {
            let scale = monitor.scale_factor();
            let screen_w = monitor.size().width as f64 / scale;
            
            // Standard centered size for idle pill
            let win_w = 140.0; 
            let x = ((screen_w - win_w) / 2.0 * scale) as i32;
            let y = 0; // Cling to the top menu bar
            let _ = window.set_position(tauri::PhysicalPosition::new(x, y));
            let _ = app.emit("reset-position", ());
        }
    }
}

// ── Dismiss ────────────────────────────────────────────────────────────────────
#[tauri::command]
fn dismiss_overlay(app: AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.hide();
    }
}

// ── Paste ─────────────────────────────────────────────────────────────────────
#[tauri::command]
fn paste_text(app: AppHandle, text: String) -> Result<(), String> {
    // 1. Write to clipboard first
    use tauri_plugin_clipboard_manager::ClipboardExt;
    app.clipboard()
        .write_text(text)
        .map_err(|e| format!("ERR_CLIPBOARD: {}", e))?;

    // 3. Resolve target app
    let (_target_name, target_id) = if let Ok(lock) = app.state::<TargetApp>().0.lock() {
        lock.clone()
    } else {
        ("Unknown".to_string(), "Unknown".to_string())
    };

    // 4. Hide window and restore focus
    #[cfg(target_os = "macos")]
    {
        let _ = app.hide(); 
        if target_id != "Unknown" {
            activate_app_by_id(&target_id);
        }
    }
    
    let enigo_arc_outer = app.state::<EnigoState>().0.clone();
    let app_handle = app.clone();

    // 5. Spawn async task with enough delay for focus to land
    tauri::async_runtime::spawn(async move {
        // macOS Tahoe needs a bit more time for the window server to complete hide() transition
        tokio::time::sleep(std::time::Duration::from_millis(600)).await;
        
        let _app_emit = app_handle.clone();
        let _enigo_arc = enigo_arc_outer.clone();

        // High-level native simulation (works with Accessibility)
        let _ = app_handle.run_on_main_thread(move || {
            #[cfg(target_os = "macos")]
            {
                use core_graphics::event::{CGEvent, CGEventTapLocation, CGEventFlags, CGKeyCode};
                use core_graphics::event_source::{CGEventSource, CGEventSourceStateID};

                if let Ok(source) = CGEventSource::new(CGEventSourceStateID::HIDSystemState) {
                    // Physical Constants
                    let k_cmd: CGKeyCode = 55;
                    let k_v: CGKeyCode = 9;

                    if let (Ok(c_dn), Ok(c_up), Ok(v_dn), Ok(v_up)) = (
                        CGEvent::new_keyboard_event(source.clone(), k_cmd, true),
                        CGEvent::new_keyboard_event(source.clone(), k_cmd, false),
                        CGEvent::new_keyboard_event(source.clone(), k_v, true),
                        CGEvent::new_keyboard_event(source.clone(), k_v, false),
                    ) {
                        // Crucial: Set flags on the V events so key-repeat/combinations register correctly
                        v_dn.set_flags(CGEventFlags::CGEventFlagCommand);
                        v_up.set_flags(CGEventFlags::CGEventFlagCommand);

                        // FULL SEQUENCE: Cmd Down -> (wait) -> V Down -> (wait) -> V Up -> (wait) -> Cmd Up
                        c_dn.post(CGEventTapLocation::HID);
                        std::thread::sleep(std::time::Duration::from_millis(30));
                        v_dn.post(CGEventTapLocation::HID);
                        std::thread::sleep(std::time::Duration::from_millis(50));
                        v_up.post(CGEventTapLocation::HID);
                        std::thread::sleep(std::time::Duration::from_millis(30));
                        c_up.post(CGEventTapLocation::HID);
                        
                        println!("NYX Vox: Native Paste sequence posted to HID");
                    }
                } else {
                    let _ = _app_emit.emit("paste-error-ui", "ERR_ACCESSIBILITY");
                }
            }
            #[cfg(target_os = "windows")]
            {
                if let Ok(mut enigo) = _enigo_arc.lock() {
                    use enigo::{Keyboard, Key, Direction};
                    let _ = enigo.0.key(Key::Control, Direction::Press);
                    let _ = enigo.0.key(Key::Unicode('v'), Direction::Click);
                    let _ = enigo.0.key(Key::Control, Direction::Release);
                }
            }
        });
    });

    Ok(())
}

#[tauri::command]
fn get_target_app(state: State<'_, TargetApp>) -> String {
    state.0.lock().unwrap().0.clone()
}

#[tauri::command]
fn update_tray_lang(app: AppHandle, lang: String) {
    if let Some(tray) = app.tray_by_id("main") {
        let welcome_label = if lang == "ru" { "Инструкция (Welcome/FAQ)" } else { "Welcome / Help" };
        let show_label = if lang == "ru" { "Показать NYX Vox" } else { "Show NYX Vox" };
        let settings_label = if lang == "ru" { "Настройки" } else { "Settings" };
        let reset_label = if lang == "ru" { "Сбросить позицию (Reset)" } else { "Reset Position" };
        let quit_label = if lang == "ru" { "Выйти (Quit)" } else { "Quit" };

        let welcome_i = MenuItem::with_id(&app, "welcome_win", welcome_label, true, None::<&str>).unwrap();
        let show_i = MenuItem::with_id(&app, "show", show_label, true, None::<&str>).unwrap();
        let settings_i = MenuItem::with_id(&app, "settings", settings_label, true, None::<&str>).unwrap();
        let reset_pos_i = MenuItem::with_id(&app, "reset_pos", reset_label, true, None::<&str>).unwrap();
        let quit_i = MenuItem::with_id(&app, "quit", quit_label, true, None::<&str>).unwrap();
        
        // Single standardized tray menu
        let tray_menu = Menu::with_items(&app, &[&welcome_i, &show_i, &settings_i, &reset_pos_i, &quit_i]).unwrap();
        let _ = tray.set_menu(Some(tray_menu));
    }
}

#[tauri::command]
async fn check_microphone_permission() -> Result<i32, String> {
    // Use cpal to check real mic access — AVCaptureDevice doesn't reflect
    // CoreAudio permissions on macOS 26+.
    tokio::task::spawn_blocking(|| {
        use cpal::traits::{HostTrait, DeviceTrait};
        let host = cpal::default_host();
        match host.default_input_device() {
            Some(device) => {
                match device.supported_input_configs() {
                    Ok(mut configs) => {
                        if configs.next().is_some() { 3 } else { 0 }
                    },
                    Err(_) => 2
                }
            },
            None => 0
        }
    }).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn request_microphone_permission() -> Result<bool, String> {
    // Trigger the macOS permission dialog by briefly probing the mic via cpal.
    tokio::task::spawn_blocking(|| {
        use cpal::traits::{HostTrait, DeviceTrait, StreamTrait};
        let host = cpal::default_host();
        match host.default_input_device() {
            Some(device) => {
                if let Ok(config) = device.default_input_config() {
                    let stream = device.build_input_stream(
                        &config.into(),
                        |_data: &[f32], _: &cpal::InputCallbackInfo| {},
                        |_err| {},
                        None,
                    );
                    if let Ok(s) = stream {
                        let _ = s.play();
                        std::thread::sleep(std::time::Duration::from_millis(200));
                        drop(s);
                        return true;
                    }
                }
                false
            },
            None => false
        }
    }).await.map_err(|e| e.to_string())
}


#[tauri::command]
async fn set_app_language(app: AppHandle, lang: String, state: State<'_, AppLanguage>) -> Result<(), String> {
    use tauri_plugin_store::StoreExt;
    let store = app.store("settings.json").map_err(|e| e.to_string())?;
    store.set("app_language", serde_json::json!(lang));
    store.save().map_err(|e| e.to_string())?;
    *state.0.lock().map_err(|e| e.to_string())? = lang.clone();
    
    // Also sync tray immediately
    update_tray_lang(app.clone(), lang.clone());
    let _ = app.emit("language-changed", lang);
    Ok(())
}

#[tauri::command]
async fn get_app_language(state: State<'_, AppLanguage>) -> Result<String, String> {
    Ok(state.0.lock().map_err(|e| e.to_string())?.clone())
}

#[tauri::command]
async fn get_update_dismissed_at(app: AppHandle) -> Result<u64, String> {
    use tauri_plugin_store::StoreExt;
    let store = app.store("settings.json").map_err(|e| e.to_string())?;
    let val = store.get("update_dismissed_at").and_then(|v| v.as_u64()).unwrap_or(0);
    Ok(val)
}

#[tauri::command]
async fn set_update_dismissed_at(app: AppHandle, timestamp: u64) -> Result<(), String> {
    use tauri_plugin_store::StoreExt;
    let store = app.store("settings.json").map_err(|e| e.to_string())?;
    store.set("update_dismissed_at", serde_json::json!(timestamp));
    store.save().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn get_ignored_update(app: AppHandle) -> Result<String, String> {
    use tauri_plugin_store::StoreExt;
    let store = app.store("settings.json").map_err(|e| e.to_string())?;
    let version = store.get("ignored_update_version")
        .and_then(|v| v.as_str().map(|s| s.to_string()))
        .unwrap_or_else(|| "".to_string());
    Ok(version)
}

#[tauri::command]
async fn set_ignored_update(app: AppHandle, version: String) -> Result<(), String> {
    use tauri_plugin_store::StoreExt;
    let store = app.store("settings.json").map_err(|e| e.to_string())?;
    store.set("ignored_update_version", serde_json::json!(version));
    store.save().map_err(|e| e.to_string())?;
    Ok(())
}

// Window management is now unified in the main pill.
#[tauri::command]
async fn show_welcome_window(app: AppHandle) -> Result<(), String> {
    let _ = app.emit("open-welcome", ());
    show_overlay(&app);
    Ok(())
}

#[tauri::command]
fn open_url(url: String) {
    #[cfg(target_os = "macos")]
    {
        let _ = std::process::Command::new("open").arg(&url).spawn();
    }
}

// ── Start recording (mode-aware) ──────────────────────────────────────────────
#[tauri::command]
async fn start_recording(
    app: AppHandle,
    state: State<'_, whisper::SharedState>,
    recording_flag: State<'_, Arc<AtomicBool>>,
    processing_flag: State<'_, ProcessingFlag>,
    stt_mode: State<'_, SttMode>,
    auto_pause: State<'_, AutoPause>,
    dg_key: State<'_, DgApiKey>,
    groq_state: State<'_, groq::SharedGroqState>,
    groq_key: State<'_, GroqApiKey>,
    _enigo_state: State<'_, EnigoState>,
    dg_lang: State<'_, DeepgramLanguage>,
    whisper_lang: State<'_, WhisperLanguage>,
    groq_lang: State<'_, GroqLanguage>,
) -> Result<(), String> {
    let mode = stt_mode.0.lock().map_err(|e| e.to_string())?.clone();
    
    let _lang = match mode.as_str() {
        "deepgram" => dg_lang.0.lock().map_err(|e| e.to_string())?.clone(),
        "whisper" => whisper_lang.0.lock().map_err(|e| e.to_string())?.clone(),
        "groq" => groq_lang.0.lock().map_err(|e| e.to_string())?.clone(),
        _ => "auto".to_string(),
    };
    let ap = *auto_pause.0.lock().map_err(|e| e.to_string())?;

    if ap {
        let script = r#"
            tell application "Music" to if it is running then pause
            tell application "Spotify" to if it is running then pause
            tell application "System Events"
                if (exists process "Google Chrome") then
                    try
                        tell application "Google Chrome" to execute (active tab of window 1) javascript "document.querySelectorAll('video, audio').forEach(m => m.pause())"
                    end try
                end if
                if (exists process "Safari") then
                    try
                        tell application "Safari" to execute (current tab of window 1) javascript "document.querySelectorAll('video, audio').forEach(m => m.pause())"
                    end try
                end if
                if (exists process "Yandex") then
                    try
                        tell application "Yandex" to execute (active tab of window 1) javascript "document.querySelectorAll('video, audio').forEach(m => m.pause())"
                    end try
                end if
                if (exists process "Yandex Browser") then
                    try
                        tell application "Yandex Browser" to execute (active tab of window 1) javascript "document.querySelectorAll('video, audio').forEach(m => m.pause())"
                    end try
                end if
                if (exists process "Arc") then
                    try
                        tell application "Arc" to execute (active tab of window 1) javascript "document.querySelectorAll('video, audio').forEach(m => m.pause())"
                    end try
                end if
                if (exists process "Brave Browser") then
                    try
                        tell application "Brave Browser" to execute (active tab of window 1) javascript "document.querySelectorAll('video, audio').forEach(m => m.pause())"
                    end try
                end if
            end tell
        "#;
        let _ = std::process::Command::new("osascript").arg("-e").arg(script).spawn();
    }

    let mut final_mode = mode;

    if final_mode == "deepgram" || final_mode == "groq" {
        // Fast network check (pinging Google DNS on port 53)
        let is_online = std::net::TcpStream::connect_timeout(
            &"8.8.8.8:53".parse().unwrap(),
            std::time::Duration::from_millis(1500),
        ).is_ok();

        if !is_online {
            if whisper::is_model_available() {
                let _ = app.emit("stt-fallback", "Нет сети. Авто-переключение на офлайн режим (Whisper).");
                
                // Update mode in state and store
                if let Ok(mut lock) = stt_mode.0.lock() { *lock = "whisper".to_string(); }
                use tauri_plugin_store::StoreExt;
                if let Ok(store) = app.store("settings.json") {
                    store.set("stt_mode", serde_json::json!("whisper"));
                    let _ = store.save();
                }
                // Notify frontend
                let _ = app.emit("mode-changed", "whisper");
                
                final_mode = "whisper".to_string();
                
                // Call start_recording recursively or just run whisper logic 
                // Since final_mode is now whisper, the flow will naturally fall into the whisper block
            } else {
                return Err("Нет подключения к интернету, а офлайн модель не установлена.".to_string());
            }
        }
    }

    let lang = match final_mode.as_str() {
        "deepgram" => dg_lang.0.lock().map_err(|e| e.to_string())?.clone(),
        "whisper" => whisper_lang.0.lock().map_err(|e| e.to_string())?.clone(),
        "groq" => groq_lang.0.lock().map_err(|e| e.to_string())?.clone(),
        _ => "auto".to_string(),
    };

    if final_mode == "deepgram" {
        // Check for API key
        let key = dg_key.0.lock().map_err(|e| e.to_string())?.clone();
        match key {
            Some(k) if !k.is_empty() => {
                let flag = Arc::clone(&recording_flag);
                deepgram::start_deepgram(app, k, flag, &lang)?;
            }
            _ => {
                // Fallback to Whisper if model available
                if whisper::is_model_available() {
                    let _ = app.emit("stt-fallback", "Deepgram ключ не найден. Используем офлайн режим.");
                    whisper::start_recording(
                        app, 
                        Arc::clone(&state), 
                        Arc::clone(&recording_flag),
                        Arc::clone(&processing_flag.0),
                        &lang,
                    )?;
                } else {
                    return Err("Добавьте ключ Deepgram в настройках или скачайте модель для офлайн режима.".to_string());
                }
            }
        }
    } else if final_mode == "whisper" {
        // Whisper offline mode
        if !whisper::is_model_available() {
            return Err("Модель не найдена. Скачайте модель в Настройках.".to_string());
        }
        whisper::start_recording(
            app,
            Arc::clone(&state),
            Arc::clone(&recording_flag),
            Arc::clone(&processing_flag.0),
            &lang,
        )?;
    } else if final_mode == "groq" {
        // Check for Groq API key
        let key = groq_key.0.lock().map_err(|e| e.to_string())?.clone();
        match key {
            Some(k) if !k.is_empty() => {
                let flag = Arc::clone(&recording_flag);
                groq::start_recording(app, Arc::clone(&groq_state), flag)?;
            }
            _ => {
                return Err("Добавьте ключ Groq в настройках.".to_string());
            }
        }
    }

    Ok(())
}

// ── Stop recording (mode-aware) ───────────────────────────────────────────────
#[tauri::command]
async fn stop_recording(
    state: State<'_, whisper::SharedState>,
    groq_state: State<'_, groq::SharedGroqState>,
    recording_flag: State<'_, Arc<AtomicBool>>,
    stt_mode: State<'_, SttMode>,
    auto_pause: State<'_, AutoPause>,
    groq_key: State<'_, GroqApiKey>,
    _enigo_state: State<'_, EnigoState>,
    dg_lang: State<'_, DeepgramLanguage>,
    whisper_lang: State<'_, WhisperLanguage>,
    groq_lang: State<'_, GroqLanguage>,
) -> Result<String, String> {
    let mode = stt_mode.0.lock().map_err(|e| e.to_string())?.clone();

    let lang = match mode.as_str() {
        "deepgram" => dg_lang.0.lock().map_err(|e| e.to_string())?.clone(),
        "whisper" => whisper_lang.0.lock().map_err(|e| e.to_string())?.clone(),
        "groq" => groq_lang.0.lock().map_err(|e| e.to_string())?.clone(),
        _ => "auto".to_string(),
    };
    let ap = *auto_pause.0.lock().map_err(|e| e.to_string())?;
    if ap {
        let script = r#"
            tell application "Music" to if it is running then play
            tell application "Spotify" to if it is running then play
            tell application "System Events"
                if (exists process "Google Chrome") then
                    try
                        tell application "Google Chrome" to execute (active tab of window 1) javascript "document.querySelectorAll('video, audio').forEach(m => m.play())"
                    end try
                end if
                if (exists process "Safari") then
                    try
                        tell application "Safari" to execute (current tab of window 1) javascript "document.querySelectorAll('video, audio').forEach(m => m.play())"
                    end try
                end if
                if (exists process "Yandex") then
                    try
                        tell application "Yandex" to execute (active tab of window 1) javascript "document.querySelectorAll('video, audio').forEach(m => m.play())"
                    end try
                end if
                if (exists process "Yandex Browser") then
                    try
                        tell application "Yandex Browser" to execute (active tab of window 1) javascript "document.querySelectorAll('video, audio').forEach(m => m.play())"
                    end try
                end if
                if (exists process "Arc") then
                    try
                        tell application "Arc" to execute (active tab of window 1) javascript "document.querySelectorAll('video, audio').forEach(m => m.play())"
                    end try
                end if
                if (exists process "Brave Browser") then
                    try
                        tell application "Brave Browser" to execute (active tab of window 1) javascript "document.querySelectorAll('video, audio').forEach(m => m.play())"
                    end try
                end if
            end tell
        "#;
        let _ = std::process::Command::new("osascript").arg("-e").arg(script).spawn();
    }

    // Stop the recording flag (works for both modes)
    recording_flag.store(false, Ordering::SeqCst);

    if mode == "deepgram" {
        // Deepgram: text is already accumulated via events, return empty
        // The frontend gets text via transcript-partial + deepgram-final events
        tokio::time::sleep(std::time::Duration::from_millis(200)).await;
        Ok(String::new())
    } else if mode == "whisper" {
        // Whisper: process full buffer for final result
        whisper::stop_recording(
            Arc::clone(&state),
            Arc::clone(&recording_flag),
            &lang,
        ).await
    } else if mode == "groq" {
        // Groq: stop and send buffer to API
        let api_key = groq_key.0.lock().map_err(|e| e.to_string())?.clone().unwrap_or_default();
        groq::stop_recording(
            Arc::clone(&groq_state),
            Arc::clone(&recording_flag),
            api_key,
            &lang,
        ).await
    } else {
        Ok(String::new())
    }
}

// ── Settings commands ─────────────────────────────────────────────────────────
#[tauri::command]
async fn save_api_key(
    app: AppHandle,
    key: String,
    dg_key: State<'_, DgApiKey>,
) -> Result<(), String> {
    use tauri_plugin_store::StoreExt;
    let store = app.store("settings.json").map_err(|e| e.to_string())?;
    store.set("deepgram_api_key", serde_json::json!(key));
    store.save().map_err(|e| e.to_string())?;

    // Cache in memory
    *dg_key.0.lock().map_err(|e| e.to_string())? = Some(key);
    Ok(())
}

#[tauri::command]
async fn get_api_key(app: AppHandle) -> Result<String, String> {
    use tauri_plugin_store::StoreExt;
    let store = app.store("settings.json").map_err(|e| e.to_string())?;
    match store.get("deepgram_api_key") {
        Some(val) => Ok(val.as_str().unwrap_or("").to_string()),
        None => Ok(String::new()),
    }
}

#[tauri::command]
async fn delete_api_key(
    app: AppHandle,
    dg_key: State<'_, DgApiKey>,
) -> Result<(), String> {
    use tauri_plugin_store::StoreExt;
    let store = app.store("settings.json").map_err(|e| e.to_string())?;
    store.delete("deepgram_api_key");
    store.save().map_err(|e| e.to_string())?;
    *dg_key.0.lock().map_err(|e| e.to_string())? = None;
    Ok(())
}

#[tauri::command]
async fn save_groq_api_key(
    app: AppHandle,
    key: String,
    groq_key: State<'_, GroqApiKey>,
) -> Result<(), String> {
    use tauri_plugin_store::StoreExt;
    let store = app.store("settings.json").map_err(|e| e.to_string())?;
    store.set("groq_api_key", serde_json::json!(key));
    store.save().map_err(|e| e.to_string())?;

    // Cache in memory
    *groq_key.0.lock().map_err(|e| e.to_string())? = Some(key);
    Ok(())
}

#[tauri::command]
async fn get_groq_api_key(app: AppHandle) -> Result<String, String> {
    use tauri_plugin_store::StoreExt;
    let store = app.store("settings.json").map_err(|e| e.to_string())?;
    match store.get("groq_api_key") {
        Some(val) => Ok(val.as_str().unwrap_or("").to_string()),
        None => Ok(String::new()),
    }
}

#[tauri::command]
async fn delete_groq_api_key(
    app: AppHandle,
    groq_key: State<'_, GroqApiKey>,
) -> Result<(), String> {
    use tauri_plugin_store::StoreExt;
    let store = app.store("settings.json").map_err(|e| e.to_string())?;
    store.delete("groq_api_key");
    store.save().map_err(|e| e.to_string())?;
    *groq_key.0.lock().map_err(|e| e.to_string())? = None;
    Ok(())
}

#[tauri::command]
async fn set_stt_mode(
    mode: String,
    stt_mode: State<'_, SttMode>,
    app: AppHandle,
) -> Result<(), String> {
    use tauri_plugin_store::StoreExt;
    let store = app.store("settings.json").map_err(|e| e.to_string())?;
    store.set("stt_mode", serde_json::json!(mode));
    store.save().map_err(|e| e.to_string())?;
    *stt_mode.0.lock().map_err(|e| e.to_string())? = mode;
    Ok(())
}

#[tauri::command]
async fn get_welcome_seen(app: AppHandle, version: String) -> Result<bool, String> {
    use tauri_plugin_store::StoreExt;
    let store = app.store("settings.json").map_err(|e| e.to_string())?;
    let key = format!("welcome_seen_{}", version.replace('.', "_"));
    match store.get(key) {
        Some(val) => Ok(val.as_bool().unwrap_or(false)),
        None => Ok(false),
    }
}

#[tauri::command]
async fn get_start_minimized(app: AppHandle) -> Result<bool, String> {
    use tauri_plugin_store::StoreExt;
    let store = app.store("settings.json").map_err(|e| e.to_string())?;
    match store.get("start_minimized") {
        Some(val) => Ok(val.as_bool().unwrap_or(false)),
        None => Ok(false),
    }
}

#[tauri::command]
async fn set_start_minimized(app: AppHandle, minimized: bool) -> Result<(), String> {
    use tauri_plugin_store::StoreExt;
    let store = app.store("settings.json").map_err(|e| e.to_string())?;
    store.set("start_minimized", serde_json::json!(minimized));
    store.save().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn get_clear_on_paste(app: AppHandle) -> Result<bool, String> {
    use tauri_plugin_store::StoreExt;
    let store = app.store("settings.json").map_err(|e| e.to_string())?;
    match store.get("clear_on_paste") {
        Some(val) => Ok(val.as_bool().unwrap_or(false)),
        None => Ok(false),
    }
}

#[tauri::command]
async fn set_clear_on_paste(app: AppHandle, enabled: bool) -> Result<(), String> {
    use tauri_plugin_store::StoreExt;
    let store = app.store("settings.json").map_err(|e| e.to_string())?;
    store.set("clear_on_paste", serde_json::json!(enabled));
    store.save().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn set_welcome_seen(app: AppHandle, version: String, seen: bool) -> Result<(), String> {
    use tauri_plugin_store::StoreExt;
    let store = app.store("settings.json").map_err(|e| e.to_string())?;
    let key = format!("welcome_seen_{}", version.replace('.', "_"));
    store.set(key, serde_json::json!(seen));
    store.save().map_err(|e| e.to_string())?;
    Ok(())
}
#[tauri::command]
async fn check_accessibility() -> Result<bool, String> {
    #[cfg(target_os = "macos")]
    {
        extern "C" {
            pub fn AXIsProcessTrusted() -> bool;
        }
        let trusted = unsafe { AXIsProcessTrusted() };
        Ok(trusted)
    }
    #[cfg(not(target_os = "macos"))]
    {
        Ok(true)
    }
}

#[tauri::command]
async fn open_accessibility_settings() -> Result<(), String> {
    let script = "tell application \"System Events\" to open location \"x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility\"";
    let _ = std::process::Command::new("osascript").arg("-e").arg(script).spawn();
    Ok(())
}

#[tauri::command]
async fn open_microphone_settings() -> Result<(), String> {
    let script = "tell application \"System Events\" to open location \"x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone\"";
    let _ = std::process::Command::new("osascript").arg("-e").arg(script).spawn();
    Ok(())
}

// Redundant functions removed as logic moved to unified pill overlays

#[tauri::command]
async fn hide_welcome_window(app: AppHandle) -> Result<(), String> {
    // Functional replacement: just dismiss the main overlay
    dismiss_overlay(app);
    Ok(())
}

#[tauri::command]
async fn fix_quarantine(app: AppHandle) -> Result<(), String> {
    let app_path = app.path().executable_dir().map_err(|e| e.to_string())?
        .parent().ok_or("Invalid path")?
        .parent().ok_or("Invalid path")?
        .parent().ok_or("Invalid path")?.to_string_lossy().to_string();
    
    // Command: xattr -d com.apple.quarantine /Applications/NYX-Vox.app
    let _ = std::process::Command::new("xattr")
        .arg("-d")
        .arg("com.apple.quarantine")
        .arg(&app_path)
        .spawn();
    Ok(())
}

#[tauri::command]
async fn get_stt_mode(stt_mode: State<'_, SttMode>) -> Result<String, String> {
    Ok(stt_mode.0.lock().map_err(|e| e.to_string())?.clone())
}



#[tauri::command]
async fn set_deepgram_language(lang: String, state: State<'_, DeepgramLanguage>, app: AppHandle) -> Result<(), String> {
    use tauri_plugin_store::StoreExt;
    let store = app.store("settings.json").map_err(|e| e.to_string())?;
    store.set("deepgram_language", serde_json::json!(lang));
    store.save().map_err(|e| e.to_string())?;
    *state.0.lock().map_err(|e| e.to_string())? = lang;
    Ok(())
}

#[tauri::command]
async fn get_deepgram_language(state: State<'_, DeepgramLanguage>) -> Result<String, String> {
    Ok(state.0.lock().map_err(|e| e.to_string())?.clone())
}

#[tauri::command]
async fn set_whisper_language(lang: String, state: State<'_, WhisperLanguage>, app: AppHandle) -> Result<(), String> {
    use tauri_plugin_store::StoreExt;
    let store = app.store("settings.json").map_err(|e| e.to_string())?;
    store.set("whisper_language", serde_json::json!(lang));
    store.save().map_err(|e| e.to_string())?;
    *state.0.lock().map_err(|e| e.to_string())? = lang;
    Ok(())
}

#[tauri::command]
async fn get_whisper_language(state: State<'_, WhisperLanguage>) -> Result<String, String> {
    Ok(state.0.lock().map_err(|e| e.to_string())?.clone())
}

#[tauri::command]
async fn set_groq_language(lang: String, state: State<'_, GroqLanguage>, app: AppHandle) -> Result<(), String> {
    use tauri_plugin_store::StoreExt;
    let store = app.store("settings.json").map_err(|e| e.to_string())?;
    store.set("groq_language", serde_json::json!(lang));
    store.save().map_err(|e| e.to_string())?;
    *state.0.lock().map_err(|e| e.to_string())? = lang;
    Ok(())
}

#[tauri::command]
async fn get_groq_language(state: State<'_, GroqLanguage>) -> Result<String, String> {
    Ok(state.0.lock().map_err(|e| e.to_string())?.clone())
}

#[tauri::command]
async fn set_auto_pause(
    pause: bool,
    auto_pause: State<'_, AutoPause>,
    app: AppHandle,
) -> Result<(), String> {
    use tauri_plugin_store::StoreExt;
    let store = app.store("settings.json").map_err(|e| e.to_string())?;
    store.set("auto_pause", serde_json::json!(pause));
    store.save().map_err(|e| e.to_string())?;

    *auto_pause.0.lock().map_err(|e| e.to_string())? = pause;
    Ok(())
}

#[tauri::command]
async fn get_auto_pause(auto_pause: State<'_, AutoPause>) -> Result<bool, String> {
    Ok(*auto_pause.0.lock().map_err(|e| e.to_string())?)
}

#[tauri::command]
async fn set_auto_paste(app_handle: tauri::AppHandle, state: State<'_, AutoPaste>, enabled: bool) -> Result<(), String> {
    if let Ok(mut lock) = state.0.lock() {
        *lock = enabled;
    }
    let store = app_handle.store("settings.json").map_err(|e| e.to_string())?;
    store.set("auto_paste", serde_json::Value::Bool(enabled));
    let _ = store.save();
    Ok(())
}

#[tauri::command]
fn get_auto_paste(state: State<'_, AutoPaste>) -> bool {
    *state.0.lock().unwrap()
}

#[tauri::command]
async fn set_always_on_top(app_handle: tauri::AppHandle, state: State<'_, AlwaysOnTop>, enabled: bool) -> Result<(), String> {
    if let Ok(mut lock) = state.0.lock() {
        *lock = enabled;
    }
    // Apply to window immediately
    if let Some(w) = app_handle.get_webview_window("main") {
        let _ = w.set_always_on_top(enabled);
    }
    let store = app_handle.store("settings.json").map_err(|e| e.to_string())?;
    store.set("always_on_top", serde_json::Value::Bool(enabled));
    let _ = store.save();
    Ok(())
}

#[tauri::command]
fn get_always_on_top(state: State<'_, AlwaysOnTop>) -> bool {
    *state.0.lock().unwrap()
}

#[tauri::command]
async fn check_model_available() -> Result<bool, String> {
    Ok(whisper::is_model_available())
}

#[tauri::command]
async fn download_whisper_model(app: AppHandle) -> Result<(), String> {
    whisper::download_model(app).await
}

#[tauri::command]
async fn delete_whisper_model() -> Result<(), String> {
    whisper::delete_model()
}

// ── Open Mac Accessibility Settings ───────────────────────────────────────────
#[tauri::command]
async fn open_mac_settings() -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg("x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility")
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
async fn fix_browser_permissions() -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        let bundles = vec![
            "com.google.Chrome",
            "com.google.Chrome.canary",
            "company.thebrowser.Browser", // Arc
            "com.apple.Safari",
            "ru.yandex.desktop.yandex-browser",
            "com.brave.Browser",
            "com.microsoft.edgemac",
            "com.vivaldi.Vivaldi"
        ];
        
        for bundle in bundles {
            let _ = std::process::Command::new("defaults")
                .args(["write", bundle, "AllowJavaScriptFromAppleEvents", "-bool", "true"])
                .status();
        }
        
        // Specially for Safari: also enable Develop menu so the user sees the result
        let _ = std::process::Command::new("defaults")
            .args(["write", "com.apple.Safari", "IncludeDevelopMenu", "-bool", "true"])
            .status();
            
        Ok(())
    }
    #[cfg(not(target_os = "macos"))]
    {
        Ok(())
    }
}

// ── Toggle window ─────────────────────────────────────────────────────────────
fn toggle_window<R: Runtime>(app: &AppHandle<R>) {
    if let Some(w) = app.get_webview_window("main") {
        if w.is_visible().unwrap_or(false) { let _ = w.hide(); }
        else { show_overlay(app); }
    }
}

// ── Entry Point ───────────────────────────────────────────────────────────────
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let ctrl_space = Shortcut::new(Some(Modifiers::CONTROL), Code::Space);
    let opt_space  = Shortcut::new(Some(Modifiers::ALT), Code::Space);

    let recording_state: whisper::SharedState = Arc::new(Mutex::new(whisper::RecordingState::default()));
    let groq_state: groq::SharedGroqState = Arc::new(Mutex::new(groq::RecordingState::default()));
    let recording_flag: Arc<AtomicBool> = Arc::new(AtomicBool::new(false));
    let processing_flag = ProcessingFlag::default();
    
    // Initialize Enigo once
    let enigo_inst = enigo::Enigo::new(&enigo::Settings::default()).expect("Failed to init Enigo");
    let enigo_state = EnigoState(Arc::new(Mutex::new(EnigoWrapper(enigo_inst))));

    // Detect system language as fallback
    let sys_lang = if std::env::var("LANG").unwrap_or_default().starts_with("ru") { "ru" } else { "en" };

    tauri::Builder::default()
        .manage(recording_state)
        .manage(groq_state)
        .manage(recording_flag)
        .manage(processing_flag)
        .manage(PositionInitialized(AtomicBool::new(false)))
        .manage(AppLanguage(Mutex::new(sys_lang.to_string())))
        .manage(TargetApp(Mutex::new(("Unknown".to_string(), "Unknown".to_string()))))
        .manage(enigo_state)
        .manage(SttMode(Mutex::new("deepgram".to_string())))
        .manage(DeepgramLanguage(Mutex::new("auto".to_string())))
        .manage(WhisperLanguage(Mutex::new("ru".to_string())))
        .manage(GroqLanguage(Mutex::new("auto".to_string())))
        .manage(AutoPause(Mutex::new(true)))
        .manage(AutoPaste(Mutex::new(true)))
        .manage(AlwaysOnTop(Mutex::new(true)))
        .manage(DgApiKey(Mutex::new(None)))
        .manage(GroqApiKey(Mutex::new(None)))
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        // .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(move |app, shortcut, event| {
                    if event.state() == ShortcutState::Pressed
                        && (shortcut == &ctrl_space || shortcut == &opt_space)
                    {
                        show_overlay(app);
                        let _ = app.emit("shortcut-trigger", ());
                    }
                })
                .build(),
        )
        .setup(move |app| {
            // Load cached API key from store
            {
                use tauri_plugin_store::StoreExt;
                if let Ok(store) = app.store("settings.json") {
                    if let Some(key) = store.get("deepgram_api_key") {
                        if let Some(k) = key.as_str() {
                            if !k.is_empty() {
                                if let Some(dg_key) = app.try_state::<DgApiKey>() {
                                    if let Ok(mut lock) = dg_key.0.lock() {
                                        *lock = Some(k.to_string());
                                    }
                                }
                            }
                        }
                    }
                    if let Some(key) = store.get("groq_api_key") {
                        if let Some(k) = key.as_str() {
                            if !k.is_empty() {
                                if let Some(groq_key) = app.try_state::<GroqApiKey>() {
                                    if let Ok(mut lock) = groq_key.0.lock() {
                                        *lock = Some(k.to_string());
                                    }
                                }
                            }
                        }
                    }
                    // Load saved mode
                    if let Some(mode) = store.get("stt_mode") {
                        if let Some(m) = mode.as_str() {
                            if let Some(stt) = app.try_state::<SttMode>() {
                                if let Ok(mut lock) = stt.0.lock() {
                                    *lock = m.to_string();
                                }
                            }
                        }
                    }
                    // Load saved auto_pause
                    if let Some(pause_val) = store.get("auto_pause") {
                        if let Some(p) = pause_val.as_bool() {
                            if let Some(ap_state) = app.try_state::<AutoPause>() {
                                if let Ok(mut lock) = ap_state.0.lock() {
                                    *lock = p;
                                }
                            }
                        }
                    }
                    // Load saved languages
                    if let Some(val) = store.get("deepgram_language") {
                        if let Some(l) = val.as_str() {
                            if let Some(state) = app.try_state::<DeepgramLanguage>() {
                                if let Ok(mut lock) = state.0.lock() { *lock = l.to_string(); }
                            }
                        }
                    }
                    if let Some(val) = store.get("whisper_language") {
                        if let Some(l) = val.as_str() {
                            if let Some(state) = app.try_state::<WhisperLanguage>() {
                                if let Ok(mut lock) = state.0.lock() { *lock = l.to_string(); }
                            }
                        }
                    }
                    if let Some(val) = store.get("groq_language") {
                        if let Some(l) = val.as_str() {
                            if let Some(state) = app.try_state::<GroqLanguage>() {
                                if let Ok(mut lock) = state.0.lock() { *lock = l.to_string(); }
                            }
                        }
                    }
                    // Load saved auto_paste
                    if let Some(paste_val) = store.get("auto_paste") {
                        if let Some(p) = paste_val.as_bool() {
                            if let Some(ap_state) = app.try_state::<AutoPaste>() {
                                if let Ok(mut lock) = ap_state.0.lock() {
                                    *lock = p;
                                }
                            }
                        }
                    }
                    // Load saved always_on_top (default true)
                    if let Some(aot_val) = store.get("always_on_top") {
                        if let Some(aot) = aot_val.as_bool() {
                            if let Some(aot_state) = app.try_state::<AlwaysOnTop>() {
                                if let Ok(mut lock) = aot_state.0.lock() {
                                    *lock = aot;
                                }
                            }
                            if let Some(w) = app.get_webview_window("main") {
                                let _ = w.set_always_on_top(aot);
                            }
                        }
                    }
                    // Load saved app language
                    let mut current_lang = sys_lang.to_string();
                    if let Some(lang_val) = store.get("app_language") {
                        if let Some(l) = lang_val.as_str() {
                            current_lang = l.to_string();
                            if let Some(state) = app.try_state::<AppLanguage>() {
                                if let Ok(mut lock) = state.0.lock() { *lock = l.to_string(); }
                            }
                        }
                    }
                    update_tray_lang(app.handle().clone(), current_lang);

                    // Load start_minimized and show window if needed
                    let minimized = store.get("start_minimized")
                        .and_then(|v| v.as_bool())
                        .unwrap_or(false);
                    
                    if !minimized {
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.show();
                        }
                    }
                }
            }


            app.global_shortcut().register(ctrl_space)?;
            app.global_shortcut().register(opt_space)?;

            let tray_menu = Menu::with_items(app, &[])?;

            TrayIconBuilder::with_id("main")
                .icon(tauri::image::Image::from_bytes(include_bytes!("../icons/trayTemplate.png")).unwrap())
                .icon_as_template(true)
                .menu(&tray_menu)
                .tooltip("NYX Vox — Option+Space")
                .on_menu_event(|app_handle: &AppHandle, event| {
                    let handle = app_handle.clone();
                    match event.id.as_ref() {
                        "quit" => handle.exit(0),
                        "show" => show_overlay(&handle),
                        "welcome_win" => {
                            show_overlay(&handle);
                            let _ = handle.emit("open-welcome", ());
                        }
                        "settings" => {
                            show_overlay(&handle);
                            let _ = handle.emit("open-settings", ());
                        }
                        "reset_pos" => {
                            reset_window_position(handle);
                        }
                        _ => {}
                    }
                })
                .on_tray_icon_event(|tray: &tauri::tray::TrayIcon, event| {
                    match event {
                        TrayIconEvent::Click { button: tauri::tray::MouseButton::Left, .. } |
                        TrayIconEvent::DoubleClick { button: tauri::tray::MouseButton::Left, .. } => {
                            toggle_window(tray.app_handle());
                        }
                        TrayIconEvent::Click { button: tauri::tray::MouseButton::Right, .. } => {
                            // Right click automatically opens the menu if attached via .menu()
                        }
                        _ => {}
                    }
                })
                .build(app)?;

            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // Standardized dark appearance
            #[cfg(target_os = "macos")]
            {
                if let Some(w) = app.get_webview_window("main") {
                    let _ = w.set_title_bar_style(tauri::TitleBarStyle::Transparent);
                }
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            paste_text,
            dismiss_overlay,
            start_recording,
            stop_recording,
            save_api_key,
            get_api_key,
            delete_api_key,
            save_groq_api_key,
            get_groq_api_key,
            delete_groq_api_key,
            set_stt_mode,
                get_welcome_seen,
                set_welcome_seen,
                check_accessibility,
                open_accessibility_settings,
                open_microphone_settings,
                show_welcome_window,
                hide_welcome_window,
                fix_quarantine,
                get_stt_mode,
            set_deepgram_language,
            get_deepgram_language,
            set_whisper_language,
            get_whisper_language,
            set_groq_language,
            get_groq_language,
            get_target_app,
            update_tray_lang,
            set_auto_pause,
            get_auto_pause,
            set_auto_paste,
            get_auto_paste,
            check_model_available,
            download_whisper_model,
            delete_whisper_model,
            open_mac_settings,
            fix_browser_permissions,
            reset_window_position,
            get_start_minimized,
            set_start_minimized,
            get_clear_on_paste,
            set_clear_on_paste,
            check_microphone_permission,
            set_always_on_top,
            get_always_on_top,
            request_microphone_permission,
            set_app_language,
            get_app_language,
            get_update_dismissed_at,
            set_update_dismissed_at,
            get_ignored_update,
            set_ignored_update,
            open_url,
        ])
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                // Intercept 'CloseRequested' for 'main' window to just hide it
                if window.label() == "main" {
                    let _ = window.hide();
                    api.prevent_close();
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
