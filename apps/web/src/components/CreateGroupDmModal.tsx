import type { CSSProperties } from "react";
import { useMemo, useState } from "react";
import { Avatar } from "./Avatar";
import { Modal } from "./Modal";

/**
 * Создание group DM (v0.52). Multi-select participant picker + опциональное
 * имя группы. Caller передаёт `availableUsers` — обычно member'ов активного
 * сервера, либо union (calling AppShell решает). Submit вызывает
 * `onCreate(memberUserIds, name?)` — caller отвечает за вызов
 * `createGroupDm(...)` хука.
 *
 * UX:
 *   - Если выбрано < 2 — submit disabled (нужно ≥3 в group: я + 2 других).
 *   - Чипы выбранных — clickable to remove.
 *   - Search — простой substring match по displayName.
 *   - Name optional — placeholder намекает что можно оставить пустым,
 *     UI auto-derive из participants list.
 */

export type AvailableUser = {
  id: string;
  displayName: string;
  avatar: string | null;
};

type Props = {
  availableUsers: AvailableUser[];
  /** Текущий пользователь — exclude из picker (creator добавится backend'ом). */
  currentUserId: string;
  onClose: () => void;
  onCreate: (memberUserIds: string[], name?: string) => Promise<string | null>;
};

const searchInput: CSSProperties = {
  width: "100%",
  padding: "var(--ec-space-2) var(--ec-space-3)",
  background: "var(--ec-input-bg)",
  border: "1px solid var(--ec-border-default)",
  borderRadius: "var(--ec-radius-md)",
  color: "var(--ec-text)",
  fontSize: "var(--ec-text-sm)",
  outline: "none",
};

const chipRow: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 6,
  marginTop: "var(--ec-space-2)",
};

const chip: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "3px 8px 3px 4px",
  borderRadius: "var(--ec-radius-full)",
  background: "var(--ec-accent-soft)",
  color: "var(--ec-accent)",
  fontSize: "var(--ec-text-xs)",
  border: "1px solid var(--ec-border-accent)",
  cursor: "pointer",
};

const listScroll: CSSProperties = {
  marginTop: "var(--ec-space-3)",
  maxHeight: 320,
  overflowY: "auto",
  display: "flex",
  flexDirection: "column",
  gap: 2,
  paddingRight: 4,
};

const userRow = (selected: boolean): CSSProperties => ({
  display: "grid",
  gridTemplateColumns: "auto 1fr auto",
  alignItems: "center",
  gap: "var(--ec-space-2)",
  padding: "var(--ec-space-2)",
  borderRadius: "var(--ec-radius-sm)",
  background: selected ? "var(--ec-accent-soft)" : "transparent",
  color: selected ? "var(--ec-text-strong)" : "var(--ec-text)",
  border: 0,
  textAlign: "left",
  cursor: "pointer",
  width: "100%",
  fontSize: "var(--ec-text-sm)",
  transition: "background var(--ec-dur-fast) var(--ec-ease)",
});

const nameInput: CSSProperties = {
  ...searchInput,
  marginTop: "var(--ec-space-3)",
};

