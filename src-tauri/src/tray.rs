use tauri::{
    menu::{Menu, MenuItem},
    AppHandle,
};

#[tauri::command]
pub fn update_tray_lang(app: AppHandle, lang: String) {
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
        let reset_label = if lang == "ru" {
            "Сбросить позицию"
        } else {
            "Reset Position"
        };
        let quit_label = if lang == "ru" { "Выйти" } else { "Quit" };

        let Ok(show_i) = MenuItem::with_id(&app, "show", show_label, true, None::<&str>) else {
            return;
        };
        let Ok(history_i) = MenuItem::with_id(&app, "history", history_label, true, None::<&str>)
        else {
            return;
        };
        let Ok(settings_i) =
            MenuItem::with_id(&app, "settings", settings_label, true, None::<&str>)
        else {
            return;
        };
        let Ok(welcome_i) =
            MenuItem::with_id(&app, "welcome_win", welcome_label, true, None::<&str>)
        else {
            return;
        };
        let Ok(reset_pos_i) = MenuItem::with_id(&app, "reset_pos", reset_label, true, None::<&str>)
        else {
            return;
        };
        let Ok(quit_i) = MenuItem::with_id(&app, "quit", quit_label, true, None::<&str>) else {
            return;
        };

        let Ok(sep_1) = tauri::menu::PredefinedMenuItem::separator(&app) else {
            return;
        };
        let Ok(sep_2) = tauri::menu::PredefinedMenuItem::separator(&app) else {
            return;
        };
        let Ok(sep_3) = tauri::menu::PredefinedMenuItem::separator(&app) else {
            return;
        };

        if let Ok(tray_menu) = Menu::with_items(
            &app,
            &[
                &show_i,
                &history_i,
                &sep_1,
                &settings_i,
                &welcome_i,
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
