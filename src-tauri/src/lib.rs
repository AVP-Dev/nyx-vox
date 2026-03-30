mod deepgram;
mod whisper;
mod ai_provider;
mod deepseek;
mod qwen;
mod keys;
mod prompts;
mod state;
mod utils;
mod window;
mod tray;
mod commands;
mod diag;
mod history;

use std::sync::{Arc, Mutex};
use tauri::{tray::TrayIconBuilder, tray::TrayIconEvent, Manager, Emitter};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};
use tauri_plugin_store::StoreExt;

use crate::state::*;
use crate::window::*;
use crate::tray::*;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let ctrl_space = Shortcut::new(Some(Modifiers::CONTROL), Code::Space);
    let opt_space  = Shortcut::new(Some(Modifiers::ALT), Code::Space);

    let recording_state: whisper::SharedState = Arc::new(Mutex::new(whisper::RecordingState::default()));
    let ai_state: ai_provider::SharedAiState = Arc::new(Mutex::new(ai_provider::RecordingState::default()));
    let deepgram_state: deepgram::SharedDeepgramState = Arc::new(Mutex::new(deepgram::DeepgramState::default()));

    let sys_lang = if cfg!(target_os = "macos") {
        if let Ok(o) = std::process::Command::new("defaults").arg("read").arg("-g").arg("AppleLanguages").output() {
            let s = String::from_utf8_lossy(&o.stdout);
            if s.contains("ru") { "ru" } else { "en" }
        } else { "en" }
    } else { "en" };

    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new()
            .with_handler(move |app, shortcut, event| {
                if event.state() == ShortcutState::Pressed && (shortcut == &ctrl_space || shortcut == &opt_space) {
                    if let (Some(p_state), Some(_r_state)) = (app.try_state::<ProcessingFlag>(), app.try_state::<RecordingFlag>()) {
                        // Only block if PROCESSING (API refinement), but ALLOW trigger if RECORDING (to stop it)
                        if p_state.0.load(std::sync::atomic::Ordering::SeqCst) { return; }
                    }
                    show_overlay(app);
                    let _ = app.emit("shortcut-trigger", ());
                }
            })
            .build()
        )
        .setup(move |app| {
            app.manage(recording_state);
            app.manage(ai_state);
            app.manage(deepgram_state);
            app.manage(WhisperDownloadFlag::default());
            app.manage(WhisperDownloadPaused::default());
            app.manage(WhisperDownloadCancelled::default());
            app.manage(ProcessingFlag::default());
            app.manage(RecordingFlag::default());
            app.manage(ActiveSttMode(Mutex::new(String::new())));
            app.manage(DidPauseMedia::default());
            app.manage(PositionInitialized::default());
            app.manage(SttMode(Mutex::new("deepgram".to_string())));
            app.manage(FormattingMode(Mutex::new("none".to_string())));
            app.manage(FormattingStyleState(Mutex::new(FormattingStyle::default())));
            app.manage(DeepgramLanguage(Mutex::new("ru".to_string())));
            app.manage(WhisperLanguage(Mutex::new("ru".to_string())));
            app.manage(WhisperModel(Mutex::new(WhisperModelType::default())));
            app.manage(GroqLanguage(Mutex::new("ru".to_string())));
            app.manage(AutoPause(Mutex::new(false)));
            app.manage(AutoPaste(Mutex::new(true)));
            app.manage(AlwaysOnTop(Mutex::new(true)));
            app.manage(TargetApp(Mutex::new(("Unknown".to_string(), "Unknown".to_string()))));
            app.manage(AppLanguage(Mutex::new(sys_lang.to_string())));
            app.manage(keys::ApiKeys::default());
            app.manage(AiSemaphore(tokio::sync::Semaphore::new(1)));

            #[cfg(target_os = "windows")]
            {
                if let Ok(enigo) = enigo::Enigo::new(&enigo::Settings::default()) {
                    app.manage(EnigoState(Arc::new(Mutex::new(EnigoWrapper(enigo)))));
                }
            }
            #[cfg(target_os = "macos")]
            {
                // Manage a dummy state to prevent panic on macOS when commands access it
                if let Ok(enigo) = enigo::Enigo::new(&enigo::Settings::default()) {
                    app.manage(EnigoState(Arc::new(Mutex::new(EnigoWrapper(enigo)))));
                }
            }

            let _ = app.global_shortcut().register(ctrl_space);
            let _ = app.global_shortcut().register(opt_space);

            let mut initial_app_lang = sys_lang.to_string();
            let mut should_show_window = true;
            let mut welcome_seen = false;

            {
                if let Ok(store) = app.store("settings.json") {
                    if let Some(api_keys) = app.try_state::<keys::ApiKeys>() {
                        let _ = api_keys.load_from_store(app.handle());
                    }

                    macro_rules! load_str_setting {
                        ($key:expr, $state_type:ty) => {
                            if let Some(val) = store.get($key).and_then(|v: serde_json::Value| v.as_str().map(|s| s.to_string())) {
                                if let Some(state) = app.try_state::<$state_type>() {
                                    if let Ok(mut lock) = state.0.lock() { *lock = val; }
                                }
                            }
                        };
                    }

                    load_str_setting!("stt_mode", SttMode);
                    load_str_setting!("formatting_mode", FormattingMode);
                    load_str_setting!("deepgram_language", DeepgramLanguage);
                    load_str_setting!("whisper_language", WhisperLanguage);
                    
                    if let Some(m) = store.get("whisper_model").and_then(|v: serde_json::Value| v.as_str().map(|s| s.to_string())) {
                        let m_type = match m.as_str() {
                            "medium" => WhisperModelType::Medium,
                            "turbo" => WhisperModelType::Turbo,
                            _ => WhisperModelType::Small,
                        };
                        if let Some(state) = app.try_state::<WhisperModel>() {
                            if let Ok(mut lock) = state.0.lock() { *lock = m_type; }
                        }
                    }

                    load_str_setting!("groq_language", GroqLanguage);

                    if let Some(l) = store.get("app_language").and_then(|v: serde_json::Value| v.as_str().map(|s| s.to_string())) {
                        initial_app_lang = l;
                        if let Some(state) = app.try_state::<AppLanguage>() {
                            if let Ok(mut lock) = state.0.lock() { *lock = initial_app_lang.clone(); }
                        }
                    }

                    if let Some(s) = store.get("formatting_style").and_then(|v: serde_json::Value| serde_json::from_value::<FormattingStyle>(v).ok()) {
                        if let Some(state) = app.try_state::<FormattingStyleState>() {
                            if let Ok(mut lock) = state.0.lock() { *lock = s; }
                        }
                    }

                    macro_rules! load_bool_setting {
                        ($key:expr, $state_type:ty) => {
                            if let Some(val) = store.get($key).and_then(|v: serde_json::Value| v.as_bool()) {
                                if let Some(state) = app.try_state::<$state_type>() {
                                    if let Ok(mut lock) = state.0.lock() { *lock = val; }
                                }
                            }
                        };
                    }

                    load_bool_setting!("auto_pause", AutoPause);
                    load_bool_setting!("auto_paste", AutoPaste);
                    load_bool_setting!("always_on_top", AlwaysOnTop);

                    if let Some(aot) = store.get("always_on_top").and_then(|v: serde_json::Value| v.as_bool()) {
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.set_always_on_top(aot);
                            #[cfg(target_os = "macos")]
                            let _ = w.set_visible_on_all_workspaces(true);
                        }
                    } else {
                        // Default to on-top for macOS if no setting found
                        #[cfg(target_os = "macos")]
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.set_always_on_top(true);
                        }
                    }

                    let minimized = store.get("start_minimized").and_then(|v: serde_json::Value| v.as_bool()).unwrap_or(false);
                    let version = app.package_info().version.to_string();
                    let welcome_key = format!("welcome_seen_{}", version.replace('.', "_"));
                    welcome_seen = store.get(welcome_key).and_then(|v: serde_json::Value| v.as_bool()).unwrap_or(false);
                    
                    if minimized && welcome_seen {
                        should_show_window = false;
                    }
                }
            }

            if should_show_window {
                let handle = app.handle().clone();
                let welcome_seen_captured = welcome_seen;
                tauri::async_runtime::spawn(async move {
                    tokio::time::sleep(std::time::Duration::from_millis(500)).await;
                    if !welcome_seen_captured {
                        show_window_at_size(&handle, 440.0, 540.0, true);
                    } else {
                        show_overlay(&handle);
                    }
                });
            }

            let tray_menu = tauri::menu::Menu::with_items(app, &[])?;
            TrayIconBuilder::with_id("main")
                .icon(tauri::image::Image::from_bytes(include_bytes!("../icons/trayTemplate.png")).unwrap())
                .icon_as_template(true)
                .menu(&tray_menu)
                .tooltip("NYX Vox — Option+Space")
                .on_menu_event(|app_handle, event| {
                    match event.id.as_ref() {
                        "quit" => app_handle.exit(0),
                        "show" => toggle_window(app_handle),
                        "welcome_win" => {
                            let _ = app_handle.emit("open-welcome", ());
                            show_overlay(app_handle);
                        }
                        "settings" => {
                            let _ = app_handle.emit("open-settings", ());
                            show_overlay(app_handle);
                        }
                        "history" => {
                            let ah = app_handle.clone();
                            tauri::async_runtime::spawn(async move {
                                let _ = commands::open_history_window(ah).await;
                            });
                        }
                        "reset_pos" => reset_window_position_inner(app_handle),
                        _ => {}
                    }
                })
                .on_tray_icon_event(|_tray, event| {
                    match event {
                        TrayIconEvent::Click { button: tauri::tray::MouseButton::Left, .. } |
                        TrayIconEvent::DoubleClick { button: tauri::tray::MouseButton::Left, .. } => {
                            // Left click now does nothing (handled by OS if menu is set)
                        }
                        _ => {}
                    }
                })
                .build(app)?;

            update_tray_lang(app.handle().clone(), initial_app_lang);

            // ── Target App Polling ────────────────────────────────────────────────
            let handle_poll = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                let mut last_name = String::new();
                loop {
                    // Only poll if window is visible to save CPU
                    let window_visible = handle_poll.get_webview_window("main")
                        .map(|w| w.is_visible().unwrap_or(false))
                        .unwrap_or(false);

                    if window_visible {
                        let (name, bundle_id) = crate::utils::get_frontmost_app_info();
                        if name != last_name && !name.is_empty() && name != "Unknown" && name != "NYX Vox" && name != "app" {
                            if let Some(state) = handle_poll.try_state::<crate::state::TargetApp>() {
                                if let Ok(mut lock) = state.0.lock() {
                                    *lock = (name.clone(), bundle_id);
                                }
                            }
                            let _ = handle_poll.emit("target-app-changed", name.clone());
                            last_name = name;
                        }
                    } else {
                        last_name = String::new();
                    }
                    tokio::time::sleep(std::time::Duration::from_millis(500)).await;
                }
            });

            #[cfg(target_os = "macos")]
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.set_title_bar_style(tauri::TitleBarStyle::Transparent);
            }

            let _ = history::perform_smart_cleanup(app.handle());

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::paste_text,
            commands::dismiss_overlay,
            commands::start_recording,
            commands::stop_recording,
            commands::refine_transcription,
            commands::cmd_set_api_key,
            commands::get_api_key,
            commands::get_services_status,
            commands::set_stt_mode,
            commands::get_stt_mode,
            commands::set_formatting_mode,
            commands::get_formatting_mode,
            commands::set_formatting_style,
            commands::get_formatting_style,
            commands::get_welcome_seen,
            commands::set_welcome_seen,
            commands::check_accessibility,
            commands::open_accessibility_settings,
            commands::reset_accessibility_permissions,
            commands::open_microphone_settings,
            commands::show_welcome_window,
            commands::hide_welcome_window,
            commands::fix_quarantine,
            commands::set_deepgram_language,
            commands::get_deepgram_language,
            commands::set_whisper_language,
            commands::get_whisper_language,
            commands::set_whisper_model_type,
            commands::get_whisper_model_type,
            commands::set_groq_language,
            commands::get_groq_language,
            commands::get_target_app,
            commands::update_target_app,
            tray::update_tray_lang,
            commands::set_auto_pause,
            commands::get_auto_pause,
            commands::set_auto_paste,
            commands::get_auto_paste,
            commands::check_model_available,
            commands::download_whisper_model,
            commands::pause_whisper_download,
            commands::resume_whisper_download,
            commands::cancel_whisper_download,
            commands::delete_whisper_model,
            commands::reset_window_position,
            commands::get_start_minimized,
            commands::set_start_minimized,
            commands::get_clear_on_paste,
            commands::set_clear_on_paste,
            commands::check_microphone_permission,
            commands::set_always_on_top,
            commands::get_always_on_top,
            commands::request_microphone_permission,
            commands::set_app_language,
            commands::get_app_language,
            commands::get_update_dismissed_at,
            commands::set_update_dismissed_at,
            commands::get_ignored_update,
            commands::set_ignored_update,
            commands::open_url,
            commands::show_update_window,
            commands::resize_window,
            diag::run_self_diagnosis,
            history::get_history,
            history::add_history_entry,
            history::clear_history,
            history::delete_history_item,
            commands::get_history_settings,
            commands::set_history_settings,
            commands::open_history_window,
        ])
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                if window.label() == "main" {
                    let _ = window.hide();
                    api.prevent_close();
                }
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| {
            if let tauri::RunEvent::Reopen { .. } = event {
                if let Some(w) = app_handle.get_webview_window("main") {
                    let _ = w.show();
                    let _ = w.set_focus();
                }
            }
        });
}
