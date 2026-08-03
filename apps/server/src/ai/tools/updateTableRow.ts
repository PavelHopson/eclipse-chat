import { z } from "zod";
import { db } from "../../db.js";
import { emitTableEvent } from "../../realtime.js";
import type { Tool, ToolCallContext, ToolResult } from "./types.js";
import { canAccessBotScopedResource } from "../botAccess.js";

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

export const updateTableRowArgsSchema = z.object({
  table_id: z.string().min(1).describe("ID таблицы"),
  row_id: z.string().min(1).describe("ID строки"),
  cell_updates: z
    .array(cellUpdateSchema)
    .min(1)
    .max(50)
    .describe("Массив {field_id, value} для обновления"),
});

export type UpdateTableRowArgs = z.infer<typeof updateTableRowArgsSchema>;
type Result = { table_id: string; row_id: string; updated_count: number };

export type UpdateTableRowPreview = {
  kind: "update_table_row";
  tableName: string;
  rowId: string;
  updates: Array<{ fieldName: string; value: string }>;
  totalUpdates: number;
};

type ValidatedUpdateTableRow = {
  args: UpdateTableRowArgs;
  preview: UpdateTableRowPreview;
};

/**
 * Validates the JSON shape and every workspace-scoped target. Approval and
 * execution share this path, so stale targets cannot bypass current policy.
 */
export async function validateUpdateTableRowRequest(
  rawArgs: unknown,
  ctx: ToolCallContext,
): Promise<ToolResult<ValidatedUpdateTableRow>> {
  const parsed = updateTableRowArgsSchema.safeParse(rawArgs);
  if (!parsed.success) {
    return { ok: false, error: `Invalid args: ${parsed.error.issues[0]?.message ?? "schema"}` };
  }
  const { table_id, row_id, cell_updates } = parsed.data;

  const table = await db.table.findUnique({
    where: { id: table_id },
    select: {
      id: true,
      name: true,
      serverId: true,
      channelId: true,
      fields: { select: { id: true, name: true } },
    },
  });
  if (!table) return { ok: false, error: `Таблица ${table_id} не найдена` };
  if (table.serverId !== ctx.serverId) {
    return { ok: false, error: "Таблица не из текущего сервера" };
  }
  if (!canAccessBotScopedResource(ctx.allowedChannelIds, table.channelId)) {
    return { ok: false, error: "Таблица не входит в разрешённый scope агента" };
  }

  const row = await db.tableRow.findUnique({
    where: { id: row_id },
    select: { id: true, tableId: true },
  });
  if (!row) return { ok: false, error: `Строка ${row_id} не найдена` };
  if (row.tableId !== table_id) {
    return { ok: false, error: "Строка не принадлежит указанной таблице" };
  }

  const fieldsById = new Map(table.fields.map((field) => [field.id, field.name]));
  for (const update of cell_updates) {
    if (!fieldsById.has(update.field_id)) {
      return { ok: false, error: `Поле ${update.field_id} не найдено в таблице` };
    }
  }

  return {
    ok: true,
    data: {
      args: parsed.data,
      preview: {
        kind: "update_table_row",
        tableName: table.name,
        rowId: row_id,
        updates: cell_updates.map((update) => ({
          fieldName: fieldsById.get(update.field_id) ?? update.field_id,
          value: update.value.slice(0, 240),
        })),
        totalUpdates: cell_updates.length,
      },
    },
  };
}

export const updateTableRowTool: Tool<UpdateTableRowArgs, Result> = {
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
    const validated = await validateUpdateTableRowRequest(rawArgs, ctx);
    if (!validated.ok) return validated;
    const { table_id, row_id, cell_updates } = validated.data.args;

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
