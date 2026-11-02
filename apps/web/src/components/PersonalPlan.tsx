import { useCallback, useEffect, useRef, useState } from "react";
import { apiJson } from "../lib/api";
import type { ActionItemPayload } from "../lib/socket";

import { PersonalTime } from "./PersonalTime";
import { ActionFocusSession } from "./ActionFocusSession";

type PlanItem = { id: string; plannedMinutes: number | null; actionItem: { id: string; title: string; status: string; channelId: string } };
type Props = { serverId: string; actions: ActionItemPayload[]; onOpenAction?: (id: string) => void; onOpenChannel: (id: string) => void };
function today() { const d = new Date(); const pad = (n: number) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }

export function PersonalPlan({ serverId, actions, onOpenAction, onOpenChannel }: Props) {
  const [day, setDay] = useState(today);
  const [items, setItems] = useState<PlanItem[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionId, setActionId] = useState("");
  const [minutes, setMinutes] = useState("");
  const [focus, setFocus] = useState<PlanItem["actionItem"] | null>(null);
  const generation = useRef(0);
  const context = useRef(serverId);
  context.current = serverId;
  useEffect(() => { setActionId(""); setMinutes(""); setBusy(false); }, [serverId]);
  const reload = useCallback(async () => {
    const request = ++generation.current;
    setLoading(true); setError(null); setItems([]); setTruncated(false);
    try {
      const data = await apiJson<{ plans: PlanItem[]; truncated: boolean }>(`/api/servers/${encodeURIComponent(serverId)}/personal-plan?day=${encodeURIComponent(day)}`);
      if (request === generation.current) { setItems(data.plans); setTruncated(data.truncated); }
    } catch {
      if (request === generation.current) setError("Не удалось загрузить личный план.");
    } finally { if (request === generation.current) setLoading(false); }
  }, [serverId, day]);
  useEffect(() => { void reload(); return () => { generation.current++; }; }, [reload]);
  const update = async (removeId?: string) => {
    const id = removeId ?? actionId;
    if (!id || busy) return;
    const plannedMinutes = minutes === "" ? null : Number(minutes);
    if (!removeId && plannedMinutes !== null && (!Number.isInteger(plannedMinutes) || plannedMinutes < 1 || plannedMinutes > 1440)) { setError("Укажите от 1 до 1440 минут или оставьте поле пустым."); return; }
    const owner = serverId;
    const startedGeneration = generation.current;
    setBusy(true); setError(null);
    try {
      const url = `/api/actions/${encodeURIComponent(id)}/personal-plan`;
      if (removeId) await apiJson(`${url}?day=${encodeURIComponent(day)}`, { method: "DELETE" });
      else await apiJson(url, { method: "PUT", body: JSON.stringify({ day, plannedMinutes }), headers: { "Content-Type": "application/json" } });
      if (context.current !== owner || generation.current !== startedGeneration) return;
      if (!removeId) { setActionId(""); setMinutes(""); }
      await reload();
    } catch { if (context.current === owner) setError("Не удалось сохранить план. Попробуйте ещё раз."); }
    finally { if (context.current === owner) setBusy(false); }
  };
  return <section className="ec-personal-plan" aria-labelledby="personal-plan-title" aria-busy={loading || busy}>
    <h3 id="personal-plan-title">Мой план</h3>
    <p>Личный план не меняет срок и ответственного задачи.</p>
    <div className="ec-personal-plan__form">
      <label>День<input type="date" value={day} min="2000-01-01" max="2100-12-31" disabled={busy} onChange={event => setDay(event.target.value)} /></label>
      <label>Задача<select aria-label="Задача" value={actionId} disabled={busy} onChange={event => setActionId(event.target.value)}><option value="">Выберите задачу</option>{actions.filter(a => a.status !== "DONE").map(a => <option key={a.id} value={a.id}>{a.title}</option>)}</select></label>
      <label>Минуты (необязательно)<input type="number" min="1" max="1440" step="1" value={minutes} disabled={busy} onChange={event => setMinutes(event.target.value)} /></label>
      <button type="button" className="ec-btn ec-btn--secondary ec-btn--sm" disabled={busy || loading || !actionId || !day} onClick={() => void update()}>Добавить</button>
    </div>
    {error && <p role="alert" className="ec-cck-banner ec-cck-banner--error">{error} <button type="button" onClick={() => void reload()} disabled={busy}>Обновить</button></p>}
    {loading && <p role="status">Загружаем план…</p>}
    {!loading && !error && items.length === 0 && <p>На этот день задач нет.</p>}
    {!loading && !error && items.length > 0 && <p>Запланировано: {items.reduce((sum, item) => sum + (item.plannedMinutes ?? 0), 0)} мин{items.some(item => item.plannedMinutes === null) ? " · есть задачи без оценки" : ""}{truncated ? " · без учёта остальных задач" : ""}</p>}
    {truncated && <p>Показаны первые 200 задач дня.</p>}
    <ul className="ec-personal-plan__list">{items.map(item => <li key={item.id}>
      <button type="button" className="ec-personal-plan__open" onClick={() => onOpenAction ? onOpenAction(item.actionItem.id) : onOpenChannel(item.actionItem.channelId)}>{item.actionItem.title}</button>
      <span>{item.plannedMinutes === null ? "Без оценки" : `${item.plannedMinutes} мин`}</span>
      <div className="ec-personal-plan__actions">
        <button type="button" className="ec-btn ec-btn--ghost ec-btn--sm" onClick={() => setFocus(item.actionItem)} aria-label={`Фокус: ${item.actionItem.title}`}>Фокус</button>
        <button type="button" className="ec-btn ec-btn--ghost ec-btn--sm" disabled={busy || loading} onClick={() => void update(item.actionItem.id)} aria-label={`Убрать из плана: ${item.actionItem.title}`}>Убрать</button>
      </div>
    </li>)}</ul>
    <PersonalTime key={serverId} serverId={serverId} actions={actions} />
    {focus && <ActionFocusSession key={focus.id} actionId={focus.id} title={focus.title} onClose={() => setFocus(null)} />}
  </section>;
}
