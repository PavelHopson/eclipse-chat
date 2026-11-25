import { useEffect } from "react";
import { api, refreshAccessToken } from "../lib/api";
import { captureDisplayedAuth } from "../lib/storage";

/**
 * 00-144: держит живой HttpOnly media-cookie, по которой сервер отдаёт
 * вложения (`/api/attachments/media/<file>`). Cookie живёт 15 минут и
 * ставится на login/refresh, но refresh access-токена реактивный (по 401),
 * поэтому в «тихой» вкладке cookie может истечь раньше, чем приложение
 * сделает следующий API-запрос, — и картинки/аудио перестанут грузиться.
 *
 * Обновляем раз в 10 минут, при возврате во вкладку и при смене профиля.
 * Ошибки глушим: худший исход — файл не загрузится, доступ шире не станет.
 */
const KEEP_ALIVE_MS = 10 * 60 * 1000;

/** Сервер ограничивает bootstrap (60 / 5 мин) — частые focus не должны его выбирать. */
const MIN_GAP_MS = 60 * 1000;
let lastRenewAt = 0;

async function renewMediaSession(force = false): Promise<void> {
  const now = Date.now();
  if (!force && now - lastRenewAt < MIN_GAP_MS) return;
  lastRenewAt = now;
  let refreshToken: string | undefined;
  try {
    refreshToken = captureDisplayedAuth().account?.refreshToken;
  } catch {
    return; // профиль сменился / не выбран
  }
  if (!refreshToken) return;
  try {
    const res = await api("api/auth/media-session", {
      method: "POST",
      body: JSON.stringify({ refreshToken }),
    });
    if (res.ok) return;
  } catch {
    // POST с 401 api() не повторяет — ниже обновим сессию явно.
  }
  // Access-токен истёк: refresh сам выставит новую media-cookie.
  try {
    await refreshAccessToken();
  } catch {
    /* вход потребует действия пользователя — это покажет основной UI */
  }
}

export function useMediaSessionKeeper(accountKey: string | null | undefined): void {
  useEffect(() => {
    if (!accountKey) return;
    void renewMediaSession(true);
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void renewMediaSession();
    }, KEEP_ALIVE_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void renewMediaSession();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [accountKey]);
}
