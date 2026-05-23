import { z } from "zod";
import { db } from "../../db.js";
import { emitTableEvent } from "../../realtime.js";
import type { Tool } from "./types.js";

/**
 * v1.2.28 — update_table_row: бот меняет cells в Operational Table.
 *
 * Safety:
 *   - table.serverId === ctx.serverId.
 *   - row.tableId === table.id.
 *   - cell_updates: для каждого {field_id, value} — field.tableId === table.id.
 *   - Value стрингифицируется (max 2000 chars per cell — защита от accidentally
 *     стирать всю таблицу одним cell'ом).
 *
 * Realtime: emit `table:row:updated` для всех members сервера.
 *
 * v1 — без validation field.type (STATUS / DATE / RELATION accept any string).
 * Frontend coerces по type. Полная type-safe валидация — Phase 2.
 */

const cellUpdateSchema = z.object({
  field_id: z.string().min(1),
  value: z.string().max(2000),
});

const argsSchema = z.object({
  table_id: z.string().min(1).describe("ID таблицы"),
  row_id: z.string().min(1).describe("ID строки"),
  cell_updates: z
    .array(cellUpdateSchema)
    .min(1)
    .max(50)
    .describe("Массив {field_id, value} для обновления"),
});

type Args = z.infer<typeof argsSchema>;
type Result = { table_id: string; row_id: string; updated_count: number };

export const updateTableRowTool: Tool<Args, Result> = {
  name: "update_table_row",
  description:
    "Обновить ячейки строки в operational table текущего сервера. Используй когда из обсуждения вытекает изменение статуса / поля / связи в трекинг-таблице. Для создания новой строки — отдельный tool (пока не реализован).",
  parameters: {
    type: "object",
    properties: {
      table_id: { type: "string", description: "ID таблицы." },
      row_id: { type: "string", description: "ID строки внутри таблицы." },
      cell_updates: {
        type: "array",
        description: "Массив обновлений: field_id + value. Value — строка (STATUS / DATE coerces на frontend).",
        items: {
          type: "object",
          properties: {
            field_id: { type: "string", description: "ID поля таблицы." },
            value: { type: "string", description: "Новое значение (до 2000 chars)." },
          },
          required: ["field_id", "value"],
        },
      },
    },
    required: ["table_id", "row_id", "cell_updates"],
    additionalProperties: false,
  },
  async execute(rawArgs, ctx) {
    const parsed = argsSchema.safeParse(rawArgs);
    if (!parsed.success) {
      return { ok: false, error: `Invalid args: ${parsed.error.issues[0]?.message ?? "schema"}` };
    }
    const { table_id, row_id, cell_updates } = parsed.data;

    const table = await db.table.findUnique({
      where: { id: table_id },
      select: { id: true, serverId: true, fields: { select: { id: true } } },
    });
    if (!table) return { ok: false, error: `Таблица ${table_id} не найдена` };
    if (table.serverId !== ctx.serverId) {
      return { ok: false, error: "Таблица не из текущего сервера" };
    }

    const row = await db.tableRow.findUnique({
      where: { id: row_id },
      select: { id: true, tableId: true },
    });
    if (!row) return { ok: false, error: `Строка ${row_id} не найдена` };
    if (row.tableId !== table_id) {
      return { ok: false, error: "Строка не принадлежит указанной таблице" };
    }

    const validFieldIds = new Set(table.fields.map((f) => f.id));
    for (const u of cell_updates) {
      if (!validFieldIds.has(u.field_id)) {
        return { ok: false, error: `Поле ${u.field_id} не найдено в таблице` };
      }
    }

    // Upsert каждую ячейку. Composite PK (rowId, fieldId).
    await db.$transaction(
      cell_updates.map((u) =>
        db.tableCell.upsert({
          where: { rowId_fieldId: { rowId: row_id, fieldId: u.field_id } },
          update: { value: u.value },
          create: { rowId: row_id, fieldId: u.field_id, value: u.value },
        }),
      ),
    );

    // Bump row.updatedAt.
    const refreshed = await db.tableRow.update({
      where: { id: row_id },
      data: { updatedAt: new Date() },
      select: {
        id: true,
        position: true,
        createdAt: true,
        updatedAt: true,
        actionItemId: true,
        cells: { select: { fieldId: true, value: true } },
      },
    });

    emitTableEvent(ctx.serverId, "table:row:updated", {
      tableId: table_id,
      row: {
        id: refreshed.id,
        position: refreshed.position,
        createdAt: refreshed.createdAt.toISOString(),
        updatedAt: refreshed.updatedAt.toISOString(),
        actionItemId: refreshed.actionItemId,
        cells: refreshed.cells,
      },
    });

    ctx.log.info(
      {
        tool: "update_table_row",
        botUserId: ctx.botUserId,
        tableId: table_id,
        rowId: row_id,
        updated: cell_updates.length,
      },
      "Bot tool executed",
    );

    return {
      ok: true,
      data: { table_id, row_id, updated_count: cell_updates.length },
    };
  },
};
