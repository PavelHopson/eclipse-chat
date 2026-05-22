/**
 * LogoutButton — кнопка выхода с характером (набор «Logout Button»):
 * при клике оператор разворачивается, проходит сквозь дверь, дверь
 * захлопывается → вызывается onLogout.
 *
 * Состояния (CSS-классы в tokens.css задают transform-переменные
 * конечностей фигурки):
 *   default → walking1 (320ms) → walking2 (480ms) → onLogout()
 *
 * Палитра — danger-red: logout это «красная тревога», не cyan.
 * Респектит prefers-reduced-motion — там клик вызывает logout сразу.
 *
 * Надёжность (фикс v1.1.99): onLogout по типу `void | Promise<void>`
 * может быть async и может упасть либо не увести со страницы. Раньше
 * busy-латч ставился в true и НИКОГДА не сбрасывался — при неудачном
 * logout'е кнопка после первого клика становилась мёртвой (`if
 * (busyRef.current) return`), выйти было нельзя без перезагрузки.
 * Теперь вызов обёрнут в try/finally: латч и состояние откатываются,
 * если компонент пережил logout — пользователь может повторить.
 */

import { useCallback, useEffect, useRef, useState } from "react";

type LogoutState = "default" | "walking1" | "walking2";

export function LogoutButton({ onLogout }: { onLogout: () => void | Promise<void> }) {
  const [state, setState] = useState<LogoutState>("default");
  const busyRef = useRef(false);
  const mountedRef = useRef(true);
  const timersRef = useRef<number[]>([]);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      timersRef.current.forEach((t) => window.clearTimeout(t));
      timersRef.current = [];
    };
  }, []);

  // Реальный вызов logout. Успех обычно уносит со страницы (unmount) —
  // тогда mountedRef уже false и откат не нужен. Если logout упал ИЛИ
  // не увёл со страницы — откатываем латч и анимацию в рабочее
  // состояние, чтобы выход можно было повторить.
  const finish = useCallback(async () => {
    try {
      await onLogout();
    } catch {
      // logout не удался — не падаем (rejection не должен всплывать
      // unhandled); откат состояния ниже даёт повторить попытку.
    } finally {
      if (mountedRef.current) {
        busyRef.current = false;
        setState("default");
      }
    }
  }, [onLogout]);

  const handleClick = useCallback(() => {
    if (busyRef.current) return;
    busyRef.current = true;

    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      void finish();
      return;
    }

    setState("walking1");
    const t1 = window.setTimeout(() => {
      if (!mountedRef.current) return;
      setState("walking2");
      const t2 = window.setTimeout(() => {
        void finish();
      }, 480);
      timersRef.current.push(t2);
    }, 320);
    timersRef.current.push(t1);
  }, [finish]);

  return (
    <button
      type="button"
      className={`ec-logout-btn ec-logout-btn--${state}`}
      onClick={handleClick}
      aria-label="Выйти"
      aria-busy={state !== "default"}
      title="Выйти из системы"
    >
      {/* doorway (фон-проём) */}
      <svg className="ec-logout-btn__doorway" viewBox="0 0 100 100" aria-hidden>
        <path d="M93.4 86.3H58.6c-1.9 0-3.4-1.5-3.4-3.4V17.1c0-1.9 1.5-3.4 3.4-3.4h34.8c1.9 0 3.4 1.5 3.4 3.4v65.8c0 1.9-1.5 3.4-3.4 3.4z" />
        <path className="ec-logout-btn__bang" d="M40.5 43.7L26.6 31.4l-2.5 6.7zM41.9 50.4l-19.5-4-1.4 6.3zM40 57.4l-17.7 3.9 3.9 5.7z" />
      </svg>
      {/* figure (фигурка-оператор) */}
      <svg className="ec-logout-btn__figure" viewBox="0 0 100 100" aria-hidden>
        <circle cx="52.1" cy="32.4" r="6.4" />
        <path d="M50.7 62.8c-1.2 2.5-3.6 5-7.2 4-3.2-.9-4.9-3.5-4-7.8.7-3.4 3.1-13.8 4.1-15.8 1.7-3.4 1.6-4.6 7-3.7 4.3.7 4.6 2.5 4.3 5.4-.4 3.7-2.8 15.1-4.2 17.9z" />
        <g className="ec-logout-btn__arm1">
          <path d="M55.5 56.5l-6-9.5c-1-1.5-.6-3.5.9-4.4 1.5-1 3.7-1.1 4.6.4l6.1 10c1 1.5.3 3.5-1.1 4.4-1.5.9-3.5.5-4.5-.9z" />
          <path className="ec-logout-btn__wrist1" d="M69.4 59.9L58.1 58c-1.7-.3-2.9-1.9-2.6-3.7.3-1.7 1.9-2.9 3.7-2.6l11.4 1.9c1.7.3 2.9 1.9 2.6 3.7-.4 1.7-2 2.9-3.8 2.6z" />
        </g>
        <g className="ec-logout-btn__arm2">
          <path d="M34.2 43.6L45 40.3c1.7-.6 3.5.3 4 2 .6 1.7-.3 4-2 4.5l-10.8 2.8c-1.7.6-3.5-.3-4-2-.6-1.6.3-3.4 2-4z" />
          <path className="ec-logout-btn__wrist2" d="M27.1 56.2L32 45.7c.7-1.6 2.6-2.3 4.2-1.6 1.6.7 2.3 2.6 1.6 4.2L33 58.8c-.7 1.6-2.6 2.3-4.2 1.6-1.7-.7-2.4-2.6-1.7-4.2z" />
        </g>
        <g className="ec-logout-btn__leg1">
          <path d="M52.1 73.2s-7-5.7-7.9-6.5c-.9-.9-1.2-3.5-.1-4.9 1.1-1.4 3.8-1.9 5.2-.9l7.9 7c1.4 1.1 1.7 3.5.7 4.9-1.1 1.4-4.4 1.5-5.8.4z" />
          <path className="ec-logout-btn__calf1" d="M52.6 84.4l-1-12.8c-.1-1.9 1.5-3.6 3.5-3.7 2-.1 3.7 1.4 3.8 3.4l1 12.8c.1 1.9-1.5 3.6-3.5 3.7-2 0-3.7-1.5-3.8-3.4z" />
        </g>
        <g className="ec-logout-btn__leg2">
          <path d="M37.8 72.7s1.3-10.2 1.6-11.4 2.4-2.8 4.1-2.6c1.7.2 3.6 2.3 3.4 4l-1.8 11.1c-.2 1.7-1.7 3.3-3.4 3.1-1.8-.2-4.1-2.4-3.9-4.2z" />
          <path className="ec-logout-btn__calf2" d="M29.5 82.3l9.6-10.9c1.3-1.4 3.6-1.5 5.1-.1 1.5 1.4.4 4.9-.9 6.3l-8.5 9.6c-1.3 1.4-3.6 1.5-5.1.1-1.4-1.3-1.5-3.5-.2-5z" />
        </g>
      </svg>
      {/* door (створка) */}
      <svg className="ec-logout-btn__door" viewBox="0 0 100 100" aria-hidden>
        <path d="M93.4 86.3H58.6c-1.9 0-3.4-1.5-3.4-3.4V17.1c0-1.9 1.5-3.4 3.4-3.4h34.8c1.9 0 3.4 1.5 3.4 3.4v65.8c0 1.9-1.5 3.4-3.4 3.4z" />
        <circle cx="66" cy="50" r="3.7" />
      </svg>
      <span className="ec-logout-btn__text ec-shell__logout-label">ВЫХОД</span>
    </button>
  );
}
