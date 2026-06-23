import { useEffect, useState } from "react";

const STORAGE_KEY = "eclipse-chat-theme";
// v1.6.75 — VOID убрана; две темы: OBSIDIAN (OLED-чёрная, дефолт) + SOLAR (светлая).
type ThemeMode = "obsidian" | "solar";

const THEMES: Array<{ id: ThemeMode; label: string }> = [
  { id: "obsidian", label: "OBSIDIAN" },
  { id: "solar", label: "SOLAR" },
];

function applyTheme(mode: ThemeMode) {
  // Обе темы выставляют data-ec-theme (no-attr VOID-дефолта больше нет).
  document.documentElement.dataset.ecTheme = mode;
}

function readTheme(): ThemeMode {
  if (typeof window === "undefined") return "obsidian";
  // solar → solar; всё прочее (null, legacy "void", "obsidian") → obsidian (дефолт + миграция).
  return window.localStorage.getItem(STORAGE_KEY) === "solar" ? "solar" : "obsidian";
}

export function ThemeToggle() {
  const [mode, setMode] = useState<ThemeMode>(readTheme);

  useEffect(() => {
    applyTheme(mode);
    window.localStorage.setItem(STORAGE_KEY, mode);
  }, [mode]);

  return (
    <div role="radiogroup" aria-label="Тема оформления" className="ec-density-seg">
      {THEMES.map((t) => {
        const active = mode === t.id;
        return (
          <button
            key={t.id}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={`Тема ${t.label}`}
            onClick={() => setMode(t.id)}
            className={"ec-density-seg__btn" + (active ? " ec-density-seg__btn--active" : "")}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
