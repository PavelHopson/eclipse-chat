import { useState, type FormEvent } from "react";
import type {
  ChannelMemoryEntry,
  CreateMemoryEntryInput,
  MemoryKind,
  MemoryListState,
  UpdateMemoryEntryInput,
} from "../hooks/useChannelMemory";
import type { PinnedMessageBrief } from "./IntelligencePanel";
import { Modal } from "./Modal";
import { useConfirm } from "./ConfirmDialog";

export type MemoryOwnerOption = {
  id: string;
  displayName: string;
};

type Props = {
  items: PinnedMessageBrief[];
  entries: ChannelMemoryEntry[];
  loading: boolean;
  saving: boolean;
  mutatingId: string | null;
  error: string | null;
  listState: MemoryListState;
  owners: MemoryOwnerOption[];
  onListStateChange: (state: MemoryListState) => void;
  onCreate?: (input: CreateMemoryEntryInput) => Promise<unknown>;
  onUpdate?: (id: string, input: UpdateMemoryEntryInput) => Promise<unknown>;
  onReview?: (id: string, reviewDueAt?: string | null) => Promise<unknown>;
  onArchive?: (id: string) => Promise<boolean>;
  onRestore?: (id: string) => Promise<boolean>;
};

const KIND_META: Record<MemoryKind, { label: string; tone: string }> = {
  NOTE: { label: "Заметка", tone: "note" },
  DECISION: { label: "Решение", tone: "decision" },
  RISK: { label: "Риск", tone: "risk" },
  FACT: { label: "Факт", tone: "fact" },
  LINK: { label: "Ссылка", tone: "link" },
  ACTION: { label: "Действие", tone: "action" },
};

const STATUS_META = {
  ACTIVE: { label: "Актуально", tone: "ok" },
  REVIEW_DUE: { label: "Нужно проверить", tone: "warn" },
  EXPIRED: { label: "Срок истёк", tone: "danger" },
  ARCHIVED: { label: "В архиве", tone: "muted" },
} as const;

