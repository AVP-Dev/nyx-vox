use std::sync::Mutex;
use tauri::{
    menu::{Menu, MenuItem},
    AppHandle,
};

static LAST_LANG: Mutex<Option<String>> = Mutex::new(None);
static AVAILABLE_UPDATE: Mutex<Option<String>> = Mutex::new(None);

pub fn format_updates_label(lang: &str, available_update: Option<&str>) -> String {
    match available_update
        .map(|v| v.trim().trim_start_matches('v'))
        .filter(|v| !v.is_empty())
    {
        Some(ver) => {
            if lang == "ru" {
                format!("Доступно обновление v{ver}")
            } else {
                format!("Update Available: v{ver}")
            }
        }
        None => {
            if lang == "ru" {
                "Проверить обновления...".to_string()
            } else {
                "Check for Updates...".to_string()
            }
        }
    }
}

pub fn get_tray_available_update() -> Option<String> {
    AVAILABLE_UPDATE.lock().ok().and_then(|g| g.clone())
}

#[tauri::command]
pub fn set_tray_update_available(app: AppHandle, version: Option<String>) {
    let normalized = version
        .map(|v| v.trim().trim_start_matches('v').to_string())
        .filter(|v| !v.is_empty());
    if let Ok(mut guard) = AVAILABLE_UPDATE.lock() {
        if *guard == normalized {
            return;
        }
        *guard = normalized.clone();
    }
    let lang = LAST_LANG
        .lock()
        .ok()
        .and_then(|g| g.clone())
        .unwrap_or_else(|| "ru".to_string());
    rebuild_tray_menu(&app, &lang, normalized.as_deref());
}

#[tauri::command]
pub fn update_tray_lang(app: AppHandle, lang: String) {
    {
        let last = LAST_LANG.lock().unwrap();
        if last.as_deref() == Some(&lang) {
            return;
        }
    }

    let available = get_tray_available_update();
    rebuild_tray_menu(&app, &lang, available.as_deref());
    *LAST_LANG.lock().unwrap() = Some(lang);
}

fn rebuild_tray_menu(app: &AppHandle, lang: &str, available_update: Option<&str>) {
    if let Some(tray) = app.tray_by_id("main") {
        let welcome_label = if lang == "ru" {
            "Инструкция"
        } else {
            "Welcome / Help"
        };
        let history_label = if lang == "ru" {
            "История"
        } else {
            "History"
        };
        let show_label = if lang == "ru" {
            "Скрыть/Показать NYX Vox"
        } else {
            "Hide/Show NYX Vox"
        };
        let settings_label = if lang == "ru" {
            "Настройки"
        } else {
            "Settings"
        };
        let website_label = if lang == "ru" {
            "Сайт проекта"
        } else {
            "Project Website"
        };
        let updates_label = format_updates_label(lang, available_update);
        let reset_label = if lang == "ru" {
            "Сбросить позицию"
        } else {
            "Reset Position"
        };
        let quit_label = if lang == "ru" { "Выйти" } else { "Quit" };

        let Ok(show_i) = MenuItem::with_id(app, "show", show_label, true, None::<&str>) else {
            return;
        };
        let Ok(history_i) = MenuItem::with_id(app, "history", history_label, true, None::<&str>)
        else {
            return;
        };
        let Ok(settings_i) = MenuItem::with_id(app, "settings", settings_label, true, None::<&str>)
        else {
            return;
        };
        let Ok(website_i) = MenuItem::with_id(app, "website", website_label, true, None::<&str>)
        else {
            return;
        };
        let Ok(updates_i) =
            MenuItem::with_id(app, "check_updates", &updates_label, true, None::<&str>)
        else {
            return;
        };
        let Ok(welcome_i) =
            MenuItem::with_id(app, "welcome_win", welcome_label, true, None::<&str>)
        else {
            return;
        };
        let Ok(reset_pos_i) = MenuItem::with_id(app, "reset_pos", reset_label, true, None::<&str>)
        else {
            return;
        };
        let Ok(quit_i) = MenuItem::with_id(app, "quit", quit_label, true, None::<&str>) else {
            return;
        };

        let Ok(sep_1) = tauri::menu::PredefinedMenuItem::separator(app) else {
            return;
        };
        let Ok(sep_2) = tauri::menu::PredefinedMenuItem::separator(app) else {
            return;
        };
        let Ok(sep_3) = tauri::menu::PredefinedMenuItem::separator(app) else {
            return;
        };

        if let Ok(tray_menu) = Menu::with_items(
            app,
            &[
                &show_i,
                &history_i,
                &sep_1,
                &settings_i,
                &welcome_i,
                &website_i,
                &updates_i,
                &sep_2,
                &reset_pos_i,
                &sep_3,
                &quit_i,
            ],
        ) {
            let _ = tray.set_menu(Some(tray_menu));
        }
    }
}

#[cfg(test)]
mod tests {
    use super::format_updates_label;

    #[test]
    fn formats_default_label() {
        assert_eq!(format_updates_label("ru", None), "Проверить обновления...");
        assert_eq!(format_updates_label("en", None), "Check for Updates...");
        assert_eq!(
            format_updates_label("ru", Some("")),
            "Проверить обновления..."
        );
    }

    #[test]
    fn formats_available_update_label() {
        assert_eq!(
            format_updates_label("ru", Some("v1.7.0")),
            "Доступно обновление v1.7.0"
        );
        assert_eq!(
            format_updates_label("en", Some("1.7.0")),
            "Update Available: v1.7.0"
        );
    }
}
