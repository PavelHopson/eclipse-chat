import { useCallback, useEffect, useState } from "react";
import { ApiError, apiJson } from "../lib/api";

/**
 * v0.84 #27 phase 3 — Push notifications subscribe/unsubscribe.
 *
 * Lifecycle:
 *   1. Fetch /api/push/config → publicKey + enabled flag.
 *   2. Check Notification.permission + navigator.serviceWorker для capability.
 *   3. enableNotifications() → request permission + subscribe через
 *      ServiceWorkerRegistration.pushManager.subscribe + POST /api/push/subscribe.
 *   4. disableNotifications() → unsubscribe в browser + DELETE /api/push/subscribe.
 *
 * State persistence — мы не храним subscription в localStorage; browser
 * хранит её в IndexedDB через pushManager. На каждый reload мы получаем
 * текущую sub через `registration.pushManager.getSubscription()`.
 *
 * Compatibility:
 *   - Chrome / Edge / Firefox desktop + mobile — full support.
 *   - Safari macOS 16+ — full support.
 *   - Safari iOS 16.4+ — только в installed PWA (не в browser tab).
 *   - Firefox iOS — нет push (Apple restriction).
 *
 * Privacy:
 *   - При enable показываем browser permission prompt (требует user gesture).
 *   - При disable — silent unsubscribe; не leak'аем endpoint в localStorage.
 */

export type PushCapability = "ready" | "unsupported" | "denied" | "loading";

export type PushState = {
  capability: PushCapability;
  enabled: boolean;
  /** True пока запрос/permission flow в полёте. */
  busy: boolean;
  /** Sub-error для UI. */
  error: string | null;
};

/**
 * base64url → ArrayBuffer для VAPID applicationServerKey.
 *
 * Возвращаем ArrayBuffer (не Uint8Array) чтобы satisfy BufferSource в
 * pushManager.subscribe — TS strict в lib.dom требует concrete ArrayBuffer,
 * не ArrayBufferLike с возможным SharedArrayBuffer.
 */
function b64urlToBuffer(base64url: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64url.length % 4)) % 4);
  const base64 = (base64url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out.buffer;
}

export function usePushNotifications() {
  const [state, setState] = useState<PushState>({
    capability: "loading",
    enabled: false,
    busy: false,
    error: null,
  });
  const [publicKey, setPublicKey] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    // Capability check
    if (typeof window === "undefined") return;
    const supported =
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;
    if (!supported) {
      setState({ capability: "unsupported", enabled: false, busy: false, error: null });
      return;
    }
    if (Notification.permission === "denied") {
      setState({ capability: "denied", enabled: false, busy: false, error: null });
      return;
    }
    try {
      const config = await apiJson<{ enabled: boolean; publicKey: string | null }>(
        "/api/push/config",
      );
      if (!config.enabled || !config.publicKey) {
        setState({
          capability: "unsupported",
          enabled: false,
          busy: false,
          error: "Push не настроен на сервере (нет VAPID ключей)",
        });
        return;
      }
      setPublicKey(config.publicKey);
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setState({
        capability: "ready",
        enabled: Boolean(sub),
        busy: false,
        error: null,
      });
    } catch (e) {
      setState({
        capability: "loading",
        enabled: false,
        busy: false,
        error: e instanceof Error ? e.message : "Не удалось получить конфиг push",
      });
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const enable = useCallback(async (): Promise<boolean> => {
    if (!publicKey) {
      setState((s) => ({ ...s, error: "Push не настроен на сервере" }));
      return false;
    }
    setState((s) => ({ ...s, busy: true, error: null }));
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState({
          capability: permission === "denied" ? "denied" : "ready",
          enabled: false,
          busy: false,
          error:
            permission === "denied"
              ? "Разрешение отклонено в браузере. Открой настройки сайта чтобы изменить."
              : null,
        });
        return false;
      }
      const reg = await navigator.serviceWorker.ready;
      // Existing sub? Reuse; иначе создаём новую.
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: b64urlToBuffer(publicKey),
        });
      }
      const json = sub.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
        throw new Error("Browser вернул неполную subscription");
      }
      await apiJson("/api/push/subscribe", {
        method: "POST",
        body: JSON.stringify({
          endpoint: json.endpoint,
          keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
          userAgent: navigator.userAgent.slice(0, 500),
        }),
      });
      setState({ capability: "ready", enabled: true, busy: false, error: null });
      return true;
    } catch (e) {
      setState((s) => ({
        ...s,
        busy: false,
        error: e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Не удалось включить",
      }));
      return false;
    }
  }, [publicKey]);

  const disable = useCallback(async (): Promise<boolean> => {
    setState((s) => ({ ...s, busy: true, error: null }));
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        const endpoint = sub.endpoint;
        await sub.unsubscribe();
        await apiJson("/api/push/subscribe", {
          method: "DELETE",
          body: JSON.stringify({ endpoint }),
        }).catch(() => {
          /* even если backend не очистил — browser sub уже отозвана */
        });
      }
      setState({ capability: "ready", enabled: false, busy: false, error: null });
      return true;
    } catch (e) {
      setState((s) => ({
        ...s,
        busy: false,
        error: e instanceof Error ? e.message : "Не удалось отключить",
      }));
      return false;
    }
  }, []);

  const sendTest = useCallback(async (): Promise<boolean> => {
    setState((s) => ({ ...s, busy: true, error: null }));
    try {
      await apiJson("/api/push/test", { method: "POST" });
      setState((s) => ({ ...s, busy: false }));
      return true;
    } catch (e) {
      setState((s) => ({
        ...s,
        busy: false,
        error: e instanceof ApiError ? e.message : "Не удалось отправить тест",
      }));
      return false;
    }
  }, []);

  return { ...state, enable, disable, sendTest, refresh };
}
