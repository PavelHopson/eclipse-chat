import { useEffect, useState } from "react";

const STORAGE_KEY = "eclipse-chat-theme";
// v1.6.75 — VOID убрана; две темы: OBSIDIAN (OLED-чёрная, дефолт) + SOLAR (светлая).
type ThemeMode = "obsidian" | "solar";

function applyTheme(mode: ThemeMode) {
  // Обе темы выставляют data-ec-theme (no-attr VOID-дефолта больше нет).
  document.documentElement.dataset.ecTheme = mode;
}

function readTheme(): ThemeMode {
  if (typeof window === "undefined") return "obsidian";
  // solar → solar; всё прочее (null, legacy "void", "obsidian") → obsidian (дефолт + миграция).
  return window.localStorage.getItem(STORAGE_KEY) === "solar" ? "solar" : "obsidian";
}

/**
 * ThemeToggle (v1.6.80) — тумблер-переключатель темы (слайдер-свитч), а не
 * сегмент из двух текст-кнопок: луна = OBSIDIAN (тёмная), солнце = SOLAR
 * (светлая). Привычный toggle, как просил Pavel. Визуал — `.ec-theme-switch`.
 */
export function ThemeToggle() {
  const [mode, setMode] = useState<ThemeMode>(readTheme);

  useEffect(() => {
    applyTheme(mode);
    window.localStorage.setItem(STORAGE_KEY, mode);
  }, [mode]);

  const solar = mode === "solar";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={solar}
      aria-label={solar ? "Светлая тема (SOLAR)" : "Тёмная тема (OBSIDIAN)"}
      title={solar ? "Тема: SOLAR (светлая)" : "Тема: OBSIDIAN (тёмная)"}
      className="ec-theme-switch"
      onClick={() => setMode(solar ? "obsidian" : "solar")}
    >
      <span className="ec-theme-switch__knob" aria-hidden>
        {solar ? (
          // солнце
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="4.2" />
            <path d="M12 2v2M12 20v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2 12h2M20 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" />
          </svg>
        ) : (
          // луна
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
        )}
      </span>
    </button>
  );
}
