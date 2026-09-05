/** Private, account-scoped interface palette. Only six-digit HEX reaches CSS. */
export const PALETTE_KEYS = ["accent", "secondary", "background", "surface", "text", "border"] as const;
export type Palette = Record<typeof PALETTE_KEYS[number], string>;
export const DEFAULT_PALETTE: Palette = {
  accent: "#6ba3ff", secondary: "#d4af37", background: "#05070a",
  surface: "#0c1117", text: "#f2f5f9", border: "#1c2536",
};
export const PALETTE_PRESETS = [
  { name: "Eclipse", colors: DEFAULT_PALETTE },
  { name: "Графит", colors: { accent: "#c3c8d4", secondary: "#aeb9cf", background: "#09090b", surface: "#151518", text: "#eeeef2", border: "#303037" } },
  { name: "Океан", colors: { accent: "#5ac8e8", secondary: "#79dfc3", background: "#050c12", surface: "#0c1b25", text: "#e8f2f8", border: "#24414e" } },
  { name: "Ирис", colors: { accent: "#b5a0f5", secondary: "#dfa3c6", background: "#0c0912", surface: "#1a1425", text: "#f0eaf8", border: "#3b2e4c" } },
] satisfies Array<{ name: string; colors: Palette }>;

export function normalizeHex(value: unknown): string | null {
  return typeof value === "string" && /^#[\da-f]{6}$/i.test(value) ? value.toLowerCase() : null;
}
function rgb(hex: string): number[] {
  return [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
}
export function luminance(hex: string): number {
  const [r, g, b] = rgb(hex).map(v => v / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
  return r * .2126 + g * .7152 + b * .0722;
}
export function contrast(a: string, b: string): number {
  const x = luminance(a), y = luminance(b);
  return (Math.max(x, y) + .05) / (Math.min(x, y) + .05);
}
export function mix(a: string, b: string, amount: number): string {
  const end = rgb(b);
  return "#" + rgb(a).map((v, i) => Math.round(v * (1 - amount) + end[i] * amount).toString(16).padStart(2, "0")).join("");
}
export function paletteError(p: Palette): string | null {
  if (PALETTE_KEYS.some(key => !normalizeHex(p[key]))) return "Введите цвет в формате #A1B2C3 — шесть символов после #.";
  if (luminance(p.background) > .08 || luminance(p.surface) > .08) return "Фон и панели должны оставаться тёмными. Выберите более глубокий оттенок.";
  const raised = mix(p.surface, p.text, .12);
  if ([p.background, p.surface, raised].some(bg => contrast(p.text, bg) < 4.5)) return "Текст сливается с фоном. Сделайте текст светлее или панели темнее.";
  return null;
}
export function parsePalette(value: unknown): Palette | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (Object.keys(record).length !== PALETTE_KEYS.length) return null;
  const colors = {} as Palette;
  for (const key of PALETTE_KEYS) {
    const color = normalizeHex(record[key]);
    if (!color) return null;
    colors[key] = color;
  }
  return paletteError(colors) ? null : colors;
}
function readable(color: string, backgrounds: string[], ratio: number): string {
  for (let step = 0; step <= 100; step++) {
    const next = mix(color, "#ffffff", step / 100);
    if (backgrounds.every(bg => contrast(next, bg) >= ratio)) return next;
  }
  return "#ffffff";
}
export function paletteTokens(p: Palette): Record<string, string> {
  // Defense in depth for both server responses and modified local storage.
  if (!parsePalette(p)) return {};
  const { background: bg, surface, text, border } = p;
  const raised = mix(surface, text, .07), high = mix(surface, text, .12);
  const sidebar = mix(bg, surface, .65), backgrounds = [bg, surface, raised, high];
  const accent = readable(p.accent, backgrounds, 3), secondary = readable(p.secondary, backgrounds, 3);
  const muted = readable(mix(surface, text, .66), backgrounds, 4.5);
  const onAccent = contrast("#05070a", accent) >= contrast("#ffffff", accent) ? "#05070a" : "#ffffff";
  const t: Record<string, string> = {};
  const set = (names: string, value: string) => names.split(" ").forEach(name => { t["--" + name] = value; });
  set("ec-bg ec-void ef-brand-bg ec-ops-bg", bg);
  set("ec-surface-0 ec-surface-1 ef-brand-bg-alt ec-ops-rail", sidebar);
  set("ec-surface-2 ef-brand-surface ec-ops-panel ec-overlay-bg ec-overlay-header-bg ec-ops-rail-strong", surface);
  set("ec-surface-3 ef-brand-surface-hover ec-ops-panel-2 ec-input-bg-focus", raised);
  set("ec-surface-4", high);
  set("ec-input-bg ec-surface-sunken", bg);
  set("ec-surface-glass", surface + "e6");
  set("ec-text ec-text-strong ef-brand-text", text);
  set("ec-text-muted ec-text-dim ec-text-placeholder ef-brand-text-secondary ef-brand-muted", muted);
  set("ec-border-default ec-ops-line ef-brand-line", border);
  set("ec-border-subtle ec-ops-line-soft", border + "99");
  set("ec-border-emphasis ec-border-strong", mix(border, text, .25));
  set("ec-accent ef-brand-signal", accent);
  set("ec-accent-hover", mix(accent, "#ffffff", .18));
  set("ec-accent-soft", accent + "24");
  set("ec-accent-text ec-on-accent", onAccent);
  set("ec-border-accent", accent + "88");
  set("ec-accent-gold ef-brand-gold", secondary);
  set("ec-accent-gold-hover", mix(secondary, "#ffffff", .18));
  set("ec-accent-gold-soft", secondary + "24");
  set("ec-on-secondary", contrast("#05070a", secondary) >= contrast("#ffffff", secondary) ? "#05070a" : "#ffffff");
  set("ec-accent-glow ec-glow-active", `0 0 0 1px ${accent}66, 0 0 22px -2px ${accent}44`);
  set("ec-edge", `0 0 0 1px ${border}88`);
  set("ec-elev-1", `0 0 0 1px ${border}88, 0 10px 28px -14px #00000099`);
  set("ec-elev-2", `0 0 0 1px ${border}, 0 14px 36px -14px #000000aa`);
  return t;
}
const TOKEN_NAMES = Object.keys(paletteTokens(DEFAULT_PALETTE));
export function applyPalette(palette: Palette | null): void {
  const root = document.documentElement;
  root.dataset.ecTheme = "obsidian";
  for (const name of TOKEN_NAMES) root.style.removeProperty(name);
  if (palette) {
    for (const [name, value] of Object.entries(paletteTokens(palette))) root.style.setProperty(name, value);
    root.dataset.ecPalette = "custom";
  } else delete root.dataset.ecPalette;
}
export function paletteCacheKey(userId: string): string { return "eclipse:appearance:v1:" + userId; }
export function readPaletteCache(userId: string): Palette | null {
  try { return parsePalette(JSON.parse(localStorage.getItem(paletteCacheKey(userId)) ?? "null")); }
  catch { return null; }
}
export function writePaletteCache(userId: string, palette: Palette | null): void {
  try {
    if (palette) localStorage.setItem(paletteCacheKey(userId), JSON.stringify(palette));
    else localStorage.removeItem(paletteCacheKey(userId));
  } catch { /* Server remains the source of truth when browser storage is blocked. */ }
}
