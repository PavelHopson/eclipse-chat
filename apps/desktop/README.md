# @eclipse-chat/desktop

Tauri 2 desktop shell для Eclipse Chat → native binaries для Windows / macOS / Linux.

**Модель подключения (v1.0.2): тонкая обёртка над прод-URL.** Окно грузит
`https://app.star-crm.ru/eclipse-chat/` напрямую (`frontendDist` = URL → Tauri
не бандлит локальные ассеты). Origin = сайт, поэтому auth / API / socket / CORS
работают идентично браузеру, без правок web или сервера. Минус: нужен интернет
(нет offline-оболочки) — это осознанный выбор для простоты и моментальной
работоспособности (выбран Pavel из 3 моделей). Сборка обновляется автоматически
вместе с сайтом (webview грузит свежий деплой); обновляется лишь сам Tauri-shell.

## Стадия

**v1.0.2** — переход на remote-wrapper модель (рабочее подключение к серверу).
Scaffold + 3 plugins (notification/updater/window-state) с v1.0.1 на месте.
Signing key для updater = manual-шаг Pavel (см. ниже), не блокирует запуск.

Roadmap:

- ✅ **v1.0.0** — scaffold: Cargo workspace, tauri.conf.json, capabilities
- ✅ **v1.0.1** — `tauri-plugin-notification` + `tauri-plugin-updater` + `tauri-plugin-window-state`
- ✅ **v1.0.2** — remote-wrapper: окно грузит прод-URL напрямую (auth/API/socket работают). Раньше бандлило `apps/web/dist` с относительными `/api` → не достукивалось до сервера из `tauri://localhost`.
- ✅ **v1.0.3** — desktop-полировка (всё в Rust, `lib.rs` setup-hook): system tray icon + меню (Открыть / Выход) + клик-toggle окна; **close-to-tray** (закрытие прячет окно, app живёт в фоне ради уведомлений — реальный выход только через tray «Выход»); глобальный шорткат **Ctrl+Shift+E** (показать+сфокусировать); startup check-for-updates (best-effort, no-op до signing key + releases).
- ✅ **v1.0.4** — cross-platform CI matrix (`.github/workflows/desktop-release.yml`): на push тега `desktop-v*` GitHub Actions собирает установщики Win (nsis+msi) / macOS (universal dmg) / Linux (deb+appimage) через `tauri-apps/tauri-action` → **draft** GitHub Release + updater `latest.json` (подписан, если заданы signing-секреты). Web НЕ собирается (remote-wrapper). См. «Releases» ниже.
- ✅ **v1.0.5** — брендированный Windows installer: Eclipse Chat artwork для NSIS/WiX, Russian-first NSIS с выбором English, current-user install без UAC. Подписанный updater теперь не только проверяет, но и автоматически скачивает, устанавливает и перезапускает приложение при запуске. Release публикуется автоматически только после зелёной сборки всех платформ; download page всегда ведёт на stable aliases последнего GitHub Release.
- ✅ **v1.0.6** — явный автозапуск из Настройки → Установка. Используется официальный `tauri-plugin-autostart`; production webview получает отдельный capability только на `enable`, `disable` и `is-enabled`, а обычный браузер этот пункт не показывает. Новый violet/gold app icon генерирует platform icons из единого Web/PWA master.
- ⏳ **post-v1.0.6** — macOS notarization + Apple Developer Program (если решим mac distribute)
- ⏳ **post-v1.0.6** — Microsoft Store .msix packaging + submission

## Prerequisites

| Tool | Version | Install |
|---|---|---|
| Rust | 1.94+ | `rustup` from rust-lang.org/tools/install |
| Node.js | 20+ | существует (для apps/web и apps/server) |
| WebView2 | runtime | preinstalled на Win 10/11 ≥ 21H2; иначе `https://go.microsoft.com/fwlink/p/?LinkId=2124703` |
| (macOS) Xcode CLI tools | latest | `xcode-select --install` |
| (Linux) | dev libs | `apt install libwebkit2gtk-4.1-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev` |

Verify:

```bash
rustc --version    # >= 1.94
cargo --version
```

## First-time setup

```bash
# Install Tauri CLI (один раз, добавляется в optionalDependencies workspace)
cd apps/desktop
npm install

# Сгенерировать icons из источника apps/web/public/icon-512.png
# Создаст src-tauri/icons/{32x32.png, 128x128.png, 128x128@2x.png, icon.ico, icon.icns}
npm run icons:gen
```

### Signing key для auto-updater

Auto-update (`tauri-plugin-updater`) использует **signed manifest** — releases
проверяются по public key, который встроен в установленный desktop binary.
Private key хранится локально + в GitHub Actions secret для CI build pipeline.

Активный keypair создан для desktop v1.0.5:

- private backup: `%USERPROFILE%\.tauri\eclipse-chat-updater.key`;
- local password backup: `%USERPROFILE%\.tauri\eclipse-chat-updater.key.password`;
- public key: встроен в `src-tauri/tauri.conf.json`;
- CI secrets: `TAURI_SIGNING_PRIVATE_KEY` и
  `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`.

**Backup private key** — потеря = невозможность publish updates для existing
installs (новые версии не пройдут signature check). Хранить как минимум в 2
местах: локально + password manager (1Password / Bitwarden).

