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
 * OperationalTablePanel — операционная таблица: control desk Execution
 * Cockpit, не spreadsheet-заготовка.
 *
 * v1.2.3 (R2) — переведена на cockpit-язык (`cockpit.css`,
 * `.ec-cck-*`): убраны module-level `CSSProperties`-консоли и весь
 * inline-style долг, JS-hover в RelationCell → CSS. Sticky-header,
 * column rhythm, row-hover, inline-edit-состояния — из общей системы.
 *
 * Render: HTML <table> с inline-editable cells. Save on blur через
 * updateRow. Логика (drag-reorder полей/строк, AI-fill, realtime
 * sync, RELATION/FILE) не тронута.
 */

type Props = {
  tableId: string;
  onClose: () => void;
  onDelete?: () => void;
  /** Список member'ов активного сервера — для USER-field dropdown. */
  members?: Array<{
    userId: string;
    user: { displayName: string; avatar: string | null };
  }>;
  /** socket для realtime sync. Optional — без него manual reload. */
  socket?: import("socket.io-client").Socket | null;
  /** Список таблиц активного сервера — для RELATION picker'а. */
  availableTables?: Array<{ id: string; name: string }>;
  /** Открыть ActionItemDrawer для linked rows. */
  onOpenLinkedAction?: (actionItemId: string, channelId: string) => void;
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

/** tone-токен → `--tone` (динамика — единственное, что допустимо инлайном). */
const tone = (t: string): CSSProperties => ({ "--tone": t } as CSSProperties);

const STATUS_TONE_POOL = [
  "var(--ec-status-idle)",
  "var(--ec-status-exec)",
  "var(--ec-status-warn)",
  "var(--ec-accent)",
  "var(--ec-status-ai)",
  "var(--ec-status-risk)",
];

function statusTone(value: string, options: string[] | null): string {
  if (!options) return "var(--ec-text-muted)";
  const idx = options.indexOf(value);
  if (idx < 0) return "var(--ec-text-muted)";
  return STATUS_TONE_POOL[idx % STATUS_TONE_POOL.length];
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
  const [dragFieldId, setDragFieldId] = useState<string | null>(null);
  const [dropFieldTarget, setDropFieldTarget] = useState<string | null>(null);
  const [dragRowId, setDragRowId] = useState<string | null>(null);
  const [dropRowTarget, setDropRowTarget] = useState<string | null>(null);

  // Всегда sorted by position на render — realtime emit'ы могут
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
      <div className="ec-cck">
        <div className="ec-cck__head">
          <span className="ec-cck__sub">Загружаем таблицу…</span>
        </div>
      </div>
    );
  }
  if (!table) {
    return (
      <div className="ec-cck">
        <div className="ec-cck__head">
          <span className="ec-cck__title" style={{ color: "var(--ec-danger)" }}>
            {error ?? "Таблица не найдена"}
          </span>
          <div className="ec-cck__tools ec-cck__tools--end">
            <button
              type="button"
              className="ec-btn ec-btn--ghost ec-btn--sm"
              onClick={onClose}
            >
              Закрыть
            </button>
          </div>
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
    <div className="ec-cck">
      <header className="ec-cck__head">
        <svg
          width="17"
          height="17"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--ec-accent)"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <line x1="3" y1="9" x2="21" y2="9" />
          <line x1="9" y1="3" x2="9" y2="21" />
        </svg>
        <input
          type="text"
          className="ec-cck-titlefield"
          value={nameDraft}
          onChange={(e) => setNameDraft(e.target.value)}
          onBlur={() => void saveTitle()}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              (e.target as HTMLInputElement).blur();
            }
          }}
          maxLength={120}
          aria-label="Название таблицы"
        />
        <div className="ec-cck__tools ec-cck__tools--end">
          <button
            type="button"
            className="ec-btn ec-btn--ghost ec-btn--sm"
            onClick={() => setShowFieldForm((v) => !v)}
            aria-pressed={showFieldForm}
          >
            + Колонка
          </button>
          <button
            type="button"
            className="ec-btn ec-btn--ghost ec-btn--sm"
            onClick={() => void addRow()}
          >
            + Строка
          </button>
          {onDelete && (
            <button
              type="button"
              className="ec-btn ec-btn--danger ec-btn--sm"
              onClick={onDelete}
            >
              Удалить
            </button>
          )}
          <button
            type="button"
            className="ec-btn ec-btn--ghost ec-btn--sm"
            onClick={onClose}
          >
            Закрыть
          </button>
        </div>
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

      <div className="ec-cck-table-scroll ec-op-table-scroll">
        {error && <p className="ec-cck-banner ec-cck-banner--error">{error}</p>}
        <table className="ec-cck-table">
          <thead>
            <tr>
              <th className="ec-cck-th ec-cck-th--rail" aria-hidden />
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
                <th className="ec-cck-th">Добавьте колонку →</th>
              )}
              <th className="ec-cck-th ec-cck-th--act" aria-label="Действия" />
            </tr>
          </thead>
          <tbody>
            {sortedRows.length === 0 ? (
              <tr>
                <td
                  colSpan={Math.max(1, sortedFields.length + 2)}
                  className="ec-cck-td"
                >
                  <p className="ec-cck-empty">
                    Пока пусто. Жми <strong>«+ Строка»</strong>, чтобы начать
                    набивать данные.
                  </p>
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
          {/* Aggregations footer для NUMBER колонок. */}
          {table.aggregations.length > 0 && sortedRows.length > 0 && (
            <tfoot className="ec-cck-tfoot">
              <tr>
                <th scope="row" className="ec-cck-tfoot__label" colSpan={2}>
                  Итого
                </th>
                {sortedFields.map((field, idx) => {
                  if (idx === 0) return null;
                  const agg = table.aggregations.find(
                    (a) => a.fieldId === field.id,
                  );
                  if (!agg || field.type !== "NUMBER") {
                    return <td key={field.id} />;
                  }
                  return (
                    <td
                      key={field.id}
                      title={`SUM ${agg.sum.toLocaleString("ru-RU")} · AVG ${
                        agg.avg !== null ? agg.avg.toFixed(2) : "—"
                      } · MIN ${agg.min ?? "—"} · MAX ${agg.max ?? "—"} · COUNT ${agg.count}`}
                    >
                      <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                        <span className="ec-cck-tfoot__sum">
                          Σ {agg.sum.toLocaleString("ru-RU")}
                        </span>
                        <span className="ec-cck-tfoot__meta">
                          ⌀ {agg.avg !== null ? agg.avg.toFixed(2) : "—"} ·{" "}
                          {agg.count} из {sortedRows.length}
                        </span>
                      </div>
                    </td>
                  );
                })}
                <td />
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
      className="ec-cck-th"
      data-dragging={dragging ? "true" : "false"}
      data-drop={dropTarget ? "true" : "false"}
      draggable={!editing}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", field.id);
        onDragStart();
      }}
      onDragEnter={onDragEnter}
      onDragOver={(e) => {
        if (dragging) return;
        e.preventDefault();
      }}
      onDragEnd={onDragEnd}
      onDrop={(e) => {
        e.preventDefault();
        onDragEnd();
      }}
    >
      <div className="ec-cck-fh">
        <span
          className="ec-cck-grip"
          aria-hidden
          title="Тяни, чтобы поменять порядок колонок"
          style={{ width: "auto" }}
        >
          ⋮⋮
        </span>
        {editing ? (
          <input
            className="ec-cck-cell"
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
            maxLength={80}
          />
        ) : (
          <button
            type="button"
            className="ec-cck-fh__name"
            onClick={() => setEditing(true)}
          >
            {field.name}
          </button>
        )}
        <span className="ec-cck-fh__type">{TYPE_LABELS[field.type]}</span>
        <span className="ec-cck-fh__spacer" />
        {field.type === "STATUS" && (
          <button
            type="button"
            className="ec-cck-act"
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
            aria-label="Значения статуса"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
        )}
        <button
          type="button"
          className="ec-cck-act ec-cck-act--danger"
          onClick={() => {
            if (window.confirm(`Удалить колонку «${field.name}»?`)) onRemove();
          }}
          title="Удалить колонку"
          aria-label="Удалить колонку"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </th>
  );
}

