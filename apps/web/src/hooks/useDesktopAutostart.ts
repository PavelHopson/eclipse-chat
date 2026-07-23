import { useCallback, useEffect, useMemo, useState } from "react";

type TauriInternals = {
  invoke?: <T>(command: string, args?: Record<string, unknown>) => Promise<T>;
};

export type DesktopAutostartState = {
  supported: boolean;
  enabled: boolean;
  loading: boolean;
  busy: boolean;
  error: string | null;
  toggle: () => Promise<void>;
  refresh: () => Promise<void>;
};

function tauriInvoke(): TauriInternals["invoke"] | null {
  if (typeof window === "undefined") return null;
  const internals = (
    window as Window & { __TAURI_INTERNALS__?: TauriInternals }
  ).__TAURI_INTERNALS__;
  return typeof internals?.invoke === "function"
    ? internals.invoke.bind(internals)
    : null;
}

async function readEnabled(invoke: NonNullable<TauriInternals["invoke"]>) {
  return invoke<boolean>("plugin:autostart|is_enabled");
}

/**
 * Narrow bridge to the official Tauri autostart plugin.
 *
 * In a regular browser `__TAURI_INTERNALS__` does not exist, so the feature is
 * hidden. The desktop shell grants its remote production origin only the
 * enable/disable/is-enabled commands; no shell or updater access is exposed.
 */
export function useDesktopAutostart(): DesktopAutostartState {
  const invoke = useMemo(tauriInvoke, []);
  const supported = invoke !== null;
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(supported);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!invoke) return;
    setLoading(true);
    setError(null);
    try {
      setEnabled(await readEnabled(invoke));
    } catch {
      setError("Не удалось проверить автозапуск. Обновите desktop-приложение.");
    } finally {
      setLoading(false);
    }
  }, [invoke]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const toggle = useCallback(async () => {
    if (!invoke || busy) return;
    setBusy(true);
    setError(null);
    const next = !enabled;
    try {
      await invoke(next ? "plugin:autostart|enable" : "plugin:autostart|disable");
      setEnabled(await readEnabled(invoke));
    } catch {
      setError(
        next
          ? "Не удалось включить автозапуск."
          : "Не удалось отключить автозапуск.",
      );
    } finally {
      setBusy(false);
    }
  }, [busy, enabled, invoke]);

  return {
    supported,
    enabled,
    loading,
    busy,
    error,
    toggle,
    refresh,
  };
}
