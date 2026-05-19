/**
 * v0.94 #10 phase 4b — bidirectional sync TableRow ↔ ActionItem.
 *
 * Convention-based field mapping (без explicit per-table config — phase 4c
 * добавит UI настройку):
 *   - title           ← первый TEXT field
 *   - status          ← первый STATUS field (если options matches enum)
 *   - assigneeUserId  ← первый USER field
 *   - dueAt           ← первый DATE field
 *
 * Loop prevention: перед write сравниваем «target == source», skip noop.
 *
 * Phase 4b — синк только указанных полей. Phase 4c — explicit mapping,
 * priority sync, multi-status, custom field selectors.
 */

import type { FastifyBaseLogger } from "fastify";
import { db } from "../db.js";

/**
 * Mapping STATUS-cell value → ActionItem.status. Поддерживает RU и EN
 * вариации, case-insensitive. Возвращает null если не распознано.
 */
const STATUS_MAP: Array<{ patterns: string[]; status: "OPEN" | "IN_PROGRESS" | "REVIEW" | "DONE" }> = [
  { patterns: ["открыто", "open", "todo", "к выполнению"], status: "OPEN" },
  { patterns: ["в работе", "in progress", "in_progress", "doing", "ongoing"], status: "IN_PROGRESS" },
  { patterns: ["на ревью", "review", "на проверке", "qa", "тест"], status: "REVIEW" },
  { patterns: ["завершено", "done", "сделано", "готово", "complete", "completed", "closed"], status: "DONE" },
];

export function mapCellToActionStatus(
  cellValue: string,
): "OPEN" | "IN_PROGRESS" | "REVIEW" | "DONE" | null {
  if (!cellValue) return null;
  const v = cellValue.trim().toLowerCase();
  for (const entry of STATUS_MAP) {
    if (entry.patterns.some((p) => p === v)) return entry.status;
  }
  return null;
}

/**
 * Reverse: ActionItem.status → cell value, выбирая из field.options.
 * Возвращает null если ни одна option не маппится к этому status.
 */
export function mapActionStatusToCell(
  actionStatus: "OPEN" | "IN_PROGRESS" | "REVIEW" | "DONE",
  options: string[],
): string | null {
  if (options.length === 0) return null;
  const targetPatterns = STATUS_MAP.find((s) => s.status === actionStatus)?.patterns ?? [];
  for (const opt of options) {
    const lo = opt.trim().toLowerCase();
    if (targetPatterns.some((p) => p === lo)) return opt;
  }
  return null;
}

type FieldRow = {
  id: string;
  name: string;
  type: string;
  options: string | null;
  position: number;
};

type CellRow = { fieldId: string; value: string };

/** Поиск первого поля типа `type` по position. */
function firstFieldByType(
  fields: FieldRow[],
  type: "TEXT" | "STATUS" | "USER" | "DATE",
): FieldRow | null {
  return (
    fields
      .filter((f) => f.type === type)
      .sort((a, b) => a.position - b.position)[0] ?? null
  );
}

function safeStatusOptions(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((v) => typeof v === "string")
      : [];
  } catch {
    return [];
  }
}

/**
 * Resolved sync mapping для конкретной таблицы.
 */
export type SyncMapping = {
  titleField: FieldRow | null;
  statusField: FieldRow | null;
  assigneeField: FieldRow | null;
  dueAtField: FieldRow | null;
};

export function resolveMapping(fields: FieldRow[]): SyncMapping {
  return {
    titleField: firstFieldByType(fields, "TEXT"),
    statusField: firstFieldByType(fields, "STATUS"),
    assigneeField: firstFieldByType(fields, "USER"),
    dueAtField: firstFieldByType(fields, "DATE"),
  };
}

/**
 * Computes ActionItem patch из row cells. Применяется при row.PATCH.
 * Returns partial Action update fields ({} если ничего не меняется).
 */
export function rowToActionPatch(
  cells: CellRow[],
  mapping: SyncMapping,
  current: {
    title: string;
    status: "OPEN" | "IN_PROGRESS" | "REVIEW" | "DONE";
    assigneeUserId: string | null;
    dueAt: Date | null;
  },
): {
  title?: string;
  status?: "OPEN" | "IN_PROGRESS" | "REVIEW" | "DONE";
  assigneeUserId?: string | null;
  dueAt?: Date | null;
} {
  const patch: ReturnType<typeof rowToActionPatch> = {};

  if (mapping.titleField) {
    const cell = cells.find((c) => c.fieldId === mapping.titleField!.id);
    const newTitle = cell?.value.trim().slice(0, 160);
    if (newTitle && newTitle !== current.title) {
      patch.title = newTitle;
    }
  }

  if (mapping.statusField) {
    const cell = cells.find((c) => c.fieldId === mapping.statusField!.id);
    if (cell) {
      const status = mapCellToActionStatus(cell.value);
      if (status && status !== current.status) {
        patch.status = status;
      }
    }
  }

  if (mapping.assigneeField) {
    const cell = cells.find((c) => c.fieldId === mapping.assigneeField!.id);
    const newAssignee = cell?.value || null;
    if (newAssignee !== current.assigneeUserId) {
      // Phase 4b: assign null или non-null. Validation members — caller's
      // responsibility (мы предполагаем USER cell value уже = valid userId).
      patch.assigneeUserId = newAssignee;
    }
  }

  if (mapping.dueAtField) {
    const cell = cells.find((c) => c.fieldId === mapping.dueAtField!.id);
    let newDue: Date | null = null;
    if (cell?.value && /^\d{4}-\d{2}-\d{2}/.test(cell.value)) {
      const d = new Date(cell.value);
      if (!Number.isNaN(d.getTime())) newDue = d;
    }
    const currentMs = current.dueAt?.getTime() ?? null;
    const newMs = newDue?.getTime() ?? null;
    if (currentMs !== newMs) {
      patch.dueAt = newDue;
    }
  }

  return patch;
}

