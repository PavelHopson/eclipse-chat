import { useId, useMemo, useRef, useState } from "react";
import type { CreateActionItemInput, MessageActionItem, MessageRow } from "../hooks/useMessages";
import type { ActionItemPriority, ActionItemType } from "../lib/socket";
import { ACTION_KIND, actionDraftTitle, actionDuePreset, localActionDate, prepareActionDraft } from "../lib/actionDraft";
import { Avatar } from "./Avatar";
import { EclipseUiIcon } from "./icons/EclipseUiIcon";
import { Modal } from "./Modal";

type Props = {
  message: MessageRow;
  members: { userId: string; displayName: string; avatar: string | null }[];
  currentUserId: string;
  canAssign: boolean;
  onClose: () => void;
  onSave: (input: CreateActionItemInput) => Promise<MessageActionItem | null>;
  onSaved: (actionId: string) => void;
};
const TYPES = Object.keys(ACTION_KIND) as ActionItemType[];
const PRIORITIES: { value: ActionItemPriority; label: string }[] = [
  { value: "LOW", label: "Низкий" }, { value: "NORMAL", label: "Обычный" },
  { value: "HIGH", label: "Высокий" }, { value: "URGENT", label: "Срочный" },
];
const priorityFor = (type: ActionItemType): ActionItemPriority => type === "RISK" ? "HIGH" : "NORMAL";
const dueFor = (type: ActionItemType) => type === "FOLLOW_UP" || type === "RISK" ? actionDuePreset(1) : "";

