import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, apiJson } from "../lib/api";
import type { ActionItemPayload } from "../lib/socket";
import { localDateValue, localDateTimeValue, localTimeIso, timeReportPeriod, timeDuration, personalTimeCsv, type TimeEntry, type TimeReport } from "../lib/personalTimeReport";

type Entry = TimeEntry;
type Props = { serverId: string; actions: ActionItemPayload[] };
const duration = (ms: number) => `${Math.floor(ms / 60_000)} мин ${Math.floor(ms / 1000) % 60} с`;

export function PersonalTime({ serverId, actions }: Props) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [actionId, setActionId] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [reportRevision, setReportRevision] = useState(0);
  const mounted = useRef(false);
  const pending = useRef(false);
  const revision = useRef(0);
  const attempt = useRef<{ actionId: string; requestId: string } | null>(null);
  const active = entries.find(entry => !entry.endedAt);
  const reload = useCallback(async () => {
    const request = ++revision.current;
    try {
      const data = await apiJson<{ entries: Entry[]; truncated: boolean }>("/api/personal-time");
      if (!mounted.current || request !== revision.current) return false;
      setEntries(data.entries); setLoading(false); setError("");
      return true;
    } catch {
      if (mounted.current && request === revision.current) { setError("Не удалось загрузить учёт времени. Повторите запрос."); setLoading(false); }
      return false;
    }
  }, []);
  useEffect(() => {
    mounted.current = true;
    void reload();
    return () => { mounted.current = false; revision.current++; };
  }, [reload]);
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    let pulsing = false;
    const pulse = async () => {
      if (pulsing || pending.current) return;
      pulsing = true;
      const request = revision.current;
      try {
        const data = await apiJson<{ entry: Entry }>(`/api/personal-time/${encodeURIComponent(active.id)}/pulse`, { method: "POST" });
        if (!cancelled && mounted.current && request === revision.current) { setEntries(rows => rows.map(row => row.id === data.entry.id ? data.entry : row)); setError(""); }
      } catch { if (!cancelled && mounted.current && request === revision.current) setError("Связь потеряна. Неподтверждённое время не учитывается. Обновите журнал."); }
      finally { pulsing = false; }
    };
    const interval = window.setInterval(() => void pulse(), 10_000);
    return () => { cancelled = true; window.clearInterval(interval); };
  }, [active?.id]);
  const change = async (stopId?: string) => {
    if (pending.current || (!stopId && !actions.some(action => action.id === actionId && action.status !== "DONE"))) return;
    revision.current++;
    pending.current = true; setBusy(true); setError("");
    try {
      if (stopId) await apiJson(`/api/personal-time/${encodeURIComponent(stopId)}/stop`, { method: "POST" });
      else {
        if (attempt.current?.actionId !== actionId) attempt.current = { actionId, requestId: crypto.randomUUID() };
        await apiJson("/api/personal-time/start", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ actionItemId: actionId, requestId: attempt.current.requestId }) });
        attempt.current = null;
      }
      if (await reload()) setReportRevision(value => value + 1);
    } catch {
      if (mounted.current) setError("Не удалось изменить таймер. Обновите журнал и повторите: возможно, таймер уже запущен в другой вкладке.");
    } finally { pending.current = false; if (mounted.current) setBusy(false); }
  };
  const refresh = async () => {
    if (pending.current) return;
    pending.current = true; setBusy(true);
    try { if (await reload()) setReportRevision(value => value + 1); }
    finally { pending.current = false; if (mounted.current) setBusy(false); }
  };
  return <section className="ec-personal-time" aria-labelledby="personal-time-title" aria-busy={busy || loading}>
    <h3 id="personal-time-title">Моё время</h3>
    <p>Личный учёт, без отчётов для команды. Держите план открытым: при закрытии или потере связи таймер остановится на последней подтверждённой отметке.</p>
    {loading && <p role="status">Загружаем время…</p>}
    {error && <p role="alert">{error}</p>}
    <button type="button" className="ec-btn ec-btn--ghost ec-btn--sm" disabled={busy} onClick={() => void refresh()}>Обновить время</button>
    {active ? <div className="ec-personal-time__active">
      <span role="status">{active.action?.serverId === serverId ? active.action.title : "Таймер другой рабочей области"} · подтверждено {duration(active.durationMs)}</span>
      <button type="button" className="ec-btn ec-btn--secondary ec-btn--sm" disabled={busy} onClick={() => void change(active.id)}>Остановить</button>
    </div> : <div className="ec-personal-time__controls">
      <label>Задача для таймера<select value={actionId} disabled={busy || loading} onChange={event => setActionId(event.target.value)}><option value="">Выберите задачу</option>{actions.filter(action => action.status !== "DONE").map(action => <option key={action.id} value={action.id}>{action.title}</option>)}</select></label>
      <button type="button" className="ec-btn ec-btn--secondary ec-btn--sm" disabled={busy || loading || !actionId} onClick={() => void change()}>Начать</button>
    </div>}
    <PersonalTimeReport key={serverId} serverId={serverId} revision={reportRevision} timerBusy={busy} onCorrected={refresh} />
  </section>;
}

