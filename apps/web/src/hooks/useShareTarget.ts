import { useCallback, useState } from "react";

/**
 * v1.5.32 — Web Share Target API receiver hook.
 *
 * Когда Eclipse Chat installed как PWA и user share'ит контент из любого app
 * (Android Chrome / Windows Chrome share menu) — browser открывает наш URL с
 * GET params `share_title` / `share_text` / `share_url` (см. manifest.webmanifest
 * `share_target`). Этот hook парсит их один раз на mount, экспортит композированную
 * строку для prefill composer, и чистит URL через history.replaceState чтобы
 * params не оставались в адресной строке после первой обработки.
 *
 * Composed string format:
 *   `${title}\n${text}\n${url}` — пустые куски опускаются, разделитель — \n\n
 *   для читабельности (markdown-paragraph).
 *
 * Phase A v1.5.33 расширит до POST-method для files (image/video share),
 * требует SW interception + IndexedDB temp storage. Пока v1 — text/url only.
 */

function parseShareFromUrl(): { content: string; raw: { title: string | null; text: string | null; url: string | null } } | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const title = params.get("share_title");
  const text = params.get("share_text");
  const url = params.get("share_url");
  if (!title && !text && !url) return null;
  const parts = [title, text, url].filter((p): p is string => !!p && p.length > 0);
  if (parts.length === 0) return null;
  return {
    content: parts.join("\n\n"),
    raw: { title, text, url },
  };
}

function clearShareFromUrl() {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(window.location.search);
  params.delete("share_title");
  params.delete("share_text");
  params.delete("share_url");
  const search = params.toString();
  const newUrl =
    window.location.pathname +
    (search ? `?${search}` : "") +
    window.location.hash;
  try {
    window.history.replaceState({}, "", newUrl);
  } catch {
    /* SecurityError on some embedded contexts — non-fatal */
  }
}

export function useShareTarget() {
  // Lazy init from URL — read ровно один раз. Если params уберут через clear()
  // или другой код — state остаётся пока compose() не вызовется.
  const [pending, setPending] = useState(() => {
    const parsed = parseShareFromUrl();
    if (parsed) {
      // Чистим URL сразу же — share params не должны висеть для bookmark/copy URL.
      clearShareFromUrl();
    }
    return parsed;
  });

  /**
   * Consume the pending share — clears state. Caller вызывает после того как
   * содержимое успешно записано в draft composer'а (или отправлено).
   */
  const consume = useCallback(() => {
    setPending(null);
  }, []);

  return {
    /** Composed string ready for composer prefill, или null если share нет. */
    pendingContent: pending?.content ?? null,
    /** Raw fields для preview или modal channel-picker UX (v1.5.33+). */
    pendingRaw: pending?.raw ?? null,
    consume,
  };
}