function formatDate(value: string | null): string {
  if (!value) return "не задано";
  return new Date(value).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function toDateInput(value: string | null): string {
  return value ? value.slice(0, 10) : "";
}

function fromDateInput(value: string): string | null {
  return value ? new Date(`${value}T12:00:00.000Z`).toISOString() : null;
}

function MemoryEditor({
  entry,
  owners,
  busy,
  error,
  onClose,
  onUpdate,
  onReview,
  onArchive,
  onRestore,
}: {
  entry: ChannelMemoryEntry;
  owners: MemoryOwnerOption[];
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onUpdate?: Props["onUpdate"];
  onReview?: Props["onReview"];
  onArchive?: Props["onArchive"];
  onRestore?: Props["onRestore"];
}) {
  const confirm = useConfirm();
  const [kind, setKind] = useState(entry.kind);
  const [title, setTitle] = useState(entry.title);
  const [content, setContent] = useState(entry.content ?? "");
  const [tags, setTags] = useState(entry.tags.join(", "));
  const [visibility, setVisibility] = useState(entry.visibility);
  const [ownerUserId, setOwnerUserId] = useState(entry.owner.id);
  const [reviewDueAt, setReviewDueAt] = useState(toDateInput(entry.reviewDueAt));
  const [expiresAt, setExpiresAt] = useState(toDateInput(entry.expiresAt));
  const ownerOptions = owners.some((owner) => owner.id === entry.owner.id)
    ? owners
    : [{ id: entry.owner.id, displayName: entry.owner.displayName }, ...owners];
  const archived = Boolean(entry.archivedAt);
  const canSave = entry.permissions.canEdit && title.trim().length > 0 && !busy && !archived;

  const save = async () => {
    if (!canSave || !onUpdate) return;
    const result = await onUpdate(entry.id, {
      kind,
      title: title.trim(),
      content: content.trim() || null,
      tags: tags.split(",").map((tag) => tag.trim()).filter(Boolean),
      visibility,
      ...(entry.permissions.canReassign ? { ownerUserId } : {}),
      reviewDueAt: fromDateInput(reviewDueAt),
      expiresAt: fromDateInput(expiresAt),
    });
    if (result) onClose();
  };

  const archive = async () => {
    if (!onArchive) return;
    const approved = await confirm({
      title: "Переместить запись в архив?",
      message: "Она перестанет попадать в AI-контекст, но её можно будет восстановить во вкладке «Архив».",
      confirmLabel: "Переместить в архив",
      danger: true,
    });
    if (approved && await onArchive(entry.id)) onClose();
  };

  const restore = async () => {
    if (onRestore && await onRestore(entry.id)) onClose();
  };

  return (
    <Modal
      title={archived ? "Архивная запись" : "Управление памятью"}
      width={680}
      onClose={onClose}
      closeOnEscape={!busy}
      footer={
        archived ? (
          <>
            <button type="button" className="ec-btn" onClick={onClose}>Закрыть</button>
            {entry.permissions.canRestore && (
              <button type="button" className="ec-btn ec-btn--primary" disabled={busy} onClick={() => void restore()}>
                {busy ? "Восстанавливаю..." : "Восстановить запись"}
              </button>
            )}
          </>
        ) : (
          <>
            {entry.permissions.canArchive && (
              <button type="button" className="ec-btn ec-btn--danger ec-memory-governance__archive" disabled={busy} onClick={() => void archive()}>
                Переместить в архив
              </button>
            )}
            {entry.permissions.canReview && onReview && (
              <button type="button" className="ec-btn" disabled={busy} onClick={() => void onReview(entry.id).then((result) => result && onClose())}>
                Подтвердить актуальность
              </button>
            )}
            <button type="button" className="ec-btn ec-btn--primary" disabled={!canSave} onClick={() => void save()}>
              {busy ? "Сохраняю..." : "Сохранить и подтвердить"}
            </button>
          </>
        )
      }
    >
      <div className="ec-memory-governance">
        <section className={`ec-memory-context ec-memory-context--${entry.lifecycle.contextEligible ? "active" : "paused"}`}>
          <span className="ec-memory-context__signal" aria-hidden />
          <div>
            <strong>{entry.lifecycle.contextEligible ? "AI-контекст активен" : "AI-контекст приостановлен"}</strong>
            <p>{entry.lifecycle.contextReason}</p>
          </div>
        </section>

        <div className="ec-memory-governance__provenance">
          <span>Источник: {entry.actionItem ? `задача «${entry.actionItem.title}»` : entry.sourceMessageId ? "сообщение комнаты" : "ручная запись"}</span>
          <span>Комната: {entry.channel?.name ?? "всё пространство"}</span>
          <span>Создал: {entry.createdBy.displayName}</span>
        </div>

        <div className="ec-memory-governance__grid">
          <label className="ec-memory-field">
            <span>Тип записи</span>
            <select value={kind} disabled={!entry.permissions.canEdit || archived} onChange={(event) => setKind(event.target.value as MemoryKind)}>
              {Object.entries(KIND_META).map(([value, meta]) => <option key={value} value={value}>{meta.label}</option>)}
            </select>
          </label>
          <label className="ec-memory-field">
            <span>Владелец</span>
            <select value={ownerUserId} disabled={!entry.permissions.canReassign || archived} onChange={(event) => setOwnerUserId(event.target.value)}>
              {ownerOptions.map((owner) => <option key={owner.id} value={owner.id}>{owner.displayName}</option>)}
            </select>
          </label>
          <label className="ec-memory-field">
            <span>Где AI может использовать</span>
            <select value={visibility} disabled={!entry.permissions.canEdit || archived} onChange={(event) => setVisibility(event.target.value as ChannelMemoryEntry["visibility"])}>
              <option value="ROOM">Только эта комната</option>
              <option value="WORKSPACE" disabled={entry.channel?.internal}>Открытые комнаты пространства</option>
            </select>
            {entry.channel?.internal && <small>Внутренняя client-room не может делиться памятью со всем пространством.</small>}
          </label>
          <label className="ec-memory-field">
            <span>Проверить снова</span>
            <input type="date" value={reviewDueAt} disabled={!entry.permissions.canEdit || archived} onChange={(event) => setReviewDueAt(event.target.value)} />
          </label>
          <label className="ec-memory-field">
            <span>Убрать из AI после</span>
            <input type="date" value={expiresAt} disabled={!entry.permissions.canEdit || archived} min={new Date().toISOString().slice(0, 10)} onChange={(event) => setExpiresAt(event.target.value)} />
            <small>Пусто — хранить, пока владелец не архивирует запись.</small>
          </label>
        </div>

        <label className="ec-memory-field">
          <span>Что нужно помнить</span>
          <input value={title} maxLength={180} disabled={!entry.permissions.canEdit || archived} onChange={(event) => setTitle(event.target.value)} />
        </label>
        <label className="ec-memory-field">
          <span>Контекст и ограничения</span>
          <textarea value={content} rows={5} maxLength={4000} disabled={!entry.permissions.canEdit || archived} onChange={(event) => setContent(event.target.value)} />
        </label>
        <label className="ec-memory-field">
          <span>Теги</span>
          <input value={tags} disabled={!entry.permissions.canEdit || archived} placeholder="auth, release, client" onChange={(event) => setTags(event.target.value)} />
        </label>

        <div className="ec-memory-governance__audit">
          <span>Последняя проверка: {formatDate(entry.lastReviewedAt)} · {entry.lastReviewedBy.displayName}</span>
          {entry.expiresAt && <span>Срок актуальности: {formatDate(entry.expiresAt)}</span>}
          {entry.archivedAt && <span>Архивировано: {formatDate(entry.archivedAt)} · {entry.archivedBy?.displayName ?? "удалённый пользователь"}</span>}
        </div>
        {error && <p className="ec-memory-governance__error" role="alert">{error}</p>}
      </div>
    </Modal>
  );
}

export function MemoryGovernanceView({
  items,
  entries,
  loading,
  saving,
  mutatingId,
  error,
  listState,
  owners,
  onListStateChange,
  onCreate,
  onUpdate,
  onReview,
  onArchive,
  onRestore,
}: Props) {
  const [kind, setKind] = useState<MemoryKind>("NOTE");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tagText, setTagText] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = selectedId ? entries.find((entry) => entry.id === selectedId) ?? null : null;
  const canCreate = Boolean(onCreate) && title.trim().length > 0 && !saving;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!canCreate || !onCreate) return;
    const created = await onCreate({
      kind,
      title: title.trim(),
      content: content.trim() || null,
      tags: tagText.split(",").map((tag) => tag.trim()).filter(Boolean),
      visibility: "ROOM",
    });
    if (created) {
      setKind("NOTE");
      setTitle("");
      setContent("");
      setTagText("");
    }
  };

  return (
    <div className="ec-memory-view">
      <header className="ec-memory-view__header">
        <div>
          <span className="ec-memory-view__eyebrow">Проверенная память</span>
          <strong>Комната помнит решения, а не шум</strong>
          <p>Каждая запись имеет владельца, срок проверки и понятный scope для AI.</p>
        </div>
        <div className="ec-memory-view__tabs" role="tablist" aria-label="Состояние памяти">
          <button type="button" role="tab" aria-selected={listState === "active"} onClick={() => onListStateChange("active")}>Актуальные</button>
          <button type="button" role="tab" aria-selected={listState === "archived"} onClick={() => onListStateChange("archived")}>Архив</button>
        </div>
      </header>

      {listState === "active" && (
        <form className="ec-memory-create" onSubmit={submit}>
          <div className="ec-memory-create__heading">
            <div><strong>Добавить вручную</strong><span>По умолчанию видно только в этой комнате; проверка через 90 дней.</span></div>
            <select value={kind} onChange={(event) => setKind(event.target.value as MemoryKind)}>
              {Object.entries(KIND_META).map(([value, meta]) => <option key={value} value={value}>{meta.label}</option>)}
            </select>
          </div>
          <input value={title} maxLength={180} placeholder="Что команда должна помнить?" onChange={(event) => setTitle(event.target.value)} />
          <textarea value={content} rows={3} maxLength={4000} placeholder="Добавьте контекст, ограничения или причину решения" onChange={(event) => setContent(event.target.value)} />
          <div className="ec-memory-create__footer">
            <input value={tagText} placeholder="Теги: auth, release, risk" onChange={(event) => setTagText(event.target.value)} />
            <button type="submit" className="ec-btn ec-btn--primary" disabled={!canCreate}>{saving ? "Сохраняю..." : "Сохранить в память"}</button>
          </div>
        </form>
      )}

      {error && <p className="ec-memory-view__error" role="alert">{error}</p>}
      {loading ? (
        <div className="ec-memory-view__loading" aria-live="polite">Загружаю память комнаты...</div>
      ) : entries.length === 0 ? (
        <div className="ec-memory-view__empty">
          <strong>{listState === "active" ? "Здесь пока нет проверенных записей" : "Архив пуст"}</strong>
          <p>{listState === "active" ? "Сохраните решение, риск или важный факт. Система сама подскажет, когда запись пора проверить." : "Архивированные записи останутся здесь и смогут вернуться в работу одним действием."}</p>
        </div>
      ) : (
        <div className="ec-memory-list">
          {entries.map((entry) => {
            const kindMeta = KIND_META[entry.kind];
            const statusMeta = STATUS_META[entry.lifecycle.status];
            return (
              <article key={entry.id} className={`ec-memory-card ec-memory-card--${statusMeta.tone}`}>
                <div className="ec-memory-card__topline">
                  <span className={`ec-memory-card__kind ec-memory-card__kind--${kindMeta.tone}`}>{kindMeta.label}</span>
                  <span className={`ec-memory-card__status ec-memory-card__status--${statusMeta.tone}`}>{statusMeta.label}</span>
                </div>
                <strong className="ec-memory-card__title">{entry.title}</strong>
                {entry.content && <p className="ec-memory-card__content">{entry.content}</p>}
                <div className="ec-memory-card__context">
                  <span className="ec-memory-context__signal" aria-hidden />
                  <span>{entry.lifecycle.contextReason}</span>
                </div>
                {entry.tags.length > 0 && <div className="ec-memory-card__tags">{entry.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>}
                <footer className="ec-memory-card__footer">
                  <div>
                    <span>Владелец: {entry.owner.displayName}</span>
                    <span>{entry.visibility === "WORKSPACE" ? "Всё пространство" : `Комната ${entry.channel?.name ?? ""}`}</span>
                    <span>Проверить: {formatDate(entry.reviewDueAt)}</span>
                  </div>
                  <button type="button" className="ec-btn" onClick={() => setSelectedId(entry.id)}>
                    {entry.permissions.canEdit || entry.permissions.canRestore ? "Управлять записью" : "Подробнее о записи"}
                  </button>
                </footer>
              </article>
            );
          })}
        </div>
      )}

      {listState === "active" && items.length > 0 && (
        <section className="ec-memory-pins">
          <strong>Закреплённые сообщения</strong>
          {items.map((item) => <article key={item.id}><span>{item.user.displayName}</span><p>{item.content || "[вложение без текста]"}</p></article>)}
        </section>
      )}

      {selected && (
        <MemoryEditor
          key={`${selected.id}:${selected.updatedAt}`}
          entry={selected}
          owners={owners}
          busy={mutatingId === selected.id}
          error={error}
          onClose={() => setSelectedId(null)}
          onUpdate={onUpdate}
          onReview={onReview}
          onArchive={onArchive}
          onRestore={onRestore}
        />
      )}
    </div>
  );
}