function PersonalTimeReport({ serverId, revision, timerBusy, onCorrected }: { serverId: string; revision: number; timerBusy: boolean; onCorrected: () => Promise<void> }) {
  const [day, setDay] = useState(localDateValue);
  const [mode, setMode] = useState<"day" | "week">("day");
  const [reloadKey, setReloadKey] = useState(0);
  const [snapshot, setSnapshot] = useState<{ key: string; report: TimeReport; fetched: Date } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [exporting, setExporting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<Entry | null>(null);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [editError, setEditError] = useState("");
  const generation = useRef(0);
  const alive = useRef(false);
  const reportHeading = useRef<HTMLHeadingElement>(null);
  const editButtons = useRef(new Map<string, HTMLButtonElement>());
  const restoreFocus = useRef<string | null>(null);
  const key = `${serverId}:${day}:${mode}:${revision}:${reloadKey}`;
  const keyRef = useRef(key);
  keyRef.current = key;
  let period: { from: string; to: string } | null = null;
  try { period = timeReportPeriod(day, mode); } catch { /* incomplete date field */ }
  const path = period ? `/api/servers/${encodeURIComponent(serverId)}/personal-time-report?from=${encodeURIComponent(period.from)}&to=${encodeURIComponent(period.to)}` : null;
  useEffect(() => { alive.current = true; return () => { alive.current = false; generation.current++; }; }, []);
  useEffect(() => {
    const request = ++generation.current;
    const abort = new AbortController();
    setSnapshot(null); setError(""); setNotice(""); setEditing(null);
    if (!path) { setLoading(false); setError("Выберите корректную дату."); return; }
    setLoading(true);
    apiJson<TimeReport>(path, { signal: abort.signal }).then(report => {
      if (alive.current && request === generation.current) setSnapshot({ key, report, fetched: new Date() });
    }).catch(err => {
      if (alive.current && request === generation.current && !abort.signal.aborted) setError(err instanceof ApiError && err.status === 413 ? "Слишком много интервалов. Выберите один день вместо недели." : "Не удалось загрузить отчёт. Повторите запрос.");
    }).finally(() => { if (alive.current && request === generation.current) setLoading(false); });
    return () => { abort.abort(); generation.current++; };
  }, [key, path]);
  const current = snapshot?.key === key && !loading && !error ? snapshot : null;
  useEffect(() => {
    if (editing || loading || saving || !restoreFocus.current) return;
    const target = editButtons.current.get(restoreFocus.current);
    if (target && !target.disabled) target.focus(); else reportHeading.current?.focus();
    restoreFocus.current = null;
  }, [editing, loading, saving, current]);
  const disabled = saving || exporting || timerBusy;
  const exportCsv = async () => {
    if (!current || !path || disabled) return;
    const requestedKey = key;
    const request = ++generation.current;
    setExporting(true); setNotice("");
    try {
      // Export only a freshly fetched complete report, never the truncated timer list.
      const report = await apiJson<TimeReport>(path);
      if (!alive.current || keyRef.current !== requestedKey || request !== generation.current) return;
      setSnapshot({ key: requestedKey, report, fetched: new Date() });
      const url = URL.createObjectURL(new Blob([personalTimeCsv(report)], { type: "text/csv;charset=utf-8" }));
      const link = document.createElement("a");
      link.href = url; link.download = `eclipse-time-${mode}-${day}.csv`; link.click(); URL.revokeObjectURL(url);
      setNotice("CSV выгружен. Файл содержит ваш личный журнал.");
    } catch {
      if (alive.current && keyRef.current === requestedKey) { setSnapshot(null); setError("Не удалось получить свежий отчёт. CSV не создан. Повторите запрос."); }
    } finally { if (alive.current) setExporting(false); }
  };
  const correct = async () => {
    if (!editing?.endedAt || saving || !current) return;
    let from: Date, to: Date;
    try { from = new Date(localTimeIso(start, editing.startedAt)); to = new Date(localTimeIso(end, editing.endedAt)); }
    catch { setEditError("Некорректное местное время. Проверьте дату и переход на летнее время."); return; }
    if (!start || !end || !Number.isFinite(+from) || !Number.isFinite(+to) || +to <= +from || +to - +from > 86400000 || +to > Date.now()) { setEditError("Укажите прошедший интервал от 1 секунды до 24 часов. Конец должен быть позже начала."); return; }
    const requestedKey = key;
    setSaving(true); setEditError(""); setNotice("");
    try {
      await apiJson(`/api/personal-time/${encodeURIComponent(editing.id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ startedAt: from.toISOString(), endedAt: to.toISOString(), version: editing.version }) });
      if (!alive.current || keyRef.current !== requestedKey) return;
      restoreFocus.current = editing.id;
      setEditing(null); setSnapshot(null); setReloadKey(value => value + 1);
      await onCorrected();
    } catch (err) {
      if (!alive.current || keyRef.current !== requestedKey) return;
      if (err instanceof ApiError && err.status === 409) {
        const message = err.message === "Interval overlaps" ? "Интервал пересекается с другой записью. Журнал обновлён: выберите непересекающееся время." : "Запись уже изменилась или таймер ещё идёт. Журнал обновлён; откройте запись заново.";
        restoreFocus.current = editing.id;
        setEditing(null); setSnapshot(null); setReloadKey(value => value + 1);
        // Keep conflict visible after the new report resolves.
        setEditError(message);
      } else setEditError("Не удалось сохранить интервал. Проверьте время и повторите.");
    } finally { if (alive.current) setSaving(false); }
  };
  const label = period ? `${new Date(period.from).toLocaleDateString("ru-RU")} — ${new Date(+new Date(period.to) - 1).toLocaleDateString("ru-RU")}` : "";
  return <section className="ec-time-report" aria-labelledby="time-report-title" aria-busy={loading || saving || exporting}>
    <h4 id="time-report-title" ref={reportHeading} tabIndex={-1}>Журнал и отчёт</h4>
    <div className="ec-time-report__controls">
      <label>Период<select value={mode} disabled={disabled} onChange={event => { setEditError(""); setMode(event.target.value as "day" | "week"); }}><option value="day">День</option><option value="week">Неделя</option></select></label>
      <label>{mode === "day" ? "Дата" : "Дата в неделе"}<input type="date" min="2000-01-01" max="2100-12-31" value={day} disabled={disabled} onChange={event => { setEditError(""); setDay(event.target.value); }} /></label>
      <button type="button" className="ec-btn ec-btn--ghost ec-btn--sm" disabled={disabled || loading} onClick={() => setReloadKey(value => value + 1)}>Обновить отчёт</button>
      <button type="button" className="ec-btn ec-btn--secondary ec-btn--sm" disabled={!current || disabled || !!editing} onClick={() => void exportCsv()}>{exporting ? "Готовим CSV…" : "Скачать CSV"}</button>
    </div>
    <p>{label}. Время указано в часовом поясе устройства.</p>
    {loading && <p role="status">Загружаем отчёт…</p>}
    {error && <p role="alert">{error}</p>}
    {editError && <p role="alert">{editError}</p>}
    {notice && <p role="status">{notice}</p>}
    {current && <>
      <p className="ec-time-report__total"><strong>Итого: {timeDuration(current.report.totalDurationMs)}</strong> · на {current.fetched.toLocaleTimeString("ru-RU")}</p>
      {current.report.entries.length === 0 && <p>За этот период нет записей.</p>}
      <ul className="ec-time-report__list">{current.report.entries.map(entry => <li key={entry.id}>
        <div><strong>{entry.action?.title ?? "Задача недоступна"}</strong><p>{new Date(entry.startedAt).toLocaleString("ru-RU")} — {new Date(entry.confirmedThrough).toLocaleString("ru-RU")}{!entry.endedAt && " · идёт"}</p><span>В периоде: {timeDuration(entry.clippedDurationMs)}</span>{entry.clippedDurationMs !== entry.durationMs && <p>Весь интервал: {timeDuration(entry.durationMs)}. В отчёте учтена только часть.</p>}{entry.interrupted && <p>Прервано — проверьте время.</p>}</div>
        {entry.endedAt && <button ref={node => { if (node) editButtons.current.set(entry.id, node); else editButtons.current.delete(entry.id); }} type="button" className="ec-btn ec-btn--ghost ec-btn--sm" disabled={disabled || !!editing} aria-label={`Исправить время: ${entry.action?.title ?? "задача недоступна"}`} onClick={() => { setEditing(entry); setStart(localDateTimeValue(entry.startedAt)); setEnd(localDateTimeValue(entry.endedAt!)); setEditError(""); }}>Исправить</button>}
        {editing?.id === entry.id && <form className="ec-time-report__editor" onSubmit={event => { event.preventDefault(); void correct(); }}>
          <label>Начало<input autoFocus type="datetime-local" step="1" value={start} disabled={saving} onChange={event => setStart(event.target.value)} required /></label>
          <label>Конец<input type="datetime-local" step="1" value={end} disabled={saving} onChange={event => setEnd(event.target.value)} required /></label>
          <button type="submit" className="ec-btn ec-btn--secondary ec-btn--sm" disabled={saving}>{saving ? "Сохраняем…" : "Сохранить время"}</button>
          <button type="button" className="ec-btn ec-btn--ghost ec-btn--sm" disabled={saving} onClick={() => { restoreFocus.current = entry.id; setEditing(null); setEditError(""); }}>Отмена</button>
        </form>}
      </li>)}</ul>
    </>}
  </section>;
}
