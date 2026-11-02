import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import "./action-focus-session.css";
import { focusDeadlineMs, focusElapsedMs, focusRemainingMs } from "./actionFocusTimer";

const DURATIONS_MINUTES = [15, 25, 30, 45, 60] as const;

function formatTime(milliseconds: number): string {
  const totalSeconds = Math.ceil(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export interface ActionFocusSessionProps {
  actionId: string;
  title: string;
  onClose: () => void;
}

export function ActionFocusSession({ actionId, title, onClose }: ActionFocusSessionProps) {
  const [durationMinutes, setDurationMinutes] = useState<number>(25);
  const [remainingMs, setRemainingMs] = useState(25 * 60_000);
  const [running, setRunning] = useState(false);
  const [completed, setCompleted] = useState(false);
  const deadlineRef = useRef<number | null>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  const refreshFromClock = useCallback(() => {
    const deadline = deadlineRef.current;
    if (deadline === null) return;
    const nextRemaining = focusRemainingMs(deadline, Date.now());
    setRemainingMs(nextRemaining);
    if (nextRemaining === 0) {
      deadlineRef.current = null;
      setRunning(false);
      setCompleted(true);
    }
  }, []);

  useEffect(() => {
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus();
    return () => returnFocusRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(refreshFromClock, 1000);
    const onVisibilityChange = () => refreshFromClock();
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [running, refreshFromClock]);

  const start = () => {
    if (completed || running) return;
    deadlineRef.current = focusDeadlineMs(Date.now(), remainingMs);
    setRunning(true);
  };

  const pause = () => {
    const deadline = deadlineRef.current;
    if (!running || deadline === null) return;
    const nextRemaining = focusRemainingMs(deadline, Date.now());
    deadlineRef.current = null;
    setRemainingMs(nextRemaining);
    setRunning(false);
    if (nextRemaining === 0) setCompleted(true);
  };

  const reset = () => {
    deadlineRef.current = null;
    setRunning(false);
    setCompleted(false);
    setRemainingMs(durationMinutes * 60_000);
    // Reset removes its own button; keep keyboard focus inside the dialog.
    closeRef.current?.focus();
  };

  const chooseDuration = (minutes: number) => {
    if (running || completed) return;
    setDurationMinutes(minutes);
    setRemainingMs(minutes * 60_000);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== "Tab" || !dialogRef.current) return;
    const controls = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(
      'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
    ));
    const first = controls[0];
    const last = controls.at(-1);
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const stateLabel = completed ? "Время вышло" : running ? "Фокус-сессия идёт" : remainingMs < durationMinutes * 60_000 ? "Пауза" : "Готово к старту";

  return (
    <div className="ec-action-focus__backdrop">
      <section
        ref={dialogRef}
        className="ec-action-focus"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ec-action-focus-title"
        aria-describedby="ec-action-focus-description"
        data-action-id={actionId}
        onKeyDown={handleKeyDown}
      >
        <header className="ec-action-focus__header">
          <div>
            <p className="ec-action-focus__eyebrow">Личный фокус · задача</p>
            <h2 id="ec-action-focus-title">{title}</h2>
          </div>
          <button ref={closeRef} type="button" className="ec-action-focus__close" onClick={onClose} aria-label="Закрыть сессию">
            Закрыть
          </button>
        </header>

        <p id="ec-action-focus-description" className="ec-action-focus__description">
          Закрытие сбросит локальный таймер. Задача останется открытой, пока вы сами не измените её статус.
        </p>

        <fieldset className="ec-action-focus__durations" disabled={running || completed}>
          <legend>Длительность</legend>
          <div className="ec-action-focus__duration-list">
            {DURATIONS_MINUTES.map((minutes) => (
              <button
                key={minutes}
                type="button"
                aria-pressed={durationMinutes === minutes}
                className="ec-action-focus__duration"
                onClick={() => chooseDuration(minutes)}
              >
                {minutes} мин
              </button>
            ))}
          </div>
        </fieldset>

        <div className="ec-action-focus__clock-wrap">
          <p className="ec-action-focus__state" aria-live="polite">{stateLabel}</p>
          <time className="ec-action-focus__clock" aria-label={`${formatTime(remainingMs)} осталось`}>
            {formatTime(remainingMs)}
          </time>
          <div
            className="ec-action-focus__progress"
            role="progressbar"
            aria-label="Ход фокус-сессии"
            aria-valuemin={0}
            aria-valuemax={durationMinutes * 60_000}
            aria-valuenow={focusElapsedMs(durationMinutes * 60_000, remainingMs)}
          >
            <span style={{ width: `${(focusElapsedMs(durationMinutes * 60_000, remainingMs) / (durationMinutes * 60_000)) * 100}%` }} />
          </div>
        </div>

        {completed && <p className="ec-action-focus__complete" role="status">Сессия завершена. Отметьте задачу выполненной отдельно, если готовы.</p>}

        <footer className="ec-action-focus__actions">
          {!completed && <button type="button" className="ec-action-focus__primary" onClick={running ? pause : start}>{running ? "Пауза" : remainingMs < durationMinutes * 60_000 ? "Продолжить" : "Начать"}</button>}
          {(running || remainingMs < durationMinutes * 60_000 || completed) && <button type="button" className="ec-action-focus__secondary" onClick={reset}>Сбросить таймер</button>}
        </footer>
      </section>
    </div>
  );
}
