import { useEffect, useState } from "react";
import { apiJson, ApiError } from "../lib/api";

/**
 * Link preview hook (v0.67).
 *
 * Fetch'ит OG preview для URL через GET /api/embeds/preview?url=.
 * Backend кэширует на 7 дней (24h для FAILED), плюс session-level
 * memory cache здесь — одна и та же ссылка в 100 сообщениях не
 * вызывает 100 запросов.
 *
 * Возвращаемые состояния:
 *   - loading: true пока fetch активный (skeleton можно показать,
 *     либо ничего — null card)
 *   - preview: данные если OK
 *   - failed: bool если backend вернул FAILED (UI fall'ит на plain link)
 *
 * Дебаунса нет — URL приходит из готового message, фиксированный.
 */

export type LinkPreviewData = {
  url: string;
  status: "OK" | "FAILED";
  title: string | null;
  description: string | null;
  image: string | null;
  siteName: string | null;
};

/** Session-level memory cache. URL → data ИЛИ pending promise. */
const cache = new Map<string, LinkPreviewData | Promise<LinkPreviewData | null>>();

async function loadPreview(url: string): Promise<LinkPreviewData | null> {
  const cached = cache.get(url);
  if (cached) {
    if (cached instanceof Promise) return cached;
    return cached;
  }
  const promise = apiJson<LinkPreviewData>(
    `/api/embeds/preview?url=${encodeURIComponent(url)}`,
  )
    .then((data) => {
      cache.set(url, data);
      return data;
    })
    .catch((err) => {
      // 422 / 401 / 500 — не cache, дадим retry на следующий mount.
      cache.delete(url);
      if (err instanceof ApiError) {
        return null;
      }
      return null;
    });
  cache.set(url, promise);
  return promise;
}

export function useLinkPreview(url: string | null) {
  const [data, setData] = useState<LinkPreviewData | null>(() => {
    if (!url) return null;
    const c = cache.get(url);
    return c && !(c instanceof Promise) ? c : null;
  });
  const [loading, setLoading] = useState<boolean>(() => {
    if (!url) return false;
    const c = cache.get(url);
    // Если в cache синхронный hit — не loading. Если promise или miss — loading.
    return !c || c instanceof Promise;
  });

  useEffect(() => {
    if (!url) {
      setData(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void loadPreview(url).then((res) => {
      if (cancelled) return;
      setData(res);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [url]);

  return { data, loading };
}
