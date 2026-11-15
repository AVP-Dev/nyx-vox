use tauri::{
    AppHandle, Emitter, LogicalSize, Manager, PhysicalPosition, PhysicalSize, Runtime,
    WebviewWindow,
};

use crate::state::{AlwaysOnTop, TargetApp};
use crate::utils::get_frontmost_app_info;

// ── Position overlay at top-center ────────────────────────────────────────────
pub fn show_window_at_size<R: Runtime>(app: &AppHandle<R>, width: f64, height: f64, center: bool) {
    if let Some(window) = app.get_webview_window("main") {
        if let Some(monitor) = monitor_for_window(&window) {
            set_size_within_work_area(&window, width, height, &monitor);
            place_window_in_work_area(&window, &monitor, center);
        } else {
            log::warn!(
                "No monitor bounds available; setting main window size without placement clamp"
            );
            log_window_result(
                "set main window size without monitor bounds",
                window.set_size(LogicalSize::new(width, height)),
            );
        }

        #[cfg(target_os = "macos")]
        {
            log_window_result("show application", app.show());
            log_window_result(
                "show main window on all workspaces",
                window.set_visible_on_all_workspaces(true),
            );
        }

        restore_show_and_focus(&window);

        if let Some(aot_state) = app.try_state::<AlwaysOnTop>() {
            if let Ok(enabled) = aot_state.0.lock() {
                log_window_result(
                    "apply always-on-top setting",
                    window.set_always_on_top(*enabled),
                );
            }
        }

        if let Err(error) = app.emit("app-summon", ()) {
            log::warn!("Failed to emit app-summon after showing main window: {error}");
        }
    }
}

pub fn show_overlay<R: Runtime>(app: &AppHandle<R>) {
    log::debug!("show_overlay called");

    // 1. Capture target app info IMMEDIATELY before showing window
    let info = get_frontmost_app_info();
    if let Some(state) = app.try_state::<TargetApp>() {
        if let Ok(mut lock) = state.0.lock() {
            *lock = info;
        }
    }

    if let Some(window) = app.get_webview_window("main") {
        log::debug!("'main' window found, calling show()");

        if let Some(monitor) = monitor_for_window(&window) {
            place_window_in_work_area(&window, &monitor, false);
        } else {
            log::warn!("No monitor bounds available; showing main window at its current position");
        }

        // Ensure the app is active and unhidden on macOS
        #[cfg(target_os = "macos")]
        {
            log_window_result("show application", app.show());
            // Allow window to appear on all workspaces and over full-screen apps
            log_window_result(
                "show main window on all workspaces",
                window.set_visible_on_all_workspaces(true),
            );
        }

        restore_show_and_focus(&window);

        // Respect user preference for Always on Top
        if let Some(aot_state) = app.try_state::<AlwaysOnTop>() {
            if let Ok(enabled) = aot_state.0.lock() {
                log_window_result(
                    "apply always-on-top setting",
                    window.set_always_on_top(*enabled),
                );

                // Extra punch for macOS: Ensure it's really on top if enabled
                #[cfg(target_os = "macos")]
                if *enabled {
                    log_window_result("focus main window", window.set_focus());
                }
            }
        } else {
            log_window_result(
                "enable default always-on-top",
                window.set_always_on_top(true),
            );
        }

        if let Err(error) = app.emit("app-summon", ()) {
            log::warn!("Failed to emit app-summon after showing main window: {error}");
        }
    } else {
        log::error!("'main' window NOT FOUND");
    }
}

pub fn toggle_window<R: Runtime>(app: &AppHandle<R>) {
    if let Some(w) = app.get_webview_window("main") {
        let is_visible = w.is_visible().unwrap_or_else(|error| {
            log::warn!("Failed to read main window visibility before tray click: {error}");
            false
        });
        let is_minimized = w.is_minimized().unwrap_or_else(|error| {
            log::warn!("Failed to read main window minimized state before tray click: {error}");
            true
        });
        if is_visible && !is_minimized {
            log_window_result("hide main window from tray click", w.hide());
        } else {
            show_overlay(app);
        }
    }
}

pub fn reset_window_position_inner<R: Runtime>(app: &AppHandle<R>) {
    if let Some(window) = app.get_webview_window("main") {
        if let Some(monitor) = monitor_for_window(&window) {
            place_window_in_work_area(&window, &monitor, true);
            if let Err(error) = app.emit("reset-position", ()) {
                log::warn!("Failed to emit reset-position after centering main window: {error}");
            }
        } else {
            log::warn!("Unable to reset main window position because no monitor was found");
        }
    }
}

fn monitor_for_window<R: Runtime>(window: &WebviewWindow<R>) -> Option<tauri::Monitor> {
    match window.current_monitor() {
        Ok(Some(monitor)) => return Some(monitor),
        Ok(None) => {}
        Err(error) => log::warn!("Failed to get current monitor for main window: {error}"),
    }
    match window.primary_monitor() {
        Ok(Some(monitor)) => return Some(monitor),
        Ok(None) => {}
        Err(error) => log::warn!("Failed to get primary monitor for main window: {error}"),
    }
    match window.available_monitors() {
        Ok(mut monitors) => monitors.pop(),
        Err(error) => {
            log::warn!("Failed to enumerate monitors for main window: {error}");
            None
        }
    }
}

