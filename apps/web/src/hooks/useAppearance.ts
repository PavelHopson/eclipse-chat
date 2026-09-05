import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { apiJson } from "../lib/api";
import { applyPalette, parsePalette, readPaletteCache, writePaletteCache, type Palette } from "../lib/appearance";

export type AppearanceController = ReturnType<typeof useAppearance>;

/** Mounted once for the authenticated account, not once for every settings window. */
export function useAppearance(userId: string, serverBrand?: string | null) {
  const [saved, setSaved] = useState<Palette | null>(() => readPaletteCache(userId));
  const [preview, setPreview] = useState<Palette | null | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const alive = useRef(false);
  const pending = useRef(new Set<AbortController>());
  const generation = useRef(0);
  const editing = useRef(false);
  const saving = useRef(false);
  const current = preview === undefined ? saved : preview;

  useLayoutEffect(() => {
    applyPalette(current);
    // Personal settings take precedence over workspace branding. Default keeps it.
    if (!current && serverBrand && /^\d{1,3}\s+\d{1,3}%\s+\d{1,3}%$/.test(serverBrand.trim())) {
      const [h, s, l] = serverBrand.match(/\d+/g)!.map(Number);
      if (h <= 360 && s <= 100 && l <= 100) {
        const style = document.documentElement.style;
        style.setProperty("--ec-accent", `hsl(${h} ${s}% ${l}%)`);
        style.setProperty("--ec-accent-hover", `hsl(${h} ${s}% ${Math.min(95, l + 6)}%)`);
        style.setProperty("--ec-accent-soft", `hsl(${h} ${s}% ${l}% / .14)`);
        style.setProperty("--ec-border-accent", `hsl(${h} ${s}% ${l}% / .55)`);
        style.setProperty("--ec-accent-glow", `0 0 0 1px hsl(${h} ${s}% ${l}% / .45), 0 0 22px -2px hsl(${h} ${s}% ${l}% / .42)`);
      }
    }
    return () => applyPalette(null);
  }, [current, serverBrand]);

  const reload = useCallback(async () => {
    if (editing.current || saving.current) return;
    const controller = new AbortController();
    pending.current.add(controller);
    const version = ++generation.current;
    setLoading(true);
    try {
      const response = await apiJson<{ palette: unknown }>("/api/users/me/appearance", { signal: controller.signal });
      if (!alive.current || controller.signal.aborted || generation.current !== version || editing.current) return;
      const palette = parsePalette(response.palette);
      if (response.palette !== null && !palette) throw new Error("Invalid appearance response");
      setSaved(palette);
      writePaletteCache(userId, palette);
      setLoaded(true);
      setError(null);
    } catch {
      if (alive.current && !controller.signal.aborted && generation.current === version) setError("Не удалось загрузить оформление. Сохранённые цвета на этом устройстве оставлены без изменений.");
    } finally {
      pending.current.delete(controller);
      if (alive.current && generation.current === version) setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    alive.current = true;
    void reload();
    const refresh = () => { if (document.visibilityState === "visible") void reload(); };
    window.addEventListener("focus", refresh);
    return () => {
      alive.current = false;
      ++generation.current;
      pending.current.forEach(controller => controller.abort());
      pending.current.clear();
      window.removeEventListener("focus", refresh);
    };
  }, [reload]);

  const previewPalette = useCallback((palette: Palette | null) => {
    editing.current = true;
    setPreview(palette === null ? null : parsePalette(palette));
  }, []);
  const cancelPreview = useCallback(() => {
    editing.current = false;
    setPreview(undefined);
  }, []);
  const save = useCallback(async (value: Palette | null): Promise<boolean> => {
    const palette = value === null ? null : parsePalette(value);
    if (saving.current || !loaded || (value !== null && palette === null)) return false;
    const controller = new AbortController();
    pending.current.add(controller);
    ++generation.current;
    saving.current = true;
    setBusy(true);
    setError(null);
    try {
      await apiJson("/api/users/me/appearance", { method: "PUT", signal: controller.signal, body: JSON.stringify({ palette }) });
      if (!alive.current || controller.signal.aborted) return false;
      setSaved(palette);
      writePaletteCache(userId, palette);
      cancelPreview();
      return true;
    } catch {
      if (alive.current && !controller.signal.aborted) setError("Цвета не сохранены. Проверьте соединение и попробуйте ещё раз.");
      return false;
    } finally {
      pending.current.delete(controller);
      saving.current = false;
      if (alive.current) setBusy(false);
    }
  }, [userId, loaded, cancelPreview]);
  return { saved, loading, loaded, busy, error, reload, previewPalette, cancelPreview, save };
}
