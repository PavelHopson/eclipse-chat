import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../db.js";
import { getUserId, requireJwt } from "../auth/requireJwt.js";
import { emitTableEvent } from "../realtime.js";
import { TABLE_TEMPLATES, getTemplate } from "../lib/tableTemplates.js";
import { processStandaloneFile } from "../attachments.js";
import { isModOrHigher } from "../lib/permissions.js";
import { AINotConfiguredError, chat } from "../ai/provider.js";
import { actionItemInclude, serializeActionItem } from "../actionItems.js";
import { emitActionItemCreated, emitMessageOnChannel } from "../realtime.js";
import { getSystemBotUserId } from "../lib/systemBot.js";

/**
 * Operational Tables phase 1 (v0.59.0) — CRUD routes.
 *
 * Endpoints:
 *   GET    /api/servers/:id/tables           — список таблиц пространства
 *   POST   /api/servers/:id/tables           — создать новую (с дефолтным
 *                                              полем «Название»)
 *   GET    /api/tables/:id                   — full table (fields + rows + cells)
 *   PATCH  /api/tables/:id                   — rename / update description
 *   DELETE /api/tables/:id                   — drop (cascade fields/rows/cells)
 *   POST   /api/tables/:id/fields            — add field
 *   PATCH  /api/tables/:id/fields/:fieldId   — edit (rename / options)
 *   DELETE /api/tables/:id/fields/:fieldId   — drop field + все cells этой колонки
 *   POST   /api/tables/:id/rows              — add empty row (в конец)
 *   PATCH  /api/tables/:id/rows/:rowId       — bulk cell update
 *   DELETE /api/tables/:id/rows/:rowId       — drop row
 *
 * Membership-only check на server. Никаких ролевых ограничений в phase 1 —
 * любой member может create/edit/delete. Phase 2 — RBAC на роль OWNER/
 * ADMIN/MOD для destructive операций.
 *
 * Realtime — out of scope phase 1. Клиент refresh'ит таблицу вручную.
 * Phase 2 — emit `table:*` events для multi-user collaboration.
 */

const fieldTypeSchema = z.enum([
  "TEXT",
  "NUMBER",
  "STATUS",
  "DATE",
  "USER",
  "CHECKBOX",
  "RELATION",
  "FILE",
]);

type FieldType = z.infer<typeof fieldTypeSchema>;

const createTableBody = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().max(500).optional(),
  channelId: z.string().nullable().optional(),
});

const updateTableBody = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().max(500).nullable().optional(),
  channelId: z.string().nullable().optional(),
}).refine((body) => Object.keys(body).length > 0, {
  message: "At least one field is required",
});

const createFieldBody = z.object({
  name: z.string().trim().min(1).max(80),
  type: fieldTypeSchema,
  /** Для STATUS — array допустимых значений. Игнорируется для других типов. */
  options: z.array(z.string().min(1).max(40)).max(20).optional(),
  /** v0.75 #10 phase 2.5b RELATION: target table id (тот же server). */
  linkedTableId: z.string().min(1).optional(),
});

const updateFieldBody = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  options: z.array(z.string().min(1).max(40)).max(20).nullable().optional(),
  linkedTableId: z.string().min(1).nullable().optional(),
}).refine((body) => Object.keys(body).length > 0, {
  message: "At least one field is required",
});

const updateRowBody = z.object({
  cells: z
    .array(
      z.object({
        fieldId: z.string().min(1),
        value: z.string().max(4000),
      }),
    )
    .min(1)
    .max(40),
});

/** v0.70: bulk reorder — ordered list ids, индекс → новая position. */
const reorderBody = z.object({
  orderedIds: z.array(z.string().min(1)).min(1).max(500),
});

/** v0.70: from-template body. templateId должен match TABLE_TEMPLATES. */
const fromTemplateBody = z.object({
  templateId: z.string().min(1).max(40),
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().max(500).optional(),
  channelId: z.string().nullable().optional(),
});

/** v0.75 #10 phase 2.5b: upload base64-attachments для FILE-ячеек. */
const tableUploadBody = z.object({
  files: z
    .array(
      z.object({
        filename: z.string().min(1).max(255),
        mimeType: z.string().min(3).max(120),
        dataBase64: z.string().min(1),
      }),
    )
    .min(1)
    .max(5),
});

async function requireServerMember(userId: string, serverId: string) {
  const member = await db.member.findUnique({
    where: { userId_serverId: { userId, serverId } },
    select: { id: true, role: true },
  });
  return member;
}

/** v0.62 → v0.78 #17: MOD+ check через centralized helper (включает OPERATOR). */
const isMod = isModOrHigher;

/**
 * v0.62: coerce + validate cell value по field.type.
 * USER — проверяет что value это userId of member данного server'а.
 * CHECKBOX — coerce в "true"/"false" (любой truthy → "true").
 * Остальные типы — passthrough (frontend сам coerce'ит при render).
 */
async function coerceCellValue(
  fieldType: FieldType,
  value: string,
  serverId: string,
  field?: { linkedTableId: string | null },
): Promise<string | { error: string }> {
  if (value === "") return value; // delete-cell path
  if (fieldType === "USER") {
    const member = await db.member.findUnique({
      where: { userId_serverId: { userId: value, serverId } },
      select: { id: true },
    });
    if (!member) return { error: `User ${value} не является участником` };
    return value;
  }
  if (fieldType === "CHECKBOX") {
    const lower = value.toLowerCase();
    return lower === "true" || lower === "1" || lower === "yes" ? "true" : "false";
  }
  if (fieldType === "RELATION") {
    // v0.75: JSON array of rowIds. Validate что rows существуют в linkedTable
    // того же сервера. Max 5 связей в ячейке — UX clarity (chip-list).
    if (!field?.linkedTableId) {
      return { error: "RELATION field has no linkedTableId" };
    }
    let ids: unknown;
    try {
      ids = JSON.parse(value);
    } catch {
      return { error: "RELATION value must be JSON array of row ids" };
    }
    if (!Array.isArray(ids) || ids.some((v) => typeof v !== "string")) {
      return { error: "RELATION value must be array of strings" };
    }
    if (ids.length === 0) return "";
    if (ids.length > 5) {
      return { error: "RELATION: максимум 5 связей в ячейке" };
    }
    const linked = await db.table.findUnique({
      where: { id: field.linkedTableId },
      select: { id: true, serverId: true },
    });
    if (!linked || linked.serverId !== serverId) {
      return { error: "Linked table not in this workspace" };
    }
    const found = await db.tableRow.findMany({
      where: { id: { in: ids as string[] }, tableId: field.linkedTableId },
      select: { id: true },
    });
    if (found.length !== ids.length) {
      return { error: "Some related rows do not exist or are in another table" };
    }
    return JSON.stringify(ids);
  }
  if (fieldType === "FILE") {
    // v0.75: JSON array of {url, filename, mimeType, size}. URLs выданы
    // POST /api/tables/:id/upload — должны начинаться с `/uploads/tables/`
    // (path-only, prevents arbitrary URL injection в ячейку). Max 5 файлов.
    let items: unknown;
    try {
      items = JSON.parse(value);
    } catch {
      return { error: "FILE value must be JSON array" };
    }
    if (!Array.isArray(items)) {
      return { error: "FILE value must be array" };
    }
    if (items.length === 0) return "";
    if (items.length > 5) {
      return { error: "FILE: максимум 5 файлов в ячейке" };
    }
    for (const it of items) {
      if (!it || typeof it !== "object") {
        return { error: "FILE item must be object" };
      }
      const obj = it as Record<string, unknown>;
      if (
        typeof obj.url !== "string" ||
        typeof obj.filename !== "string" ||
        typeof obj.mimeType !== "string" ||
        typeof obj.size !== "number"
      ) {
        return { error: "FILE item missing required fields" };
      }
      if (!obj.url.startsWith("/uploads/tables/")) {
        return { error: "FILE url must be from /api/tables/:id/upload" };
      }
    }
    return JSON.stringify(items);
  }
  return value;
}

