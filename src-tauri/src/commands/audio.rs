use std::sync::atomic::Ordering;
use std::sync::Arc;
use tauri::{AppHandle, Emitter, Manager, State};
use crate::state::*;
use crate::utils::*;
use crate::{whisper, deepgram, ai_provider, keys};

#[cfg(target_os = "macos")]
use macos_accessibility_client::accessibility::application_is_trusted_with_prompt;

#[tauri::command]
pub async fn check_microphone_permission() -> Result<bool, String> {
    tokio::task::spawn_blocking(|| {
        use cpal::traits::{HostTrait, DeviceTrait};
        let host = cpal::default_host();
        match host.default_input_device() {
            Some(device) => {
                match device.supported_input_configs() {
                    Ok(mut configs) => {
                        configs.next().is_some()
                    },
                    Err(_) => false
                }
            },
            None => false
        }
    }).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn request_microphone_permission() -> Result<bool, String> {
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
#[allow(clippy::too_many_arguments)]
pub async fn start_recording(
    app: AppHandle,
    state: State<'_, whisper::SharedState>,
    recording_flag: State<'_, RecordingFlag>,
    processing_flag: State<'_, ProcessingFlag>,
    stt_mode: State<'_, SttMode>,
    active_stt_mode: State<'_, ActiveSttMode>,
    auto_pause: State<'_, AutoPause>,
    did_pause_media: State<'_, DidPauseMedia>,
    api_keys: State<'_, keys::ApiKeys>,
    ai_state: State<'_, ai_provider::SharedAiState>,
    dg_state: State<'_, deepgram::SharedDeepgramState>,
    dg_lang: State<'_, DeepgramLanguage>,
    whisper_lang: State<'_, WhisperLanguage>,
    whisper_model: State<'_, WhisperModel>,
    groq_lang: State<'_, GroqLanguage>,
) -> Result<(), String> {
    let mode = stt_mode.0.lock().map_err(|e| e.to_string())?.clone();
    let ap = *auto_pause.0.lock().map_err(|e| e.to_string())?;

    if ap {
        if is_media_playing() {
            system_media_control(1); 
            did_pause_media.0.store(true, Ordering::SeqCst);
        } else {
            did_pause_media.0.store(false, Ordering::SeqCst);
        }
    }

    let mut final_mode = mode;
    let model_type = *whisper_model.0.lock().map_err(|e| e.to_string())?;

    if final_mode == "deepgram" || final_mode == "groq" {
        let is_online = std::net::TcpStream::connect_timeout(
            &"8.8.8.8:53".parse().unwrap(),
            std::time::Duration::from_millis(1500),
        ).is_ok();

        if !is_online {
            if whisper::is_model_available(model_type) {
                let _ = app.emit("stt-fallback", "Нет сети. Авто-переключение на офлайн режим (Whisper).");
                if let Ok(mut lock) = stt_mode.0.lock() { *lock = "whisper".to_string(); }
                use tauri_plugin_store::StoreExt;
                if let Ok(store) = app.store("settings.json") {
                    store.set("stt_mode", serde_json::json!("whisper"));
                    let _ = store.save();
                }
                let _ = app.emit("mode-changed", "whisper");
                final_mode = "whisper".to_string();
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
        let key = api_keys.0.lock().map_err(|e| e.to_string())?.get(&keys::Service::Deepgram).cloned().flatten();
        match key {
            Some(k) if !k.is_empty() => {
                let flag = Arc::clone(&recording_flag.0);
                deepgram::start_recording(app, Arc::clone(&dg_state), flag)?;
            }
            _ => {
                if whisper::is_model_available(model_type) {
                    let _ = app.emit("stt-fallback", "Deepgram ключ не найден. Используем офлайн режим.");
                    final_mode = "whisper".to_string();
                    let whisper_lang = whisper_lang.0.lock().map_err(|e| e.to_string())?.clone();
                    whisper::start_recording(
                        app,
                        Arc::clone(&state),
                        Arc::clone(&recording_flag.0),
                        Arc::clone(&processing_flag.0),
                        &whisper_lang,
                        model_type,
                    )?;
                } else {
                    return Err("Добавьте ключ Deepgram в настройках или скачайте модель для офлайн режима.".to_string());
                }
            }
        }
    } else if final_mode == "whisper" {
        if !whisper::is_model_available(model_type) {
            return Err("Модель не найдена. Скачайте модель в Настройках.".to_string());
        }
        whisper::start_recording(app, Arc::clone(&state), Arc::clone(&recording_flag.0), Arc::clone(&processing_flag.0), &lang, model_type)?;
    } else if final_mode == "groq" || final_mode == "gemini" {
        let service = if final_mode == "groq" { keys::Service::Groq } else { keys::Service::Gemini };
        let key = api_keys.0.lock().map_err(|e| e.to_string())?.get(&service).cloned().flatten();
        match key {
            Some(k) if !k.is_empty() => {
                let flag = Arc::clone(&recording_flag.0);
                ai_provider::start_recording(app, Arc::clone(&ai_state), flag)?;
            }
            _ => { return Err(format!("Добавьте ключ {} в настройках.", if final_mode == "groq" { "Groq" } else { "Gemini" })); }
        }
    }

    if let Ok(mut lock) = active_stt_mode.0.lock() {
        *lock = final_mode;
    }

    Ok(())
}

#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub async fn stop_recording(
    app: AppHandle,
    state: State<'_, whisper::SharedState>,
    ai_state: State<'_, ai_provider::SharedAiState>,
    dg_state: State<'_, deepgram::SharedDeepgramState>,
    recording_flag: State<'_, RecordingFlag>,
    stt_mode: State<'_, SttMode>,
    active_stt_mode: State<'_, ActiveSttMode>,
    auto_pause: State<'_, AutoPause>,
    did_pause_media: State<'_, DidPauseMedia>,
    api_keys: State<'_, keys::ApiKeys>,
    formatting_mode: State<'_, FormattingMode>,
    dg_lang: State<'_, DeepgramLanguage>,
    whisper_lang: State<'_, WhisperLanguage>,
    whisper_model: State<'_, WhisperModel>,
    groq_lang: State<'_, GroqLanguage>,
) -> Result<String, String> {
    if !recording_flag.0.load(Ordering::SeqCst) {
        return Err("ALREADY_IDLE".to_string());
    }
    recording_flag.0.store(false, Ordering::SeqCst);

    let configured_mode = stt_mode.0.lock().map_err(|e| e.to_string())?.clone();
    let mode = active_stt_mode
        .0
        .lock()
        .map_err(|e| e.to_string())?
        .clone();
    let mode = if mode.is_empty() { configured_mode } else { mode };
    let ap = *auto_pause.0.lock().map_err(|e| e.to_string())?;
    let model_type = *whisper_model.0.lock().map_err(|e| e.to_string())?;

    let lang = match mode.as_str() {
        "deepgram" => dg_lang.0.lock().map_err(|e| e.to_string())?.clone(),
        "whisper" => whisper_lang.0.lock().map_err(|e| e.to_string())?.clone(),
        "groq" => groq_lang.0.lock().map_err(|e| e.to_string())?.clone(),
        _ => "auto".to_string(),
    };

    if ap && did_pause_media.0.load(Ordering::SeqCst) {
        system_media_control(0); 
        did_pause_media.0.store(false, Ordering::SeqCst);
    }
    
    let result = if mode == "deepgram" {
        let api_key = api_keys.0.lock().map_err(|e| e.to_string())?.get(&keys::Service::Deepgram).cloned().flatten().unwrap_or_default();
        deepgram::stop_recording(Arc::clone(&dg_state), Arc::clone(&recording_flag.0), api_key, &lang).await
    } else if mode == "whisper" {
        whisper::stop_recording(Arc::clone(&state), Arc::clone(&recording_flag.0), &lang, model_type).await
    } else if mode == "groq" || mode == "gemini" {
        let service = if mode == "groq" { keys::Service::Groq } else { keys::Service::Gemini };
        let api_key = api_keys
            .0
            .lock()
            .map_err(|e| e.to_string())?
            .get(&service)
            .cloned()
            .flatten()
            .unwrap_or_default();
        ai_provider::stop_recording(app.clone(), Arc::clone(&ai_state), Arc::clone(&recording_flag.0), api_key, &lang).await
    } else {
        Ok(String::new())
    }?;

    if let Ok(mut lock) = active_stt_mode.0.lock() {
        *lock = String::new();
    }

    let mut final_text = result.clone();
    if final_text.trim().starts_with('{') {
        if let Ok(json) = serde_json::from_str::<serde_json::Value>(&final_text) {
            if let Some(content) = json["content"].as_str() {
                final_text = content.to_string();
            }
        }
    }

    if !final_text.is_empty() {
        let f_mode = formatting_mode.0.lock().map_err(|e| e.to_string())?.clone();
        if f_mode != "none" {
            let service = match f_mode.as_str() {
                "gemini" => keys::Service::Gemini,
                "qwen"   => keys::Service::Qwen,
                "deepseek" => keys::Service::Deepseek,
                "groq"   => keys::Service::Groq,
                _ => keys::Service::Gemini,
            };

            let key = api_keys.0.lock().map_err(|e| e.to_string())?.get(&service).cloned().flatten();
            if let Some(k) = key {
                if !k.is_empty() {
                    let lang = app
                        .state::<crate::state::AppLanguage>()
                        .0
                        .lock()
                        .map(|l| l.clone())
                        .unwrap_or_else(|_| "ru".to_string());
                    let _ = app.emit("formatting-status", format!("{:?}", service));
                    let _ = app.emit("ai-status", if lang == "ru" { "✨ Форматирую..." } else { "✨ Formatting..." });
                    let refined = match service {
                        keys::Service::Gemini => ai_provider::gemini_refine_text(app.clone(), final_text.clone(), k, None).await,
                        keys::Service::Qwen => crate::qwen::refine_text(final_text.clone(), k, None).await,
                        keys::Service::Deepseek => crate::deepseek::refine_text(final_text.clone(), k, None).await,
                        keys::Service::Groq => ai_provider::groq_refine_text(app.clone(), final_text.clone(), k, None).await,
                        _ => Ok(final_text.clone()),
                    };
                    match refined {
                        Ok(text) => {
                            final_text = text;
                            let _ = app.emit("formatting-status", "done");
                        }
                        Err(e) => {
                            let err_str = e.to_string();
                            let code = if err_str.contains("429") { "429" } else if err_str.contains("403") { "403" } else if err_str.contains("401") { "401" } else if err_str.contains("503") { "503" } else { "Err" };
                            let _ = app.emit("formatting-status", format!("error:{}", code));
                        } 
                    }
                } else { let _ = app.emit("formatting-status", "error:key"); }
            } else { let _ = app.emit("formatting-status", "error:key"); }
        }
    }

    let _ = app.emit("ai-status", "");
    
    let raw_text = result.clone();
    let target_app = app
        .try_state::<crate::state::TargetApp>()
        .and_then(|s| s.0.lock().ok().map(|l| l.0.clone()))
        .unwrap_or_else(|| "Unknown".to_string());
        
    let _ = crate::history::add_history_entry(
        app.clone(),
        final_text.clone(),
        raw_text,
        mode,
        target_app
    ).await;
    
    Ok(final_text)
}

#[tauri::command]
pub fn paste_text(app: AppHandle, text: String) -> Result<(), String> {
    use tauri_plugin_clipboard_manager::ClipboardExt;
    app.clipboard().write_text(text).map_err(|e| format!("ERR_CLIPBOARD: {}", e))?;

    let (target_name, target_id) = crate::utils::get_frontmost_app_info();
    
    if let Some(state) = app.try_state::<TargetApp>() {
        if let Ok(mut lock) = state.0.lock() { *lock = (target_name.clone(), target_id.clone()); }
    }

    #[cfg(target_os = "macos")]
    {
        if target_name == "NYX Vox" || target_name == "app" {
             if let Some(w) = app.get_webview_window("main") { let _ = w.hide(); }
        } else { let _ = app.hide(); }
    }
    
    let app_handle = app.clone();
    tauri::async_runtime::spawn(async move {
        tokio::time::sleep(std::time::Duration::from_millis(250)).await;
        let _ = app_handle.run_on_main_thread(move || {
            #[cfg(target_os = "macos")]
            {
                use core_graphics::event::{CGEvent, CGEventTapLocation, CGEventFlags, CGKeyCode};
                use core_graphics::event_source::{CGEventSource, CGEventSourceStateID};
                if let Ok(source) = CGEventSource::new(CGEventSourceStateID::HIDSystemState) {
                    let k_cmd: CGKeyCode = 55;
                    let k_v: CGKeyCode = 9;
                    if let (Ok(c_dn), Ok(c_up), Ok(v_dn), Ok(v_up)) = (
                        CGEvent::new_keyboard_event(source.clone(), k_cmd, true),
                        CGEvent::new_keyboard_event(source.clone(), k_cmd, false),
                        CGEvent::new_keyboard_event(source.clone(), k_v, true),
                        CGEvent::new_keyboard_event(source.clone(), k_v, false),
                    ) {
                        v_dn.set_flags(CGEventFlags::CGEventFlagCommand);
                        v_up.set_flags(CGEventFlags::CGEventFlagCommand);
                        c_dn.post(CGEventTapLocation::HID);
                        std::thread::sleep(std::time::Duration::from_millis(30));
                        v_dn.post(CGEventTapLocation::HID);
                        std::thread::sleep(std::time::Duration::from_millis(50));
                        v_up.post(CGEventTapLocation::HID);
                        std::thread::sleep(std::time::Duration::from_millis(30));
                        c_up.post(CGEventTapLocation::HID);
                    }
                }
            }
            #[cfg(target_os = "windows")]
            {
                if let Some(enigo_state) = app_handle.try_state::<EnigoState>() {
                    if let Ok(mut enigo) = enigo_state.0.lock() {
                        use enigo::{Keyboard, Key, Direction};
                        let _ = enigo.0.key(Key::Control, Direction::Press);
                        let _ = enigo.0.key(Key::Unicode('v'), Direction::Click);
                        let _ = enigo.0.key(Key::Control, Direction::Release);
                    }
                }
            }
        });
    });
    Ok(())
}

#[tauri::command]
pub fn get_target_app(state: State<'_, TargetApp>) -> String {
    state.0.lock().unwrap().0.clone()
}

#[tauri::command]
pub fn update_target_app(app: AppHandle) {
    let info = get_frontmost_app_info();
    if let Some(state) = app.try_state::<TargetApp>() {
        if let Ok(mut lock) = state.0.lock() { *lock = info; }
    }
}

#[cfg(target_os = "macos")]
mod macos_ext {
    use core_foundation::dictionary::CFDictionaryRef;
    use core_foundation::string::CFStringRef;
    #[link(name = "ApplicationServices", kind = "framework")]
    extern "C" {
        pub static kAXTrustedCheckOptionPrompt: CFStringRef;
        pub fn AXIsProcessTrustedWithOptions(options: CFDictionaryRef) -> bool;
    }
}

#[tauri::command]
pub async fn check_accessibility() -> Result<bool, String> {
    #[cfg(target_os = "macos")]
    {
        use core_foundation::base::TCFType;
        use core_foundation::dictionary::CFDictionary;
        use core_foundation::boolean::CFBoolean;
        use core_foundation::string::CFString;
        
        let trusted = unsafe {
            // Try explicit check with no prompt
            let key_ref = macos_ext::kAXTrustedCheckOptionPrompt;
            let key = CFString::wrap_under_get_rule(key_ref);
            let value = CFBoolean::false_value();
            let options = CFDictionary::from_CFType_pairs(&[
                (key.as_CFType(), value.as_CFType())
            ]);
            macos_ext::AXIsProcessTrustedWithOptions(options.as_concrete_TypeRef())
        };
        
        if !trusted {
            // Also fall back to the basic check just in case
            let basic = macos_accessibility_client::accessibility::application_is_trusted();
            if basic { return Ok(true); }
            
            println!("[Accessibility] Status: NOT TRUSTED. If granted in settings, please remove and re-add NYX Vox to the list.");
        }
        
        Ok(trusted)
    }
    #[cfg(not(target_os = "macos"))]
    {
        Ok(true)
    }
}

#[tauri::command]
pub async fn open_microphone_settings(app: AppHandle) -> Result<(), String> {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.set_always_on_top(false);
        let _ = w.hide();
    }
    let script = "tell application \"System Events\" to open location \"x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone\"";
    let _ = std::process::Command::new("osascript").arg("-e").arg(script).spawn();
    Ok(())
}

#[tauri::command]
pub async fn open_accessibility_settings(app: AppHandle) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        if let Some(w) = app.get_webview_window("main") {
            let _ = w.set_always_on_top(false);
            let _ = w.hide();
        }
        let _ = application_is_trusted_with_prompt();
        let _ = std::process::Command::new("open").arg("x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility").spawn();
    }
    Ok(())
}

#[tauri::command]
pub async fn reset_accessibility_permissions(app: AppHandle) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        if let Some(w) = app.get_webview_window("main") {
            let _ = w.set_always_on_top(false);
            let _ = w.hide();
        }
        
        let identifier = app.config().identifier.clone();
        
        // 1. Reset TCC database for this app
        let status = std::process::Command::new("tccutil")
            .arg("reset")
            .arg("Accessibility")
            .arg(&identifier)
            .status();
            
        match status {
            Ok(s) if s.success() => {
                // 2. Trigger the OS prompt again by checking with prompt
                let _ = application_is_trusted_with_prompt();
                Ok(())
            }
            Ok(s) => Err(format!("tccutil failed with exit code: {:?}", s.code())),
            Err(e) => Err(format!("Failed to execute tccutil: {}", e)),
        }
    }
    #[cfg(not(target_os = "macos"))]
    {
        Ok(())
    }
}
