import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  useOperationalTable,
  type TableCell,
  type TableField,
  type TableFieldType,
  type TableRow as TableRowType,
} from "../hooks/useOperationalTables";

/**
 * Operational Table phase 1 (v0.59) — main view.
 *
 * Render: HTML <table> с inline editable cells. Каждая cell — input/select/
 * textarea в зависимости от field.type. Save on blur (debounced + batched
 * через updateRow). Без drag-reorder, без advanced filters/sort, без AI fill
 * — это foundation. Phase 2 наращивает функциональность.
 *
 * Layout: occupies main content area (где обычно chat) когда selectedTableId
 * выставлен. AppShell render conditionally.
 */

type Props = {
  tableId: string;
  onClose: () => void;
  onDelete?: () => void;
  /** v0.62 phase 2: список member'ов активного сервера — для USER-field
   *  dropdown. Empty array = UI рендерит «—» в USER cells. */
  members?: Array<{
    userId: string;
    user: { displayName: string; avatar: string | null };
  }>;
  /** v0.62: socket для realtime sync. Optional — без него поведение как
   *  в v0.59 phase 1 (manual reload). */
  socket?: import("socket.io-client").Socket | null;
};

const wrap: CSSProperties = {
  flex: 1,
  display: "flex",
  flexDirection: "column",
  minHeight: 0,
  background: "var(--ec-bg)",
};

const header: CSSProperties = {
  padding: "var(--ec-space-3) var(--ec-space-5)",
  borderBottom: "1px solid var(--ec-border-subtle)",
  display: "flex",
  alignItems: "center",
  gap: "var(--ec-space-3)",
};

const titleInput: CSSProperties = {
  flex: 1,
  background: "transparent",
  border: 0,
  color: "var(--ec-text-strong)",
  fontSize: "var(--ec-text-lg)",
  fontWeight: 600,
  outline: "none",
  padding: "0.2rem 0.4rem",
  borderRadius: "var(--ec-radius-sm)",
};

const actionBtn: CSSProperties = {
  background: "transparent",
  border: "1px solid var(--ec-border-default)",
  color: "var(--ec-text-muted)",
  padding: "0.4rem 0.75rem",
  borderRadius: "var(--ec-radius-sm)",
  fontSize: "var(--ec-text-sm)",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
};

const bodyScroll: CSSProperties = {
  flex: 1,
  overflow: "auto",
  padding: "var(--ec-space-4) var(--ec-space-5)",
};

const tableStyle: CSSProperties = {
  width: "100%",
  borderCollapse: "separate",
  borderSpacing: 0,
  fontSize: "var(--ec-text-sm)",
};

const thStyle: CSSProperties = {
  textAlign: "left",
  padding: "var(--ec-space-2) var(--ec-space-3)",
  borderBottom: "1px solid var(--ec-border-default)",
  background: "var(--ec-surface-2)",
  color: "var(--ec-text-muted)",
  fontWeight: 600,
  fontSize: "var(--ec-text-2xs)",
  letterSpacing: "var(--ec-tracking-wide)",
  textTransform: "uppercase",
  position: "sticky",
  top: 0,
  zIndex: 1,
};

const tdStyle: CSSProperties = {
  padding: 0,
  borderBottom: "1px solid var(--ec-border-subtle)",
  background: "var(--ec-surface-1)",
  verticalAlign: "top",
};

const cellInput: CSSProperties = {
  width: "100%",
  background: "transparent",
  border: 0,
  padding: "var(--ec-space-2) var(--ec-space-3)",
  color: "var(--ec-text)",
  fontSize: "var(--ec-text-sm)",
  fontFamily: "inherit",
  outline: "none",
};

const cellInputFocus: CSSProperties = {
  background: "var(--ec-input-bg)",
  boxShadow: "inset 0 0 0 1px var(--ec-accent)",
};

