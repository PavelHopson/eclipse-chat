import { useState } from "react";
import type { MessageRow } from "../hooks/useMessages";
import type {
  CreateMemoryEntryInput,
  MemoryKind,
  MemorySuggestion,
} from "../hooks/useChannelMemory";
import { Modal } from "./Modal";

type Props = {
  message: MessageRow;
  saving: boolean;
  suggesting: boolean;
  onClose: () => void;
  onSave: (input: CreateMemoryEntryInput) => Promise<unknown>;
  onSuggest: (messageId: string) => Promise<MemorySuggestion>;
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

function initialKind(message: MessageRow): MemoryKind {
  if (message.actionItems.some((item) => item.type === "DECISION")) return "DECISION";
  if (message.actionItems.some((item) => item.type === "TASK" || item.type === "FOLLOW_UP")) {
    return "ACTION";
  }
  return "NOTE";
}

function initialTitle(content: string): string {
  const line = content
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[#>*_`~\[\]]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!line) return "Контекст из сообщения";
  return line.length <= 96 ? line : `${line.slice(0, 93).trimEnd()}...`;
}

export function MessageMemoryModal({
  message,
  saving,
  suggesting,
  onClose,
  onSave,
  onSuggest,
  onSaved,
}: Props) {
  const [kind, setKind] = useState<MemoryKind>(() => initialKind(message));
  const [title, setTitle] = useState(() => initialTitle(message.content));
  const [content, setContent] = useState(() => message.content.trim().slice(0, 4000));
  const [tags, setTags] = useState("");
  const [error, setError] = useState<string | null>(null);

  const applySuggestion = async () => {
    setError(null);
    try {
      const suggestion = await onSuggest(message.id);
      setKind(suggestion.kind);
      setTitle(suggestion.title);
      setContent(suggestion.content ?? "");
      setTags(suggestion.tags.join(", "));
    } catch {
      setError("AI не смог подготовить черновик. Локальный вариант можно сохранить вручную.");
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
      sourceMessageId: message.id,
    });
    if (!result) {
      setError("Запись не сохранилась. Проверьте соединение и повторите попытку.");
      return;
    }
    onSaved();
  };

  return (
    <Modal
      title="Сохранить в память"
      width={620}
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
            Отмена
          </button>
          <button
            type="button"
            className="ec-btn ec-btn--primary"
            onClick={() => void save()}
            disabled={saving || suggesting || !title.trim()}
          >
            {saving ? "Сохраняем..." : "Сохранить запись"}
          </button>
        </>
      }
    >
      <div className="ec-memory-compose">
        <div className="ec-memory-compose__source">
          <span className="ec-memory-compose__source-label">Исходное сообщение</span>
          <strong>{message.user.displayName}</strong>
          <p>{message.content}</p>
        </div>

        <div className="ec-memory-compose__ai-row">
          <div>
            <strong>Черновик уже готов</strong>
            <span>Проверьте смысл и сохраните. AI используется только по вашему нажатию.</span>
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
            <span className="ec-field-label">Тип записи</span>
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
              placeholder="например: релиз, backend"
              disabled={saving || suggesting}
            />
          </label>
        </div>

        <label>
          <span className="ec-field-label">Заголовок</span>
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
          <span className="ec-field-label">Что важно запомнить</span>
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
          При выборе «Улучшить с AI» текст этого сообщения отправляется настроенному AI-провайдеру.
          В память ничего не попадёт, пока вы не нажмёте «Сохранить запись».
        </p>
      </div>
    </Modal>
  );
}