export function CreateGroupDmModal({
  availableUsers,
  currentUserId,
  onClose,
  onCreate,
}: Props) {
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Исключаем self и применяем substring-filter. Сортируем: selected first,
  // потом alphabetical.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pool = availableUsers.filter((u) => u.id !== currentUserId);
    const matched = q
      ? pool.filter((u) => u.displayName.toLowerCase().includes(q))
      : pool;
    const selSet = new Set(selectedIds);
    return matched.slice().sort((a, b) => {
      const aSel = selSet.has(a.id);
      const bSel = selSet.has(b.id);
      if (aSel !== bSel) return aSel ? -1 : 1;
      return a.displayName.localeCompare(b.displayName, "ru");
    });
  }, [availableUsers, currentUserId, query, selectedIds]);

  const selectedUsers = useMemo(
    () =>
      selectedIds
        .map((id) => availableUsers.find((u) => u.id === id))
        .filter((u): u is AvailableUser => u != null),
    [availableUsers, selectedIds],
  );

  const toggle = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const canSubmit = selectedIds.length >= 2 && !submitting;

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    const trimmedName = name.trim() || undefined;
    const id = await onCreate(selectedIds, trimmedName);
    setSubmitting(false);
    if (id) {
      onClose();
    } else {
      setError("Не удалось создать группу. Попробуй ещё раз.");
    }
  };

  return (
    <Modal
      title="Новая группа"
      onClose={onClose}
      width={480}
      footer={
        <>
          <button type="button" className="ec-btn ec-btn--ghost" onClick={onClose} disabled={submitting}>
            Отмена
          </button>
          <button
            type="button"
            className="ec-btn ec-btn--primary"
            onClick={submit}
            disabled={!canSubmit}
          >
            {submitting
              ? "Создаём…"
              : selectedIds.length === 0
              ? "Выбери участников"
              : selectedIds.length < 2
              ? "Минимум 2 участника"
              : `Создать (${selectedIds.length + 1})`}
          </button>
        </>
      }
    >
      <div>
        <label
          style={{
            display: "block",
            color: "var(--ec-text-muted)",
            fontSize: "var(--ec-text-xs)",
            marginBottom: 6,
          }}
        >
          Участники
        </label>
        <input
          type="search"
          placeholder="Поиск по имени…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={searchInput}
          autoFocus
        />
        {selectedUsers.length > 0 && (
          <div style={chipRow} aria-label="Выбранные участники">
            {selectedUsers.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => toggle(u.id)}
                style={chip}
                title={`Убрать ${u.displayName}`}
              >
                <Avatar url={u.avatar} name={u.displayName} size={18} />
                <span>{u.displayName}</span>
                <span aria-hidden style={{ fontSize: "0.7rem", marginLeft: 2 }}>
                  ✕
                </span>
              </button>
            ))}
          </div>
        )}
        <div style={listScroll}>
          {filtered.length === 0 && (
            <p
              style={{
                fontSize: "var(--ec-text-sm)",
                color: "var(--ec-text-dim)",
                padding: "var(--ec-space-3)",
                margin: 0,
                textAlign: "center",
              }}
            >
              {availableUsers.length <= 1
                ? "Нет других участников. Открой сервер, чтобы добавить людей в группу."
                : "Никого не найдено"}
            </p>
          )}
          {filtered.map((u) => {
            const selected = selectedIds.includes(u.id);
            return (
              <button
                key={u.id}
                type="button"
                onClick={() => toggle(u.id)}
                style={userRow(selected)}
                onMouseEnter={(e) => {
                  if (!selected) e.currentTarget.style.background = "var(--ec-surface-2)";
                }}
                onMouseLeave={(e) => {
                  if (!selected) e.currentTarget.style.background = "transparent";
                }}
              >
                <Avatar url={u.avatar} name={u.displayName} size={28} />
                <span
                  style={{
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {u.displayName}
                </span>
                <span
                  aria-hidden
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: "var(--ec-radius-xs)",
                    border: selected
                      ? "1px solid var(--ec-accent)"
                      : "1px solid var(--ec-border-default)",
                    background: selected ? "var(--ec-accent)" : "transparent",
                    color: selected ? "var(--ec-accent-text, #fff)" : "transparent",
                    display: "grid",
                    placeItems: "center",
                    fontSize: "0.7rem",
                  }}
                >
                  ✓
                </span>
              </button>
            );
          })}
        </div>

        <label
          style={{
            display: "block",
            color: "var(--ec-text-muted)",
            fontSize: "var(--ec-text-xs)",
            marginTop: "var(--ec-space-3)",
            marginBottom: 6,
          }}
        >
          Название (необязательно)
        </label>
        <input
          type="text"
          placeholder="Авто — по именам участников"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={nameInput}
          maxLength={80}
        />

        {error && (
          <p
            style={{
              marginTop: "var(--ec-space-3)",
              padding: "var(--ec-space-2)",
              background: "var(--ec-danger-soft)",
              color: "var(--ec-danger)",
              borderRadius: "var(--ec-radius-sm)",
              fontSize: "var(--ec-text-sm)",
            }}
          >
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}
