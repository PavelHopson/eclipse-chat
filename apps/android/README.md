# Eclipse Chat — Android (Capacitor)

Тонкий **WebView-враппер** над прод-PWA (`https://app.star-crm.ru/eclipse-chat/`)
на **Capacitor** — зеркало десктопа (`apps/desktop`, Tauri remote-wrapper).
Приложение всегда показывает актуальный прод без пересборки под каждое
изменение веба.

- **appId:** `ru.starcrm.eclipsechat` — БЕЗ дефисов (Android package-правила;
  у десктопа `ru.star-crm.eclipse-chat`, Tauri допускает дефис).
- **Загрузка:** `server.url` → прод-PWA. `www/index.html` — offline-фолбэк.
- **Нативный проект `android/`** генерируется командой `cap add android`
  (в `.gitignore` — не коммитим, создаётся в CI/локально).

## Сборка

### CI (рекомендуется — локально npm/Android SDK может не быть)
Воркфлоу [`.github/workflows/android-release.yml`](../../.github/workflows/android-release.yml):
- `pull_request` / `workflow_dispatch` → **debug-APK** (`app-debug.apk`) в
  artifact `eclipse-chat-android-debug` (валидация сборки).
- push тега `android-v*` → **подписанный release-APK + AAB** в GitHub Release
  (prerelease). См. «Фазы» п.2.
- ubuntu-раннер уже содержит Android SDK + build-tools + лицензии.

### Локально (нужны Node + JDK 21 + Android Studio/SDK)
> Capacitor 7 требует **JDK 21** (на 17 падает `invalid source release: 21`).
```bash
cd apps/android
npm install
npx cap add android      # один раз — генерирует android/
npx cap sync android
cd android && ./gradlew assembleDebug      # → app/build/outputs/apk/debug/app-debug.apk
# или: npx cap open android  (открыть в Android Studio)
```

## Решения Pavel
- **Подпись:** keystore сгенерирован Pavel'ом (24.06.2026, `eclipse-chat.keystore`,
  alias `eclipse`); секреты заведены в GitHub Actions → CI подписывает release
  (фаза 2 ✅). Ключ хранится у Pavel — потеря = нельзя обновлять приложение в Play.
- **Дистрибуция (цель):** **оба канала** — GitHub Releases (.apk прямая ссылка)
  + Google Play (.aab, когда заведён Play-аккаунт).

## Фазы (роадмап)

1. **✅ Скаффолд + debug-APK через CI + публикация в GitHub Release** —
   debug-APK для сайдлоада/теста. PR/`workflow_dispatch` → artifact.
2. **✅ Подписанный release-APK/AAB** — на push тега `android-v*` job
   `build-release` собирает `assembleRelease`+`bundleRelease` (unsigned), затем
   **подписывает**: APK через `zipalign` + `apksigner` (v2/v3), AAB через
   `jarsigner` (upload-ключ Play); оба → **prerelease** (prerelease ⇒ не
   перетирает `releases/latest` десктопа). Ключ берётся из секретов
   `ANDROID_KEYSTORE_BASE64` / `_PASSWORD` / `_KEY_PASSWORD` / `_KEY_ALIAS`.
   Подпись делается **после** сборки (не через `signingConfig` в build.gradle),
   т.к. `android/` gitignored и регенерится `cap add` каждый прогон.
3. **⏳ Google Play** — нужен **Play Developer аккаунт** (Pavel, $25 разово);
   `.aab` уже собирается и подписывается — останется загрузить + листинг.

## Релиз
```bash
git tag android-v1.0.1 && git push origin android-v1.0.1
# → CI: signed APK + AAB в prerelease github.com/PavelHopson/eclipse-chat/releases
```
Версия в `package.json` (`apps/android`) — держать в синхроне с тегом.

## Зависит от Pavel
- Google Play Developer аккаунт (фаза 3);
- решение: чистый remote-load (текущее, нужна сеть) vs частично-bundled (offline).