const TASK_STATUS_TONE: Record<"OPEN" | "IN_PROGRESS" | "REVIEW" | "DONE", string> = {
  OPEN: "var(--ec-status-idle)",
  IN_PROGRESS: "var(--ec-status-warn)",
  REVIEW: "var(--ec-status-ai)",
  DONE: "var(--ec-status-exec)",
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
  onOpenLinkedAction?: (actionItemId: string, channelId: string) => void;
}) {
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const cellMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of row.cells) m.set(c.fieldId, c.value);
    return m;
  }, [row.cells]);

  const [drafts, setDrafts] = useState<Record<string, string>>({});

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

  const fillableEmpty = fields.some(
    (f) =>
      ["TEXT", "NUMBER", "STATUS", "DATE", "CHECKBOX"].includes(f.type) &&
      (!cellMap.get(f.id) || cellMap.get(f.id) === ""),
  );

  return (
    <tr
      className="ec-cck-row"
      data-dragging={dragging ? "true" : "false"}
      data-drop={dropTarget ? "true" : "false"}
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
      <td
        className="ec-cck-td"
        draggable
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("text/plain", row.id);
          onDragStart();
        }}
        onDragEnd={onDragEnd}
        title="Тяни, чтобы поменять порядок строк"
        aria-label="Перетащить строку"
      >
        <span className="ec-cck-grip" aria-hidden>⋮⋮</span>
      </td>
      {fields.map((field) => (
        <td key={field.id} className="ec-cck-td">
          <CellEditor
            field={field}
            value={drafts[field.id] ?? ""}
            members={members}
            onChange={(v) => setDrafts((prev) => ({ ...prev, [field.id]: v }))}
            onCommit={(v) => saveSingle(field.id, v)}
            loadRelatedRows={loadRelatedRows}
            uploadFiles={uploadFiles}
          />
        </td>
      ))}
      <td className="ec-cck-td">
        <div className="ec-cck-rowact">
          {fillableEmpty && (
            <button
              type="button"
              className="ec-cck-rowbtn"
              data-tone={aiError ? "danger" : aiBusy ? "accent" : undefined}
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
                    setAiError("Не удалось подобрать значения");
                    return;
                  }
                  onSave(
                    res.suggestions.map((s) => ({
                      fieldId: s.fieldId,
                      value: s.value,
                    })),
                  );
                } catch (e) {
                  const msg = e instanceof Error ? e.message : "Ошибка заполнения";
                  setAiError(msg);
                  window.setTimeout(() => setAiError(null), 4000);
                } finally {
                  setAiBusy(false);
                }
              }}
              disabled={aiBusy}
              title={aiError ?? "Заполнить пустые ячейки автоматически"}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
                <path d="M13 2L3 14h7l-2 8 10-12h-7l2-8z" strokeLinejoin="round" />
              </svg>
              Авто
            </button>
          )}
          {row.linkedAction ? (
            <button
              type="button"
              className="ec-cck-rowbtn ec-cck-rowbtn--badge"
              style={tone(TASK_STATUS_TONE[row.linkedAction.status])}
              onClick={() =>
                onOpenLinkedAction?.(row.linkedAction!.id, row.linkedAction!.channelId)
              }
              title={`Задача: ${row.linkedAction.title} · ${TASK_STATUS_RU[row.linkedAction.status]}`}
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
              className="ec-cck-rowbtn"
              data-tone={actionError ? "danger" : actionBusy ? "accent" : undefined}
              onClick={async () => {
                setActionBusy(true);
                setActionError(null);
                try {
                  await apiJson(
                    `/api/tables/${encodeURIComponent(tableId)}/rows/${encodeURIComponent(row.id)}/to-action`,
                    { method: "POST", body: JSON.stringify({}) },
                  );
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
            >
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden>
                <path d="M9 11l3 3L22 4" />
              </svg>
              задача
            </button>
          )}
          <button
            type="button"
            className="ec-cck-act ec-cck-act--danger"
            onClick={() => {
              if (window.confirm("Удалить строку?")) onRemove();
            }}
            title="Удалить строку"
            aria-label="Удалить строку"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
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
  if (field.type === "CHECKBOX") {
    const checked = value === "true";
    return (
      <label className="ec-cck-cell ec-cck-cell--check">
        <input
          type="checkbox"
          className="ec-cck-checkbox"
          checked={checked}
          onChange={(e) => {
            const next = e.target.checked ? "true" : "false";
            onChange(next);
            onCommit(next);
          }}
        />
      </label>
    );
  }

  if (field.type === "USER") {
    return (
      <select
        className={"ec-cck-cell" + (value ? "" : " ec-cck-cell--ghost")}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          onCommit(e.target.value);
        }}
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
    return (
      <select
        className={"ec-cck-cell" + (value ? " ec-cck-cell--status" : " ec-cck-cell--ghost")}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          onCommit(e.target.value);
        }}
        style={value ? { color: statusTone(value, field.options) } : undefined}
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
        className="ec-cck-cell"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={(e) => onCommit(e.target.value)}
      />
    );
  }

  if (field.type === "NUMBER") {
    return (
      <input
        type="number"
        className="ec-cck-cell ec-cck-cell--num"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={(e) => onCommit(e.target.value)}
      />
    );
  }

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

  if (field.type === "FILE") {
    return (
      <FileCell value={value} onCommit={onCommit} uploadFiles={uploadFiles} />
    );
  }

  // TEXT
  return (
    <input
      type="text"
      className="ec-cck-cell"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={(e) => onCommit(e.target.value)}
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
  availableTables?: Array<{ id: string; name: string }>;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState<TableFieldType>("TEXT");
  const [optionsText, setOptionsText] = useState("");
  const [linkedTableId, setLinkedTableId] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <div className="ec-cck-fieldform">
      <input
        type="text"
        className="ec-cck-input"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Название колонки"
        maxLength={80}
        autoFocus
        style={{ minWidth: 200 }}
      />
      <select
        className="ec-cck-input"
        value={type}
        onChange={(e) => setType(e.target.value as TableFieldType)}
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
          className="ec-cck-input"
          value={linkedTableId}
          onChange={(e) => setLinkedTableId(e.target.value)}
          style={{ minWidth: 200 }}
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
          className="ec-cck-input"
          value={optionsText}
          onChange={(e) => setOptionsText(e.target.value)}
          placeholder="Значения через запятую (TODO, IN PROGRESS, DONE)"
          style={{ flex: 1, minWidth: 240 }}
        />
      )}
      <button
        type="button"
        className="ec-btn ec-btn--primary ec-btn--sm"
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
        disabled={busy || !name.trim() || (type === "RELATION" && !linkedTableId)}
      >
        {busy ? "Создаём…" : "Добавить"}
      </button>
      <button
        type="button"
        className="ec-btn ec-btn--ghost ec-btn--sm"
        onClick={onCancel}
      >
        Отмена
      </button>
    </div>
  );
}

