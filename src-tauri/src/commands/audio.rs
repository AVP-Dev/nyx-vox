use crate::state::*;
use crate::utils::*;
use crate::{ai_provider, deepgram, keys, whisper};
use std::sync::atomic::Ordering;
use std::sync::Arc;
use tauri::{AppHandle, Emitter, Manager, State};

#[cfg(target_os = "macos")]
use macos_accessibility_client::accessibility::application_is_trusted_with_prompt;

/// Cached online status: once checked, reused for up to 5 seconds to avoid
/// blocking `start_recording` on a slow TCP connect for every invocation.
fn is_online() -> bool {
    use std::sync::atomic::AtomicU64;
    use std::time::{SystemTime, UNIX_EPOCH};

    static LAST_CHECK_MS: AtomicU64 = AtomicU64::new(0);
    static CACHED_ONLINE: AtomicU64 = AtomicU64::new(0);

    let now_ms = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0);
    let last = LAST_CHECK_MS.load(Ordering::Relaxed);
    if now_ms.saturating_sub(last) < 5000 {
        return CACHED_ONLINE.load(Ordering::Relaxed) == 1;
    }

    let online = tokio::task::block_in_place(|| {
        std::net::TcpStream::connect_timeout(
            &"8.8.8.8:53".parse().expect("hardcoded DNS address"),
            std::time::Duration::from_millis(500),
        )
        .is_ok()
    });
    LAST_CHECK_MS.store(now_ms, Ordering::Relaxed);
    CACHED_ONLINE.store(online as u64, Ordering::Relaxed);
    online
}

