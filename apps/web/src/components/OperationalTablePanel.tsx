import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiJson } from "../lib/api";
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
  /** v0.75 #10 phase 2.5b: список таблиц активного сервера — для RELATION
   *  picker'а в AddFieldForm. Empty array = «нет таблиц для связи». */
  availableTables?: Array<{ id: string; name: string }>;
  /** v0.90 #10 phase 4: открыть ActionItemDrawer (для linked rows). Если
   *  undefined — badge всё равно показывается, но click — noop. */
  onOpenLinkedAction?: (actionItemId: string, channelId: string) => void;
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
  // v1.1.12: position:relative для .ec-server-header-edge::after
  position: "relative",
  background: "hsl(210 25% 4% / 0.55)",
};

const titleInput: CSSProperties = {
  flex: 1,
  background: "transparent",
  border: 0,
  color: "var(--ec-text-strong)",
  fontSize: "var(--ec-text-lg)",
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  fontFamily: "var(--ec-font-display, var(--ec-font-sans))",
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
  fontWeight: 700,
  fontSize: "0.6rem",
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  fontFamily: "var(--ec-font-mono, ui-monospace, monospace)",
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
  RELATION: "Связь",
  FILE: "Файл",
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
  availableTables,
  onOpenLinkedAction,
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
    reorderFields,
    reorderRows,
    loadRelatedRows,
    uploadFiles,
  } = useOperationalTable(tableId, socket);

  const [nameDraft, setNameDraft] = useState("");
  const [showFieldForm, setShowFieldForm] = useState(false);
  // v0.70: drag-and-drop state. Один на каждый axis (поля / строки) —
  // нельзя drag одновременно field+row, но они независимы visually.
  const [dragFieldId, setDragFieldId] = useState<string | null>(null);
  const [dropFieldTarget, setDropFieldTarget] = useState<string | null>(null);
  const [dragRowId, setDragRowId] = useState<string | null>(null);
  const [dropRowTarget, setDropRowTarget] = useState<string | null>(null);

  // v0.70: всегда sorted by position на render — realtime emit'ы могут
  // прислать field/row updates в произвольном порядке.
  const sortedFields = useMemo(
    () => (table ? [...table.fields].sort((a, b) => a.position - b.position) : []),
    [table?.fields],
  );
  const sortedRows = useMemo(
    () => (table ? [...table.rows].sort((a, b) => a.position - b.position) : []),
    [table?.rows],
  );

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
      <header className="ec-server-header-edge" style={header}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ec-accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ filter: "drop-shadow(0 0 4px hsl(195 70% 60% / 0.4))" }}>
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
          onSubmit={async (name, type, options, linkedTableId) => {
            const ok = await addField(name, type, options, linkedTableId);
            if (ok) setShowFieldForm(false);
          }}
          onCancel={() => setShowFieldForm(false)}
          availableTables={availableTables}
        />
      )}

      <div className="ec-op-table-scroll" style={bodyScroll}>
        {error && (
          <p style={{ color: "var(--ec-danger)", margin: "0 0 var(--ec-space-2)" }}>
            {error}
          </p>
        )}
        <table style={tableStyle}>
          <thead>
            <tr>
              {/* v0.70: row-drag-handle column placeholder в thead */}
              <th style={{ ...thStyle, width: 28 }} aria-hidden />
              {sortedFields.map((field) => (
                <FieldHeader
                  key={field.id}
                  field={field}
                  dragging={dragFieldId === field.id}
                  dropTarget={dropFieldTarget === field.id}
                  onRename={(name) => void updateField(field.id, { name })}
                  onUpdateOptions={(options) => void updateField(field.id, { options })}
                  onRemove={() => void removeField(field.id)}
                  onDragStart={() => setDragFieldId(field.id)}
                  onDragEnter={() => {
                    if (dragFieldId && dragFieldId !== field.id) {
                      setDropFieldTarget(field.id);
                    }
                  }}
                  onDragEnd={() => {
                    if (dragFieldId && dropFieldTarget && dragFieldId !== dropFieldTarget) {
                      // v0.70: построить новый порядок ids перемещая dragFieldId
                      // на позицию dropFieldTarget.
                      const ids = sortedFields.map((f) => f.id);
                      const from = ids.indexOf(dragFieldId);
                      const to = ids.indexOf(dropFieldTarget);
                      if (from >= 0 && to >= 0 && from !== to) {
                        ids.splice(from, 1);
                        ids.splice(to, 0, dragFieldId);
                        void reorderFields(ids);
                      }
                    }
                    setDragFieldId(null);
                    setDropFieldTarget(null);
                  }}
                />
              ))}
              {sortedFields.length === 0 && (
                <th style={thStyle}>
                  Добавьте колонку →
                </th>
              )}
              <th style={{ ...thStyle, width: 32 }} aria-label="actions" />
            </tr>
          </thead>
          <tbody>
            {sortedRows.length === 0 ? (
              <tr>
                <td
                  colSpan={Math.max(1, sortedFields.length + 2)}
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
              sortedRows.map((row) => (
                <RowEditor
                  key={row.id}
                  tableId={table.id}
                  row={row}
                  fields={sortedFields}
                  members={members}
                  loadRelatedRows={loadRelatedRows}
                  uploadFiles={uploadFiles}
                  dragging={dragRowId === row.id}
                  dropTarget={dropRowTarget === row.id}
                  onSave={(cells) => void updateRow(row.id, cells)}
                  onRemove={() => void removeRow(row.id)}
                  onOpenLinkedAction={onOpenLinkedAction}
                  onDragStart={() => setDragRowId(row.id)}
                  onDragEnter={() => {
                    if (dragRowId && dragRowId !== row.id) {
                      setDropRowTarget(row.id);
                    }
                  }}
                  onDragEnd={() => {
                    if (dragRowId && dropRowTarget && dragRowId !== dropRowTarget) {
                      const ids = sortedRows.map((r) => r.id);
                      const from = ids.indexOf(dragRowId);
                      const to = ids.indexOf(dropRowTarget);
                      if (from >= 0 && to >= 0 && from !== to) {
                        ids.splice(from, 1);
                        ids.splice(to, 0, dragRowId);
                        void reorderRows(ids);
                      }
                    }
                    setDragRowId(null);
                    setDropRowTarget(null);
                  }}
                />
              ))
            )}
          </tbody>
          {/* v0.87 #10 phase 3: aggregations footer для NUMBER колонок. */}
          {table.aggregations.length > 0 && sortedRows.length > 0 && (
            <tfoot>
              <tr>
                <th
                  scope="row"
                  style={{
                    ...tdStyle,
                    fontWeight: 700,
                    color: "var(--ec-text-dim)",
                    fontSize: "var(--ec-text-2xs)",
                    letterSpacing: "var(--ec-tracking-caps)",
                    textTransform: "uppercase",
                    background: "var(--ec-surface-1)",
                    borderTop: "1px solid var(--ec-border-subtle)",
                  }}
                >
                  Итого
                </th>
                {sortedFields.map((field) => {
                  const agg = table.aggregations.find(
                    (a) => a.fieldId === field.id,
                  );
                  if (!agg || field.type !== "NUMBER") {
                    return (
                      <td
                        key={field.id}
                        style={{
                          ...tdStyle,
                          background: "var(--ec-surface-1)",
                          borderTop: "1px solid var(--ec-border-subtle)",
                        }}
                      />
                    );
                  }
                  return (
                    <td
                      key={field.id}
                      style={{
                        ...tdStyle,
                        background: "var(--ec-surface-1)",
                        borderTop: "1px solid var(--ec-border-subtle)",
                        fontFeatureSettings: '"tnum"',
                        fontSize: "var(--ec-text-xs)",
                      }}
                      title={`SUM ${agg.sum.toLocaleString("ru-RU")} · AVG ${
                        agg.avg !== null ? agg.avg.toFixed(2) : "—"
                      } · MIN ${agg.min ?? "—"} · MAX ${agg.max ?? "—"} · COUNT ${agg.count}`}
                    >
                      <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                        <strong style={{ color: "var(--ec-text-strong)" }}>
                          Σ {agg.sum.toLocaleString("ru-RU")}
                        </strong>
                        <span
                          style={{
                            color: "var(--ec-text-dim)",
                            fontSize: "var(--ec-text-2xs)",
                          }}
                        >
                          ⌀ {agg.avg !== null ? agg.avg.toFixed(2) : "—"} · {agg.count}{" "}
                          из {sortedRows.length}
                        </span>
                      </div>
                    </td>
                  );
                })}
                <td
                  style={{
                    ...tdStyle,
                    background: "var(--ec-surface-1)",
                    borderTop: "1px solid var(--ec-border-subtle)",
                  }}
                />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

function FieldHeader({
  field,
  dragging,
  dropTarget,
  onRename,
  onUpdateOptions,
  onRemove,
  onDragStart,
  onDragEnter,
  onDragEnd,
}: {
  field: TableField;
  dragging: boolean;
  dropTarget: boolean;
  onRename: (name: string) => void;
  onUpdateOptions: (options: string[] | null) => void;
  onRemove: () => void;
  onDragStart: () => void;
  onDragEnter: () => void;
  onDragEnd: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(field.name);

  useEffect(() => setDraft(field.name), [field.id, field.name]);

  return (
    <th
      style={{
        ...thStyle,
        opacity: dragging ? 0.4 : 1,
        boxShadow: dropTarget
          ? "inset 3px 0 0 0 var(--ec-accent)"
          : undefined,
        transition: "opacity var(--ec-dur-fast) var(--ec-ease)",
      }}
      draggable={!editing}
      onDragStart={(e) => {
        // editable input swallows drag — этот path только для th в idle.
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", field.id);
        onDragStart();
      }}
      onDragEnter={onDragEnter}
      onDragOver={(e) => {
        // allow drop
        if (dragging) return;
        e.preventDefault();
      }}
      onDragEnd={onDragEnd}
      onDrop={(e) => {
        e.preventDefault();
        onDragEnd();
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {/* v0.70: drag handle visual hint — pure CSS, no logic */}
        <span
          aria-hidden
          title="Тяни чтобы поменять порядок колонок"
          style={{
            color: "var(--ec-text-faint)",
            fontSize: "0.7rem",
            cursor: "grab",
            userSelect: "none",
            letterSpacing: "-2px",
            marginRight: 2,
          }}
        >
          ⋮⋮
        </span>
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
  tableId,
  row,
  fields,
  members,
  loadRelatedRows,
  uploadFiles,
  dragging,
  dropTarget,
  onSave,
  onRemove,
  onDragStart,
  onDragEnter,
  onDragEnd,
  onOpenLinkedAction,
}: {
  /** v0.87 #10 phase 3: для AI-fill endpoint. */
  tableId: string;
  row: TableRowType;
  fields: TableField[];
  members: Array<{
    userId: string;
    user: { displayName: string; avatar: string | null };
  }>;
  loadRelatedRows?: (fieldId: string) => Promise<{
    linkedTableId: string;
    displayFieldName: string | null;
    rows: Array<{ id: string; display: string }>;
  } | null>;
  uploadFiles?: (files: File[]) => Promise<
    Array<{ url: string; filename: string; mimeType: string; size: number }>
    | null
  >;
  dragging: boolean;
  dropTarget: boolean;
  onSave: (cells: Array<{ fieldId: string; value: string }>) => void;
  onRemove: () => void;
  onDragStart: () => void;
  onDragEnter: () => void;
  onDragEnd: () => void;
  /** v0.90 #10 phase 4: открыть ActionItemDrawer для linked row'а. */
  onOpenLinkedAction?: (actionItemId: string, channelId: string) => void;
}) {
  // v0.87 #10 phase 3: AI-fill state.
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  // v0.90 #10 phase 4: row → action conversion state.
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
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
    <tr
      style={{
        opacity: dragging ? 0.4 : 1,
        boxShadow: dropTarget
          ? "inset 0 3px 0 0 var(--ec-accent)"
          : undefined,
        transition: "opacity var(--ec-dur-fast) var(--ec-ease)",
      }}
      onDragEnter={onDragEnter}
      onDragOver={(e) => {
        if (dragging) return;
        e.preventDefault();
      }}
      onDrop={(e) => {
        e.preventDefault();
        onDragEnd();
      }}
    >
      {/* v0.70: drag handle column — initiate row reorder by dragging it. */}
      <td
        style={{
          ...tdStyle,
          width: 28,
          textAlign: "center",
          verticalAlign: "middle",
          cursor: "grab",
          color: "var(--ec-text-faint)",
          userSelect: "none",
          padding: "var(--ec-space-2) 0",
        }}
        draggable
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("text/plain", row.id);
          onDragStart();
        }}
        onDragEnd={onDragEnd}
        title="Тяни чтобы поменять порядок строк"
        aria-label="Перетащить строку"
      >
        ⋮⋮
      </td>
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
            loadRelatedRows={loadRelatedRows}
            uploadFiles={uploadFiles}
          />
        </td>
      ))}
      <td style={{ ...tdStyle, width: 56, textAlign: "center", verticalAlign: "middle", padding: "var(--ec-space-1) 0" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 2, alignItems: "center" }}>
          {/* v0.87 #10 phase 3: AI-fill row button. Видна если есть пустые
              fillable cells (TEXT/NUMBER/STATUS/DATE/CHECKBOX). */}
          {(() => {
            const fillableEmpty = fields.some(
              (f) =>
                ["TEXT", "NUMBER", "STATUS", "DATE", "CHECKBOX"].includes(f.type) &&
                (!cellMap.get(f.id) || cellMap.get(f.id) === ""),
            );
            if (!fillableEmpty) return null;
            return (
              <button
                type="button"
                onClick={async () => {
                  setAiBusy(true);
                  setAiError(null);
                  try {
                    const res = await apiJson<{
                      rowId: string;
                      suggestions: Array<{ fieldId: string; fieldName: string; value: string }>;
                    }>(
                      `/api/tables/${encodeURIComponent(tableId)}/rows/${encodeURIComponent(row.id)}/ai-fill`,
                      { method: "POST" },
                    );
                    if (res.suggestions.length === 0) {
                      setAiError("AI ничего не предложил");
                      return;
                    }
                    // Auto-apply suggestions через onSave (PATCH row через batch).
                    onSave(
                      res.suggestions.map((s) => ({
                        fieldId: s.fieldId,
                        value: s.value,
                      })),
                    );
                  } catch (e) {
                    const msg = e instanceof Error ? e.message : "AI ошибка";
                    setAiError(msg);
                    window.setTimeout(() => setAiError(null), 4000);
                  } finally {
                    setAiBusy(false);
                  }
                }}
                disabled={aiBusy}
                title={aiError ?? "Заполнить пустые ячейки через AI"}
                aria-label="AI заполнить"
                style={{
                  background: "transparent",
                  border: "1px solid var(--ec-border-subtle)",
                  color: aiError
                    ? "var(--ec-danger)"
                    : aiBusy
                      ? "var(--ec-accent)"
                      : "var(--ec-text-dim)",
                  cursor: aiBusy ? "wait" : "pointer",
                  fontSize: "0.7rem",
                  padding: "0.18rem 0.42rem",
                  borderRadius: "var(--ec-radius-xs)",
                  lineHeight: 1,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 3,
                }}
              >
                {aiBusy ? (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                    <circle cx="12" cy="12" r="9" opacity="0.3" />
                    <path d="M12 3a9 9 0 0 1 9 9" />
                  </svg>
                ) : (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
                    <path d="M13 2L3 14h7l-2 8 10-12h-7l2-8z" strokeLinejoin="round" />
                  </svg>
                )}
                AI
              </button>
            );
          })()}
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
              padding: "0.18rem 0.4rem",
            }}
          >
            ×
          </button>
          {/* v0.90 #10 phase 4: «→ Задача» button (если row не linked) или
              status badge (если linked). */}
          {row.linkedAction ? (
            <button
              type="button"
              onClick={() => onOpenLinkedAction?.(row.linkedAction!.id, row.linkedAction!.channelId)}
              title={`Задача: ${row.linkedAction.title} · ${TASK_STATUS_RU[row.linkedAction.status]}`}
              style={{
                background: TASK_STATUS_TONE[row.linkedAction.status].bg,
                border: `1px solid ${TASK_STATUS_TONE[row.linkedAction.status].border}`,
                color: TASK_STATUS_TONE[row.linkedAction.status].fg,
                cursor: "pointer",
                fontSize: "0.62rem",
                fontWeight: 700,
                letterSpacing: "var(--ec-tracking-wide)",
                textTransform: "uppercase",
                padding: "0.14rem 0.42rem",
                borderRadius: "var(--ec-radius-xs)",
                lineHeight: 1.1,
                display: "inline-flex",
                alignItems: "center",
                gap: 3,
              }}
            >
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden>
                <path d="M9 11l3 3L22 4" />
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
              </svg>
              {TASK_STATUS_SHORT[row.linkedAction.status]}
            </button>
          ) : (
            <button
              type="button"
              onClick={async () => {
                setActionBusy(true);
                setActionError(null);
                try {
                  await apiJson(
                    `/api/tables/${encodeURIComponent(tableId)}/rows/${encodeURIComponent(row.id)}/to-action`,
                    { method: "POST", body: JSON.stringify({}) },
                  );
                  // Socket emit table:row:updated прилетит и обновит state.
                } catch (e) {
                  const msg = e instanceof Error ? e.message : "Не удалось";
                  setActionError(msg);
                  window.setTimeout(() => setActionError(null), 4000);
                } finally {
                  setActionBusy(false);
                }
              }}
              disabled={actionBusy}
              title={actionError ?? "Создать задачу из этой строки"}
              style={{
                background: "transparent",
                border: "1px solid var(--ec-border-subtle)",
                color: actionError
                  ? "var(--ec-danger)"
                  : actionBusy
                    ? "var(--ec-accent)"
                    : "var(--ec-text-dim)",
                cursor: actionBusy ? "wait" : "pointer",
                fontSize: "0.62rem",
                fontWeight: 700,
                letterSpacing: "var(--ec-tracking-wide)",
                textTransform: "uppercase",
                padding: "0.14rem 0.42rem",
                borderRadius: "var(--ec-radius-xs)",
                lineHeight: 1.1,
                display: "inline-flex",
                alignItems: "center",
                gap: 3,
              }}
            >
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden>
                <path d="M9 11l3 3L22 4" />
              </svg>
              → задача
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

const TASK_STATUS_TONE: Record<
  "OPEN" | "IN_PROGRESS" | "REVIEW" | "DONE",
  { bg: string; border: string; fg: string }
> = {
  OPEN: {
    bg: "hsl(200 30% 16% / 0.5)",
    border: "hsl(200 40% 35% / 0.4)",
    fg: "hsl(200 70% 75%)",
  },
  IN_PROGRESS: {
    bg: "hsl(36 50% 18% / 0.5)",
    border: "hsl(36 60% 40% / 0.4)",
    fg: "hsl(36 80% 75%)",
  },
  REVIEW: {
    bg: "hsl(280 30% 18% / 0.5)",
    border: "hsl(280 50% 40% / 0.4)",
    fg: "hsl(280 60% 75%)",
  },
  DONE: {
    bg: "hsl(150 30% 14% / 0.5)",
    border: "hsl(150 50% 35% / 0.4)",
    fg: "hsl(150 60% 75%)",
  },
};

const TASK_STATUS_RU: Record<"OPEN" | "IN_PROGRESS" | "REVIEW" | "DONE", string> = {
  OPEN: "Открыто",
  IN_PROGRESS: "В работе",
  REVIEW: "На ревью",
  DONE: "Завершено",
};

const TASK_STATUS_SHORT: Record<"OPEN" | "IN_PROGRESS" | "REVIEW" | "DONE", string> = {
  OPEN: "open",
  IN_PROGRESS: "work",
  REVIEW: "rev",
  DONE: "done",
};

function CellEditor({
  field,
  value,
  members,
  onChange,
  onCommit,
  loadRelatedRows,
  uploadFiles,
}: {
  field: TableField;
  value: string;
  members: Array<{
    userId: string;
    user: { displayName: string; avatar: string | null };
  }>;
  onChange: (v: string) => void;
  onCommit: (v: string) => void;
  /** v0.75 #10 phase 2.5b: RELATION/FILE editors используют. */
  loadRelatedRows?: (fieldId: string) => Promise<{
    linkedTableId: string;
    displayFieldName: string | null;
    rows: Array<{ id: string; display: string }>;
  } | null>;
  uploadFiles?: (files: File[]) => Promise<
    Array<{ url: string; filename: string; mimeType: string; size: number }>
    | null
  >;
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

  // v0.75 #10 phase 2.5b — RELATION cell
  if (field.type === "RELATION") {
    return (
      <RelationCell
        field={field}
        value={value}
        loadRelatedRows={loadRelatedRows}
        onCommit={onCommit}
      />
    );
  }

  // v0.75 #10 phase 2.5b — FILE cell
  if (field.type === "FILE") {
    return (
      <FileCell value={value} onCommit={onCommit} uploadFiles={uploadFiles} />
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
  availableTables,
}: {
  onSubmit: (
    name: string,
    type: TableFieldType,
    options?: string[],
    linkedTableId?: string,
  ) => Promise<void>;
  onCancel: () => void;
  /** v0.75 #10 phase 2.5b: список доступных таблиц для RELATION picker'а. */
  availableTables?: Array<{ id: string; name: string }>;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState<TableFieldType>("TEXT");
  const [optionsText, setOptionsText] = useState("");
  const [linkedTableId, setLinkedTableId] = useState("");
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
        <option value="RELATION">Связь</option>
        <option value="FILE">Файл</option>
      </select>
      {type === "RELATION" && (
        <select
          value={linkedTableId}
          onChange={(e) => setLinkedTableId(e.target.value)}
          style={{
            padding: "0.4rem 0.6rem",
            background: "var(--ec-input-bg)",
            border: "1px solid var(--ec-border-default)",
            borderRadius: "var(--ec-radius-sm)",
            color: linkedTableId ? "var(--ec-text)" : "var(--ec-text-dim)",
            fontSize: "var(--ec-text-sm)",
            minWidth: 200,
          }}
        >
          <option value="">— Выберите таблицу —</option>
          {(availableTables ?? []).map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      )}
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
          if (type === "RELATION" && !linkedTableId) return;
          setBusy(true);
          const options =
            type === "STATUS"
              ? optionsText
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean)
              : undefined;
          await onSubmit(
            trimmed,
            type,
            options,
            type === "RELATION" ? linkedTableId : undefined,
          );
          setBusy(false);
        }}
        disabled={
          busy || !name.trim() || (type === "RELATION" && !linkedTableId)
        }
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

/* ============================================================
 * v0.75 #10 phase 2.5b — RelationCell + FileCell editors
 * ============================================================ */

type TableFileItem = {
  url: string;
  filename: string;
  mimeType: string;
  size: number;
};

function parseRelationValue(value: string): string[] {
  if (!value) return [];
  try {
    const arr = JSON.parse(value);
    return Array.isArray(arr) ? arr.filter((v) => typeof v === "string") : [];
  } catch {
    return [];
  }
}

function parseFileValue(value: string): TableFileItem[] {
  if (!value) return [];
  try {
    const arr = JSON.parse(value);
    if (!Array.isArray(arr)) return [];
    return arr.filter(
      (i): i is TableFileItem =>
        i &&
        typeof i === "object" &&
        typeof (i as { url?: unknown }).url === "string" &&
        typeof (i as { filename?: unknown }).filename === "string" &&
        typeof (i as { mimeType?: unknown }).mimeType === "string" &&
        typeof (i as { size?: unknown }).size === "number",
    );
  } catch {
    return [];
  }
}

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function RelationCell({
  field,
  value,
  loadRelatedRows,
  onCommit,
}: {
  field: TableField;
  value: string;
  loadRelatedRows?: (fieldId: string) => Promise<{
    linkedTableId: string;
    displayFieldName: string | null;
    rows: Array<{ id: string; display: string }>;
  } | null>;
  onCommit: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Array<{ id: string; display: string }> | null>(
    null,
  );
  const selectedIds = useMemo(() => new Set(parseRelationValue(value)), [value]);
  const displayMap = useMemo(() => {
    const m = new Map<string, string>();
    if (rows) {
      for (const r of rows) m.set(r.id, r.display);
    }
    return m;
  }, [rows]);

  const ensureLoaded = useCallback(async () => {
    if (rows || !loadRelatedRows) return;
    const data = await loadRelatedRows(field.id);
    if (data) setRows(data.rows);
  }, [rows, loadRelatedRows, field.id]);

  useEffect(() => {
    if (open) void ensureLoaded();
  }, [open, ensureLoaded]);

  const toggle = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else if (next.size >= 5) return; // max 5 backend hard cap
    else next.add(id);
    onCommit(next.size === 0 ? "" : JSON.stringify(Array.from(next)));
  };

  if (!field.linkedTableId) {
    return (
      <span
        style={{
          ...cellInput,
          color: "var(--ec-text-dim)",
          fontStyle: "italic",
        }}
        title="Связанная таблица была удалена"
      >
        — связь сломана —
      </span>
    );
  }

  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          ...cellInput,
          textAlign: "left",
          cursor: "pointer",
          background: "transparent",
          border: "1px solid transparent",
          color: selectedIds.size > 0 ? "var(--ec-text)" : "var(--ec-text-dim)",
          fontSize: "var(--ec-text-sm)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
        title={
          selectedIds.size > 0
            ? Array.from(selectedIds)
                .map((id) => displayMap.get(id) ?? id.slice(0, 8))
                .join(", ")
            : "Связать с рядами"
        }
      >
        {selectedIds.size === 0
          ? "+ связать"
          : selectedIds.size === 1
            ? Array.from(selectedIds)
                .map((id) => displayMap.get(id) ?? `…${id.slice(-6)}`)
                .join(", ")
            : `${selectedIds.size} связей`}
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            zIndex: 30,
            marginTop: 4,
            background: "var(--ec-surface-2)",
            border: "1px solid var(--ec-border-default)",
            borderRadius: "var(--ec-radius-md)",
            padding: "var(--ec-space-2)",
            boxShadow: "0 12px 32px -16px rgba(0,0,0,0.55)",
            minWidth: 240,
            maxHeight: 280,
            overflow: "auto",
          }}
        >
          {!rows ? (
            <div style={{ color: "var(--ec-text-dim)", padding: 6 }}>
              Загрузка…
            </div>
          ) : rows.length === 0 ? (
            <div style={{ color: "var(--ec-text-dim)", padding: 6 }}>
              Целевая таблица пустая.
            </div>
          ) : (
            rows.map((r) => {
              const checked = selectedIds.has(r.id);
              return (
                <label
                  key={r.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "0.3rem 0.5rem",
                    borderRadius: "var(--ec-radius-sm)",
                    cursor: "pointer",
                    fontSize: "var(--ec-text-sm)",
                    color: "var(--ec-text)",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "var(--ec-surface-3)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                  }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(r.id)}
                    style={{ accentColor: "var(--ec-accent)" }}
                  />
                  <span
                    style={{
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {r.display || `(пусто) #${r.id.slice(-6)}`}
                  </span>
                </label>
              );
            })
          )}
          <div
            style={{
              borderTop: "1px solid var(--ec-border-subtle)",
              marginTop: 6,
              paddingTop: 6,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: "var(--ec-text-2xs)",
              color: "var(--ec-text-dim)",
            }}
          >
            <span>{selectedIds.size}/5</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              style={{
                padding: "0.2rem 0.5rem",
                background: "transparent",
                border: "1px solid var(--ec-border-default)",
                borderRadius: "var(--ec-radius-sm)",
                color: "var(--ec-text-muted)",
                cursor: "pointer",
                fontSize: "var(--ec-text-2xs)",
              }}
            >
              Закрыть
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function FileCell({
  value,
  onCommit,
  uploadFiles,
}: {
  value: string;
  onCommit: (v: string) => void;
  uploadFiles?: (files: File[]) => Promise<TableFileItem[] | null>;
}) {
  const files = useMemo(() => parseFileValue(value), [value]);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const onSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files;
    if (!list || list.length === 0 || !uploadFiles) return;
    const arr = Array.from(list);
    const remaining = Math.max(0, 5 - files.length);
    if (remaining <= 0) return;
    const slice = arr.slice(0, remaining);
    setBusy(true);
    const uploaded = await uploadFiles(slice);
    setBusy(false);
    if (uploaded && uploaded.length > 0) {
      const next = [...files, ...uploaded].slice(0, 5);
      onCommit(next.length === 0 ? "" : JSON.stringify(next));
    }
    if (inputRef.current) inputRef.current.value = "";
  };

  const removeAt = (idx: number) => {
    const next = files.filter((_, i) => i !== idx);
    onCommit(next.length === 0 ? "" : JSON.stringify(next));
  };

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 4,
        alignItems: "center",
        padding: "0.25rem 0.4rem",
      }}
    >
      {files.map((f, i) => (
        <span
          key={`${f.url}-${i}`}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            padding: "0.1rem 0.45rem",
            borderRadius: "var(--ec-radius-full)",
            background: "var(--ec-surface-2)",
            border: "1px solid var(--ec-border-subtle)",
            fontSize: "var(--ec-text-2xs)",
            maxWidth: 200,
          }}
          title={`${f.filename} · ${fmtBytes(f.size)}`}
        >
          <a
            href={f.url}
            target="_blank"
            rel="noreferrer"
            style={{
              color: "var(--ec-text)",
              textDecoration: "none",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {f.filename}
          </a>
          <button
            type="button"
            onClick={() => removeAt(i)}
            aria-label="Удалить файл"
            style={{
              width: 16,
              height: 16,
              display: "grid",
              placeItems: "center",
              background: "transparent",
              border: 0,
              color: "var(--ec-text-dim)",
              cursor: "pointer",
              fontSize: "0.8rem",
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </span>
      ))}
      {files.length < 5 && (
        <>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy || !uploadFiles}
            style={{
              padding: "0.18rem 0.6rem",
              background: "transparent",
              border: "1px dashed var(--ec-border-default)",
              borderRadius: "var(--ec-radius-sm)",
              color: busy ? "var(--ec-text-dim)" : "var(--ec-text-muted)",
              cursor: busy ? "wait" : "pointer",
              fontSize: "var(--ec-text-2xs)",
              fontWeight: 600,
            }}
            title="Прикрепить файл (до 5 на ячейку)"
          >
            {busy ? "Загрузка…" : "+ файл"}
          </button>
          <input
            ref={inputRef}
            type="file"
            multiple
            onChange={onSelected}
            style={{ display: "none" }}
          />
        </>
      )}
    </div>
  );
}
