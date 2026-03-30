use tauri::{AppHandle, Manager, Runtime, Emitter, LogicalSize, LogicalPosition};

use crate::state::{TargetApp, AlwaysOnTop};
use crate::utils::get_frontmost_app_info;

// ── Position overlay at top-center ────────────────────────────────────────────
pub fn show_window_at_size<R: Runtime>(app: &AppHandle<R>, width: f64, height: f64, center: bool) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.set_size(LogicalSize::new(width, height));
        
        if center {
            if let Ok(Some(monitor)) = window.primary_monitor() {
                let scale = monitor.scale_factor();
                let screen_w = monitor.size().width as f64 / scale;
                let x = (screen_w - width) / 2.0;
                let _ = window.set_position(LogicalPosition::new(x, 0.0));
            }
        }

        #[cfg(target_os = "macos")]
        {
            app.show().ok(); 
            window.set_visible_on_all_workspaces(true).ok();
        }

        let _ = window.show();
        let _ = window.set_focus();
        
        if let Some(aot_state) = app.try_state::<AlwaysOnTop>() {
            if let Ok(enabled) = aot_state.0.lock() {
                let _ = window.set_always_on_top(*enabled);
            }
        }

        let _ = app.emit("app-summon", ());
    }
}

pub fn show_overlay<R: Runtime>(app: &AppHandle<R>) {
    println!("DEBUG: show_overlay called");
    
    // 1. Capture target app info IMMEDIATELY before showing window
    let info = get_frontmost_app_info();
    if let Some(state) = app.try_state::<TargetApp>() {
        if let Ok(mut lock) = state.0.lock() {
            *lock = info;
        }
    }

    if let Some(window) = app.get_webview_window("main") {
        println!("DEBUG: 'main' window found, calling show()");
        
        // Ensure the app is active and unhidden on macOS
        #[cfg(target_os = "macos")]
        {
            app.show().ok(); 
            // Allow window to appear on all workspaces and over full-screen apps
            window.set_visible_on_all_workspaces(true).ok();
        }

        let _ = window.show();
        let _ = window.set_focus();
        
        // Respect user preference for Always on Top
        if let Some(aot_state) = app.try_state::<AlwaysOnTop>() {
            if let Ok(enabled) = aot_state.0.lock() {
                let _ = window.set_always_on_top(*enabled);
                
                // Extra punch for macOS: Ensure it's really on top if enabled
                #[cfg(target_os = "macos")]
                if *enabled {
                    let _ = window.set_focus();
                }
            }
        } else {
            let _ = window.set_always_on_top(true);
        }

        let _ = app.emit("app-summon", ());
    } else {
        println!("DEBUG: ERROR - 'main' window NOT FOUND");
    }
}

pub fn toggle_window<R: Runtime>(app: &AppHandle<R>) {
    if let Some(w) = app.get_webview_window("main") {
        if w.is_visible().unwrap_or(false) {
            let _ = w.hide();
        } else {
            show_overlay(app);
        }
    }
}

pub fn reset_window_position_inner<R: Runtime>(app: &AppHandle<R>) {
    if let Some(window) = app.get_webview_window("main") {
        if let Ok(Some(monitor)) = window.primary_monitor() {
            let scale = monitor.scale_factor();
            let screen_w = monitor.size().width as f64 / scale;
            
            let win_w = 150.0; 
            let x = ((screen_w - win_w) / 2.0 * scale) as i32;
            let y = 0;
            let _ = window.set_position(tauri::PhysicalPosition::new(x, y));
            let _ = app.emit("reset-position", ());
        }
    }
}
