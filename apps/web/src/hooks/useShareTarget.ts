import { useCallback, useEffect, useState } from "react";

/**
 * Web Share Target API receiver — v1.5.32 + v1.5.37.
 *
 * Два режима, не конфликтуют:
 *
 * 1) **GET text/url share** (v1.5.32) — `?share_title/text/url` URL params.
 *    Browser GET'ит с заполненными query, мы парсим on mount + чистим URL.
 *    Подходит для share текста / ссылки из любого app.
 *
 * 2) **POST files share** (v1.5.37) — `?share-id=<uuid>` URL param.
 *    Browser POST'ит multipart на /share-target, SW intercept'ит, кладёт
 *    files+meta в IndexedDB, redirect'ит на `?share-id=<uuid>`. Frontend
 *    on mount читает IDB по этому id → expose'ит pendingFiles[] + meta.
 *    Поддерживает image/video/audio/pdf/txt.
 *
 * Pavel-Phase A v1.5.37 — закрывает gap: GET был text-only, теперь полноценно
 * "Share photo from Gallery → Eclipse Chat" работает на Android Chrome
 * installed PWA.
 */

const IDB_NAME = "eclipse-chat-shares";
const IDB_STORE = "shares";

type IdbSharePayload = {
  files: File[];
  title: string | null;
  text: string | null;
  url: string | null;
  timestamp: number;
};

function openShareIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbReadShare(id: string): Promise<IdbSharePayload | null> {
  try {
    const db = await openShareIDB();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, "readonly");
      const req = tx.objectStore(IDB_STORE).get(id);
      req.onsuccess = () => resolve((req.result as IdbSharePayload | undefined) ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

async function idbDeleteShare(id: string): Promise<void> {
  try {
    const db = await openShareIDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, "readwrite");
      tx.objectStore(IDB_STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    /* non-fatal */
  }
}

function parseGetShareFromUrl(): {
  content: string;
  raw: { title: string | null; text: string | null; url: string | null };
} | null {
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

function readShareIdFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  return params.get("share-id");
}

function clearShareFromUrl() {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(window.location.search);
  for (const key of ["share_title", "share_text", "share_url", "share-id"]) {
    params.delete(key);
  }
  const search = params.toString();
  const newUrl =
    window.location.pathname +
    (search ? `?${search}` : "") +
    window.location.hash;
  try {
    window.history.replaceState({}, "", newUrl);
  } catch {
    /* SecurityError на некоторых embed — non-fatal */
  }
}

export function useShareTarget() {
  const [pendingContent, setPendingContent] = useState<string | null>(null);
  const [pendingFiles, setPendingFiles] = useState<File[] | null>(null);
  const [pendingRaw, setPendingRaw] = useState<{
    title: string | null;
    text: string | null;
    url: string | null;
  } | null>(null);

  // Init: parse URL once on mount, dispatch GET vs POST flow.
  useEffect(() => {
    let cancelled = false;
    const shareId = readShareIdFromUrl();

    if (shareId) {
      // POST flow (v1.5.37) — files share.
      void (async () => {
        const payload = await idbReadShare(shareId);
        if (cancelled) return;
        if (payload) {
          if (payload.files && payload.files.length > 0) {
            setPendingFiles(payload.files);
          }
          const parts = [payload.title, payload.text, payload.url].filter(
            (p): p is string => !!p && p.length > 0,
          );
          if (parts.length > 0) {
            setPendingContent(parts.join("\n\n"));
            setPendingRaw({
              title: payload.title,
              text: payload.text,
              url: payload.url,
            });
          }
          // Consume IDB entry — share doesn't persist across reloads.
          void idbDeleteShare(shareId);
        }
        clearShareFromUrl();
      })();
      return () => {
        cancelled = true;
      };
    }

    // GET flow (v1.5.32) — text/url share.
    const getParsed = parseGetShareFromUrl();
    if (getParsed) {
      setPendingContent(getParsed.content);
      setPendingRaw(getParsed.raw);
      clearShareFromUrl();
    }
    return () => {
      cancelled = true;
    };
  }, []);

  const consume = useCallback(() => {
    setPendingContent(null);
    setPendingRaw(null);
  }, []);

  const consumeFiles = useCallback(() => {
    setPendingFiles(null);
  }, []);

  return {
    pendingContent,
    pendingRaw,
    pendingFiles,
    consume,
    consumeFiles,
  };
}
