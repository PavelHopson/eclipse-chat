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
// v1.0.3 — desktop-полировка (всё в Rust, setup-hook):
//   - system tray icon + меню (Открыть / Выход) + клик-toggle окна
//   - close → hide-to-tray (chat-app живёт в фоне ради уведомлений);
//     реальный выход только через tray «Выход»
//   - глобальный шорткат Ctrl+Shift+E → показать+сфокусировать окно
//   - startup check-for-updates (best-effort; до signing key + releases
//     это no-op, только лог)

#[cfg(desktop)]
use std::sync::atomic::{AtomicBool, Ordering};

// Флаг «идёт реальный выход» — чтобы close-handler НЕ перехватывал закрытие,
// инициированное пунктом трея «Выход» (иначе приложение нельзя было бы закрыть).
#[cfg(desktop)]
static QUITTING: AtomicBool = AtomicBool::new(false);

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        // v1.5.39 plugins: notification (native toast), updater (auto-update из
        // GitHub Releases, signed manifest — pubkey в tauri.conf.json), window_state
        // (сохраняет позицию/размер окна между запусками, drop-in).
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .on_window_event(|window, event| {
            // v1.0.3 — close-to-tray: прячем окно вместо выхода, чтобы фоновые
            // уведомления продолжали работать. Реальный выход — tray «Выход»
            // (ставит QUITTING=true перед app.exit, тогда close проходит).
            #[cfg(desktop)]
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                if !QUITTING.load(Ordering::SeqCst) {
                    let _ = window.hide();
                    api.prevent_close();
                }
            }
            #[cfg(not(desktop))]
            {
                let _ = (window, event);
            }
        })
        .setup(|app| {
            #[cfg(desktop)]
            {
                setup_tray(app)?;
                setup_global_shortcut(app)?;
                spawn_update_check(app.handle().clone());
            }
            #[cfg(not(desktop))]
            {
                let _ = app;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

// ----- desktop helpers ----------------------------------------------------

/// Показать + сфокусировать главное окно (из трея / шортката).
#[cfg(desktop)]
fn show_main(app: &tauri::AppHandle) {
    use tauri::Manager;
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.unminimize();
        let _ = w.show();
        let _ = w.set_focus();
    }
}

/// Toggle видимости главного окна (левый клик по трею).
#[cfg(desktop)]
fn toggle_main(app: &tauri::AppHandle) {
    use tauri::Manager;
    if let Some(w) = app.get_webview_window("main") {
        if w.is_visible().unwrap_or(false) {
            let _ = w.hide();
        } else {
            let _ = w.unminimize();
            let _ = w.show();
            let _ = w.set_focus();
        }
    }
}

/// System tray icon + меню.
#[cfg(desktop)]
fn setup_tray(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    use tauri::menu::{Menu, MenuItem};
    use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};

    let show = MenuItem::with_id(app, "show", "Открыть Eclipse Chat", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Выход", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show, &quit])?;

    TrayIconBuilder::new()
        .icon(
            app.default_window_icon()
                .expect("default window icon")
                .clone(),
        )
        .tooltip("Eclipse Chat")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "show" => show_main(app),
            "quit" => {
                QUITTING.store(true, Ordering::SeqCst);
                app.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                toggle_main(tray.app_handle());
            }
        })
        .build(app)?;
    Ok(())
}

/// Глобальный шорткат Ctrl+Shift+E → показать+сфокусировать окно.
#[cfg(desktop)]
fn setup_global_shortcut(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    use tauri_plugin_global_shortcut::{
        Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState,
    };

    let toggle = Shortcut::new(Some(Modifiers::CONTROL | Modifiers::SHIFT), Code::KeyE);
    app.handle().plugin(
        tauri_plugin_global_shortcut::Builder::new()
            .with_handler(move |app, shortcut, event| {
                if shortcut == &toggle && event.state() == ShortcutState::Pressed {
                    show_main(app);
                }
            })
            .build(),
    )?;
    // Не-фатально: если Ctrl+Shift+E уже занят другим приложением, register
    // вернёт Err — НЕ роняем запуск из-за этого, просто логируем (шорткат не
    // заработает, но всё остальное — трей/окно/обновления — функционирует).
    if let Err(e) = app.global_shortcut().register(toggle) {
        eprintln!("[global-shortcut] register Ctrl+Shift+E failed (already taken?): {e}");
    }
    Ok(())
}

/// Checks the signed stable channel on every launch and applies a newer build.
///
/// We intentionally do not run a periodic forced update while the app is open:
/// restarting in the middle of a voice call or an unsent draft is worse than
/// waiting until the next launch. Artifact signatures are verified by the
/// updater plugin before installation.
#[cfg(desktop)]
fn spawn_update_check(handle: tauri::AppHandle) {
    use tauri_plugin_updater::UpdaterExt;

    tauri::async_runtime::spawn(async move {
        match handle.updater() {
            Ok(updater) => match updater.check().await {
                Ok(Some(update)) => {
                    eprintln!("[updater] update available: {}", update.version);
                    let mut downloaded = 0;

                    // On Windows the updater closes the app before replacing
                    // binaries. Let that close request pass through our
                    // close-to-tray handler.
                    QUITTING.store(true, Ordering::SeqCst);

                    match update
                        .download_and_install(
                            |chunk_length, content_length| {
                                downloaded += chunk_length;
                                eprintln!(
                                    "[updater] downloaded {downloaded} of {content_length:?} bytes"
                                );
                            },
                            || eprintln!("[updater] download finished; installing"),
                        )
                        .await
                    {
                        Ok(()) => {
                            eprintln!("[updater] update installed; restarting");
                            handle.restart();
                        }
                        Err(e) => {
                            QUITTING.store(false, Ordering::SeqCst);
                            eprintln!("[updater] download or install failed: {e}");
                        }
                    }
                }
                Ok(None) => {}
                Err(e) => eprintln!("[updater] check failed: {e}"),
            },
            Err(e) => eprintln!("[updater] not configured: {e}"),
        }
    });
}
