/**
 * Token storage в localStorage.
 *
 * `eclipse_chat_access` — short-lived access JWT (15m).
 * `eclipse_chat_refresh` — long-lived refresh token (~7d, SHA-256 hash в БД).
 * `eclipse_chat_token` — legacy ключ (до v0.3). Один раз мигрирует в access
 * при старте приложения.
 */

const LS_ACCESS = "eclipse_chat_access";
const LS_REFRESH = "eclipse_chat_refresh";
const LS_LEGACY = "eclipse_chat_token";

export function migrateLegacyToken(): void {
  try {
    const legacy = localStorage.getItem(LS_LEGACY);
    if (legacy) {
      if (!localStorage.getItem(LS_ACCESS)) {
        localStorage.setItem(LS_ACCESS, legacy);
      }
      localStorage.removeItem(LS_LEGACY);
    }
  } catch {
    /* нет localStorage (редко, например приватный режим Safari) */
  }
}

export function getAccess(): string | null {
  return localStorage.getItem(LS_ACCESS);
}

export function getRefresh(): string | null {
  return localStorage.getItem(LS_REFRESH);
}

export function setTokenPair(access: string | null, refresh: string | null): void {
  if (access) {
    localStorage.setItem(LS_ACCESS, access);
  } else {
    localStorage.removeItem(LS_ACCESS);
  }
  if (refresh) {
    localStorage.setItem(LS_REFRESH, refresh);
  } else {
    localStorage.removeItem(LS_REFRESH);
  }
}

export function clearAllTokens(): void {
  localStorage.removeItem(LS_ACCESS);
  localStorage.removeItem(LS_REFRESH);
  localStorage.removeItem(LS_LEGACY);
}