const TYPE_LABELS: Record<TableFieldType, string> = {
  TEXT: "Текст",
  NUMBER: "Число",
  STATUS: "Статус",
  DATE: "Дата",
  USER: "Участник",
  CHECKBOX: "Чекбокс",
};

const STATUS_COLOR_POOL = [
  "var(--ec-status-idle)",
  "var(--ec-status-exec)",
  "var(--ec-status-warn)",
  "var(--ec-accent)",
  "var(--ec-status-ai)",
  "var(--ec-status-risk, var(--ec-danger))",
];

function statusColor(value: string, options: string[] | null): string {
  if (!options) return "var(--ec-text-muted)";
  const idx = options.indexOf(value);
  if (idx < 0) return "var(--ec-text-muted)";
  return STATUS_COLOR_POOL[idx % STATUS_COLOR_POOL.length];
}

export function OperationalTablePanel({
  tableId,
  onClose,
  onDelete,
  members = [],
  socket = null,
}: Props) {
  const {
    table,
    loading,
    error,
    rename,
    addField,
    updateField,
    removeField,
    addRow,
    updateRow,
    removeRow,
  } = useOperationalTable(tableId, socket);

  const [nameDraft, setNameDraft] = useState("");
  const [showFieldForm, setShowFieldForm] = useState(false);

  useEffect(() => {
    if (table) setNameDraft(table.name);
  }, [table?.id, table?.name]);

  if (loading && !table) {
    return (
      <div style={wrap}>
        <div style={header}>
          <span style={{ color: "var(--ec-text-muted)" }}>Загружаем таблицу…</span>
        </div>
      </div>
    );
  }
  if (!table) {
    return (
      <div style={wrap}>
        <div style={header}>
          <span style={{ color: "var(--ec-danger)" }}>
            {error ?? "Таблица не найдена"}
          </span>
          <span style={{ marginLeft: "auto" }} />
          <button type="button" style={actionBtn} onClick={onClose}>
            Закрыть
          </button>
        </div>
      </div>
    );
  }

  const saveTitle = async () => {
    const trimmed = nameDraft.trim();
    if (!trimmed || trimmed === table.name) return;
    await rename(trimmed);
  };

  return (
    <div style={wrap}>
      <header style={header}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ec-accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <line x1="3" y1="9" x2="21" y2="9" />
          <line x1="9" y1="3" x2="9" y2="21" />
        </svg>
        <input
          type="text"
          value={nameDraft}
          onChange={(e) => setNameDraft(e.target.value)}
          onBlur={() => void saveTitle()}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              (e.target as HTMLInputElement).blur();
            }
          }}
          style={titleInput}
          maxLength={120}
        />
        <button
          type="button"
          style={actionBtn}
          onClick={() => setShowFieldForm((v) => !v)}
        >
          + Колонка
        </button>
        <button type="button" style={actionBtn} onClick={() => void addRow()}>
          + Строка
        </button>
        {onDelete && (
          <button
            type="button"
            style={{ ...actionBtn, borderColor: "var(--ec-danger)", color: "var(--ec-danger)" }}
            onClick={onDelete}
          >
            Удалить
          </button>
        )}
        <button type="button" style={actionBtn} onClick={onClose}>
          Закрыть
        </button>
      </header>

      {showFieldForm && (
        <AddFieldForm
          onSubmit={async (name, type, options) => {
            const ok = await addField(name, type, options);
            if (ok) setShowFieldForm(false);
          }}
          onCancel={() => setShowFieldForm(false)}
        />
      )}

      <div style={bodyScroll}>
        {error && (
          <p style={{ color: "var(--ec-danger)", margin: "0 0 var(--ec-space-2)" }}>
            {error}
          </p>
        )}
        <table style={tableStyle}>
          <thead>
            <tr>
              {table.fields.map((field) => (
                <FieldHeader
                  key={field.id}
                  field={field}
                  onRename={(name) => void updateField(field.id, { name })}
                  onUpdateOptions={(options) => void updateField(field.id, { options })}
                  onRemove={() => void removeField(field.id)}
                />
              ))}
              {table.fields.length === 0 && (
                <th style={thStyle}>
                  Добавьте колонку →
                </th>
              )}
              <th style={{ ...thStyle, width: 32 }} aria-label="actions" />
            </tr>
          </thead>
          <tbody>
            {table.rows.length === 0 ? (
              <tr>
                <td
                  colSpan={Math.max(1, table.fields.length + 1)}
                  style={{
                    padding: "var(--ec-space-5)",
                    textAlign: "center",
                    color: "var(--ec-text-dim)",
                    background: "var(--ec-surface-1)",
                  }}
                >
                  Пока пусто. Жми <strong>«+ Строка»</strong> чтобы начать
                  набивать данные.
                </td>
              </tr>
            ) : (
              table.rows.map((row) => (
                <RowEditor
                  key={row.id}
                  row={row}
                  fields={table.fields}
                  members={members}
                  onSave={(cells) => void updateRow(row.id, cells)}
                  onRemove={() => void removeRow(row.id)}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FieldHeader({
  field,
  onRename,
  onUpdateOptions,
  onRemove,
}: {
  field: TableField;
  onRename: (name: string) => void;
  onUpdateOptions: (options: string[] | null) => void;
  onRemove: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(field.name);

  useEffect(() => setDraft(field.name), [field.id, field.name]);

  return (
    <th style={thStyle}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {editing ? (
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => {
              setEditing(false);
              if (draft.trim() && draft.trim() !== field.name) onRename(draft.trim());
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                (e.target as HTMLInputElement).blur();
              } else if (e.key === "Escape") {
                setDraft(field.name);
                setEditing(false);
              }
            }}
            autoFocus
            style={{
              ...cellInput,
              padding: "0.15rem 0.35rem",
              fontSize: "var(--ec-text-2xs)",
              color: "var(--ec-text-strong)",
            }}
            maxLength={80}
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            style={{
              background: "transparent",
              border: 0,
              color: "var(--ec-text-strong)",
              fontSize: "var(--ec-text-2xs)",
              fontWeight: 700,
              letterSpacing: "var(--ec-tracking-caps)",
              textTransform: "uppercase",
              cursor: "pointer",
              padding: 0,
            }}
          >
            {field.name}
          </button>
        )}
        <span
          style={{
            fontSize: "0.55rem",
            color: "var(--ec-text-dim)",
            fontWeight: 500,
            padding: "0.1rem 0.4rem",
            borderRadius: "var(--ec-radius-xs)",
            background: "var(--ec-surface-3)",
            textTransform: "uppercase",
            letterSpacing: "0.04em",
          }}
        >
          {TYPE_LABELS[field.type]}
        </span>
        <span style={{ marginLeft: "auto" }} />
        {field.type === "STATUS" && (
          <button
            type="button"
            onClick={() => {
              const next = prompt(
                "Список значений через запятую",
                (field.options ?? []).join(", "),
              );
              if (next == null) return;
              const parsed = next
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean);
              onUpdateOptions(parsed.length > 0 ? parsed : null);
            }}
            title="Изменить набор значений"
            style={{
              background: "transparent",
              border: 0,
              color: "var(--ec-text-dim)",
              cursor: "pointer",
              padding: 0,
              fontSize: "0.7rem",
            }}
          >
            ⚙
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            if (window.confirm(`Удалить колонку «${field.name}»?`)) onRemove();
          }}
          title="Удалить колонку"
          style={{
            background: "transparent",
            border: 0,
            color: "var(--ec-text-dim)",
            cursor: "pointer",
            padding: 0,
            fontSize: "0.85rem",
          }}
        >
          ×
        </button>
      </div>
    </th>
  );
}

function RowEditor({
  row,
  fields,
  members,
  onSave,
  onRemove,
}: {
  row: TableRowType;
  fields: TableField[];
  members: Array<{
    userId: string;
    user: { displayName: string; avatar: string | null };
  }>;
  onSave: (cells: Array<{ fieldId: string; value: string }>) => void;
  onRemove: () => void;
}) {
  // Local draft per field. Save on blur.
  const cellMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of row.cells) m.set(c.fieldId, c.value);
    return m;
  }, [row.cells]);

  const [drafts, setDrafts] = useState<Record<string, string>>({});

  // Sync drafts when row.cells changes externally.
  useEffect(() => {
    const next: Record<string, string> = {};
    for (const c of row.cells) next[c.fieldId] = c.value;
    setDrafts(next);
  }, [row.id, row.updatedAt]);

  const saveSingle = (fieldId: string, value: string) => {
    const original = cellMap.get(fieldId) ?? "";
    if (original === value) return;
    onSave([{ fieldId, value }]);
  };

  return (
    <tr>
      {fields.map((field) => (
        <td key={field.id} style={tdStyle}>
          <CellEditor
            field={field}
            value={drafts[field.id] ?? ""}
            members={members}
            onChange={(v) =>
              setDrafts((prev) => ({ ...prev, [field.id]: v }))
            }
            onCommit={(v) => saveSingle(field.id, v)}
          />
        </td>
      ))}
      <td style={{ ...tdStyle, width: 32, textAlign: "center", verticalAlign: "middle" }}>
        <button
          type="button"
          onClick={() => {
            if (window.confirm("Удалить строку?")) onRemove();
          }}
          title="Удалить строку"
          style={{
            background: "transparent",
            border: 0,
            color: "var(--ec-text-dim)",
            cursor: "pointer",
            fontSize: "0.95rem",
            padding: "0.25rem 0.4rem",
          }}
        >
          ×
        </button>
      </td>
    </tr>
  );
}

