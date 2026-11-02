export type TimeEntry = {
  id: string; startedAt: string; endedAt: string | null; confirmedThrough: string;
  version: number; interrupted: boolean; durationMs: number;
  action: { id: string; title: string; serverId: string } | null;
};
export type TimeReport = {
  entries: (TimeEntry & { clippedDurationMs: number })[];
  totalDurationMs: number; from: string; to: string;
};
const pad = (value: number) => String(value).padStart(2, "0");
export function localDateValue(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
export function localDateTimeValue(iso: string) {
  const date = new Date(iso);
  return `${localDateValue(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}
export function localTimeIso(value: string, original: string) {
  const normalized = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) ? `${value}:00` : value;
  // Preserve exact timestamp/offset if an unchanged repeated DST hour is shown.
  if (normalized === localDateTimeValue(original)) return original;
  const date = new Date(normalized);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(normalized) || !Number.isFinite(+date) || localDateTimeValue(date.toISOString()) !== normalized) throw new Error("Invalid local time");
  return date.toISOString();
}
export function timeReportPeriod(day: string, mode: "day" | "week") {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error("Invalid day");
  const [year, month, date] = day.split("-").map(Number);
  const start = new Date(year, month - 1, date);
  if (localDateValue(start) !== day || year < 2000 || year > 2100) throw new Error("Invalid day");
  if (mode === "week") start.setDate(start.getDate() - (start.getDay() + 6) % 7);
  const end = new Date(start);
  end.setDate(end.getDate() + (mode === "week" ? 7 : 1));
  return { from: start.toISOString(), to: end.toISOString() };
}
export function timeDuration(ms: number) {
  const seconds = Math.floor(Math.max(0, ms) / 1000);
  return `${Math.floor(seconds / 3600)} ч ${Math.floor(seconds / 60) % 60} мин ${seconds % 60} с`;
}
export function timeCsvCell(value: unknown) {
  let text = String(value ?? "");
  // A quoted CSV field can still be a spreadsheet formula. Neutralize leading
  // control characters and formula operators even after spaces/BOM.
  if (/^[\s\u0000-\u001f\u007f]*[=+@-]/u.test(text) || /^[\u0000-\u001f\u007f]/u.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}
export function personalTimeCsv(report: TimeReport) {
  const rows: unknown[][] = [["Задача", "Начало UTC", "Конец/подтверждено UTC", "Весь интервал, мс", "Начало в периоде UTC", "Конец в периоде UTC", "В периоде, мс", "Состояние", "Нужна проверка"]];
  for (const entry of report.entries) rows.push([
    entry.action?.title ?? "Задача недоступна", entry.startedAt, entry.confirmedThrough,
    entry.durationMs, new Date(Math.max(+new Date(entry.startedAt), +new Date(report.from))).toISOString(),
    new Date(Math.min(+new Date(entry.confirmedThrough), +new Date(report.to))).toISOString(),
    entry.clippedDurationMs, entry.endedAt ? "Завершён" : "Идёт", entry.interrupted ? "Да" : "Нет",
  ]);
  return "\uFEFF" + rows.map(row => row.map(timeCsvCell).join(",")).join("\r\n") + "\r\n";
}