fn work_area_bounds(monitor: &tauri::Monitor) -> (PhysicalPosition<i32>, PhysicalSize<u32>) {
    let work_area = monitor.work_area();
    if work_area.size.width > 0 && work_area.size.height > 0 {
        (work_area.position, work_area.size)
    } else {
        (*monitor.position(), *monitor.size())
    }
}

fn set_size_within_work_area<R: Runtime>(
    window: &WebviewWindow<R>,
    width: f64,
    height: f64,
    monitor: &tauri::Monitor,
) {
    let (_, area_size) = work_area_bounds(monitor);
    let scale = valid_scale_factor(monitor.scale_factor());
    let available_width = area_size.width as f64 / scale;
    let available_height = area_size.height as f64 / scale;
    let width = fit_logical_dimension(width, available_width);
    let height = fit_logical_dimension(height, available_height);
    log_window_result(
        "set main window size within monitor work area",
        window.set_size(LogicalSize::new(width, height)),
    );
}

fn fit_logical_dimension(requested: f64, available: f64) -> f64 {
    let available = available.max(1.0);
    let requested = if requested.is_finite() && requested > 0.0 {
        requested
    } else {
        available
    };
    requested.min(available).max(1.0)
}

fn valid_scale_factor(scale: f64) -> f64 {
    if scale.is_finite() && scale > 0.0 {
        scale
    } else {
        1.0
    }
}

fn place_window_in_work_area<R: Runtime>(
    window: &WebviewWindow<R>,
    monitor: &tauri::Monitor,
    center_top: bool,
) {
    let (origin, area_size) = work_area_bounds(monitor);
    let window_size = match window.outer_size() {
        Ok(size) => size,
        Err(error) => {
            log::warn!("Failed to read main window size for monitor placement: {error}");
            return;
        }
    };
    let bounded_size = PhysicalSize::new(
        window_size.width.min(area_size.width),
        window_size.height.min(area_size.height),
    );
    if bounded_size != window_size {
        log_window_result(
            "shrink main window to monitor work area",
            window.set_size(bounded_size),
        );
    }

    let current_position = window.outer_position().unwrap_or_else(|error| {
        log::warn!("Failed to read main window position for monitor placement: {error}");
        origin
    });
    let position = window_position_in_work_area(
        origin,
        area_size,
        bounded_size,
        current_position,
        center_top,
    );
    log_window_result(
        "place main window within monitor work area",
        window.set_position(position),
    );
}

fn window_position_in_work_area(
    origin: PhysicalPosition<i32>,
    area_size: PhysicalSize<u32>,
    window_size: PhysicalSize<u32>,
    current: PhysicalPosition<i32>,
    center_top: bool,
) -> PhysicalPosition<i32> {
    let width = window_size.width.min(area_size.width);
    let height = window_size.height.min(area_size.height);
    let max_x = origin
        .x
        .saturating_add(i32::try_from(area_size.width.saturating_sub(width)).unwrap_or(i32::MAX));
    let max_y = origin
        .y
        .saturating_add(i32::try_from(area_size.height.saturating_sub(height)).unwrap_or(i32::MAX));
    let centered_x = origin
        .x
        .saturating_add(i32::try_from(area_size.width.saturating_sub(width) / 2).unwrap_or(0));
    let x = if center_top {
        centered_x
    } else {
        current.x.clamp(origin.x, max_x)
    };
    let y = if center_top {
        origin.y
    } else {
        current.y.clamp(origin.y, max_y)
    };
    PhysicalPosition::new(x, y)
}

fn restore_show_and_focus<R: Runtime>(window: &WebviewWindow<R>) {
    log_window_result(
        "restore main window from minimized state",
        window.unminimize(),
    );
    log_window_result("show main window", window.show());
    log_window_result("focus main window", window.set_focus());
}

fn log_window_result(action: &str, result: tauri::Result<()>) {
    if let Err(error) = result {
        log::warn!("Failed to {action}: {error}");
    }
}

#[cfg(test)]
mod tests {
    use super::window_position_in_work_area;
    use tauri::{PhysicalPosition, PhysicalSize};

    #[test]
    fn centers_at_work_area_top_with_monitor_offset() {
        let position = window_position_in_work_area(
            PhysicalPosition::new(1920, 24),
            PhysicalSize::new(1920, 1080),
            PhysicalSize::new(440, 540),
            PhysicalPosition::new(1440, 0),
            true,
        );

        assert_eq!(position, PhysicalPosition::new(2660, 24));
    }

    #[test]
    fn clamps_offscreen_position_into_work_area() {
        let position = window_position_in_work_area(
            PhysicalPosition::new(0, 24),
            PhysicalSize::new(1440, 1000),
            PhysicalSize::new(440, 540),
            PhysicalPosition::new(1440, 0),
            false,
        );

        assert_eq!(position, PhysicalPosition::new(1000, 24));
    }

    #[test]
    fn clamps_positions_on_negative_origin_monitor() {
        let position = window_position_in_work_area(
            PhysicalPosition::new(-1920, 0),
            PhysicalSize::new(1920, 1040),
            PhysicalSize::new(440, 540),
            PhysicalPosition::new(100, 0),
            false,
        );

        assert_eq!(position, PhysicalPosition::new(-440, 0));
    }
}
