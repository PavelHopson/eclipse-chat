import { useCallback, useEffect, useState } from "react";

/**
 * v1.5.30 — PWA install prompt hook.
 *
 * Captures the `beforeinstallprompt` event на mount, exposes:
 *   - `canInstall` — true когда браузер готов показать prompt
 *     (PWA criteria met: manifest + SW + https + не уже installed)
 *   - `isInstalled` — running как standalone (display-mode: standalone)
 *   - `prompt()` — trigger browser install dialog
 *
 * Behavior per platform:
 *   - Chrome/Edge desktop + Android: full `beforeinstallprompt` support
 *   - iOS Safari: НЕ fires beforeinstallprompt. Manual instructions ("Share →
 *     Add to Home Screen"). UI должен показать iOS-fallback hint.
 *   - Firefox: limited, не fires событие, нет install API
 *
 * dismissedAt persists в localStorage чтобы не спамить — если user закрыл
 * banner, не показываем 7 дней.
 */

type DeferredPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "eclipse_chat_install_dismissed_at";
const DISMISS_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia("(display-mode: standalone)").matches) return true;
  // iOS Safari legacy
  if ((window.navigator as Navigator & { standalone?: boolean }).standalone) {
    return true;
  }
  return false;
}

function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !("MSStream" in window);
}

function recentlyDismissed(): boolean {
  if (typeof localStorage === "undefined") return false;
  const raw = localStorage.getItem(DISMISS_KEY);
  if (!raw) return false;
  const at = Number.parseInt(raw, 10);
  if (Number.isNaN(at)) return false;
  return Date.now() - at < DISMISS_COOLDOWN_MS;
}

export function useInstallPrompt() {
  const [deferred, setDeferred] = useState<DeferredPromptEvent | null>(null);
  const [installed, setInstalled] = useState<boolean>(isStandalone());
  const [dismissed, setDismissed] = useState<boolean>(recentlyDismissed());

  useEffect(() => {
    const onBeforeInstall = (e: Event) => {
      // Предотвращаем mini-infobar в Chrome — будем сами рисовать UI.
      e.preventDefault();
      setDeferred(e as DeferredPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const prompt = useCallback(async (): Promise<"accepted" | "dismissed" | "unavailable"> => {
    if (!deferred) return "unavailable";
    try {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      setDeferred(null);
      if (choice.outcome === "dismissed") {
        try {
          localStorage.setItem(DISMISS_KEY, String(Date.now()));
          setDismissed(true);
        } catch {
          /* localStorage может быть disabled */
        }
      }
      return choice.outcome;
    } catch {
      return "unavailable";
    }
  }, [deferred]);

  const dismiss = useCallback(() => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
    setDismissed(true);
  }, []);

  return {
    canInstall: deferred !== null && !installed && !dismissed,
    isInstalled: installed,
    isIOS: isIOS() && !installed,
    prompt,
    dismiss,
  };
}
