import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getUserId, requireJwt } from "../auth/requireJwt.js";
import { db } from "../db.js";
import type { MemberRole } from "./servers.js";

/**
 * v0.86 #24 phase 2 — Invoice CRUD.
 *
 * Денежные значения в **копейках** (Int). Frontend форматит /100 для display.
 * Currency — ISO 4217 code (RUB / USD / EUR / etc), default "RUB".
 *
 * Permission model:
 *   - OWNER/ADMIN — full CRUD + status transitions.
 *   - Все остальные роли — 403 на admin routes. Client-facing display
 *     (SENT/PAID only) идёт через GET /api/servers/:id/client-portal
 *     (см. routes/clientPortal.ts).
 *
 * Status workflow:
 *   DRAFT → SENT (set issuedAt)
 *   SENT  → PAID (set paidAt)
 *   SENT  → CANCELLED (paidAt остаётся null)
 *   DRAFT → CANCELLED (никогда не было issued — нет смысла)
 *   PAID  → ничего (final state)
 *
 * Phase 2b (deferred): PDF generation. Заблокировано — pdfkit npm install
 * упирается в registry ECONNRESET, deferred до следующего слайса.
 */

const createInvoiceBody = z.object({
  number: z.string().trim().min(1).max(64),
  title: z.string().trim().min(1).max(200),
  currency: z.string().trim().length(3).optional(),
  dueAt: z.string().datetime().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  items: z
    .array(
      z.object({
        title: z.string().trim().min(1).max(200),
        amount: z.number().int().min(0).max(1_000_000_000_00),
      }),
    )
    .optional(),
});

