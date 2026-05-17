import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../db.js";
import { getUserId, requireJwt } from "../auth/requireJwt.js";

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

const fieldTypeSchema = z.enum(["TEXT", "NUMBER", "STATUS", "DATE"]);

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

async function requireServerMember(userId: string, serverId: string) {
  const member = await db.member.findUnique({
    where: { userId_serverId: { userId, serverId } },
    select: { id: true, role: true },
  });
  return member;
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
    type: "TEXT" | "NUMBER" | "STATUS" | "DATE";
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
      return { table: updated };
    },
  );

  /** DELETE /api/tables/:id — drop (cascade). */
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
      await db.table.delete({ where: { id } });
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
      return {
        field: {
          id: field.id,
          name: field.name,
          type: field.type,
          options: serializeOptions(field.options),
          position: field.position,
        },
      };
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
      return {
        field: {
          id: updated.id,
          name: updated.name,
          type: updated.type,
          options: serializeOptions(updated.options),
          position: updated.position,
        },
      };
    },
  );

  /** DELETE field — cascade удаляет cells этой колонки. */
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
      await db.tableField.delete({ where: { id: fieldId } });
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
      return {
        row: {
          id: row.id,
          position: row.position,
          createdAt: row.createdAt.toISOString(),
          updatedAt: row.updatedAt.toISOString(),
          cells: [],
        },
      };
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
      // Verify все fieldIds принадлежат этой таблице.
      const fieldIds = parsed.data.cells.map((c) => c.fieldId);
      const fields = await db.tableField.findMany({
        where: { id: { in: fieldIds }, tableId },
        select: { id: true },
      });
      const valid = new Set(fields.map((f) => f.id));
      const invalid = fieldIds.filter((id) => !valid.has(id));
      if (invalid.length > 0) {
        return reply
          .status(400)
          .send({ error: "Some fieldIds do not belong to this table", invalid });
      }
      await db.$transaction(async (tx) => {
        for (const cell of parsed.data.cells) {
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
      return {
        row: updated
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
          : null,
      };
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
      return { ok: true };
    },
  );
}
