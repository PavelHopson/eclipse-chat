import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { Modal } from "./Modal";

/**
 * useConfirm — промис-based подтверждение вместо браузерного window.confirm.
 *
 * Резкий системный popup window.confirm нарушает UX-принцип «помощник, не
 * консоль» (правило 11/12): выглядит чужеродно, не в стиле приложения. Этот
 * хук даёт in-app диалог на базе Modal, с понятным заголовком, текстом и
 * кнопками-действиями (глаголом), с danger-акцентом для разрушительного.
 *
 * Использование:
 *   const confirm = useConfirm();
 *   if (!(await confirm({
 *     title: "Удалить комнату?",
 *     message: "Все сообщения внутри будут потеряны. Действие необратимо.",
 *     confirmLabel: "Удалить комнату",
 *     danger: true,
 *   }))) return;
 *
 * ConfirmProvider монтируется один раз в корне (App), покрывает и лендинг, и AppShell.
 */

export type ConfirmOptions = {
  /** Заголовок диалога. По умолчанию — «Подтвердите действие». */
  title?: string;
  /** Текст-объяснение (что произойдёт). Человеческим языком. */
  message: ReactNode;
  /** Подпись кнопки подтверждения — глаголом («Удалить комнату»). По умолчанию «Подтвердить». */
  confirmLabel?: string;
  /** Подпись отмены. По умолчанию «Отмена». */
  cancelLabel?: string;
  /** Разрушительное действие → красная кнопка. */
  danger?: boolean;
};

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn>(() => Promise.resolve(false));

export function useConfirm(): ConfirmFn {
  return useContext(ConfirmContext);
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<
    { opts: ConfirmOptions; resolve: (v: boolean) => void } | null
  >(null);

  const confirm = useCallback<ConfirmFn>((opts) => {
    return new Promise<boolean>((resolve) => setState({ opts, resolve }));
  }, []);

  const settle = useCallback((result: boolean) => {
    setState((cur) => {
      // resolve идемпотентен — safe даже при StrictMode double-invoke.
      if (cur) cur.resolve(result);
      return null;
    });
  }, []);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state && (
        <Modal
          title={state.opts.title ?? "Подтвердите действие"}
          width={420}
          onClose={() => settle(false)}
          footer={
            <>
              <button type="button" className="ec-btn" onClick={() => settle(false)}>
                {state.opts.cancelLabel ?? "Отмена"}
              </button>
              <button
                type="button"
                className={"ec-btn " + (state.opts.danger ? "ec-btn--danger" : "ec-btn--primary")}
                onClick={() => settle(true)}
                autoFocus
              >
                {state.opts.confirmLabel ?? "Подтвердить"}
              </button>
            </>
          }
        >
          <p
            style={{
              margin: 0,
              color: "var(--ec-text-strong)",
              fontSize: "var(--ec-text-sm)",
              lineHeight: 1.5,
            }}
          >
            {state.opts.message}
          </p>
        </Modal>
      )}
    </ConfirmContext.Provider>
  );
}
