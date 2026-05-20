import { useEffect, useState } from "react";

const STORAGE_KEY = "eclipse-chat-theme";
type ThemeMode = "void" | "solar";

function applyTheme(mode: ThemeMode) {
  const root = document.documentElement;
  if (mode === "solar") {
    root.dataset.ecTheme = "solar";
  } else {
    delete root.dataset.ecTheme;
  }
}

export function ThemeToggle() {
  const [mode, setMode] = useState<ThemeMode>(() => {
    if (typeof window === "undefined") return "void";
    return window.localStorage.getItem(STORAGE_KEY) === "solar" ? "solar" : "void";
  });

  useEffect(() => {
    applyTheme(mode);
    window.localStorage.setItem(STORAGE_KEY, mode);
  }, [mode]);

  const isSolar = mode === "solar";

  return (
    <button
      type="button"
      className="ec-theme-toggle"
      aria-label={isSolar ? "Включить тёмный режим" : "Включить светлый режим"}
      aria-pressed={isSolar}
      title={isSolar ? "Solar mode активен" : "Void mode активен"}
      onClick={() => setMode((current) => (current === "void" ? "solar" : "void"))}
    >
      <span className="ec-theme-toggle__track" aria-hidden>
        <span className="ec-theme-toggle__stars" />
        <span className="ec-theme-toggle__knob">
          <span className="ec-theme-toggle__eclipse" />
        </span>
      </span>
      <span className="ec-theme-toggle__label">{isSolar ? "SOLAR" : "VOID"}</span>
    </button>
  );
}
