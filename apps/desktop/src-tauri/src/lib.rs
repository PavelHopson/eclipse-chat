// Eclipse Chat desktop — Tauri 2 entry point.
//
// Shared между main.rs (desktop binary) и mobile_entry_point (Tauri 2 mobile,
// будет relevant в Phase C iOS/Android).
//
// v1.0.2 — модель «тонкая обёртка над прод-URL»: окно грузит
// https://app.star-crm.ru/eclipse-chat/ напрямую (frontendDist=URL в
// tauri.conf.json), БЕЗ бандла локальных ассетов. Origin = сайт, поэтому
// auth/API/socket/CORS работают как в браузере, без правок web/сервера.
// Rust-плагины (updater, window-state) работают со стороны Rust; native
// notification из JS недоступен remote-контенту (Tauri sandbox) — сайт
// использует Web Notifications в webview, что ок.
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
        // v1.5.39 plugins:
        // - notification: позволяет frontend позвать window.__TAURI__ или
        //   `@tauri-apps/plugin-notification` чтобы показать native toast.
        //   Используется существующим useNotifications hook'ом из web-side
        //   когда `window.__TAURI_INTERNALS__` detected — fallback на Web
        //   Notification API для browser context.
        // - updater: проверяет GitHub Releases на новую версию при startup
        //   + по запросу. Открывает confirm dialog (см. tauri.conf.json
        //   plugins.updater.dialog = true), скачивает delta-patch, applies
        //   на restart. Требует signed manifest (см. pubkey в tauri.conf.json
        //   и Tauri signing key setup в README.md).
        // - window_state: drop-in plugin, сам сохраняет позицию/размер
        //   окна в OS-config dir перед close, восстанавливает на launch.
        //   Никаких frontend hook'ов не требует.
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .setup(|_app| {
            // v1.5.39 setup hook остаётся пустым. v1.5.40 добавит:
            //   - register tray icon
            //   - register global shortcuts (Ctrl+Shift+E focus window)
            // v1.5.41 добавит:
            //   - check for updates on startup (через updater plugin)
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