// Helper экспорт TableCell для дальнейших импортов.
export type { TableCell };

/* ============================================================
 * RelationCell + FileCell editors
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
      <span className="ec-cck-cell ec-cck-cell--ghost" title="Связанная таблица была удалена">
        — связь сломана —
      </span>
    );
  }

  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        className={"ec-cck-cell" + (selectedIds.size > 0 ? "" : " ec-cck-cell--ghost")}
        onClick={() => setOpen((v) => !v)}
        style={{ textAlign: "left", cursor: "pointer" }}
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
        <div className="ec-cck-pop">
          {!rows ? (
            <p className="ec-cck-empty">Загрузка…</p>
          ) : rows.length === 0 ? (
            <p className="ec-cck-empty">Целевая таблица пустая.</p>
          ) : (
            rows.map((r) => {
              const checked = selectedIds.has(r.id);
              return (
                <label key={r.id} className="ec-cck-pop__row">
                  <input
                    type="checkbox"
                    className="ec-cck-checkbox"
                    checked={checked}
                    onChange={() => toggle(r.id)}
                  />
                  <span className="ec-cck-card__name">
                    {r.display || `(пусто) #${r.id.slice(-6)}`}
                  </span>
                </label>
              );
            })
          )}
          <div className="ec-cck-pop__foot">
            <span>{selectedIds.size}/5</span>
            <button
              type="button"
              className="ec-btn ec-btn--ghost ec-btn--sm"
              onClick={() => setOpen(false)}
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
    <div className="ec-cck-cell" style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
      {files.map((f, i) => (
        <span
          key={`${f.url}-${i}`}
          className="ec-cck-file"
          title={`${f.filename} · ${fmtBytes(f.size)}`}
        >
          <a
            href={f.url}
            target="_blank"
            rel="noreferrer"
            className="ec-cck-file__name"
          >
            {f.filename}
          </a>
          <button
            type="button"
            className="ec-cck-act"
            onClick={() => removeAt(i)}
            aria-label="Удалить файл"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </span>
      ))}
      {files.length < 5 && (
        <>
          <button
            type="button"
            className="ec-cck-rowbtn"
            onClick={() => inputRef.current?.click()}
            disabled={busy || !uploadFiles}
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
