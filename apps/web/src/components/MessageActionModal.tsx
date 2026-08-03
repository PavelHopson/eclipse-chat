import { useMemo, useState } from "react";
import type {
  CreateActionItemInput,
  MessageActionItem,
  MessageRow,
} from "../hooks/useMessages";
import type { ActionItemPriority, ActionItemType } from "../lib/socket";
import { Avatar } from "./Avatar";
import { Modal } from "./Modal";

type MemberOption = {
  userId: string;
  displayName: string;
  avatar: string | null;
};

type Props = {
  message: MessageRow;
  members: MemberOption[];
  currentUserId: string;
  canAssign: boolean;
  onClose: () => void;
  onSave: (input: CreateActionItemInput) => Promise<MessageActionItem | null>;
  onSaved: (actionId: string) => void;
};

const TYPE_OPTIONS: Array<{
  value: ActionItemType;
  label: string;
  description: string;
  glyph: string;
}> = [
  { value: "TASK", label: "Задача", description: "Нужно выполнить", glyph: "▣" },
  { value: "DECISION", label: "Решение", description: "Уже согласовано", glyph: "◆" },
  { value: "FOLLOW_UP", label: "Контроль", description: "Нужно вернуться", glyph: "↻" },
];

const PRIORITIES: Array<{ value: ActionItemPriority; label: string }> = [
  { value: "LOW", label: "Низкий" },
  { value: "NORMAL", label: "Обычный" },
  { value: "HIGH", label: "Высокий" },
  { value: "URGENT", label: "Срочный" },
];

