import { useEffect, useRef } from "react";

type AppPlugin = {
  addListener?: (
    event: "backButton",
    cb: (data: { canGoBack: boolean }) => void,
  ) => Promise<{ remove: () => void }> | { remove: () => void };
  exitApp?: () => void;
  minimizeApp?: () => void;
};
type Bridge = {
  isNativePlatform?: () => boolean;
  Plugins?: { App?: AppPlugin };
};
function bridge(): Bridge | undefined {
  return (window as unknown as { Capacitor?: Bridge }).Capacitor;
}

/**
 * useNativeBackButton (v1.6.85) — аппаратная кнопка «Назад» в Android-оболочке
 * (Capacitor `@capacitor/app`). `handler()` возвращает true, если закрыл оверлей
 * (drawer/модалку) → выход отменяется; false → **сворачиваем** приложение
 * (`minimizeApp`, не убиваем — сокет и push живут). В браузере/без плагина —
 * no-op (мост `window.Capacitor` не инжектится). Слушатель ставится один раз,
 * актуальный handler читается через ref.
 */
export function useNativeBackButton(handler: () => boolean) {
  const ref = useRef(handler);
  ref.current = handler;

  useEffect(() => {
    const b = bridge();
    const app = b?.Plugins?.App;
    if (!b?.isNativePlatform?.() || !app?.addListener) return;

    let remove: (() => void) | undefined;
    const sub = app.addListener("backButton", () => {
      const consumed = ref.current();
      if (!consumed) {
        if (app.minimizeApp) app.minimizeApp();
        else if (app.exitApp) app.exitApp();
      }
    });
    Promise.resolve(sub).then((h) => {
      remove = () => h?.remove?.();
    });
    return () => remove?.();
  }, []);
}