#[tauri::command]
pub async fn check_microphone_permission() -> Result<bool, String> {
    tokio::task::spawn_blocking(|| {
        use cpal::traits::{DeviceTrait, HostTrait};
        let host = cpal::default_host();
        match host.default_input_device() {
            Some(device) => match device.supported_input_configs() {
                Ok(mut configs) => configs.next().is_some(),
                Err(_) => false,
            },
            None => false,
        }
    })
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn request_microphone_permission() -> Result<bool, String> {
    tokio::task::spawn_blocking(|| {
        use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
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
            }
            None => false,
        }
    })
    .await
    .map_err(|e| e.to_string())
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
    whisper_model: State<'_, WhisperModel>,
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
        let is_online = is_online();

        if !is_online {
            if whisper::is_model_available(model_type) {
                let _ = app.emit(
                    "stt-fallback",
                    "Нет сети. Авто-переключение на офлайн режим (Whisper).",
                );
                if let Ok(mut lock) = stt_mode.0.lock() {
                    *lock = "whisper".to_string();
                }
                use tauri_plugin_store::StoreExt;
                if let Ok(store) = app.store("settings.json") {
                    store.set("stt_mode", serde_json::json!("whisper"));
                    let _ = store.save();
                }
                let _ = app.emit("mode-changed", "whisper");
                final_mode = "whisper".to_string();
            } else {
                return Err(
                    "Нет подключения к интернету, а офлайн модель не установлена.".to_string(),
                );
            }
        }
    }

    let lang = match final_mode.as_str() {
        "deepgram" => "multi",
        "whisper" => "auto",
        "groq" => "ru",
        "gemini" => "mixed",
        "gigachat" => "mixed",
        _ => "mixed",
    };

    if final_mode == "deepgram" {
        let key = api_keys
            .0
            .lock()
            .map_err(|e| e.to_string())?
            .get(&keys::Service::Deepgram)
            .cloned()
            .flatten();
        match key {
            Some(k) if !k.is_empty() => {
                let flag = Arc::clone(&recording_flag.0);
                deepgram::start_recording(app, Arc::clone(&dg_state), flag)?;
            }
            _ => {
                if whisper::is_model_available(model_type) {
                    let _ = app.emit(
                        "stt-fallback",
                        "Deepgram ключ не найден. Используем офлайн режим.",
                    );
                    final_mode = "whisper".to_string();
                    whisper::start_recording(
                        app,
                        Arc::clone(&state),
                        Arc::clone(&recording_flag.0),
                        Arc::clone(&processing_flag.0),
                        "auto",
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
        whisper::start_recording(
            app,
            Arc::clone(&state),
            Arc::clone(&recording_flag.0),
            Arc::clone(&processing_flag.0),
            lang,
            model_type,
        )?;
    } else if final_mode == "groq" || final_mode == "gemini" || final_mode == "gigachat" {
        let service = if final_mode == "groq" {
            keys::Service::Groq
        } else if final_mode == "gemini" {
            keys::Service::Gemini
        } else {
            keys::Service::Gigachat
        };
        let key = api_keys
            .0
            .lock()
            .map_err(|e| e.to_string())?
            .get(&service)
            .cloned()
            .flatten();
        match key {
            Some(k) if !k.is_empty() => {
                let flag = Arc::clone(&recording_flag.0);
                ai_provider::start_recording(app, Arc::clone(&ai_state), flag)?;
            }
            _ => {
                return Err(format!(
                    "Добавьте ключ {} в настройках.",
                    if final_mode == "groq" {
                        "Groq"
                    } else if final_mode == "gemini" {
                        "Gemini"
                    } else {
                        "GigaChat"
                    }
                ));
            }
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
    processing_flag: State<'_, ProcessingFlag>,
    stt_mode: State<'_, SttMode>,
    active_stt_mode: State<'_, ActiveSttMode>,
    did_pause_media: State<'_, DidPauseMedia>,
    api_keys: State<'_, keys::ApiKeys>,
    formatting_mode: State<'_, FormattingMode>,
    whisper_model: State<'_, WhisperModel>,
    noise_gate: State<'_, NoiseGateThreshold>,
    audio_gain: State<'_, AudioGain>,
    streamed_text: Option<String>,
) -> Result<String, String> {
    processing_flag
        .0
        .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
        .map_err(|_| "ALREADY_PROCESSING".to_string())?;

    struct ProcessingReset(Arc<std::sync::atomic::AtomicBool>);
    impl Drop for ProcessingReset {
        fn drop(&mut self) {
            self.0.store(false, Ordering::SeqCst);
        }
    }
    let _processing_reset = ProcessingReset(Arc::clone(&processing_flag.0));

    if !recording_flag.0.load(Ordering::SeqCst) {
        return Err("ALREADY_IDLE".to_string());
    }

    let configured_mode = stt_mode.0.lock().map_err(|e| e.to_string())?.clone();
    let mode = active_stt_mode.0.lock().map_err(|e| e.to_string())?.clone();
    let mode = if mode.is_empty() {
        configured_mode
    } else {
        mode
    };
    let model_type = *whisper_model.0.lock().map_err(|e| e.to_string())?;
    log::debug!("stop_recording: mode={}, model_type={:?}", mode, model_type);

    let lang = match mode.as_str() {
        "deepgram" => "multi",
        "whisper" => "auto",
        "groq" => "ru",
        "gemini" => "mixed",
        "gigachat" => "mixed",
        _ => "mixed",
    };

    let threshold = *noise_gate.0.lock().map_err(|e| e.to_string())?;
    let gain = *audio_gain.0.lock().map_err(|e| e.to_string())?;

    let was_paused = did_pause_media.0.swap(false, Ordering::SeqCst);
    if was_paused {
        crate::utils::system_media_control(0);
    }

    let batch_result = if mode == "deepgram" {
        if let Some(ref st) = streamed_text {
            let trimmed = st.trim();
            if !trimmed.is_empty()
                && !trimmed.starts_with("Ошибка")
                && !trimmed.starts_with("Error")
            {
                log::info!("stop_recording: using live Deepgram WebSocket stream directly (0 extra REST requests)");
                recording_flag.0.store(false, Ordering::SeqCst);
                if let Ok(mut lock) = dg_state.lock() {
                    lock.samples.clear();
                }
                trimmed.to_string()
            } else {
                let api_key = api_keys
                    .0
                    .lock()
                    .map_err(|e| e.to_string())?
                    .get(&keys::Service::Deepgram)
                    .cloned()
                    .flatten()
                    .unwrap_or_default();
                deepgram::stop_recording(
                    &app,
                    Arc::clone(&dg_state),
                    Arc::clone(&recording_flag.0),
                    api_key,
                    lang,
                    threshold,
                    gain,
                )
                .await?
            }
        } else {
            let api_key = api_keys
                .0
                .lock()
                .map_err(|e| e.to_string())?
                .get(&keys::Service::Deepgram)
                .cloned()
                .flatten()
                .unwrap_or_default();
            deepgram::stop_recording(
                &app,
                Arc::clone(&dg_state),
                Arc::clone(&recording_flag.0),
                api_key,
                lang,
                threshold,
                gain,
            )
            .await?
        }
    } else if mode == "whisper" {
        whisper::stop_recording(
            &app,
            Arc::clone(&state),
            Arc::clone(&recording_flag.0),
            lang,
            model_type,
            threshold,
            gain,
        )
        .await?
    } else if mode == "gigachat" {
        let api_key = api_keys
            .0
            .lock()
            .map_err(|e| e.to_string())?
            .get(&keys::Service::Gigachat)
            .cloned()
            .flatten()
            .unwrap_or_default();
        recording_flag.0.store(false, Ordering::SeqCst);
        let Some(wav) = ai_provider::take_recording_wav(&app, &ai_state, threshold, gain)? else {
            return Ok(String::new());
        };
        crate::gigachat::transcribe(app.clone(), wav, api_key, lang).await?
    } else {
        let service = if mode == "groq" {
            keys::Service::Groq
        } else {
            keys::Service::Gemini
        };
        let api_key = api_keys
            .0
            .lock()
            .map_err(|e| e.to_string())?
            .get(&service)
            .cloned()
            .flatten()
            .unwrap_or_default();
        if mode == "gemini" {
            ai_provider::gemini_stop_recording(
                app.clone(),
                Arc::clone(&ai_state),
                Arc::clone(&recording_flag.0),
                api_key,
                lang,
                threshold,
                gain,
            )
            .await?
        } else {
            ai_provider::stop_recording(
                app.clone(),
                Arc::clone(&ai_state),
                Arc::clone(&recording_flag.0),
                api_key,
                lang,
                threshold,
                gain,
            )
            .await?
        }
    };

    // If batch STT returned empty or silence, fallback to live streamed text if available
    let result = if batch_result.trim().is_empty() {
        if let Some(ref st) = streamed_text {
            let trimmed = st.trim();
            if !trimmed.is_empty()
                && !trimmed.starts_with("Ошибка")
                && !trimmed.starts_with("Error")
            {
                log::info!(
                    "stop_recording: batch STT returned empty, falling back to streamed preview"
                );
                trimmed.to_string()
            } else {
                batch_result
            }
        } else {
            batch_result
        }
    } else {
        batch_result
    };

    if let Ok(mut lock) = active_stt_mode.0.lock() {
        *lock = String::new();
    }

    let mut final_text = result.clone();
    log::debug!(
        "stop_recording: raw result: {:?}",
        final_text.chars().take(200).collect::<String>()
    );
    if final_text.trim().starts_with('{') {
        if let Ok(json) = serde_json::from_str::<serde_json::Value>(&final_text) {
            if let Some(content) = json["content"].as_str() {
                final_text = content.to_string();
            }
        }
    }
    log::debug!(
        "stop_recording: after JSON unwrap: {:?}",
        final_text.chars().take(200).collect::<String>()
    );

    let pre_cleanup = final_text.clone();
    final_text =
        crate::utils::strip_filler_phrases(&crate::utils::clean_repetitive_phrases(&final_text));
    log::debug!(
        "stop_recording: after cleanup: {:?}",
        final_text.chars().take(200).collect::<String>()
    );
    if final_text.trim().is_empty() && !pre_cleanup.trim().is_empty() {
        log::debug!("stop_recording: cleanup stripped all text, falling back to raw");
        final_text = pre_cleanup;
    }
    final_text = crate::transliteration::fix_transliterations(&final_text);
    log::debug!("stop_recording: final_text len={}", final_text.len());

    if !final_text.is_empty() {
        let f_mode = formatting_mode.0.lock().map_err(|e| e.to_string())?.clone();
        if f_mode != "none" {
            let service = match f_mode.as_str() {
                "gemini" => keys::Service::Gemini,
                "qwen" => keys::Service::Qwen,
                "deepseek" => keys::Service::Deepseek,
                "groq" => keys::Service::Groq,
                "gigachat" => keys::Service::Gigachat,
                _ => keys::Service::Gemini,
            };

            let key = api_keys
                .0
                .lock()
                .map_err(|e| e.to_string())?
                .get(&service)
                .cloned()
                .flatten();
            if let Some(k) = key {
                if !k.is_empty() {
                    let lang = app
                        .state::<crate::state::AppLanguage>()
                        .0
                        .lock()
                        .map(|l| l.clone())
                        .unwrap_or_else(|e| {
                            log::warn!("AppLanguage mutex poisoned: {}", e);
                            "ru".to_string()
                        });
                    let _ = app.emit("formatting-status", format!("{:?}", service));
                    let _ = app.emit(
                        "ai-status",
                        if lang == "ru" {
                            "✨ Форматирую..."
                        } else {
                            "✨ Formatting..."
                        },
                    );
                    let refined = match service {
                        keys::Service::Gemini => {
                            ai_provider::gemini_refine_text(
                                app.clone(),
                                final_text.clone(),
                                k,
                                None,
                            )
                            .await
                        }
                        keys::Service::Qwen => {
                            crate::qwen::refine_text(app.clone(), final_text.clone(), k, None).await
                        }
                        keys::Service::Deepseek => {
                            crate::deepseek::refine_text(app.clone(), final_text.clone(), k, None)
                                .await
                        }
                        keys::Service::Groq => {
                            ai_provider::groq_refine_text(app.clone(), final_text.clone(), k, None)
                                .await
                        }
                        keys::Service::Gigachat => {
                            crate::gigachat::refine_text(app.clone(), final_text.clone(), k, None)
                                .await
                        }
                        _ => Ok(final_text.clone()),
                    };
                    match refined {
                        Ok(text) => {
                            if !text.trim().is_empty() {
                                final_text = text;
                            } else {
                                log::debug!("stop_recording: formatting returned empty, keeping pre-formatted text");
                            }
                            let _ = app.emit("formatting-status", "done");
                        }
                        Err(e) => {
                            let err_str = e.to_string();
                            let code = if err_str.contains("429") {
                                "429"
                            } else if err_str.contains("403") {
                                "403"
                            } else if err_str.contains("401") {
                                "401"
                            } else if err_str.contains("503") {
                                "503"
                            } else {
                                "Err"
                            };
                            let _ = app.emit("formatting-status", format!("error:{}", code));
                        }
                    }
                } else {
                    let _ = app.emit("formatting-status", "error:key");
                }
            } else {
                let _ = app.emit("formatting-status", "error:key");
            }
        }
    }

    let _ = app.emit("ai-status", "");

    if !final_text.is_empty() {
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
            target_app,
        )
        .await;
    }

    Ok(final_text)
}

#[tauri::command]
pub async fn paste_text(app: AppHandle, text: String) -> Result<(), String> {
    use tauri_plugin_clipboard_manager::ClipboardExt;
    app.clipboard()
        .write_text(text)
        .map_err(|e| format!("ERR_CLIPBOARD: {}", e))?;

    let (target_name, target_id) = crate::utils::get_frontmost_app_info();

    if let Some(state) = app.try_state::<TargetApp>() {
        if let Ok(mut lock) = state.0.lock() {
            *lock = (target_name.clone(), target_id.clone());
        }
    }

    // Abort early if Accessibility isn't granted — the synthetic Cmd+V would
    // silently do nothing, leaving the user's window hidden for nothing.
    #[cfg(target_os = "macos")]
    if !macos_accessibility_client::accessibility::application_is_trusted() {
        return Err(
            "Не предоставлен доступ к Универсальному доступу (Accessibility). Откройте Настройки → Доступность и добавьте NYX Vox.".to_string(),
        );
    }

    // Hide window FIRST so focus transfers to the target app before Cmd+V
    #[cfg(target_os = "macos")]
    {
        if target_name == "NYX Vox" || target_name == "app" {
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.hide();
            }
        } else {
            let _ = app.hide();
        }
    }

    // Delay to let macOS WindowServer fully transfer focus to the target app.
    // Without this delay, Cmd+V can land in NYX Vox instead of the target.
    tokio::time::sleep(std::time::Duration::from_millis(400)).await;

    let app_handle = app.clone();
    let (tx, rx) = tokio::sync::oneshot::channel::<Result<(), String>>();

    tauri::async_runtime::spawn(async move {
        let _ = app_handle.run_on_main_thread(move || {
            let result = (|| {
                #[cfg(target_os = "macos")]
                {
                    use core_graphics::event::{
                        CGEvent, CGEventFlags, CGEventTapLocation, CGKeyCode,
                    };
                    use core_graphics::event_source::{CGEventSource, CGEventSourceStateID};
                    let source = CGEventSource::new(CGEventSourceStateID::HIDSystemState)
                        .map_err(|_| "CGEventSource init failed".to_string())?;
                    let k_cmd: CGKeyCode = 55;
                    let k_v: CGKeyCode = 9;
                    let (c_dn, c_up, v_dn, v_up) = (
                        CGEvent::new_keyboard_event(source.clone(), k_cmd, true)
                            .map_err(|_| "CGEvent cmd-down failed".to_string())?,
                        CGEvent::new_keyboard_event(source.clone(), k_cmd, false)
                            .map_err(|_| "CGEvent cmd-up failed".to_string())?,
                        CGEvent::new_keyboard_event(source.clone(), k_v, true)
                            .map_err(|_| "CGEvent v-down failed".to_string())?,
                        CGEvent::new_keyboard_event(source.clone(), k_v, false)
                            .map_err(|_| "CGEvent v-up failed".to_string())?,
                    );
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
                #[cfg(target_os = "windows")]
                {
                    if let Some(enigo_state) = app_handle.try_state::<EnigoState>() {
                        if let Ok(mut enigo) = enigo_state.0.lock() {
                            use enigo::{Direction, Key, Keyboard};
                            enigo
                                .0
                                .key(Key::Control, Direction::Press)
                                .map_err(|e| e.to_string())?;
                            enigo
                                .0
                                .key(Key::Unicode('v'), Direction::Click)
                                .map_err(|e| e.to_string())?;
                            enigo
                                .0
                                .key(Key::Control, Direction::Release)
                                .map_err(|e| e.to_string())?;
                        }
                    }
                }
                Ok(())
            })();
            let _ = tx.send(result);
        });
    });

    match tokio::time::timeout(std::time::Duration::from_secs(2), rx).await {
        Ok(Ok(Ok(()))) => Ok(()),
        Ok(Ok(Err(e))) => {
            // Paste failed after the window was hidden — bring it back so the
            // user isn't left staring at nothing.
            #[cfg(target_os = "macos")]
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.show();
            }
            Err(e)
        }
        Ok(Err(_)) => Err("Paste task was dropped".to_string()),
        Err(_) => Err("Paste timed out".to_string()),
    }
}

#[tauri::command]
pub fn get_target_app(state: State<'_, TargetApp>) -> String {
    state.0.lock().unwrap_or_else(|e| e.into_inner()).0.clone()
}

#[tauri::command]
pub fn update_target_app(app: AppHandle) {
    let info = get_frontmost_app_info();
    if let Some(state) = app.try_state::<TargetApp>() {
        if let Ok(mut lock) = state.0.lock() {
            *lock = info;
        }
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
        use core_foundation::boolean::CFBoolean;
        use core_foundation::dictionary::CFDictionary;
        use core_foundation::string::CFString;

        let trusted = unsafe {
            // Try explicit check with no prompt
            let key_ref = macos_ext::kAXTrustedCheckOptionPrompt;
            let key = CFString::wrap_under_get_rule(key_ref);
            let value = CFBoolean::false_value();
            let options = CFDictionary::from_CFType_pairs(&[(key.as_CFType(), value.as_CFType())]);
            macos_ext::AXIsProcessTrustedWithOptions(options.as_concrete_TypeRef())
        };

        if !trusted {
            // Also fall back to the basic check just in case
            let basic = macos_accessibility_client::accessibility::application_is_trusted();
            if basic {
                return Ok(true);
            }

            log::warn!("Accessibility Status: NOT TRUSTED. If granted in settings, please remove and re-add NYX Vox to the list.");
        }

        Ok(trusted)
    }
    #[cfg(not(target_os = "macos"))]
    {
        Ok(true)
    }
}

#[tauri::command]
pub async fn request_permissions_auto() -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        // 1. Accessibility Prompt (pops up System Preferences if missing)
        let _ = macos_accessibility_client::accessibility::application_is_trusted_with_prompt();
    }

    // 2. Microphone Prompt (pops up the macOS dialog if missing)
    use cpal::traits::{DeviceTrait, HostTrait};
    let host = cpal::default_host();
    if let Some(device) = host.default_input_device() {
        if let Ok(config) = device.default_input_config() {
            let _ = device.build_input_stream(
                &config.into(),
                move |_data: &[f32], _: &_| {},
                move |_err| {},
                None,
            );
        }
    }

    Ok(())
}

#[tauri::command]
pub async fn open_microphone_settings(app: AppHandle) -> Result<(), String> {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.set_always_on_top(false);
        let _ = w.hide();
    }
    let script = "tell application \"System Events\" to open location \"x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone\"";
    let _ = std::process::Command::new("osascript")
        .arg("-e")
        .arg(script)
        .spawn();
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
        let _ = std::process::Command::new("open")
            .arg("x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility")
            .spawn();
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
