import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../db.js";
import { getUserId, requireJwt } from "../auth/requireJwt.js";
import { emitTableEvent } from "../realtime.js";
import { TABLE_TEMPLATES, getTemplate } from "../lib/tableTemplates.js";

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
]);

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
});

const updateFieldBody = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  options: z.array(z.string().min(1).max(40)).max(20).nullable().optional(),
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

async function requireServerMember(userId: string, serverId: string) {
  const member = await db.member.findUnique({
    where: { userId_serverId: { userId, serverId } },
    select: { id: true, role: true },
  });
  return member;
}

/** v0.62: MOD+ check для destructive ops. */
function isMod(role: "OWNER" | "ADMIN" | "MODERATOR" | "MEMBER"): boolean {
  return role === "OWNER" || role === "ADMIN" || role === "MODERATOR";
}

/**
 * v0.62: coerce + validate cell value по field.type.
 * USER — проверяет что value это userId of member данного server'а.
 * CHECKBOX — coerce в "true"/"false" (любой truthy → "true").
 * Остальные типы — passthrough (frontend сам coerce'ит при render).
 */
async function coerceCellValue(
  fieldType: "TEXT" | "NUMBER" | "STATUS" | "DATE" | "USER" | "CHECKBOX",
  value: string,
  serverId: string,
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
    type: "TEXT" | "NUMBER" | "STATUS" | "DATE" | "USER" | "CHECKBOX";
    options: string | null;
    position: number;
  }>;
  rows: Array<{
    id: string;
    position: number;
    createdAt: Date;
    updatedAt: Date;
    cells: Array<{ rowId: string; fieldId: string; value: string }>;
  }>;
}) {
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
      })),
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
          rows: { include: { cells: true } },
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
          rows: { include: { cells: true } },
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
        select: { id: true, type: true },
      });
      const fieldMap = new Map(fields.map((f) => [f.id, f.type]));
      const invalid = fieldIds.filter((id) => !fieldMap.has(id));
      if (invalid.length > 0) {
        return reply
          .status(400)
          .send({ error: "Some fieldIds do not belong to this table", invalid });
      }

      // v0.62: coerce / validate cell values по типу поля.
      const coercedCells: Array<{ fieldId: string; value: string }> = [];
      for (const cell of parsed.data.cells) {
        const type = fieldMap.get(cell.fieldId)!;
        const result = await coerceCellValue(type, cell.value, row.table.serverId);
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
          rows: { include: { cells: true } },
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
}