const updateInvoiceBody = z.object({
  number: z.string().trim().min(1).max(64).optional(),
  title: z.string().trim().min(1).max(200).optional(),
  currency: z.string().trim().length(3).optional(),
  dueAt: z.string().datetime().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

const itemBody = z.object({
  title: z.string().trim().min(1).max(200),
  amount: z.number().int().min(0).max(1_000_000_000_00),
  position: z.number().int().min(0).max(1000).optional(),
});

const statusBody = z.object({
  status: z.enum(["DRAFT", "SENT", "PAID", "CANCELLED"]),
});

type InvoiceWithItems = {
  id: string;
  serverId: string;
  number: string;
  title: string;
  status: "DRAFT" | "SENT" | "PAID" | "CANCELLED";
  currency: string;
  amountTotal: number;
  issuedAt: Date | null;
  dueAt: Date | null;
  paidAt: Date | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  createdBy: { id: string; displayName: string; avatar: string | null } | null;
  items: Array<{ id: string; position: number; title: string; amount: number }>;
};

function serializeInvoice(inv: InvoiceWithItems) {
  return {
    id: inv.id,
    serverId: inv.serverId,
    number: inv.number,
    title: inv.title,
    status: inv.status,
    currency: inv.currency,
    amountTotal: inv.amountTotal,
    issuedAt: inv.issuedAt?.toISOString() ?? null,
    dueAt: inv.dueAt?.toISOString() ?? null,
    paidAt: inv.paidAt?.toISOString() ?? null,
    notes: inv.notes,
    createdAt: inv.createdAt.toISOString(),
    updatedAt: inv.updatedAt.toISOString(),
    createdBy: inv.createdBy,
    items: inv.items
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((i) => ({
        id: i.id,
        position: i.position,
        title: i.title,
        amount: i.amount,
      })),
  };
}

const invoiceInclude = {
  items: { select: { id: true, position: true, title: true, amount: true } },
  createdBy: { select: { id: true, displayName: true, avatar: true } },
} as const;

async function isAdmin(
  userId: string,
  serverId: string,
): Promise<MemberRole | null> {
  const member = await db.member.findUnique({
    where: { userId_serverId: { userId, serverId } },
    select: { role: true },
  });
  if (!member) return null;
  if (member.role === "OWNER" || member.role === "ADMIN") {
    return member.role as MemberRole;
  }
  return null;
}

/** Пересчёт `amountTotal` после insert/update/delete item'а. */
async function recomputeTotal(
  tx: Parameters<Parameters<typeof db.$transaction>[0]>[0],
  invoiceId: string,
): Promise<number> {
  const agg = await tx.invoiceItem.aggregate({
    where: { invoiceId },
    _sum: { amount: true },
  });
  const total = agg._sum.amount ?? 0;
  await tx.invoice.update({
    where: { id: invoiceId },
    data: { amountTotal: total },
  });
  return total;
}

export function registerInvoiceRoutes(app: FastifyInstance) {
  /** List server invoices (admin). */
  app.get(
    "/api/servers/:id/invoices",
    { onRequest: [requireJwt] },
    async (req, reply) => {
      const userId = getUserId(req);
      if (!userId) return reply.status(401).send({ error: "Unauthorized" });
      const { id: serverId } = req.params as { id: string };
      const role = await isAdmin(userId, serverId);
      if (!role) {
        return reply.status(403).send({ error: "Admin only" });
      }
      const list = await db.invoice.findMany({
        where: { serverId },
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
        take: 200,
        include: invoiceInclude,
      });
      return { invoices: list.map(serializeInvoice) };
    },
  );

  /** Create draft invoice. */
  app.post(
    "/api/servers/:id/invoices",
    { onRequest: [requireJwt] },
    async (req, reply) => {
      const userId = getUserId(req);
      if (!userId) return reply.status(401).send({ error: "Unauthorized" });
      const { id: serverId } = req.params as { id: string };
      const role = await isAdmin(userId, serverId);
      if (!role) return reply.status(403).send({ error: "Admin only" });
      const parsed = createInvoiceBody.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid body" });
      }
      const items = parsed.data.items ?? [];
      try {
        const created = await db.$transaction(async (tx) => {
          const inv = await tx.invoice.create({
            data: {
              serverId,
              number: parsed.data.number,
              title: parsed.data.title,
              currency: parsed.data.currency ?? "RUB",
              dueAt: parsed.data.dueAt ? new Date(parsed.data.dueAt) : null,
              notes: parsed.data.notes ?? null,
              createdByUserId: userId,
              amountTotal: items.reduce((s, it) => s + it.amount, 0),
            },
          });
          if (items.length > 0) {
            await tx.invoiceItem.createMany({
              data: items.map((it, idx) => ({
                invoiceId: inv.id,
                position: idx,
                title: it.title,
                amount: it.amount,
              })),
            });
          }
          return tx.invoice.findUnique({
            where: { id: inv.id },
            include: invoiceInclude,
          });
        });
        if (!created) {
          return reply.status(500).send({ error: "Failed to create" });
        }
        return { invoice: serializeInvoice(created) };
      } catch (err: unknown) {
        if (
          err &&
          typeof err === "object" &&
          "code" in err &&
          (err as { code: string }).code === "P2002"
        ) {
          return reply
            .status(409)
            .send({ error: "Номер счёта уже используется в этом пространстве" });
        }
        throw err;
      }
    },
  );

  /** Get single (admin). Client portal returns invoices через свой endpoint. */
  app.get(
    "/api/invoices/:id",
    { onRequest: [requireJwt] },
    async (req, reply) => {
      const userId = getUserId(req);
      if (!userId) return reply.status(401).send({ error: "Unauthorized" });
      const { id: invoiceId } = req.params as { id: string };
      const inv = await db.invoice.findUnique({
        where: { id: invoiceId },
        include: invoiceInclude,
      });
      if (!inv) return reply.status(404).send({ error: "Invoice not found" });
      const role = await isAdmin(userId, inv.serverId);
      if (!role) {
        // CLIENT может видеть SENT/PAID, остальное — 403.
        const member = await db.member.findUnique({
          where: { userId_serverId: { userId, serverId: inv.serverId } },
          select: { role: true },
        });
        if (!member) return reply.status(403).send({ error: "Forbidden" });
        if (member.role !== "CLIENT" && member.role !== "VIEWER") {
          return reply.status(403).send({ error: "Forbidden" });
        }
        if (inv.status !== "SENT" && inv.status !== "PAID") {
          return reply.status(403).send({ error: "Forbidden" });
        }
      }
      return { invoice: serializeInvoice(inv) };
    },
  );

  /** Update fields (admin). */
  app.patch(
    "/api/invoices/:id",
    { onRequest: [requireJwt] },
    async (req, reply) => {
      const userId = getUserId(req);
      if (!userId) return reply.status(401).send({ error: "Unauthorized" });
      const { id: invoiceId } = req.params as { id: string };
      const parsed = updateInvoiceBody.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid body" });
      }
      const existing = await db.invoice.findUnique({
        where: { id: invoiceId },
        select: { id: true, serverId: true },
      });
      if (!existing) return reply.status(404).send({ error: "Invoice not found" });
      const role = await isAdmin(userId, existing.serverId);
      if (!role) return reply.status(403).send({ error: "Admin only" });
      try {
        const updated = await db.invoice.update({
          where: { id: invoiceId },
          data: {
            ...(parsed.data.number !== undefined ? { number: parsed.data.number } : {}),
            ...(parsed.data.title !== undefined ? { title: parsed.data.title } : {}),
            ...(parsed.data.currency !== undefined
              ? { currency: parsed.data.currency }
              : {}),
            ...(parsed.data.dueAt !== undefined
              ? { dueAt: parsed.data.dueAt ? new Date(parsed.data.dueAt) : null }
              : {}),
            ...(parsed.data.notes !== undefined ? { notes: parsed.data.notes } : {}),
          },
          include: invoiceInclude,
        });
        return { invoice: serializeInvoice(updated) };
      } catch (err: unknown) {
        if (
          err &&
          typeof err === "object" &&
          "code" in err &&
          (err as { code: string }).code === "P2002"
        ) {
          return reply.status(409).send({ error: "Номер счёта уже используется" });
        }
        throw err;
      }
    },
  );

  /** Delete (admin). */
  app.delete(
    "/api/invoices/:id",
    { onRequest: [requireJwt] },
    async (req, reply) => {
      const userId = getUserId(req);
      if (!userId) return reply.status(401).send({ error: "Unauthorized" });
      const { id: invoiceId } = req.params as { id: string };
      const inv = await db.invoice.findUnique({
        where: { id: invoiceId },
        select: { serverId: true },
      });
      if (!inv) return reply.status(404).send({ error: "Invoice not found" });
      const role = await isAdmin(userId, inv.serverId);
      if (!role) return reply.status(403).send({ error: "Admin only" });
      await db.invoice.delete({ where: { id: invoiceId } });
      return { deleted: true };
    },
  );

  /** Add line item. */
  app.post(
    "/api/invoices/:id/items",
    { onRequest: [requireJwt] },
    async (req, reply) => {
      const userId = getUserId(req);
      if (!userId) return reply.status(401).send({ error: "Unauthorized" });
      const { id: invoiceId } = req.params as { id: string };
      const parsed = itemBody.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid body" });
      }
      const inv = await db.invoice.findUnique({
        where: { id: invoiceId },
        select: { serverId: true },
      });
      if (!inv) return reply.status(404).send({ error: "Invoice not found" });
      const role = await isAdmin(userId, inv.serverId);
      if (!role) return reply.status(403).send({ error: "Admin only" });
      const updated = await db.$transaction(async (tx) => {
        // Default position — после последнего.
        let position = parsed.data.position;
        if (position === undefined) {
          const last = await tx.invoiceItem.findFirst({
            where: { invoiceId },
            orderBy: { position: "desc" },
            select: { position: true },
          });
          position = (last?.position ?? -1) + 1;
        }
        await tx.invoiceItem.create({
          data: {
            invoiceId,
            position,
            title: parsed.data.title,
            amount: parsed.data.amount,
          },
        });
        await recomputeTotal(tx, invoiceId);
        return tx.invoice.findUnique({
          where: { id: invoiceId },
          include: invoiceInclude,
        });
      });
      if (!updated) return reply.status(500).send({ error: "Failed" });
      return { invoice: serializeInvoice(updated) };
    },
  );

  /** Update line item. */
  app.patch(
    "/api/invoices/:id/items/:itemId",
    { onRequest: [requireJwt] },
    async (req, reply) => {
      const userId = getUserId(req);
      if (!userId) return reply.status(401).send({ error: "Unauthorized" });
      const { id: invoiceId, itemId } = req.params as {
        id: string;
        itemId: string;
      };
      const parsed = itemBody.partial().safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid body" });
      }
      const item = await db.invoiceItem.findUnique({
        where: { id: itemId },
        select: { invoiceId: true, invoice: { select: { serverId: true } } },
      });
      if (!item || item.invoiceId !== invoiceId) {
        return reply.status(404).send({ error: "Item not found" });
      }
      const role = await isAdmin(userId, item.invoice.serverId);
      if (!role) return reply.status(403).send({ error: "Admin only" });
      const updated = await db.$transaction(async (tx) => {
        await tx.invoiceItem.update({
          where: { id: itemId },
          data: {
            ...(parsed.data.title !== undefined ? { title: parsed.data.title } : {}),
            ...(parsed.data.amount !== undefined
              ? { amount: parsed.data.amount }
              : {}),
            ...(parsed.data.position !== undefined
              ? { position: parsed.data.position }
              : {}),
          },
        });
        if (parsed.data.amount !== undefined) {
          await recomputeTotal(tx, invoiceId);
        }
        return tx.invoice.findUnique({
          where: { id: invoiceId },
          include: invoiceInclude,
        });
      });
      if (!updated) return reply.status(500).send({ error: "Failed" });
      return { invoice: serializeInvoice(updated) };
    },
  );

  /** Delete line item. */
  app.delete(
    "/api/invoices/:id/items/:itemId",
    { onRequest: [requireJwt] },
    async (req, reply) => {
      const userId = getUserId(req);
      if (!userId) return reply.status(401).send({ error: "Unauthorized" });
      const { id: invoiceId, itemId } = req.params as {
        id: string;
        itemId: string;
      };
      const item = await db.invoiceItem.findUnique({
        where: { id: itemId },
        select: { invoiceId: true, invoice: { select: { serverId: true } } },
      });
      if (!item || item.invoiceId !== invoiceId) {
        return reply.status(404).send({ error: "Item not found" });
      }
      const role = await isAdmin(userId, item.invoice.serverId);
      if (!role) return reply.status(403).send({ error: "Admin only" });
      const updated = await db.$transaction(async (tx) => {
        await tx.invoiceItem.delete({ where: { id: itemId } });
        await recomputeTotal(tx, invoiceId);
        return tx.invoice.findUnique({
          where: { id: invoiceId },
          include: invoiceInclude,
        });
      });
      if (!updated) return reply.status(500).send({ error: "Failed" });
      return { invoice: serializeInvoice(updated) };
    },
  );

  /** Status transition. Sets issuedAt/paidAt automatically. */
  app.post(
    "/api/invoices/:id/status",
    { onRequest: [requireJwt] },
    async (req, reply) => {
      const userId = getUserId(req);
      if (!userId) return reply.status(401).send({ error: "Unauthorized" });
      const { id: invoiceId } = req.params as { id: string };
      const parsed = statusBody.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid body" });
      }
      const inv = await db.invoice.findUnique({
        where: { id: invoiceId },
        select: { serverId: true, status: true, issuedAt: true, paidAt: true },
      });
      if (!inv) return reply.status(404).send({ error: "Invoice not found" });
      const role = await isAdmin(userId, inv.serverId);
      if (!role) return reply.status(403).send({ error: "Admin only" });
      const next = parsed.data.status;
      const now = new Date();
      const updated = await db.invoice.update({
        where: { id: invoiceId },
        data: {
          status: next,
          // issuedAt set'аем только при первом DRAFT→SENT.
          ...(next === "SENT" && !inv.issuedAt ? { issuedAt: now } : {}),
          ...(next === "PAID" && !inv.paidAt ? { paidAt: now } : {}),
          // Если откатываем в DRAFT — стираем issuedAt + paidAt (для тестов /
          // ошибок). UX вопрос — оставлю destructive поведение под admin'ом.
          ...(next === "DRAFT" ? { issuedAt: null, paidAt: null } : {}),
        },
        include: invoiceInclude,
      });
      return { invoice: serializeInvoice(updated) };
    },
  );
}