function serializeOptions(raw: string | null): string[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === "string") : null;
  } catch {
    return null;
  }
}

/**
 * v0.87 #10 phase 3: column-level aggregations.
 *
 * Pure computation — для каждого NUMBER field считается SUM/AVG/COUNT/MIN/MAX
 * по non-empty parseable values. Возвращается в payload как `aggregations`
 * (один row per NUMBER field). UI рендерит footer-row под таблицей.
 *
 * COUNT учитывает только parseable non-empty cells (не общее число rows).
 * AVG/MIN/MAX undefined если COUNT=0.
 */
export type FieldAggregation = {
  fieldId: string;
  count: number;
  sum: number;
  avg: number | null;
  min: number | null;
  max: number | null;
};

export function aggregateNumberFields(
  fields: Array<{ id: string; type: FieldType }>,
  rows: Array<{ cells: Array<{ fieldId: string; value: string }> }>,
): FieldAggregation[] {
  const numericFields = fields.filter((f) => f.type === "NUMBER");
  return numericFields.map((field) => {
    let count = 0;
    let sum = 0;
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;
    for (const row of rows) {
      const cell = row.cells.find((c) => c.fieldId === field.id);
      if (!cell || !cell.value) continue;
      const parsed = parseFloat(cell.value.replace(",", "."));
      if (!Number.isFinite(parsed)) continue;
      count += 1;
      sum += parsed;
      if (parsed < min) min = parsed;
      if (parsed > max) max = parsed;
    }
    return {
      fieldId: field.id,
      count,
      sum,
      avg: count > 0 ? sum / count : null,
      min: count > 0 ? min : null,
      max: count > 0 ? max : null,
    };
  });
}

/** v0.90 #10 phase 4: lightweight linked-action snapshot для row. */
export type LinkedActionView = {
  id: string;
  title: string;
  type: "TASK" | "DECISION" | "FOLLOW_UP";
  status: "OPEN" | "IN_PROGRESS" | "REVIEW" | "DONE";
  priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  approvalStatus: "NONE" | "PENDING" | "APPROVED" | "REJECTED";
  dueAt: string | null;
  assigneeUserId: string | null;
  channelId: string;
};

function serializeTable(t: {
  id: string;
  serverId: string;
  channelId: string | null;
  name: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
  createdBy: { id: string; displayName: string; avatar: string | null };
  fields: Array<{
    id: string;
    name: string;
    type: FieldType;
    options: string | null;
    position: number;
    linkedTableId?: string | null;
  }>;
  rows: Array<{
    id: string;
    position: number;
    createdAt: Date;
    updatedAt: Date;
    actionItemId?: string | null;
    actionItem?: {
      id: string;
      title: string;
      type: "TASK" | "DECISION" | "FOLLOW_UP";
      status: "OPEN" | "IN_PROGRESS" | "REVIEW" | "DONE";
      priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
      approvalStatus: "NONE" | "PENDING" | "APPROVED" | "REJECTED";
      dueAt: Date | null;
      assigneeUserId: string | null;
      channelId: string;
    } | null;
    cells: Array<{ rowId: string; fieldId: string; value: string }>;
  }>;
}) {
  const cellsByRow = t.rows.map((r) => ({ cells: r.cells }));
  return {
    id: t.id,
    serverId: t.serverId,
    channelId: t.channelId,
    name: t.name,
    description: t.description,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
    createdBy: {
      id: t.createdBy.id,
      displayName: t.createdBy.displayName,
      avatar: t.createdBy.avatar,
    },
    fields: t.fields
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((f) => ({
        id: f.id,
        name: f.name,
        type: f.type,
        options: serializeOptions(f.options),
        position: f.position,
        linkedTableId: f.linkedTableId ?? null,
      })),
    rows: t.rows
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((r) => ({
        id: r.id,
        position: r.position,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
        cells: r.cells.map((c) => ({
          fieldId: c.fieldId,
          value: c.value,
        })),
        // v0.90 #10 phase 4: linked-action snapshot. null если row не linked.
        actionItemId: r.actionItemId ?? null,
        linkedAction: r.actionItem
          ? ({
              id: r.actionItem.id,
              title: r.actionItem.title,
              type: r.actionItem.type,
              status: r.actionItem.status,
              priority: r.actionItem.priority,
              approvalStatus: r.actionItem.approvalStatus,
              dueAt: r.actionItem.dueAt?.toISOString() ?? null,
              assigneeUserId: r.actionItem.assigneeUserId,
              channelId: r.actionItem.channelId,
            } satisfies LinkedActionView)
          : null,
      })),
    // v0.87 #10 phase 3: aggregations footer.
    aggregations: aggregateNumberFields(t.fields, cellsByRow),
  };
}

