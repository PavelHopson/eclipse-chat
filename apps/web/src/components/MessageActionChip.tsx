import { useEffect, useRef, useState } from "react";
import type { ActionItemStatus, MessageActionItem } from "../hooks/useMessages";
import { ACTION_KIND } from "../lib/actionDraft";
import { EclipseUiIcon } from "./icons/EclipseUiIcon";

const STATUS_LABEL: Record<ActionItemStatus, string> = {
  OPEN: "Открыто", IN_PROGRESS: "В работе", REVIEW: "На проверке", DONE: "Выполнено",
};

/** Opening a task and completing it are deliberately separate actions. */
export function MessageActionChip({ action, onOpen, onToggle }: {
  action: Pick<MessageActionItem, "id" | "title" | "type" | "status" | "dueAt"> & { assignee: { displayName: string } | null };
  onOpen?: (id: string) => void;
  onToggle?: (id: string, status: ActionItemStatus) => Promise<boolean>;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const busy = useRef(false);
  const previousStatus = useRef(action.status);
  const [confirmed, setConfirmed] = useState(false);
  useEffect(() => {
    if (previousStatus.current === action.status) return;
    previousStatus.current = action.status;
    setConfirmed(true);
    const timer = window.setTimeout(() => setConfirmed(false), 650);
    return () => window.clearTimeout(timer);
  }, [action.status]);
  const done = action.status === "DONE";
  const kind = ACTION_KIND[action.type];
  const toggle = async () => {
    if (!onToggle || busy.current) return;
    busy.current = true;
    setPending(true);
    setError("");
    try {
      if (!await onToggle(action.id, done ? "OPEN" : "DONE")) throw new Error("update");
    } catch {
      setError("Статус не изменён. Попробуйте ещё раз.");
    } finally {
      busy.current = false;
      setPending(false);
    }
  };
  const content = <>
    <span className="ec-task-link__meta">
      <EclipseUiIcon name={kind.icon} size={14} />
      {kind.label}<span aria-hidden>·</span><span role="status">{pending ? "Сохраняем…" : STATUS_LABEL[action.status]}</span>
    </span>
    <strong className="ec-task-link__title">{action.title}</strong>
    <span className="ec-task-link__details">
      {action.assignee?.displayName ?? "Без ответственного"}
      {action.dueAt && <><span aria-hidden>·</span><time dateTime={action.dueAt}>{new Date(action.dueAt).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}</time></>}
    </span>
  </>;
  return <div className={"ec-task-link" + (done ? " is-done" : "") + (confirmed ? " is-confirmed" : "")}>
    {onToggle && <button type="button" className="ec-task-link__check" aria-pressed={done}
      aria-label={(done ? "Вернуть в работу: " : "Завершить: ") + action.title}
      disabled={pending} onClick={() => void toggle()}>
      <span>{done && <EclipseUiIcon name="check" size={14} />}</span>
    </button>}
    {onOpen ? <button type="button" className="ec-task-link__open" aria-label={"Открыть: " + action.title} onClick={() => onOpen(action.id)}>
      {content}<EclipseUiIcon name="arrow" size={16} className="ec-task-link__arrow" />
    </button> : <div className="ec-task-link__open">{content}</div>}
    {error && <p className="ec-task-link__error" role="alert">{error}</p>}
  </div>;
}
