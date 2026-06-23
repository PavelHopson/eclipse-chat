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
- триггеры: `pull_request` (валидация при правках `apps/android/**`),
  `workflow_dispatch` (ручной), push тега `android-v*`.
- собирает **debug-APK** (`app-debug.apk`) → artifact `eclipse-chat-android-debug`.
- ubuntu-раннер уже содержит Android SDK + лицензии.

### Локально (нужны Node + JDK 17 + Android Studio/SDK)
```bash
cd apps/android
npm install
npx cap add android      # один раз — генерирует android/
npx cap sync android
cd android && ./gradlew assembleDebug      # → app/build/outputs/apk/debug/app-debug.apk
# или: npx cap open android  (открыть в Android Studio)
```

## Фазы (роадмап)

1. **✅ Скаффолд + debug-APK через CI** (эта итерация) — unsigned APK для
   сайдлоада/теста на устройстве.
2. **⏳ Подписанный release-APK/AAB** — нужен **keystore** (Pavel):
   ```bash
   keytool -genkey -v -keystore eclipse-chat.keystore -alias eclipse -keyalg RSA -keysize 2048 -validity 10000
   ```
   → положить в GitHub Secrets (base64 keystore + пароли), добавить signingConfig
   в `android/app/build.gradle`, собирать `assembleRelease`/`bundleRelease`.
3. **⏳ Google Play** — нужен **Play Developer аккаунт** (Pavel, $25 разово);
   загрузка AAB + листинг. Альтернатива/параллельно: прямой APK с лендинга +
   кнопки «Скачать приложение» в EC (уже линкует releases).

## Зависит от Pavel
- keystore для подписи (фаза 2);
- Google Play Developer аккаунт (фаза 3);
- решение: чистый remote-load (текущее, нужна сеть) vs частично-bundled (offline).