export async function registerTableRoutes(app: FastifyInstance) {
  /**
   * GET /api/servers/:id/tables — lightweight list для sidebar / Context
   * Tree. Возвращает только id+name+description+rowCount+fieldCount.
   */
  app.get(
    "/api/servers/:id/tables",
    { onRequest: [requireJwt] },
    async (req, reply) => {
      const userId = getUserId(req);
      if (!userId) return reply.status(401).send({ error: "Unauthorized" });
      const { id: serverId } = req.params as { id: string };
      const member = await requireServerMember(userId, serverId);
      if (!member) {
        return reply.status(403).send({ error: "Not a member of this server" });
      }
      const tables = await db.table.findMany({
        where: { serverId },
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          name: true,
          description: true,
          channelId: true,
          createdAt: true,
          updatedAt: true,
          _count: { select: { fields: true, rows: true } },
        },
      });
      return {
        tables: tables.map((t) => ({
          id: t.id,
          name: t.name,
          description: t.description,
          channelId: t.channelId,
          createdAt: t.createdAt.toISOString(),
          updatedAt: t.updatedAt.toISOString(),
          fieldCount: t._count.fields,
          rowCount: t._count.rows,
        })),
      };
    },
  );

  /**
   * POST /api/servers/:id/tables — создать таблицу с дефолтным полем
   * «Название» (TEXT). Frontend сразу может добавлять rows / fields.
   */
  app.post(
    "/api/servers/:id/tables",
    { onRequest: [requireJwt] },
    async (req, reply) => {
      const userId = getUserId(req);
      if (!userId) return reply.status(401).send({ error: "Unauthorized" });
      const { id: serverId } = req.params as { id: string };
      const member = await requireServerMember(userId, serverId);
      if (!member) {
        return reply.status(403).send({ error: "Not a member of this server" });
      }
      const parsed = createTableBody.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid body" });
      }
      const created = await db.table.create({
        data: {
          serverId,
          channelId: parsed.data.channelId ?? null,
          name: parsed.data.name,
          description: parsed.data.description ?? null,
          createdByUserId: userId,
          fields: {
            create: {
              name: "Название",
              type: "TEXT",
              position: 0,
            },
          },
        },
        include: {
          createdBy: { select: { id: true, displayName: true, avatar: true } },
          fields: true,
          rows: {
            include: {
              cells: true,
              // v0.90 #10 phase 4: linked ActionItem snapshot для row badge.
              actionItem: {
                select: {
                  id: true,
                  title: true,
                  type: true,
                  status: true,
                  priority: true,
                  approvalStatus: true,
                  dueAt: true,
                  assigneeUserId: true,
                  channelId: true,
                },
              },
            },
          },
        },
      });
      emitTableEvent(serverId, "table:updated", {
        serverId,
        id: created.id,
        name: created.name,
        description: created.description,
        channelId: created.channelId,
      });
      return { table: serializeTable(created) };
    },
  );

  /**
   * GET /api/tables/:id — full detail (fields + rows + cells). Membership
   * resolved через table.serverId.
   */
  app.get(
    "/api/tables/:id",
    { onRequest: [requireJwt] },
    async (req, reply) => {
      const userId = getUserId(req);
      if (!userId) return reply.status(401).send({ error: "Unauthorized" });
      const { id } = req.params as { id: string };
      const table = await db.table.findUnique({
        where: { id },
        include: {
          createdBy: { select: { id: true, displayName: true, avatar: true } },
          fields: true,
          rows: {
            include: {
              cells: true,
              // v0.90 #10 phase 4: linked ActionItem snapshot для row badge.
              actionItem: {
                select: {
                  id: true,
                  title: true,
                  type: true,
                  status: true,
                  priority: true,
                  approvalStatus: true,
                  dueAt: true,
                  assigneeUserId: true,
                  channelId: true,
                },
              },
            },
          },
        },
      });
      if (!table) return reply.status(404).send({ error: "Table not found" });
      const member = await requireServerMember(userId, table.serverId);
      if (!member) {
        return reply.status(403).send({ error: "Not a member of this server" });
      }
      return { table: serializeTable(table) };
    },
  );

  /** PATCH /api/tables/:id — rename / описание / привязка к каналу. */
  app.patch(
    "/api/tables/:id",
    { onRequest: [requireJwt] },
    async (req, reply) => {
      const userId = getUserId(req);
      if (!userId) return reply.status(401).send({ error: "Unauthorized" });
      const { id } = req.params as { id: string };
      const parsed = updateTableBody.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid body" });
      }
      const existing = await db.table.findUnique({
        where: { id },
        select: { id: true, serverId: true },
      });
      if (!existing) return reply.status(404).send({ error: "Table not found" });
      const member = await requireServerMember(userId, existing.serverId);
      if (!member) {
        return reply.status(403).send({ error: "Not a member of this server" });
      }
      const updated = await db.table.update({
        where: { id },
        data: {
          ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
          ...(parsed.data.description !== undefined
            ? { description: parsed.data.description }
            : {}),
          ...(parsed.data.channelId !== undefined
            ? { channelId: parsed.data.channelId }
            : {}),
        },
        select: { id: true, name: true, description: true, channelId: true },
      });
      emitTableEvent(existing.serverId, "table:updated", {
        serverId: existing.serverId,
        id: updated.id,
        name: updated.name,
        description: updated.description,
        channelId: updated.channelId,
      });
      return { table: updated };
    },
  );

  /** DELETE /api/tables/:id — drop (cascade). MOD+ only (v0.62 RBAC). */
  app.delete(
    "/api/tables/:id",
    { onRequest: [requireJwt] },
    async (req, reply) => {
      const userId = getUserId(req);
      if (!userId) return reply.status(401).send({ error: "Unauthorized" });
      const { id } = req.params as { id: string };
      const existing = await db.table.findUnique({
        where: { id },
        select: { serverId: true },
      });
      if (!existing) return reply.status(404).send({ error: "Table not found" });
      const member = await requireServerMember(userId, existing.serverId);
      if (!member) {
        return reply.status(403).send({ error: "Not a member of this server" });
      }
      if (!isMod(member.role)) {
        return reply
          .status(403)
          .send({ error: "Удалить таблицу может только модератор / админ / владелец" });
      }
      await db.table.delete({ where: { id } });
      emitTableEvent(existing.serverId, "table:deleted", {
        serverId: existing.serverId,
        id,
      });
      return { ok: true };
    },
  );

  /** POST /api/tables/:id/fields — add column (в конец). */
  app.post(
    "/api/tables/:id/fields",
    { onRequest: [requireJwt] },
    async (req, reply) => {
      const userId = getUserId(req);
      if (!userId) return reply.status(401).send({ error: "Unauthorized" });
      const { id: tableId } = req.params as { id: string };
      const parsed = createFieldBody.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid body" });
      }
      const table = await db.table.findUnique({
        where: { id: tableId },
        select: {
          serverId: true,
          _count: { select: { fields: true } },
        },
      });
      if (!table) return reply.status(404).send({ error: "Table not found" });
      const member = await requireServerMember(userId, table.serverId);
      if (!member) {
        return reply.status(403).send({ error: "Not a member of this server" });
      }
      // v0.75 RELATION: validate linkedTableId если type=RELATION.
      let linkedTableId: string | null = null;
      if (parsed.data.type === "RELATION") {
        if (!parsed.data.linkedTableId) {
          return reply
            .status(400)
            .send({ error: "RELATION требует linkedTableId" });
        }
        const linked = await db.table.findUnique({
          where: { id: parsed.data.linkedTableId },
          select: { serverId: true },
        });
        if (!linked || linked.serverId !== table.serverId) {
          return reply
            .status(400)
            .send({ error: "Связанная таблица не найдена в этом пространстве" });
        }
        linkedTableId = parsed.data.linkedTableId;
      }
      const field = await db.tableField.create({
        data: {
          tableId,
          name: parsed.data.name,
          type: parsed.data.type,
          position: table._count.fields,
          options:
            parsed.data.type === "STATUS" && parsed.data.options
              ? JSON.stringify(parsed.data.options)
              : null,
          linkedTableId,
        },
      });
      // bump table.updatedAt чтобы list пересортировался
      await db.table.update({
        where: { id: tableId },
        data: { updatedAt: new Date() },
      });
      const fieldPayload = {
        id: field.id,
        name: field.name,
        type: field.type,
        options: serializeOptions(field.options),
        position: field.position,
        linkedTableId: field.linkedTableId,
      };
      emitTableEvent(table.serverId, "table:field:added", {
        tableId,
        field: fieldPayload,
      });
      return { field: fieldPayload };
    },
  );

  /** PATCH field — rename / options (для STATUS). */
  app.patch(
    "/api/tables/:id/fields/:fieldId",
    { onRequest: [requireJwt] },
    async (req, reply) => {
      const userId = getUserId(req);
      if (!userId) return reply.status(401).send({ error: "Unauthorized" });
      const { id: tableId, fieldId } = req.params as { id: string; fieldId: string };
      const parsed = updateFieldBody.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid body" });
      }
      const field = await db.tableField.findUnique({
        where: { id: fieldId },
        select: { id: true, tableId: true, type: true, table: { select: { serverId: true } } },
      });
      if (!field || field.tableId !== tableId) {
        return reply.status(404).send({ error: "Field not found" });
      }
      const member = await requireServerMember(userId, field.table.serverId);
      if (!member) {
        return reply.status(403).send({ error: "Not a member of this server" });
      }
      const updated = await db.tableField.update({
        where: { id: fieldId },
        data: {
          ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
          ...(parsed.data.options !== undefined
            ? {
                options:
                  field.type === "STATUS" && parsed.data.options
                    ? JSON.stringify(parsed.data.options)
                    : null,
              }
            : {}),
        },
      });
      const fieldPayload = {
        id: updated.id,
        name: updated.name,
        type: updated.type,
        options: serializeOptions(updated.options),
        position: updated.position,
        linkedTableId: updated.linkedTableId,
      };
      emitTableEvent(field.table.serverId, "table:field:updated", {
        tableId,
        field: fieldPayload,
      });
      return { field: fieldPayload };
    },
  );

  /** DELETE field — cascade удаляет cells этой колонки. MOD+ only. */
  app.delete(
    "/api/tables/:id/fields/:fieldId",
    { onRequest: [requireJwt] },
    async (req, reply) => {
      const userId = getUserId(req);
      if (!userId) return reply.status(401).send({ error: "Unauthorized" });
      const { id: tableId, fieldId } = req.params as { id: string; fieldId: string };
      const field = await db.tableField.findUnique({
        where: { id: fieldId },
        select: { tableId: true, table: { select: { serverId: true } } },
      });
      if (!field || field.tableId !== tableId) {
        return reply.status(404).send({ error: "Field not found" });
      }
      const member = await requireServerMember(userId, field.table.serverId);
      if (!member) {
        return reply.status(403).send({ error: "Not a member of this server" });
      }
      if (!isMod(member.role)) {
        return reply
          .status(403)
          .send({ error: "Удалить колонку может только модератор / админ / владелец" });
      }
      await db.tableField.delete({ where: { id: fieldId } });
      emitTableEvent(field.table.serverId, "table:field:deleted", {
        tableId,
        fieldId,
      });
      return { ok: true };
    },
  );

  /** POST row — добавляет пустую строку в конец. */
  app.post(
    "/api/tables/:id/rows",
    { onRequest: [requireJwt] },
    async (req, reply) => {
      const userId = getUserId(req);
      if (!userId) return reply.status(401).send({ error: "Unauthorized" });
      const { id: tableId } = req.params as { id: string };
      const table = await db.table.findUnique({
        where: { id: tableId },
        select: {
          serverId: true,
          _count: { select: { rows: true } },
        },
      });
      if (!table) return reply.status(404).send({ error: "Table not found" });
      const member = await requireServerMember(userId, table.serverId);
      if (!member) {
        return reply.status(403).send({ error: "Not a member of this server" });
      }
      const row = await db.tableRow.create({
        data: { tableId, position: table._count.rows },
      });
      await db.table.update({
        where: { id: tableId },
        data: { updatedAt: new Date() },
      });
      const rowPayload = {
        id: row.id,
        position: row.position,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
        cells: [] as Array<{ fieldId: string; value: string }>,
      };
      emitTableEvent(table.serverId, "table:row:added", { tableId, row: rowPayload });
      return { row: rowPayload };
    },
  );

  /**
   * PATCH row — bulk update нескольких cells в одной строке. Каждая
   * cell с пустым value удаляется (чтобы не хранить empty strings в
   * indexed-table при массовых правках).
   */
  app.patch(
    "/api/tables/:id/rows/:rowId",
    { onRequest: [requireJwt] },
    async (req, reply) => {
      const userId = getUserId(req);
      if (!userId) return reply.status(401).send({ error: "Unauthorized" });
      const { id: tableId, rowId } = req.params as { id: string; rowId: string };
      const parsed = updateRowBody.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid body" });
      }
      const row = await db.tableRow.findUnique({
        where: { id: rowId },
        select: { id: true, tableId: true, table: { select: { serverId: true } } },
      });
      if (!row || row.tableId !== tableId) {
        return reply.status(404).send({ error: "Row not found" });
      }
      const member = await requireServerMember(userId, row.table.serverId);
      if (!member) {
        return reply.status(403).send({ error: "Not a member of this server" });
      }
      // Verify все fieldIds принадлежат этой таблице + получим типы для
      // value coercion.
      const fieldIds = parsed.data.cells.map((c) => c.fieldId);
      const fields = await db.tableField.findMany({
        where: { id: { in: fieldIds }, tableId },
        select: { id: true, type: true, linkedTableId: true },
      });
      const fieldMap = new Map(
        fields.map((f) => [f.id, { type: f.type, linkedTableId: f.linkedTableId }]),
      );
      const invalid = fieldIds.filter((id) => !fieldMap.has(id));
      if (invalid.length > 0) {
        return reply
          .status(400)
          .send({ error: "Some fieldIds do not belong to this table", invalid });
      }

      // v0.62: coerce / validate cell values по типу поля.
      // v0.75: field meta (linkedTableId) передаётся для RELATION валидации.
      const coercedCells: Array<{ fieldId: string; value: string }> = [];
      for (const cell of parsed.data.cells) {
        const meta = fieldMap.get(cell.fieldId)!;
        const result = await coerceCellValue(
          meta.type,
          cell.value,
          row.table.serverId,
          { linkedTableId: meta.linkedTableId },
        );
        if (typeof result === "object") {
          return reply.status(400).send({ error: result.error, fieldId: cell.fieldId });
        }
        coercedCells.push({ fieldId: cell.fieldId, value: result });
      }

      await db.$transaction(async (tx) => {
        for (const cell of coercedCells) {
          if (cell.value === "") {
            await tx.tableCell.deleteMany({
              where: { rowId, fieldId: cell.fieldId },
            });
          } else {
            await tx.tableCell.upsert({
              where: { rowId_fieldId: { rowId, fieldId: cell.fieldId } },
              update: { value: cell.value },
              create: { rowId, fieldId: cell.fieldId, value: cell.value },
            });
          }
        }
        await tx.tableRow.update({
          where: { id: rowId },
          data: { updatedAt: new Date() },
        });
        await tx.table.update({
          where: { id: tableId },
          data: { updatedAt: new Date() },
        });
      });
      const updated = await db.tableRow.findUnique({
        where: { id: rowId },
        include: { cells: true },
      });
      const rowPayload = updated
        ? {
            id: updated.id,
            position: updated.position,
            createdAt: updated.createdAt.toISOString(),
            updatedAt: updated.updatedAt.toISOString(),
            cells: updated.cells.map((c) => ({
              fieldId: c.fieldId,
              value: c.value,
            })),
          }
        : null;
      if (rowPayload) {
        emitTableEvent(row.table.serverId, "table:row:updated", {
          tableId,
          row: rowPayload,
        });
      }
      return { row: rowPayload };
    },
  );

  /**
   * v0.70 POST /api/tables/:id/fields/reorder — bulk re-position.
   * Body: { orderedIds: [...] } — каждый id получит index как position.
   * Все ids должны принадлежать этой таблице (validated). Atomic transaction.
   * После — emit table:field:updated за каждое перемещённое поле, чтобы
   * клиенты pacify state без full reload.
   */
  app.post(
    "/api/tables/:id/fields/reorder",
    { onRequest: [requireJwt] },
    async (req, reply) => {
      const userId = getUserId(req);
      if (!userId) return reply.status(401).send({ error: "Unauthorized" });
      const { id: tableId } = req.params as { id: string };
      const parsed = reorderBody.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid body" });
      }
      const table = await db.table.findUnique({
        where: { id: tableId },
        select: { serverId: true },
      });
      if (!table) return reply.status(404).send({ error: "Table not found" });
      const member = await requireServerMember(userId, table.serverId);
      if (!member) {
        return reply.status(403).send({ error: "Not a member of this server" });
      }
      // Все ids должны принадлежать этой таблице.
      const existing = await db.tableField.findMany({
        where: { id: { in: parsed.data.orderedIds }, tableId },
        select: { id: true },
      });
      if (existing.length !== parsed.data.orderedIds.length) {
        return reply
          .status(400)
          .send({ error: "Some fieldIds не принадлежат этой таблице" });
      }
      const updated = await db.$transaction(
        parsed.data.orderedIds.map((id, idx) =>
          db.tableField.update({
            where: { id },
            data: { position: idx },
            select: {
              id: true,
              name: true,
              type: true,
              options: true,
              position: true,
            },
          }),
        ),
      );
      await db.table.update({
        where: { id: tableId },
        data: { updatedAt: new Date() },
      });
      for (const f of updated) {
        emitTableEvent(table.serverId, "table:field:updated", {
          tableId,
          field: {
            id: f.id,
            name: f.name,
            type: f.type,
            options: serializeOptions(f.options),
            position: f.position,
          },
        });
      }
      return { ok: true };
    },
  );

  /**
   * v0.70 POST /api/tables/:id/rows/reorder — bulk re-position rows.
   * Same pattern что и fields/reorder.
   */
  app.post(
    "/api/tables/:id/rows/reorder",
    { onRequest: [requireJwt] },
    async (req, reply) => {
      const userId = getUserId(req);
      if (!userId) return reply.status(401).send({ error: "Unauthorized" });
      const { id: tableId } = req.params as { id: string };
      const parsed = reorderBody.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid body" });
      }
      const table = await db.table.findUnique({
        where: { id: tableId },
        select: { serverId: true },
      });
      if (!table) return reply.status(404).send({ error: "Table not found" });
      const member = await requireServerMember(userId, table.serverId);
      if (!member) {
        return reply.status(403).send({ error: "Not a member of this server" });
      }
      const existing = await db.tableRow.findMany({
        where: { id: { in: parsed.data.orderedIds }, tableId },
        select: { id: true },
      });
      if (existing.length !== parsed.data.orderedIds.length) {
        return reply
          .status(400)
          .send({ error: "Some rowIds не принадлежат этой таблице" });
      }
      const updated = await db.$transaction(
        parsed.data.orderedIds.map((id, idx) =>
          db.tableRow.update({
            where: { id },
            data: { position: idx },
            include: { cells: true },
          }),
        ),
      );
      await db.table.update({
        where: { id: tableId },
        data: { updatedAt: new Date() },
      });
      for (const r of updated) {
        emitTableEvent(table.serverId, "table:row:updated", {
          tableId,
          row: {
            id: r.id,
            position: r.position,
            createdAt: r.createdAt.toISOString(),
            updatedAt: r.updatedAt.toISOString(),
            cells: r.cells.map((c) => ({ fieldId: c.fieldId, value: c.value })),
          },
        });
      }
      return { ok: true };
    },
  );

  /**
   * v0.70 GET /api/tables/templates — list для frontend create-form
   * picker'а. Не требует серверного контекста (templates — статические).
   * Auth обязателен — нет смысла отдавать незалогиненным.
   */
  app.get(
    "/api/tables/templates",
    { onRequest: [requireJwt] },
    async () => {
      return {
        templates: TABLE_TEMPLATES.map((t) => ({
          id: t.id,
          label: t.label,
          description: t.description,
          fieldCount: t.fields.length,
          fieldNames: t.fields.map((f) => f.name),
        })),
      };
    },
  );

  /**
   * v0.70 POST /api/servers/:id/tables/from-template — создать таблицу
   * с пред-заданным набором полей. Эквивалент обычного create + N add-
   * field в одной транзакции, плюс правильный default name.
   */
  app.post(
    "/api/servers/:id/tables/from-template",
    { onRequest: [requireJwt] },
    async (req, reply) => {
      const userId = getUserId(req);
      if (!userId) return reply.status(401).send({ error: "Unauthorized" });
      const { id: serverId } = req.params as { id: string };
      const member = await requireServerMember(userId, serverId);
      if (!member) {
        return reply.status(403).send({ error: "Not a member of this server" });
      }
      const parsed = fromTemplateBody.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid body" });
      }
      const tpl = getTemplate(parsed.data.templateId);
      if (!tpl) {
        return reply.status(400).send({ error: `Unknown template: ${parsed.data.templateId}` });
      }
      const created = await db.table.create({
        data: {
          serverId,
          channelId: parsed.data.channelId ?? null,
          name: parsed.data.name?.trim() || tpl.defaultName,
          description: parsed.data.description ?? null,
          createdByUserId: userId,
          fields: {
            create: tpl.fields.map((f, idx) => ({
              name: f.name,
              type: f.type,
              position: idx,
              options:
                f.type === "STATUS" && f.options
                  ? JSON.stringify(f.options)
                  : null,
            })),
          },
        },
        include: {
          createdBy: { select: { id: true, displayName: true, avatar: true } },
          fields: true,
          rows: {
            include: {
              cells: true,
              // v0.90 #10 phase 4: linked ActionItem snapshot для row badge.
              actionItem: {
                select: {
                  id: true,
                  title: true,
                  type: true,
                  status: true,
                  priority: true,
                  approvalStatus: true,
                  dueAt: true,
                  assigneeUserId: true,
                  channelId: true,
                },
              },
            },
          },
        },
      });
      emitTableEvent(serverId, "table:updated", {
        serverId,
        id: created.id,
        name: created.name,
        description: created.description,
        channelId: created.channelId,
      });
      return { table: serializeTable(created) };
    },
  );

  /** DELETE row — cascade удаляет cells. */
  app.delete(
    "/api/tables/:id/rows/:rowId",
    { onRequest: [requireJwt] },
    async (req, reply) => {
      const userId = getUserId(req);
      if (!userId) return reply.status(401).send({ error: "Unauthorized" });
      const { id: tableId, rowId } = req.params as { id: string; rowId: string };
      const row = await db.tableRow.findUnique({
        where: { id: rowId },
        select: { tableId: true, table: { select: { serverId: true } } },
      });
      if (!row || row.tableId !== tableId) {
        return reply.status(404).send({ error: "Row not found" });
      }
      const member = await requireServerMember(userId, row.table.serverId);
      if (!member) {
        return reply.status(403).send({ error: "Not a member of this server" });
      }
      await db.tableRow.delete({ where: { id: rowId } });
      emitTableEvent(row.table.serverId, "table:row:deleted", {
        tableId,
        rowId,
      });
      return { ok: true };
    },
  );

  /**
   * v0.90 #10 phase 4: convert table row → first-class ActionItem.
   *
   * POST /api/tables/:id/rows/:rowId/to-action
   * Body: `{ type?: "TASK" | "DECISION" | "FOLLOW_UP" }` (default TASK).
   *
   * Lifecycle:
   *   1. Validate row + table; row не должен быть already linked.
   *   2. Table должна быть привязана к channel'у — иначе 400 (нет где
   *      создавать source message + ActionItem).
   *   3. Pick title из первого NON-EMPTY TEXT cell (fallback на
   *      «Строка #{position+1} из {tableName}»).
   *   4. Post system message в channel («Задача из таблицы…»).
   *   5. Create ActionItem с этим message как source.
   *   6. Update row.actionItemId.
   *   7. Emit `table:row:updated` + `action:item:created`.
   *
   * Sync direction phase 4a: ONE-WAY (row → task). Phase 4b — bidirectional
   * STATUS column ↔ ActionItem.status + title column ↔ ActionItem.title.
   */
  const toActionBody = z
    .object({
      type: z.enum(["TASK", "DECISION", "FOLLOW_UP"]).optional(),
    })
    .optional();

  app.post(
    "/api/tables/:id/rows/:rowId/to-action",
    { onRequest: [requireJwt] },
    async (req, reply) => {
      const userId = getUserId(req);
      if (!userId) return reply.status(401).send({ error: "Unauthorized" });
      const { id: tableId, rowId } = req.params as { id: string; rowId: string };
      const parsed = toActionBody.safeParse(req.body ?? {});
      const actionType = parsed.success
        ? (parsed.data?.type ?? "TASK")
        : "TASK";
      const row = await db.tableRow.findUnique({
        where: { id: rowId },
        include: {
          cells: true,
          table: {
            select: {
              id: true,
              name: true,
              serverId: true,
              channelId: true,
              fields: {
                select: { id: true, name: true, type: true, position: true },
              },
            },
          },
        },
      });
      if (!row || row.tableId !== tableId) {
        return reply.status(404).send({ error: "Row not found" });
      }
      if (row.actionItemId) {
        return reply
          .status(409)
          .send({ error: "Эта строка уже привязана к задаче" });
      }
      const member = await requireServerMember(userId, row.table.serverId);
      if (!member) {
        return reply.status(403).send({ error: "Not a member of this server" });
      }
      if (!row.table.channelId) {
        return reply.status(400).send({
          error:
            "Привяжи таблицу к каналу в настройках чтобы создавать задачи из строк",
        });
      }
      const channel = await db.channel.findUnique({
        where: { id: row.table.channelId },
        select: { id: true, type: true, serverId: true },
      });
      if (!channel || channel.serverId !== row.table.serverId) {
        return reply.status(400).send({ error: "Channel not in this server" });
      }
      if (channel.type === "VOICE") {
        return reply.status(400).send({
          error: "Нельзя создать задачу из voice-канала — привяжи таблицу к TEXT каналу",
        });
      }

      // Derive title: первый TEXT field's non-empty cell value.
      const textFields = row.table.fields
        .filter((f) => f.type === "TEXT")
        .sort((a, b) => a.position - b.position);
      let title = "";
      for (const f of textFields) {
        const cell = row.cells.find((c) => c.fieldId === f.id);
        if (cell?.value) {
          title = cell.value.trim().slice(0, 160);
          if (title) break;
        }
      }
      if (!title) {
        title = `Строка #${row.position + 1} из «${row.table.name}»`.slice(0, 160);
      }

      const systemUserId = await getSystemBotUserId();
      const provenanceText =
        `📋 Задача создана из таблицы **«${row.table.name}»** (строка #${row.position + 1}): ` +
        title;

      // Transaction: post system message + create action + link row.
      const result = await db.$transaction(async (tx) => {
        const message = await tx.message.create({
          data: {
            content: provenanceText,
            userId: systemUserId,
            channelId: channel.id,
          },
          include: {
            user: { select: { id: true, displayName: true, avatar: true } },
          },
        });
        const action = await tx.actionItem.create({
          data: {
            title,
            type: actionType,
            serverId: row.table.serverId,
            channelId: channel.id,
            sourceMessageId: message.id,
            createdByUserId: userId,
            activities: {
              create: {
                userId,
                type: "CREATED",
                payload: JSON.stringify({
                  source: "table-row",
                  tableId,
                  rowId,
                  type: actionType,
                }),
              },
            },
          },
          include: actionItemInclude,
        });
        const updatedRow = await tx.tableRow.update({
          where: { id: rowId },
          data: { actionItemId: action.id },
          include: { cells: true },
        });
        return { message, action, updatedRow };
      });

      // Emit events (вне transaction'а).
      emitMessageOnChannel(channel.id, {
        messageId: result.message.id,
        content: result.message.content,
        channelId: channel.id,
        userId: result.message.userId!,
        displayName: result.message.user?.displayName ?? "System",
        avatar: result.message.user?.avatar ?? null,
        isBot: true,
        createdAt: result.message.createdAt.toISOString(),
        attachments: [],
      });
      const actionPayload = serializeActionItem(result.action);
      emitActionItemCreated(channel.id, actionPayload);
      emitTableEvent(row.table.serverId, "table:row:updated", {
        tableId,
        row: {
          id: result.updatedRow.id,
          position: result.updatedRow.position,
          createdAt: result.updatedRow.createdAt.toISOString(),
          updatedAt: result.updatedRow.updatedAt.toISOString(),
          actionItemId: result.updatedRow.actionItemId,
          cells: result.updatedRow.cells.map((c) => ({
            fieldId: c.fieldId,
            value: c.value,
          })),
        },
      });
      return {
        rowId,
        actionItemId: result.action.id,
        action: actionPayload,
      };
    },
  );

  /**
   * v0.75 #10 phase 2.5b: GET /api/tables/:id/related-rows?fieldId=X
   * Возвращает rows из linkedTable поля X с display value (значение
   * первой колонки) — для RELATION picker'а на frontend'е. Membership
   * resolved через source table.
   */
  app.get(
    "/api/tables/:id/related-rows",
    { onRequest: [requireJwt] },
    async (req, reply) => {
      const userId = getUserId(req);
      if (!userId) return reply.status(401).send({ error: "Unauthorized" });
      const { id: tableId } = req.params as { id: string };
      const { fieldId } = req.query as { fieldId?: string };
      if (!fieldId) {
        return reply.status(400).send({ error: "fieldId is required" });
      }
      const field = await db.tableField.findUnique({
        where: { id: fieldId },
        select: {
          tableId: true,
          type: true,
          linkedTableId: true,
          table: { select: { serverId: true } },
        },
      });
      if (!field || field.tableId !== tableId) {
        return reply.status(404).send({ error: "Field not found" });
      }
      if (field.type !== "RELATION" || !field.linkedTableId) {
        return reply
          .status(400)
          .send({ error: "Field is not a RELATION or has no linked table" });
      }
      const member = await requireServerMember(userId, field.table.serverId);
      if (!member) {
        return reply.status(403).send({ error: "Not a member of this server" });
      }
      // Display column = первое поле linked table'а (position=0).
      const linkedFields = await db.tableField.findMany({
        where: { tableId: field.linkedTableId },
        orderBy: { position: "asc" },
        select: { id: true, name: true },
        take: 1,
      });
      const displayFieldId = linkedFields[0]?.id ?? null;
      const rows = await db.tableRow.findMany({
        where: { tableId: field.linkedTableId },
        orderBy: { position: "asc" },
        take: 200,
        select: {
          id: true,
          cells: displayFieldId
            ? {
                where: { fieldId: displayFieldId },
                select: { value: true },
              }
            : false,
        },
      });
      return {
        linkedTableId: field.linkedTableId,
        displayFieldName: linkedFields[0]?.name ?? null,
        rows: rows.map((r) => ({
          id: r.id,
          display:
            displayFieldId && Array.isArray(r.cells) && r.cells[0]
              ? r.cells[0].value
              : `(${r.id.slice(0, 6)})`,
        })),
      };
    },
  );

  /**
   * v0.75 #10 phase 2.5b: POST /api/tables/:id/upload — upload files
   * для FILE-ячейки. Base64 inline (как везде), сохраняются на диск
   * через `processStandaloneFile` без Attachment row. Возвращает
   * массив `{url, filename, mimeType, size}` — клиент кладёт в cell
   * как JSON. Cap: 5 файлов за раз, 50/200 MB per file (как везде).
   */
  /**
   * v0.87 #10 phase 3: AI-fill empty cells in a row.
   *
   * POST /api/tables/:id/rows/:rowId/ai-fill
   *
   * Просит AI заполнить пустые ячейки row'а на основе:
   *   - Table schema (имена + типы полей + STATUS options).
   *   - Sample rows (top 3 fully-filled) для tone/format reference.
   *   - Существующих заполненных ячеек этой row (контекст).
   *
   * Returns JSON `{ updates: Array<{ fieldId, value }> }` — клиент потом
   * PATCH'ает row через стандартный update-row endpoint. Этот endpoint
   * READ-ONLY — он только генерирует suggestion, не сохраняет.
   *
   * Skipped fields: FILE / RELATION / USER — AI не умеет валидно угадывать
   * id'шники. Если AI не configured → 503 с понятным сообщением.
   */
  app.post(
    "/api/tables/:id/rows/:rowId/ai-fill",
    {
      onRequest: [requireJwt],
      // v0.91 stability hardening: rate-limit per IP. AI-fill попадает
      // в Ollama/OpenRouter/OpenAI чейн — burst клики могли бы перегрузить
      // upstream + удерживать DB connections на ожидании. 20 req за 60s
      // достаточно для нормального workflow; spam-cooling.
      config: {
        rateLimit: { max: 20, timeWindow: 60 * 1000 },
      },
    },
    async (req, reply) => {
      const userId = getUserId(req);
      if (!userId) return reply.status(401).send({ error: "Unauthorized" });
      const { id: tableId, rowId } = req.params as { id: string; rowId: string };
      const table = await db.table.findUnique({
        where: { id: tableId },
        include: {
          fields: true,
          rows: {
            include: {
              cells: true,
              // v0.90 #10 phase 4: linked ActionItem snapshot для row badge.
              actionItem: {
                select: {
                  id: true,
                  title: true,
                  type: true,
                  status: true,
                  priority: true,
                  approvalStatus: true,
                  dueAt: true,
                  assigneeUserId: true,
                  channelId: true,
                },
              },
            },
          },
        },
      });
      if (!table) return reply.status(404).send({ error: "Table not found" });
      const member = await requireServerMember(userId, table.serverId);
      if (!member) {
        return reply.status(403).send({ error: "Not a member of this server" });
      }
      const row = table.rows.find((r) => r.id === rowId);
      if (!row) return reply.status(404).send({ error: "Row not found" });

      // Только AI-fillable types — skip FILE/RELATION/USER.
      const fillableFields = table.fields
        .slice()
        .sort((a, b) => a.position - b.position)
        .filter((f) =>
          ["TEXT", "NUMBER", "STATUS", "DATE", "CHECKBOX"].includes(f.type),
        );
      if (fillableFields.length === 0) {
        return reply
          .status(400)
          .send({ error: "Нет полей для AI-заполнения в этой таблице" });
      }

      // Какие cells пустые в этой row.
      const currentCells = new Map(row.cells.map((c) => [c.fieldId, c.value]));
      const emptyFieldIds = fillableFields
        .map((f) => f.id)
        .filter((id) => {
          const v = currentCells.get(id);
          return v === undefined || v === "";
        });
      if (emptyFieldIds.length === 0) {
        return reply.status(400).send({ error: "Все поля уже заполнены" });
      }

      // Sample rows — берём first 3 с самым большим non-empty count, не-target row.
      const sampleRows = table.rows
        .filter((r) => r.id !== rowId)
        .map((r) => ({
          cells: r.cells,
          filledCount: r.cells.filter((c) => c.value).length,
        }))
        .sort((a, b) => b.filledCount - a.filledCount)
        .slice(0, 3);

      const schemaPart = fillableFields
        .map((f) => {
          const opts = serializeOptions(f.options);
          const optsHint =
            f.type === "STATUS" && opts && opts.length > 0
              ? ` (allowed: ${opts.join(" | ")})`
              : "";
          return `- ${f.name} (${f.type}${optsHint})`;
        })
        .join("\n");

      const samplePart = sampleRows.length
        ? sampleRows
            .map((r, idx) => {
              const pairs = fillableFields
                .map((f) => {
                  const c = r.cells.find((c) => c.fieldId === f.id);
                  return `${f.name}: ${c?.value ?? "—"}`;
                })
                .join("; ");
              return `Row ${idx + 1}: ${pairs}`;
            })
            .join("\n")
        : "(no example rows yet)";

      const currentPart = fillableFields
        .map((f) => {
          const v = currentCells.get(f.id);
          return `${f.name}: ${v && v !== "" ? v : "<EMPTY>"}`;
        })
        .join("; ");

      const fillTargets = emptyFieldIds
        .map((id) => fillableFields.find((f) => f.id === id))
        .filter((f): f is NonNullable<typeof f> => Boolean(f))
        .map((f) => `"${f.name}"`)
        .join(", ");

      // Compact JSON-only prompt — AI должен вернуть структурированный JSON.
      const messages = [
        {
          role: "system" as const,
          content:
            "Ты — operational assistant в Eclipse Chat. Заполни пустые ячейки таблицы " +
            "на основе схемы и существующих rows. Отвечай ТОЛЬКО валидным JSON массивом " +
            "вида: [{\"name\":\"<column name>\",\"value\":\"<value>\"}]. Никаких пояснений, " +
            "никаких маркеров, никакого markdown. Для STATUS поля используй ТОЛЬКО " +
            "значения из allowed list. Для NUMBER — число без единиц. Для DATE — формат " +
            "YYYY-MM-DD. Для CHECKBOX — \"true\" или \"false\". Если не уверен в значении — " +
            "пропусти поле (не включай в массив).",
        },
        {
          role: "user" as const,
          content: [
            `Table: ${table.name}`,
            `Columns:\n${schemaPart}`,
            `Example rows:\n${samplePart}`,
            `Current row (fill EMPTY): ${currentPart}`,
            `Fill these columns: ${fillTargets}`,
            "JSON response:",
          ].join("\n\n"),
        },
      ];

      let raw: string;
      try {
        const result = await chat(messages, {
          maxTokens: 500,
          temperature: 0.3,
        });
        raw = result.text;
      } catch (err) {
        if (err instanceof AINotConfiguredError) {
          return reply.status(503).send({ error: "AI не настроен на сервере" });
        }
        req.log.warn({ err }, "Table AI-fill chat() failed");
        return reply.status(500).send({ error: "AI failed" });
      }

      // Парсим JSON. AI иногда оборачивает в ```json ``` — strip.
      const cleaned = raw
        .replace(/^[\s\S]*?(\[)/, "$1") // обрезаем всё до первой `[`
        .replace(/([\]\}])[\s\S]*$/, "$1"); // и всё после последней `]`
      let parsedJson: Array<{ name?: string; value?: string }> = [];
      try {
        const json = JSON.parse(cleaned);
        if (Array.isArray(json)) {
          parsedJson = json;
        }
      } catch (err) {
        req.log.warn({ err, raw }, "Table AI-fill JSON parse failed");
        return reply.status(500).send({ error: "AI вернул невалидный JSON" });
      }

      // Map name→fieldId + validate STATUS options.
      const nameMap = new Map(fillableFields.map((f) => [f.name.toLowerCase(), f]));
      const updates: Array<{ fieldId: string; value: string; fieldName: string }> = [];
      for (const entry of parsedJson) {
        if (!entry.name || entry.value === undefined) continue;
        const field = nameMap.get(entry.name.toLowerCase());
        if (!field) continue;
        if (!emptyFieldIds.includes(field.id)) continue; // не overwrite заполненные
        const value = String(entry.value).trim().slice(0, 4000);
        if (!value) continue;
        // STATUS validation: значение должно быть в options.
        if (field.type === "STATUS") {
          const opts = serializeOptions(field.options);
          if (opts && opts.length > 0 && !opts.includes(value)) continue;
        }
        // CHECKBOX normalization.
        if (field.type === "CHECKBOX") {
          if (value !== "true" && value !== "false") continue;
        }
        // NUMBER validation.
        if (field.type === "NUMBER") {
          const n = parseFloat(value.replace(",", "."));
          if (!Number.isFinite(n)) continue;
        }
        // DATE validation: ISO date.
        if (field.type === "DATE") {
          if (!/^\d{4}-\d{2}-\d{2}/.test(value)) continue;
        }
        updates.push({ fieldId: field.id, value, fieldName: field.name });
      }

      return {
        rowId,
        suggestions: updates.map(({ fieldId, value, fieldName }) => ({
          fieldId,
          fieldName,
          value,
        })),
      };
    },
  );

  app.post(
    "/api/tables/:id/upload",
    { onRequest: [requireJwt] },
    async (req, reply) => {
      const userId = getUserId(req);
      if (!userId) return reply.status(401).send({ error: "Unauthorized" });
      const { id: tableId } = req.params as { id: string };
      const parsed = tableUploadBody.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid body" });
      }
      const table = await db.table.findUnique({
        where: { id: tableId },
        select: { serverId: true },
      });
      if (!table) return reply.status(404).send({ error: "Table not found" });
      const member = await requireServerMember(userId, table.serverId);
      if (!member) {
        return reply.status(403).send({ error: "Not a member of this server" });
      }
      try {
        const files = await Promise.all(
          parsed.data.files.map((f, idx) =>
            processStandaloneFile(f, tableId, idx),
          ),
        );
        return { files };
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Upload failed";
        return reply.status(400).send({ error: msg });
      }
    },
  );
}