export function MessageActionModal({ message, members, currentUserId, canAssign, onClose, onSave, onSaved }: Props) {
  const formId = useId();
  const errorId = useId();
  const busy = useRef(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const existingTypes = useMemo(() => new Set(message.actionItems.map(item => item.type)), [message.actionItems]);
  const initialType = TYPES.find(value => !existingTypes.has(value)) ?? "TASK";
  const assigneeFor = (value: ActionItemType) => canAssign && value !== "DECISION" && value !== "REQUIREMENT" ? currentUserId : "";
  const [type, setType] = useState(initialType);
  const [title, setTitle] = useState(() => actionDraftTitle(message.content));
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState(() => priorityFor(initialType));
  const [assigneeUserId, setAssigneeUserId] = useState(() => assigneeFor(initialType));
  const [dueAt, setDueAt] = useState(() => dueFor(initialType));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [invalidField, setInvalidField] = useState("");
  const chooseType = (value: ActionItemType) => {
    if (existingTypes.has(value)) return;
    setType(value);
    setPriority(priorityFor(value));
    setAssigneeUserId(assigneeFor(value));
    setDueAt(dueFor(value));
    setError("");
    setInvalidField("");
  };
  const close = () => { if (!busy.current) onClose(); };
  const save = async () => {
    if (busy.current) return;
    const draft = prepareActionDraft({ type, title, description, priority, assigneeUserId, dueAt }, { canAssign, existingTypes });
    if (!draft.ok) {
      setError(draft.error);
      setInvalidField(draft.field);
      if (draft.field === "title") titleRef.current?.focus();
      return;
    }
    busy.current = true;
    setSubmitting(true);
    setError("");
    setInvalidField("");
    try {
      const action = await onSave(draft.input);
      if (!action) throw new Error("create");
      onSaved(action.id);
    } catch {
      setError("Не удалось сохранить. Проверьте соединение и доступ к комнате. Введённые данные сохранены в форме.");
    } finally {
      busy.current = false;
      setSubmitting(false);
    }
  };
  return <Modal title={type === "TASK" ? "Новая задача" : ACTION_KIND[type].cta} width={560}
    closeOnEscape={!submitting} onClose={close} footer={<>
      <button type="button" className="ec-btn ec-btn--secondary" onClick={close} disabled={submitting}>Отмена</button>
      <button type="submit" form={formId} className="ec-btn ec-btn--primary" disabled={submitting || existingTypes.has(type)}>
        <EclipseUiIcon name={submitting ? "orbit" : ACTION_KIND[type].icon} size={17} />
        {submitting ? "Сохраняем…" : ACTION_KIND[type].cta}
      </button>
    </>}>
    <form id={formId} className="ec-action-compose ec-task-compose" noValidate aria-busy={submitting}
      onSubmit={event => { event.preventDefault(); void save(); }}>
      <div className="ec-task-compose__origin">
        <EclipseUiIcon name="chat" size={16} />
        <span>Из сообщения</span>
        <label className="ec-task-compose__kind">
          <span className="ec-task-sr-only">Тип объекта</span>
          <select aria-label="Тип объекта" value={type} onChange={event => chooseType(event.target.value as ActionItemType)} disabled={submitting}>
            {TYPES.map(value => <option key={value} value={value} disabled={existingTypes.has(value)}>
              {ACTION_KIND[value].label}{existingTypes.has(value) ? " — уже создано" : ""}
            </option>)}
          </select>
        </label>
      </div>
      <label>
        <span className="ec-field-label">Название</span>
        <input ref={titleRef} data-autofocus className="ec-field ec-task-compose__title" value={title}
          onChange={event => { setTitle(event.target.value); if (invalidField === "title") { setError(""); setInvalidField(""); } }}
          placeholder={type === "TASK" ? "Что нужно сделать?" : "Краткое название"} maxLength={160} disabled={submitting}
          aria-invalid={invalidField === "title"} aria-describedby={invalidField === "title" ? errorId : undefined} />
      </label>
      <div className="ec-task-compose__owners">
        {type !== "DECISION" && canAssign && <label>
          <span className="ec-field-label">Ответственный</span>
          <select aria-label="Ответственный" className="ec-field" value={assigneeUserId} onChange={event => setAssigneeUserId(event.target.value)} disabled={submitting}>
            <option value="">Без ответственного</option>
            {members.map(member => <option key={member.userId} value={member.userId}>{member.displayName}{member.userId === currentUserId ? " (я)" : ""}</option>)}
          </select>
        </label>}
        {type !== "DECISION" && <label>
          <span className="ec-field-label">Срок</span>
          <input type="datetime-local" className="ec-field" value={dueAt} min={localActionDate(new Date())}
            onChange={event => { setDueAt(event.target.value); if (invalidField === "dueAt") { setError(""); setInvalidField(""); } }} disabled={submitting}
            aria-invalid={invalidField === "dueAt"} aria-describedby={invalidField === "dueAt" ? errorId : undefined} />
        </label>}
      </div>
      {type !== "DECISION" && <div className="ec-action-compose__presets" aria-label="Быстрый срок">
        <button type="button" onClick={() => setDueAt(actionDuePreset(0))} disabled={submitting}>Сегодня</button>
        <button type="button" onClick={() => setDueAt(actionDuePreset(1))} disabled={submitting}>Завтра</button>
        <button type="button" onClick={() => setDueAt(actionDuePreset(7))} disabled={submitting}>Через неделю</button>
        {dueAt && <button type="button" onClick={() => { setDueAt(""); setError(""); setInvalidField(""); }} disabled={submitting}>Убрать срок</button>}
      </div>}
      <details className="ec-task-compose__extra">
        <summary>Описание и приоритет<EclipseUiIcon name="chevron" size={14} /></summary>
        <label>
          <span className="ec-field-label">Описание</span>
          <textarea className="ec-field ec-field--textarea" value={description} onChange={event => setDescription(event.target.value)}
            placeholder="Ожидаемый результат и важные детали" rows={3} maxLength={4000} disabled={submitting} />
        </label>
        <label>
          <span className="ec-field-label">Приоритет</span>
          <select aria-label="Приоритет" className="ec-field" value={priority} onChange={event => setPriority(event.target.value as ActionItemPriority)} disabled={submitting}>
            {PRIORITIES.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
      </details>
      <details className="ec-task-compose__source">
        <summary><Avatar url={message.user.avatar} name={message.user.displayName} size={22} />
          <span><strong>{message.user.displayName}</strong><small>Исходное сообщение</small></span>
          <EclipseUiIcon name="chevron" size={14} /></summary>
        <p>{message.content || "Сообщение без текста"}</p>
      </details>
      {error && <div id={errorId} className="ec-memory-compose__error" role="alert">{error}</div>}
      <p className="ec-task-compose__note">Связь с исходным сообщением сохранится.</p>
    </form>
  </Modal>;
}