Updater signature подтверждает целостность наших update packages. Это не
Windows Authenticode: предупреждение SmartScreen при первой установке исчезнет
только после подписи `.exe` доверенным code-signing certificate или публикации
через Microsoft Store.

## Dev mode

`devUrl` указывает на прод-URL — `tauri:dev` открывает окно, грузящее живой сайт
(тот же remote-wrapper, что и production-сборка). Фронтенд-разработка ведётся
отдельно в `apps/web` (vite dev), не через Tauri-окно.

```bash
cd apps/desktop
npm run tauri:dev
```

> Если нужно тестировать обёртку против локального/staging сервера — временно
> поменяйте `devUrl`/`frontendDist` в `src-tauri/tauri.conf.json` на нужный URL.

## Production build

Каждая target создаёт installer/bundle в `apps/desktop/src-tauri/target/release/bundle/<target>/`.

```bash
# Windows .msi (MSI installer, корпоративные deployments)
npm run tauri:build:msi

# Windows .exe NSIS (рекомендуем для consumer download)
npm run tauri:build:nsis

# macOS .dmg (universal arm64+x64, требует macOS host)
npm run tauri:build:dmg

# Linux .deb (Debian/Ubuntu)
npm run tauri:build:deb

# Linux .AppImage (universal)
npm run tauri:build:appimage

# Все доступные на текущей платформе разом
npm run tauri:build
```

## Releases (CI, v1.0.5+)

Установщики для всех платформ собираются **в облаке** по тегу — локальная сборка
больше не обязательна. Workflow [`.github/workflows/desktop-release.yml`](../../.github/workflows/desktop-release.yml):

```bash
# Версия в tauri.conf.json / Cargo.toml / package.json уже = X.Y.Z, затем:
git tag desktop-vX.Y.Z
git push origin desktop-vX.Y.Z
```

GitHub Actions (Win + macOS universal + Linux) собирает
nsis/msi/dmg/deb/appimage, updater signatures и `latest.json` в draft Release.
Отдельный `publish` job выполняется только после успеха всей matrix и делает
релиз публичным. Те же jobs добавляют stable aliases
`eclipse-chat-setup.exe`, `eclipse-chat.msi`, `eclipse-chat.dmg`,
`eclipse-chat.deb`, `eclipse-chat.AppImage`, поэтому download page не устаревает
при повышении версии.

## Архитектура

```
apps/desktop/
├── package.json           # @eclipse-chat/desktop, Tauri CLI scripts
├── scripts/
│   └── generate-installer-assets.ps1 # reproducible NSIS/WiX brand artwork
├── src-tauri/
│   ├── Cargo.toml         # Rust workspace, tauri v2 deps
│   ├── build.rs           # tauri-build run
│   ├── tauri.conf.json    # identifier, window, bundle targets, icons
│   ├── src/
│   │   ├── main.rs        # Windows binary entry (subsystem=windows)
│   │   └── lib.rs         # mobile-shared entry (Tauri 2 mobile-ready)
│   ├── capabilities/
│   │   └── default.json   # core + shell:open permissions
│   ├── windows/branding/  # generated installer BMP assets
│   └── icons/             # generated by `npm run icons:gen` (gitignored)
├── .env.desktop           # (in apps/web) — VITE_BASE_PATH=/ override
└── README.md              # this file
```

**Frontend integration (v1.0.2)**: `frontendDist` в tauri.conf.json = URL
`https://app.star-crm.ru/eclipse-chat/`, поэтому Tauri **не** бандлит локальные
ассеты — окно грузит сайт напрямую. `beforeBuildCommand`/`beforeDevCommand`
пустые (web-build не требуется). Никакого `.env.desktop` / `VITE_BASE_PATH`
больше не нужно — origin webview = сам сайт, все относительные `/api`,
`/socket.io` резолвятся на app.star-crm.ru как в обычном браузере.

## Identifier

`ru.star-crm.eclipse-chat` — bundle identifier (macOS / Linux), MSIX package family name (Windows Store).

## Дисклеймеры

- **WebRTC / LiveKit voice** — работает через WebView2 на Windows (WKWebView на macOS, WebKitGTK на Linux). Качество voice = same as browser. Native LiveKit SDK plug-in — на mobile (Phase C Capacitor), для desktop оверкилл (WebView WebRTC mature).
- **Push notifications** — v1.5.38 use Web Push API из browser (через SW). v1.0.1 добавит `tauri-plugin-notification` для native OS notifications (Windows Action Center / macOS Notification Center / Linux libnotify).
- **Auto-update** — НЕТ в v1.0.0. User manually скачивает new installer. v1.0.1 добавит updater plugin (signature verification + delta updates from GitHub Releases).
- **OS code signing** — updater packages подписаны, но Windows installer пока без Authenticode, а macOS build без notarization. SmartScreen/Gatekeeper могут показать предупреждение при первой установке; это отдельный следующий этап распространения.

## Ссылки

- [Tauri 2 docs](https://tauri.app/)
- [Tauri 2 Windows distribution](https://tauri.app/distribute/windows-installer/)
- Eclipse Chat memory: `eclipse_chat_native_apps_plan.md` (фиксация roadmap 26.05.2026)
