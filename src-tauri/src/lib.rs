use tauri::{
    menu::{MenuBuilder, MenuItemBuilder},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager,
};
use tauri_plugin_global_shortcut::GlobalShortcutExt;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .setup(|app| {
            // --- system tray ---
            let play_pause = MenuItemBuilder::with_id("play_pause", "Play / Pause").build(app)?;
            let next_track = MenuItemBuilder::with_id("next_track", "Next").build(app)?;
            let prev_track = MenuItemBuilder::with_id("prev_track", "Previous").build(app)?;
            let quit = MenuItemBuilder::with_id("quit", "Quit Frameo").build(app)?;

            let menu = MenuBuilder::new(app)
                .item(&play_pause)
                .item(&next_track)
                .item(&prev_track)
                .separator()
                .item(&quit)
                .build()?;

            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .on_menu_event(move |app, event| {
                    let id = event.id().as_ref();
                    match id {
                        "play_pause" => {
                            let _ = app.emit("tray:play-pause", ());
                        }
                        "next_track" => {
                            let _ = app.emit("tray:next", ());
                        }
                        "prev_track" => {
                            let _ = app.emit("tray:prev", ());
                        }
                        "quit" => {
                            app.exit(0);
                        }
                        _ => {}
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        // Toggle window visibility on tray click.
                        if let Some(window) = app.get_webview_window("main") {
                            if window.is_visible().unwrap_or(false) {
                                let _ = window.hide();
                            } else {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                    }
                })
                .build(app)?;

            // --- global media key shortcuts ---
            let handle = app.handle().clone();
            let shortcuts = app.global_shortcut();

            let handler_play = handle.clone();
            let _ = shortcuts.on_shortcut("MediaPlayPause", move |_app, _shortcut, _event| {
                let _ = handler_play.emit("shortcut", "MediaPlayPause");
            });
            let handler_next = handle.clone();
            let _ = shortcuts.on_shortcut("MediaNextTrack", move |_app, _shortcut, _event| {
                let _ = handler_next.emit("shortcut", "MediaNextTrack");
            });
            let handler_prev = handle.clone();
            let _ = shortcuts.on_shortcut("MediaPrevTrack", move |_app, _shortcut, _event| {
                let _ = handler_prev.emit("shortcut", "MediaPrevTrack");
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
