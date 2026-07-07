/**
 * DeleteButton — анимированная кнопка удаления (эффект из набора
 * «Animated Delete Button»): при клике крышка урны откидывается,
 * «документ» падает внутрь и разрезается, в финале — зелёная галочка.
 *
 * Применяется для prominent destructive-действий (Danger Zone). НЕ для
 * compact icon-кнопок — эффект крупный (урна + текстовый label).
 *
 * Flow: click → confirm() → анимация (~3.2s) ∥ onDelete() параллельно.
 * Анимация — «вес» необратимого действия; in-app confirm-диалог остаётся
 * реальным защитным гейтом. Респектит prefers-reduced-motion (там сразу
 * onDelete, без анимации).
 *
 * Адаптировано под Eclipse-палитру: danger-red урна, accent-cyan
 * «документ», ok-green финальная галочка.
 */

import { useEffect, useRef, useState } from "react";
import { useConfirm } from "./ConfirmDialog";

/** Длительность анимации удаления — синхронизирована с CSS keyframes. */
const ANIM_MS = 3200;

type Props = {
  /** Текст на кнопке. Короткий — эффект калиброван под компактную ширину. */
  label: string;
  /** Текст-объяснение в диалоге подтверждения. Опусти — без подтверждения. */
  confirmMessage?: string;
  /** Заголовок диалога подтверждения. По умолчанию — «Подтвердите действие». */
  confirmTitle?: string;
  /** Действие удаления. Запускается параллельно с анимацией. */
  onDelete: () => void | Promise<void>;
  /** Parent busy — блокирует повторный клик / DOM-disable вне анимации. */
  disabled?: boolean;
};

export function DeleteButton({ label, confirmMessage, confirmTitle, onDelete, disabled }: Props) {
  const confirm = useConfirm();
  const [deleting, setDeleting] = useState(false);
  const busyRef = useRef(false);
  const timerRef = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timerRef.current), []);

  const handleClick = async () => {
    if (disabled || busyRef.current) return;
    // Занимаем busy ДО await — in-app диалог не блокирует поток как
    // window.confirm, иначе повторный клик открыл бы второй диалог.
    busyRef.current = true;
    if (confirmMessage) {
      const ok = await confirm({
        title: confirmTitle,
        message: confirmMessage,
        confirmLabel: label,
        danger: true,
      });
      if (!ok) {
        busyRef.current = false;
        return;
      }
    }

    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      void Promise.resolve(onDelete()).finally(() => {
        busyRef.current = false;
      });
      return;
    }

    setDeleting(true);
    void Promise.resolve(onDelete());
    timerRef.current = window.setTimeout(() => {
      setDeleting(false);
      busyRef.current = false;
    }, ANIM_MS);
  };

  return (
    <button
      type="button"
      className={"ec-delete-btn" + (deleting ? " ec-delete-btn--deleting" : "")}
      onClick={handleClick}
      // Во время анимации DOM-disable снят — иначе эффект тускнеет (opacity).
      // Повторный клик всё равно блокирует busyRef.
      disabled={disabled && !deleting}
    >
      <span className="ec-delete-btn__trash" aria-hidden>
        <span className="ec-delete-btn__top">
          <span className="ec-delete-btn__paper" />
        </span>
        <span className="ec-delete-btn__box" />
        <span className="ec-delete-btn__check">
          <svg viewBox="0 0 8 6" aria-hidden>
            <polyline points="1 3.4 2.71428571 5 7 1" />
          </svg>
        </span>
      </span>
      <span className="ec-delete-btn__label">{label}</span>
    </button>
  );
}
