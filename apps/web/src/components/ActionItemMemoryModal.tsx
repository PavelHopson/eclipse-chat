import { useState } from "react";
import type { ActionItemDetail } from "../hooks/useActionItem";
import type {
  CreateMemoryEntryInput,
  MemoryKind,
  MemorySuggestion,
} from "../hooks/useChannelMemory";
import { Modal } from "./Modal";

type Props = {
  action: ActionItemDetail;
  channelName: string;
  saving: boolean;
  suggesting: boolean;
  onClose: () => void;
  onSave: (input: CreateMemoryEntryInput) => Promise<unknown>;
  onSuggest: (actionItemId: string) => Promise<MemorySuggestion>;
  onSaved: () => void;
};

const KIND_OPTIONS: Array<{ value: MemoryKind; label: string }> = [
  { value: "NOTE", label: "Заметка" },
  { value: "DECISION", label: "Решение" },
  { value: "RISK", label: "Риск" },
  { value: "FACT", label: "Факт" },
  { value: "LINK", label: "Ссылка" },
  { value: "ACTION", label: "Следующее действие" },
];

const TYPE_LABEL = {
  TASK: "Задача",
  DECISION: "Решение",
  FOLLOW_UP: "Follow-up",
} as const;

const STATUS_LABEL = {
  OPEN: "Открыто",
  IN_PROGRESS: "В работе",
  REVIEW: "На ревью",
  DONE: "Выполнено",
} as const;

function initialKind(action: ActionItemDetail): MemoryKind {
  return action.type === "DECISION" ? "DECISION" : "ACTION";
}

function initialContent(action: ActionItemDetail): string {
  const parts: string[] = [];
  if (action.description?.trim()) parts.push(action.description.trim());
  if (action.approvalStatus === "APPROVED") {
    parts.push(
      action.approvalNote?.trim()
        ? `Одобрено: ${action.approvalNote.trim()}`
        : "Решение одобрено.",
    );
  }
  if (parts.length === 0) parts.push(action.title.trim());
  return parts.join("\n\n").slice(0, 4000);
}

function initialTags(action: ActionItemDetail): string {
  const tags = [
    action.type === "DECISION"
      ? "решение"
      : action.type === "FOLLOW_UP"
        ? "follow-up"
        : "задача",
  ];
  if (action.status === "DONE") tags.push("выполнено");
  if (action.approvalStatus === "APPROVED") tags.push("одобрено");
  return tags.join(", ");
}

export function ActionItemMemoryModal({
  action,
  channelName,
  saving,
  suggesting,
  onClose,
  onSave,
  onSuggest,
  onSaved,
}: Props) {
  const [kind, setKind] = useState<MemoryKind>(() => initialKind(action));
  const [title, setTitle] = useState(() => action.title.trim().slice(0, 180));
  const [content, setContent] = useState(() => initialContent(action));
  const [tags, setTags] = useState(() => initialTags(action));
  const [error, setError] = useState<string | null>(null);

  const applySuggestion = async () => {
    setError(null);
    try {
      const suggestion = await onSuggest(action.id);
      setKind(suggestion.kind);
      setTitle(suggestion.title);
      setContent(suggestion.content ?? "");
      setTags(suggestion.tags.join(", "));
    } catch {
      setError("AI не смог улучшить черновик. Проверьте локальный вариант и сохраните вручную.");
    }
  };

  const save = async () => {
    const normalizedTitle = title.trim();
    if (!normalizedTitle) {
      setError("Добавьте короткий заголовок, чтобы запись было легко найти.");
      return;
    }

    setError(null);
    const result = await onSave({
      kind,
      title: normalizedTitle,
      content: content.trim() || null,
      tags: Array.from(
        new Set(
          tags
            .split(",")
            .map((tag) => tag.trim().slice(0, 40))
            .filter(Boolean),
        ),
      ).slice(0, 8),
      actionItemId: action.id,
    });
    if (!result) {
      setError("Запись не сохранилась. Проверьте соединение и повторите попытку.");
      return;
    }
    onSaved();
  };

  const primaryLabel =
    action.type === "DECISION" ? "Зафиксировать решение" : "Сохранить действие";

  return (
    <Modal
      title="Зафиксировать в памяти"
      width={640}
      closeOnEscape={!saving && !suggesting}
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            className="ec-btn ec-btn--secondary"
            onClick={onClose}
            disabled={saving || suggesting}
          >
            Вернуться к задаче
          </button>
          <button
            type="button"
            className="ec-btn ec-btn--primary"
            onClick={() => void save()}
            disabled={saving || suggesting || !title.trim()}
          >
            {saving ? "Сохраняем..." : primaryLabel}
          </button>
        </>
      }
    >
      <div className="ec-memory-compose">
        <div className="ec-memory-compose__source">
          <span className="ec-memory-compose__source-label">
            {TYPE_LABEL[action.type]} · #{channelName}
          </span>
          <strong>{action.title}</strong>
          <p>
            {STATUS_LABEL[action.status]}
            {action.description?.trim() ? ` · ${action.description.trim()}` : ""}
          </p>
        </div>

        <p className="ec-memory-compose__visibility">
          Запись появится в памяти комнаты <strong>#{channelName}</strong> и будет видна
          только тем, у кого уже есть доступ к этой комнате.
        </p>

        <div className="ec-memory-compose__ai-row">
          <div>
            <strong>Сначала проверьте итог</strong>
            <span>Сохранится только отредактированная запись, а не вся история задачи.</span>
          </div>
          <button
            type="button"
            className="ec-btn ec-btn--secondary"
            onClick={() => void applySuggestion()}
            disabled={saving || suggesting}
          >
            {suggesting ? "AI анализирует..." : "Улучшить с AI"}
          </button>
        </div>

        <div className="ec-memory-compose__grid">
          <label>
            <span className="ec-field-label">Что сохраняем</span>
            <select
              className="ec-field"
              value={kind}
              onChange={(event) => setKind(event.target.value as MemoryKind)}
              disabled={saving || suggesting}
            >
              {KIND_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="ec-field-label">Теги через запятую</span>
            <input
              className="ec-field"
              value={tags}
              onChange={(event) => setTags(event.target.value)}
              maxLength={320}
              placeholder="например: релиз, риск"
              disabled={saving || suggesting}
            />
          </label>
        </div>

        <label>
          <span className="ec-field-label">Короткий итог</span>
          <input
            className="ec-field"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={180}
            autoFocus
            disabled={saving || suggesting}
          />
          <span className="ec-field-counter">{title.length}/180</span>
        </label>

        <label>
          <span className="ec-field-label">Подтвержденный контекст</span>
          <textarea
            className="ec-field ec-field--textarea ec-memory-compose__content"
            value={content}
            onChange={(event) => setContent(event.target.value)}
            maxLength={4000}
            disabled={saving || suggesting}
          />
          <span className="ec-field-counter">{content.length}/4000</span>
        </label>

        {error && (
          <div className="ec-memory-compose__error" role="alert">
            {error}
          </div>
        )}
        <p className="ec-memory-compose__privacy">
          «Улучшить с AI» передаст bounded-поля задачи настроенному AI-провайдеру. Запись
          появится в памяти только после нажатия основной кнопки.
        </p>
      </div>
    </Modal>
  );
}