/**
 * Computes row cells patch из ActionItem changes. Применяется когда
 * ActionItem updates. Возвращает массив cell-changes для row.
 */
export type CellUpdate = { fieldId: string; value: string };

export function actionToCellsPatch(
  action: {
    title: string;
    status: "OPEN" | "IN_PROGRESS" | "REVIEW" | "DONE";
    assigneeUserId: string | null;
    dueAt: Date | null;
  },
  mapping: SyncMapping,
  currentCells: CellRow[],
): CellUpdate[] {
  const updates: CellUpdate[] = [];

  if (mapping.titleField) {
    const cell = currentCells.find((c) => c.fieldId === mapping.titleField!.id);
    if ((cell?.value ?? "") !== action.title) {
      updates.push({ fieldId: mapping.titleField.id, value: action.title });
    }
  }

  if (mapping.statusField) {
    const opts = safeStatusOptions(mapping.statusField.options);
    const target = mapActionStatusToCell(action.status, opts);
    if (target !== null) {
      const cell = currentCells.find((c) => c.fieldId === mapping.statusField!.id);
      if ((cell?.value ?? "") !== target) {
        updates.push({ fieldId: mapping.statusField.id, value: target });
      }
    }
  }

  if (mapping.assigneeField) {
    const target = action.assigneeUserId ?? "";
    const cell = currentCells.find((c) => c.fieldId === mapping.assigneeField!.id);
    if ((cell?.value ?? "") !== target) {
      updates.push({ fieldId: mapping.assigneeField.id, value: target });
    }
  }

  if (mapping.dueAtField) {
    const target = action.dueAt ? action.dueAt.toISOString().slice(0, 10) : "";
    const cell = currentCells.find((c) => c.fieldId === mapping.dueAtField!.id);
    if ((cell?.value ?? "") !== target) {
      updates.push({ fieldId: mapping.dueAtField.id, value: target });
    }
  }

  return updates;
}

/**
 * Row updated → sync attached ActionItem (если есть).
 * Fire-and-forget из caller'а (PATCH row endpoint).
 */
export async function syncRowToAction(
  rowId: string,
  log?: FastifyBaseLogger,
): Promise<void> {
  try {
    const row = await db.tableRow.findUnique({
      where: { id: rowId },
      include: {
        cells: { select: { fieldId: true, value: true } },
        actionItem: {
          select: {
            id: true,
            title: true,
            status: true,
            assigneeUserId: true,
            dueAt: true,
            channelId: true,
          },
        },
        table: {
          select: {
            fields: {
              select: {
                id: true,
                name: true,
                type: true,
                options: true,
                position: true,
              },
            },
          },
        },
      },
    });
    if (!row?.actionItem) return;
    if (!row.table) return;
    const mapping = resolveMapping(row.table.fields);
    const patch = rowToActionPatch(row.cells, mapping, {
      title: row.actionItem.title,
      status: row.actionItem.status as "OPEN" | "IN_PROGRESS" | "REVIEW" | "DONE",
      assigneeUserId: row.actionItem.assigneeUserId,
      dueAt: row.actionItem.dueAt,
    });
    if (Object.keys(patch).length === 0) return;
    await db.actionItem.update({
      where: { id: row.actionItem.id },
      data: patch,
    });
    log?.info(
      { rowId, actionItemId: row.actionItem.id, fields: Object.keys(patch) },
      "row→action sync",
    );
  } catch (err) {
    log?.warn({ err, rowId }, "syncRowToAction failed");
  }
}

/**
 * ActionItem updated → sync linked rows (если есть).
 * Fire-and-forget из caller'а (PATCH action endpoint).
 */
export async function syncActionToRows(
  actionItemId: string,
  log?: FastifyBaseLogger,
): Promise<void> {
  try {
    const action = await db.actionItem.findUnique({
      where: { id: actionItemId },
      select: {
        id: true,
        title: true,
        status: true,
        assigneeUserId: true,
        dueAt: true,
        tableRows: {
          select: {
            id: true,
            tableId: true,
            cells: { select: { fieldId: true, value: true } },
            table: {
              select: {
                serverId: true,
                fields: {
                  select: {
                    id: true,
                    name: true,
                    type: true,
                    options: true,
                    position: true,
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!action?.tableRows.length) return;

    for (const row of action.tableRows) {
      if (!row.table) continue;
      const mapping = resolveMapping(row.table.fields);
      const updates = actionToCellsPatch(
        {
          title: action.title,
          status: action.status as "OPEN" | "IN_PROGRESS" | "REVIEW" | "DONE",
          assigneeUserId: action.assigneeUserId,
          dueAt: action.dueAt,
        },
        mapping,
        row.cells,
      );
      if (updates.length === 0) continue;
      // Upsert each cell — TableCell composite PK (rowId, fieldId).
      await db.$transaction(
        updates.map((u) =>
          db.tableCell.upsert({
            where: { rowId_fieldId: { rowId: row.id, fieldId: u.fieldId } },
            create: { rowId: row.id, fieldId: u.fieldId, value: u.value },
            update: { value: u.value },
          }),
        ),
      );
      log?.info(
        {
          rowId: row.id,
          tableId: row.tableId,
          actionItemId,
          fields: updates.map((u) => u.fieldId),
        },
        "action→row sync",
      );
    }
  } catch (err) {
    log?.warn({ err, actionItemId }, "syncActionToRows failed");
  }
}