function CellEditor({
  field,
  value,
  members,
  onChange,
  onCommit,
}: {
  field: TableField;
  value: string;
  members: Array<{
    userId: string;
    user: { displayName: string; avatar: string | null };
  }>;
  onChange: (v: string) => void;
  onCommit: (v: string) => void;
}) {
  const [focused, setFocused] = useState(false);

  if (field.type === "CHECKBOX") {
    const checked = value === "true";
    return (
      <label
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "var(--ec-space-2) var(--ec-space-3)",
          cursor: "pointer",
        }}
      >
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => {
            const next = e.target.checked ? "true" : "false";
            onChange(next);
            onCommit(next);
          }}
          style={{
            width: 16,
            height: 16,
            accentColor: "var(--ec-accent)",
            cursor: "pointer",
          }}
        />
      </label>
    );
  }

  if (field.type === "USER") {
    return (
      <select
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          onCommit(e.target.value);
        }}
        style={{
          ...cellInput,
          ...(focused ? cellInputFocus : null),
          color: value ? "var(--ec-text-strong)" : "var(--ec-text-dim)",
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      >
        <option value="">— не назначен —</option>
        {members.map((m) => (
          <option key={m.userId} value={m.userId}>
            {m.user.displayName}
          </option>
        ))}
      </select>
    );
  }

  if (field.type === "STATUS") {
    const options = field.options ?? [];
    const color = statusColor(value, field.options);
    return (
      <select
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          onCommit(e.target.value);
        }}
        style={{
          ...cellInput,
          ...(focused ? cellInputFocus : null),
          color,
          fontWeight: value ? 600 : 400,
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      >
        <option value="">—</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    );
  }

  if (field.type === "DATE") {
    return (
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={(e) => {
          setFocused(false);
          onCommit(e.target.value);
        }}
        onFocus={() => setFocused(true)}
        style={{ ...cellInput, ...(focused ? cellInputFocus : null) }}
      />
    );
  }

  if (field.type === "NUMBER") {
    return (
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={(e) => {
          setFocused(false);
          onCommit(e.target.value);
        }}
        onFocus={() => setFocused(true)}
        style={{
          ...cellInput,
          ...(focused ? cellInputFocus : null),
          fontFamily: "var(--ec-font-mono)",
          textAlign: "right",
        }}
      />
    );
  }

  // TEXT
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={(e) => {
        setFocused(false);
        onCommit(e.target.value);
      }}
      onFocus={() => setFocused(true)}
      style={{ ...cellInput, ...(focused ? cellInputFocus : null) }}
    />
  );
}

function AddFieldForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (name: string, type: TableFieldType, options?: string[]) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState<TableFieldType>("TEXT");
  const [optionsText, setOptionsText] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <div
      style={{
        padding: "var(--ec-space-3) var(--ec-space-5)",
        background: "var(--ec-surface-2)",
        borderBottom: "1px solid var(--ec-border-subtle)",
        display: "flex",
        gap: "var(--ec-space-2)",
        alignItems: "center",
        flexWrap: "wrap",
      }}
    >
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Название колонки"
        maxLength={80}
        autoFocus
        style={{
          padding: "0.4rem 0.6rem",
          background: "var(--ec-input-bg)",
          border: "1px solid var(--ec-border-default)",
          borderRadius: "var(--ec-radius-sm)",
          color: "var(--ec-text)",
          fontSize: "var(--ec-text-sm)",
          minWidth: 200,
        }}
      />
      <select
        value={type}
        onChange={(e) => setType(e.target.value as TableFieldType)}
        style={{
          padding: "0.4rem 0.6rem",
          background: "var(--ec-input-bg)",
          border: "1px solid var(--ec-border-default)",
          borderRadius: "var(--ec-radius-sm)",
          color: "var(--ec-text)",
          fontSize: "var(--ec-text-sm)",
        }}
      >
        <option value="TEXT">Текст</option>
        <option value="NUMBER">Число</option>
        <option value="STATUS">Статус</option>
        <option value="DATE">Дата</option>
        <option value="USER">Участник</option>
        <option value="CHECKBOX">Чекбокс</option>
      </select>
      {type === "STATUS" && (
        <input
          type="text"
          value={optionsText}
          onChange={(e) => setOptionsText(e.target.value)}
          placeholder="Значения через запятую (TODO, IN PROGRESS, DONE)"
          style={{
            padding: "0.4rem 0.6rem",
            background: "var(--ec-input-bg)",
            border: "1px solid var(--ec-border-default)",
            borderRadius: "var(--ec-radius-sm)",
            color: "var(--ec-text)",
            fontSize: "var(--ec-text-sm)",
            flex: 1,
            minWidth: 240,
          }}
        />
      )}
      <button
        type="button"
        onClick={async () => {
          const trimmed = name.trim();
          if (!trimmed) return;
          setBusy(true);
          const options =
            type === "STATUS"
              ? optionsText
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean)
              : undefined;
          await onSubmit(trimmed, type, options);
          setBusy(false);
        }}
        disabled={busy || !name.trim()}
        style={{
          padding: "0.4rem 0.9rem",
          background: "var(--ec-accent)",
          color: "var(--ec-accent-text, #fff)",
          border: "1px solid var(--ec-accent)",
          borderRadius: "var(--ec-radius-sm)",
          fontSize: "var(--ec-text-sm)",
          fontWeight: 600,
          cursor: busy ? "not-allowed" : "pointer",
          opacity: !name.trim() ? 0.55 : 1,
        }}
      >
        {busy ? "Создаём…" : "Добавить"}
      </button>
      <button
        type="button"
        onClick={onCancel}
        style={{
          padding: "0.4rem 0.9rem",
          background: "transparent",
          color: "var(--ec-text-muted)",
          border: "1px solid var(--ec-border-default)",
          borderRadius: "var(--ec-radius-sm)",
          fontSize: "var(--ec-text-sm)",
          cursor: "pointer",
        }}
      >
        Отмена
      </button>
    </div>
  );
}

// Helper экспорт TableCell для дальнейших импортов (если понадобится).
export type { TableCell };
