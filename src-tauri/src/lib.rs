mod deepgram;
mod whisper;
mod groq;

use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc, Mutex,
};
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

// Deepgram API key (cached from store)
struct DgApiKey(Mutex<Option<String>>);

// Groq API key (cached from store)
struct GroqApiKey(Mutex<Option<String>>);

// Enigo instance (cached to avoid IOHID initialization delay on every call)
struct EnigoWrapper(enigo::Enigo);
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

// ── Position overlay at top-center ────────────────────────────────────────────
fn show_overlay<R: Runtime>(app: &AppHandle<R>) {
    if let Some(window) = app.get_webview_window("main") {
        if let Ok(Some(monitor)) = window.primary_monitor() {
            let scale = monitor.scale_factor();
            let screen_w = monitor.size().width as f64 / scale;

            if !window.is_visible().unwrap_or(false) {
                let win_w = window.outer_size().unwrap_or_default().width as f64 / scale;
                let actual_win_w = if win_w > 0.0 { win_w } else { 500.0 };
                let x = ((screen_w - actual_win_w) / 2.0 * scale) as i32;
                let y = (28.0 * scale) as i32;
                let _ = window.set_position(tauri::PhysicalPosition::new(x, y));
            }
        }
        let _ = window.show();
        let _ = window.set_focus();
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
    use tauri_plugin_clipboard_manager::ClipboardExt;
    app.clipboard()
        .write_text(text)
        .map_err(|e| format!("Clipboard error: {}", e))?;

    #[cfg(target_os = "macos")]
    let _ = app.hide();
    
    let enigo_arc = app.state::<EnigoState>().0.clone();
    let app_clone = app.clone();

    tauri::async_runtime::spawn(async move {
        tokio::time::sleep(std::time::Duration::from_millis(150)).await;
        let _ = app_clone.run_on_main_thread(move || {
            if let Ok(mut g) = enigo_arc.lock() {
                use enigo::{Direction, Key, Keyboard};
                let enigo = &mut g.0;
                enigo.key(Key::Meta, Direction::Press).ok();
                enigo.key(Key::Unicode('v'), Direction::Click).ok();
                enigo.key(Key::Meta, Direction::Release).ok();
            }
        });
    });

    Ok(())
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
    
    let lang = match mode.as_str() {
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
                    tell application "Google Chrome" to execute (active tab of window 1) javascript "document.querySelectorAll('video, audio').forEach(m => m.pause())"
                end if
                if (exists process "Safari") then
                    tell application "Safari" to execute (current tab of window 1) javascript "document.querySelectorAll('video, audio').forEach(m => m.pause())"
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
                    tell application "Google Chrome" to execute (active tab of window 1) javascript "document.querySelectorAll('video, audio').forEach(m => m.play())"
                end if
                if (exists process "Safari") then
                    tell application "Safari" to execute (current tab of window 1) javascript "document.querySelectorAll('video, audio').forEach(m => m.play())"
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
async fn check_model_available() -> Result<bool, String> {
    Ok(whisper::is_model_available())
}

#[tauri::command]
async fn download_whisper_model(app: AppHandle) -> Result<(), String> {
    whisper::download_model(app).await
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

    tauri::Builder::default()
        .manage(recording_state)
        .manage(groq_state)
        .manage(recording_flag)
        .manage(processing_flag)
        .manage(enigo_state)
        .manage(SttMode(Mutex::new("deepgram".to_string())))
        .manage(DeepgramLanguage(Mutex::new("auto".to_string())))
        .manage(WhisperLanguage(Mutex::new("ru".to_string())))
        .manage(GroqLanguage(Mutex::new("auto".to_string())))
        .manage(AutoPause(Mutex::new(true)))
        .manage(AutoPaste(Mutex::new(true)))
        .manage(DgApiKey(Mutex::new(None)))
        .manage(GroqApiKey(Mutex::new(None)))
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_window_state::Builder::default().build())
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
                }
            }


            app.global_shortcut().register(ctrl_space)?;
            app.global_shortcut().register(opt_space)?;

            let quit_i = MenuItem::with_id(app, "quit", "Выйти (Quit)", true, None::<&str>)?;
            let show_i = MenuItem::with_id(app, "show", "Показать NYX VOX", true, None::<&str>)?;
            let settings_i = MenuItem::with_id(app, "settings", "Настройки", true, None::<&str>)?;
            let tray_menu = Menu::with_items(app, &[&show_i, &settings_i, &quit_i])?;

            TrayIconBuilder::new()
                .icon(tauri::image::Image::from_bytes(include_bytes!("../icons/trayTemplate.png")).unwrap())
                .icon_as_template(true)
                .menu(&tray_menu)
                .tooltip("NYX Vox — Option+Space")
                .on_menu_event(|app_handle: &AppHandle, event| match event.id.as_ref() {
                    "quit" => app_handle.exit(0),
                    "show" => show_overlay(app_handle),
                    "settings" => {
                        show_overlay(app_handle);
                        let _ = app_handle.emit("open-settings", ());
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray: &tauri::tray::TrayIcon, event| {
                    if let TrayIconEvent::Click { button: tauri::tray::MouseButton::Left, .. } = event {
                        toggle_window(tray.app_handle());
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
            get_stt_mode,
            get_stt_mode,
            set_deepgram_language,
            get_deepgram_language,
            set_whisper_language,
            get_whisper_language,
            set_groq_language,
            get_groq_language,
            set_auto_pause,
            get_auto_pause,
            set_auto_paste,
            get_auto_paste,
            check_model_available,
            download_whisper_model,
            open_mac_settings,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
