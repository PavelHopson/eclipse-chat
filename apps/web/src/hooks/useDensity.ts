import { useCallback, useEffect, useState } from "react";

/**
 * v1.1.64 §12 — density modes (per-user, persistent через localStorage).
 *
 * Управляет плотностью интерфейса через `data-density` на <html>:
 *   balanced — default, текущая плотность (атрибут НЕ ставится)
 *   compact  — плотнее (spacing-шкала ~−18%)
 *   tactical — плотнее всех (~−27%), operator-режим
 *
 * CSS читает `:root[data-density="..."]` и переопределяет --ec-space-*
 * примитивную шкалу — density меняет ритм всего интерфейса разом
 * (three-layer tokens: density модифицирует primitive-слой).
 *
 * Первичное применение (до первой отрисовки, анти-FOUC) делает inline-
 * скрипт в index.html. Этот хук — источник правды для контрола в
 * ProfileModal: читает stored-значение и пишет при смене.
 */

export type Density = "balanced" | "compact" | "tactical";

const LS_KEY = "eclipse_chat_density";
const DENSITIES: Density[] = ["balanced", "compact", "tactical"];

function getStored(): Density {
  if (typeof window === "undefined") return "balanced";
  try {
    const v = localStorage.getItem(LS_KEY);
    return v && DENSITIES.includes(v as Density) ? (v as Density) : "balanced";
  } catch {
    return "balanced";
  }
}

function apply(density: Density): void {
  if (typeof document === "undefined") return;
  // balanced — атрибут не ставим (default-токены), чтобы не плодить слои.
  if (density === "balanced") {
    document.documentElement.removeAttribute("data-density");
  } else {
    document.documentElement.setAttribute("data-density", density);
  }
}

export function useDensity() {
  const [density, setDensityState] = useState<Density>("balanced");

  useEffect(() => {
    const stored = getStored();
    setDensityState(stored);
    apply(stored);
  }, []);

  const setDensity = useCallback((next: Density) => {
    setDensityState(next);
    apply(next);
    try {
      localStorage.setItem(LS_KEY, next);
    } catch {
      /* ignore — приватный режим / квота */
    }
  }, []);

  return { density, setDensity };
}