function initialTitle(content: string): string {
  const compact = content
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[#>*_`~\[\]]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!compact) return "Рабочий объект из сообщения";
  return compact.slice(0, 160);
}

function toLocalDateTime(date: Date): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function duePreset(days: number): string {
  const now = new Date();
  const due = new Date(now);
  due.setDate(due.getDate() + days);
  due.setHours(days === 0 ? 18 : 10, 0, 0, 0);
  if (due.getTime() <= now.getTime() + 30 * 60_000) {
    due.setTime(now.getTime() + 2 * 60 * 60_000);
    due.setMinutes(0, 0, 0);
  }
  return toLocalDateTime(due);
}

function ctaLabel(type: ActionItemType): string {
  if (type === "DECISION") return "Зафиксировать решение";
  if (type === "FOLLOW_UP") return "Поставить контроль";
  return "Создать задачу";
}

export function MessageActionModal({
  message,
  members,
  currentUserId,
  canAssign,
  onClose,
  onSave,
  onSaved,
}: Props) {
  const existingTypes = useMemo(
    () => new Set(message.actionItems.map((item) => item.type)),
    [message.actionItems],
  );
  const initialType =
    TYPE_OPTIONS.find((option) => !existingTypes.has(option.value))?.value ?? "TASK";
  const [type, setType] = useState<ActionItemType>(initialType);
  const [title, setTitle] = useState(() => initialTitle(message.content));
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<ActionItemPriority>("NORMAL");
  const [assigneeUserId, setAssigneeUserId] = useState(() =>
    canAssign && initialType !== "DECISION" ? currentUserId : "",
  );
  const [dueAt, setDueAt] = useState(() =>
    initialType === "FOLLOW_UP" ? duePreset(1) : "",
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const chooseType = (nextType: ActionItemType) => {
    if (existingTypes.has(nextType)) return;
    setType(nextType);
    setError(null);
    if (nextType === "DECISION") {
      setAssigneeUserId("");
      setDueAt("");
      return;
    }
    if (canAssign && !assigneeUserId) setAssigneeUserId(currentUserId);
    if (nextType === "FOLLOW_UP" && !dueAt) setDueAt(duePreset(1));
  };

  const save = async () => {
    const normalizedTitle = title.trim();
    if (!normalizedTitle) {
      setError("Добавьте короткий заголовок, чтобы объект было легко найти.");
      return;
    }

    let dueIso: string | null = null;
    if (dueAt) {
      const parsedDue = new Date(dueAt);
      if (Number.isNaN(parsedDue.getTime()) || parsedDue.getTime() < Date.now() - 60_000) {
        setError("Выберите будущую дату или уберите срок.");
        return;
      }
      dueIso = parsedDue.toISOString();
    }

    setSubmitting(true);
    setError(null);
    const action = await onSave({
      type,
      title: normalizedTitle,
      description: description.trim() || null,
      priority,
      assigneeUserId: canAssign && assigneeUserId ? assigneeUserId : null,
      dueAt: dueIso,
    });
    setSubmitting(false);
    if (!action) {
      setError("Объект не создан. Проверьте соединение или права и повторите попытку.");
      return;
    }
    onSaved(action.id);
  };

  return (
    <Modal
      title="Создать рабочий объект"
      width={680}
      closeOnEscape={!submitting}
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            className="ec-btn ec-btn--secondary"
            onClick={onClose}
            disabled={submitting}
          >
            Отмена
          </button>
          <button
            type="button"
            className="ec-btn ec-btn--primary"
            onClick={() => void save()}
            disabled={submitting || !title.trim()}
          >
            {submitting ? "Создаём..." : ctaLabel(type)}
          </button>
        </>
      }
    >
      <div className="ec-action-compose">
        <div className="ec-memory-compose__source">
          <span className="ec-memory-compose__source-label">Исходное сообщение</span>
          <div className="ec-action-compose__author">
            <Avatar url={message.user.avatar} name={message.user.displayName} size={24} />
            <strong>{message.user.displayName}</strong>
          </div>
          <p>{message.content || "Сообщение без текста"}</p>
        </div>

        <div className="ec-action-compose__types" role="radiogroup" aria-label="Тип объекта">
          {TYPE_OPTIONS.map((option) => {
            const exists = existingTypes.has(option.value);
            return (
              <button
                key={option.value}
                type="button"
                className={`ec-action-type${type === option.value ? " is-selected" : ""}`}
                role="radio"
                aria-checked={type === option.value}
                disabled={exists || submitting}
                onClick={() => chooseType(option.value)}
              >
                <span className="ec-action-type__glyph" aria-hidden>{option.glyph}</span>
                <span>
                  <strong>{option.label}</strong>
                  <small>{exists ? "Уже создано" : option.description}</small>
                </span>
              </button>
            );
          })}
        </div>

        <label>
          <span className="ec-field-label">Заголовок</span>
          <input
            className="ec-field"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={160}
            disabled={submitting}
          />
          <span className="ec-field-counter">{title.length}/160</span>
        </label>

        <div className="ec-action-compose__grid">
          <label>
            <span className="ec-field-label">Приоритет</span>
            <select
              className="ec-field"
              value={priority}
              onChange={(event) => setPriority(event.target.value as ActionItemPriority)}
              disabled={submitting}
            >
              {PRIORITIES.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>

          {type !== "DECISION" && canAssign && (
            <label>
              <span className="ec-field-label">Ответственный</span>
              <select
                className="ec-field"
                value={assigneeUserId}
                onChange={(event) => setAssigneeUserId(event.target.value)}
                disabled={submitting}
              >
                <option value="">Без ответственного</option>
                {members.map((member) => (
                  <option key={member.userId} value={member.userId}>
                    {member.displayName}{member.userId === currentUserId ? " (я)" : ""}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        {type !== "DECISION" && (
          <div className="ec-action-compose__due">
            <label>
              <span className="ec-field-label">Срок</span>
              <input
                type="datetime-local"
                className="ec-field"
                value={dueAt}
                min={toLocalDateTime(new Date())}
                onChange={(event) => setDueAt(event.target.value)}
                disabled={submitting}
              />
            </label>
            <div className="ec-action-compose__presets" aria-label="Быстрый срок">
              <button type="button" onClick={() => setDueAt(duePreset(0))} disabled={submitting}>Сегодня</button>
              <button type="button" onClick={() => setDueAt(duePreset(1))} disabled={submitting}>Завтра</button>
              <button type="button" onClick={() => setDueAt(duePreset(7))} disabled={submitting}>Через неделю</button>
              {dueAt && <button type="button" onClick={() => setDueAt("")} disabled={submitting}>Без срока</button>}
            </div>
          </div>
        )}

        <label>
          <span className="ec-field-label">Контекст и ожидаемый результат</span>
          <textarea
            className="ec-field ec-field--textarea ec-action-compose__description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={4000}
            placeholder={type === "DECISION" ? "Почему приняли это решение..." : "Что должно получиться..."}
            disabled={submitting}
          />
          <span className="ec-field-counter">{description.length}/4000</span>
        </label>

        {error && <div className="ec-memory-compose__error" role="alert">{error}</div>}
        <p className="ec-action-compose__provenance">
          Источник и автор сохранятся автоматически. Пока вы не нажмёте основную кнопку, ничего не будет создано.
        </p>
      </div>
    </Modal>
  );
}
