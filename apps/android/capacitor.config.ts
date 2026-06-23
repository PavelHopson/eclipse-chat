import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Eclipse Chat — Android (Capacitor).
 *
 * Стратегия = зеркало десктопа (Tauri remote-wrapper, apps/desktop):
 * тонкий WebView-враппер грузит ПРОД-PWA напрямую (server.url) → приложение
 * всегда актуально без пересборки/публикации под каждое изменение веба, и
 * получает PWA-фичи (push в будущем, install). webDir = локальный offline-
 * фолбэк (www/index.html), показывается при отсутствии сети до загрузки прод.
 *
 * appId БЕЗ дефисов (Android package-правила) — отличается от десктопного
 * `ru.star-crm.eclipse-chat` (Tauri допускает дефис), здесь `ru.starcrm.eclipsechat`.
 */
const config: CapacitorConfig = {
  appId: "ru.starcrm.eclipsechat",
  appName: "Eclipse Chat",
  webDir: "www",
  server: {
    url: "https://app.star-crm.ru/eclipse-chat/",
    androidScheme: "https",
  },
  android: {
    backgroundColor: "#000000",
  },
};

export default config;
