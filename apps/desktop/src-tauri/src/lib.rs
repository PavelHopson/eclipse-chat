// Eclipse Chat desktop — Tauri 2 entry point.
//
// Shared между main.rs (desktop binary) и mobile_entry_point (Tauri 2 mobile,
// будет relevant в Phase C iOS/Android). Сейчас — pure desktop shell который
// загружает фронтенд из bundled dist (apps/web/dist).
//
// Plugins:
//   - tauri-plugin-shell — для open() external links из web context
//     (например, click affiliate в StarMarket → external marketplace).
//
// v1.6.x roadmap planned:
//   - v1.6.1: tauri-plugin-notification (native notifications) +
//     tauri-plugin-updater (auto-update from GitHub Releases)
//   - v1.6.2: tauri-plugin-window-state (remember window pos/size)
//   - v1.6.3: tray icon + global shortcuts
//   - v1.6.4: MS Store packaging .msix

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|_app| {
            // v1.5.38 первый slice — empty setup. v1.6.1+ добавит:
            //   - register tray
            //   - register global shortcuts
            //   - initialize push notification handler
            //   - check for updates on startup
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
