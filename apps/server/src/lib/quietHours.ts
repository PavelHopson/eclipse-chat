/**
 * v1.5.49 Discord-parity B5 — Quiet hours helper.
 *
 * Проверка попадает ли current moment в quiet-window пользователя.
 * Используется в `notifyUser()` для skip push send'а.
 *
 * Semantics window:
 *   - `quietFrom` || `quietTo` null → disabled (always send)
 *   - `quietFrom === quietTo` → effectively disabled (zero-width)
 *   - `quietFrom < quietTo` → same-day window [from, to) — push skipped когда
 *      from ≤ now < to (например "13:00"-"14:00" lunch quiet)
 *   - `quietFrom > quietTo` → spans midnight, push skipped когда
 *      now ≥ from ИЛИ now < to (например "22:00"-"08:00" overnight)
 *
 * Timezone: IANA name (e.g. "Europe/Moscow"). NULL → fallback на server TZ
 * (Intl без timeZone option использует runtime default). Invalid string
 * silently degrades в fallback (защита от corrupted БД row'ев).
 *
 * Performance: один Intl.DateTimeFormat вызов per check — недорого.
 * Каждый push send уже делает DB queries (notifyUser pref + sub fetch),
 * Intl стоит < 100µs.
 */

type QuietConfig = {
  quietFrom: string | null;
  quietTo: string | null;
  timezone: string | null;
};

/**
 * Парсит "HH:MM" в минуты от полуночи. Возвращает null если строка
 * не валидна — caller трактует как «no quiet».
 */
function parseHHMM(s: string | null): number | null {
  if (!s) return null;
  const m = /^(\d{2}):(\d{2})$/.exec(s);
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return hh * 60 + mm;
}

/**
 * Возвращает current time в user-timezone как minutes-from-midnight.
 * При невалидном timezone-string fallback'ит на server default
 * (Intl без timeZone opt). UTC fallback на крайний случай если runtime
 * не поддерживает Intl.DateTimeFormat (Node < 14, не наш случай).
 */
function nowMinutesInTimezone(timezone: string | null): number {
  try {
    const options: Intl.DateTimeFormatOptions = {
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    };
    if (timezone) options.timeZone = timezone;
    const fmt = new Intl.DateTimeFormat("en-GB", options);
    const parts = fmt.formatToParts(new Date());
    const hh = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
    const mm = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
    return hh * 60 + mm;
  } catch {
    // Invalid IANA name → fallback server TZ.
    if (timezone) return nowMinutesInTimezone(null);
    // Both server TZ failed — use UTC.
    const d = new Date();
    return d.getUTCHours() * 60 + d.getUTCMinutes();
  }
}

/**
 * Главный экспорт: true если push должен быть SKIPPED (user в quiet window).
 */
export function isInQuietHours(config: QuietConfig): boolean {
  const from = parseHHMM(config.quietFrom);
  const to = parseHHMM(config.quietTo);
  if (from === null || to === null) return false;
  if (from === to) return false; // zero-width window = disabled
  const now = nowMinutesInTimezone(config.timezone);
  if (from < to) {
    // Same-day window.
    return now >= from && now < to;
  }
  // Spans midnight (from > to). Например 22:00-08:00:
  // quiet когда now ≥ 22:00 ИЛИ now < 08:00.
  return now >= from || now < to;
}
