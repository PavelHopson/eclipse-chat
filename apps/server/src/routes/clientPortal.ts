import type { FastifyInstance } from "fastify";
import { getUserId, requireJwt } from "../auth/requireJwt.js";
import { db } from "../db.js";
import { AINotConfiguredError, chat } from "../ai/provider.js";
import type { MemberRole } from "./servers.js";

/**
 * v0.83 #24 phase 1 — Client Portal.
 *
 *   GET /api/servers/:id/client-portal
 *
 * Client-facing dashboard для CLIENT-mode workspace'ов: project progress,
 * approvals queue, files, recent activity. Endpoint aggregating существующие
 * primitives (ActionItem / Attachment / Member) без новых schema-add'ов.
 *
 * Permission model (phase 1):
 *   - Server.mode MUST be CLIENT — на ENGINEERING serverах endpoint 404 (нет
 *     смысла открывать portal в engineering workspace; signals что service
 *     не предназначен для этого server'а).
 *   - User must be Member. role=CLIENT — primary user (получает clean view,
 *     internal-каналы hidden). OWNER/ADMIN — preview mode (видят те же
 *     данные что увидел бы клиент, но с preview-индикатором). Прочие роли
 *     (MODERATOR / ARCHITECT / DEVELOPER / OPERATOR / VIEWER / MEMBER / GUEST)
 *     получают 403 — portal не для них, у них есть полный workspace.
 *
 * Visibility filter:
 *   - Phase 1: only non-internal channels (Channel.internal=false) учитываются
 *     в aggregations. OWNER/ADMIN preview видят те же данные что и CLIENT —
 *     чтобы preview точно отражал client experience.
 *
 * Phase 2 plans (отдельный slice):
 *   - Invoice model + line items + status workflow.
 *   - PDF reports generation (puppeteer/playwright server-side render).
 *   - AI digest endpoint (existing assistant chain → 5-line summary).
 *   - Public token-based access (client получает ссылку с ?token=, login не
 *     требуется) — нужен careful security pass + rate-limiting.
 */

/** Visible-to-client channel ids — base filter для всех aggregations. */
type ChannelMeta = { id: string; name: string; type: string };

/** Action item summary в portal payload. Compact view, не полный drawer. */
export type PortalActionItem = {
  id: string;
  title: string;
  type: "TASK" | "DECISION" | "FOLLOW_UP";
  status: "OPEN" | "IN_PROGRESS" | "REVIEW" | "DONE";
  priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  dueAt: string | null;
  channelId: string;
  channelName: string;
  assignee: {
    id: string;
    displayName: string;
    avatar: string | null;
  } | null;
  updatedAt: string;
};

export type PortalApproval = {
  id: string;
  title: string;
  type: "TASK" | "DECISION" | "FOLLOW_UP";
  approvalStatus: "PENDING" | "APPROVED" | "REJECTED";
  approvalNote: string | null;
  approvedAt: string | null;
  approver: { id: string; displayName: string; avatar: string | null } | null;
  requestedBy: { id: string; displayName: string; avatar: string | null } | null;
  channelId: string;
  channelName: string;
  updatedAt: string;
};

export type PortalFile = {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  url: string;
  thumbnailUrl: string | null;
  createdAt: string;
  channelId: string;
  channelName: string;
  uploadedBy: {
    id: string;
    displayName: string;
    avatar: string | null;
  } | null;
};

export type PortalActivity =
  | {
      kind: "task-done";
      actionItemId: string;
      title: string;
      timestamp: string;
      channelName: string;
      actor: string | null;
    }
  | {
      kind: "approved" | "rejected";
      actionItemId: string;
      title: string;
      timestamp: string;
      channelName: string;
      actor: string | null;
    };

/** v0.86 #24 phase 2: invoice summary в portal payload. */
export type PortalInvoice = {
  id: string;
  number: string;
  title: string;
  status: "SENT" | "PAID";
  currency: string;
  amountTotal: number;
  issuedAt: string | null;
  dueAt: string | null;
  paidAt: string | null;
  itemCount: number;
};

export type ClientPortalPayload = {
  server: {
    id: string;
    name: string;
    brandColor: string | null;
    description: string | null;
    welcomeMessage: string | null;
    mode: "CLIENT";
  };
  viewer: {
    role: MemberRole;
    isPreview: boolean;
  };
  generatedAt: string;
  /** v0.86 #24 phase 2: AI-generated 3-5 line summary. null если AI not configured. */
  summary: { text: string; generatedAt: string } | null;
  progress: {
    counts: { open: number; inProgress: number; review: number; done: number };
    items: PortalActionItem[];
  };
  approvals: {
    pending: PortalApproval[];
    recent: PortalApproval[];
  };
  files: PortalFile[];
  /** v0.86 #24 phase 2: invoices visible to client (SENT + PAID). */
  invoices: {
    outstanding: number; // sum amount SENT, в копейках currency
    invoices: PortalInvoice[];
  };
  recentActivity: PortalActivity[];
};

/**
 * Pure aggregation: считает counts из плоского массива actions.
 * Exported для unit-tests. Не выдёргивает per-status items — это делает
 * вызывающая сторона из БД (с правильными limit/orderBy).
 */
export function aggregatePortalCounts(
  actions: Array<{ status: "OPEN" | "IN_PROGRESS" | "REVIEW" | "DONE" }>,
): { open: number; inProgress: number; review: number; done: number } {
  let open = 0;
  let inProgress = 0;
  let review = 0;
  let done = 0;
  for (const a of actions) {
    if (a.status === "OPEN") open++;
    else if (a.status === "IN_PROGRESS") inProgress++;
    else if (a.status === "REVIEW") review++;
    else if (a.status === "DONE") done++;
  }
  return { open, inProgress, review, done };
}

/**
 * Pure helper: какие роли могут увидеть portal. Не permission matrix call —
 * portal специфический (CLIENT — primary, OWNER/ADMIN — preview). Это бы
 * не уложилось в существующие 20 permissions.
 *
 * Решение: явный whitelist в одном месте. Phase 2 — переехать на permission
 * "PORTAL_VIEW" + "PORTAL_PREVIEW" если matrix будет per-workspace
 * configurable.
 */
export function canAccessClientPortal(role: MemberRole): {
  allowed: boolean;
  isPreview: boolean;
} {
  if (role === "OWNER" || role === "ADMIN") {
    return { allowed: true, isPreview: true };
  }
  if (role === "CLIENT") {
    return { allowed: true, isPreview: false };
  }
  return { allowed: false, isPreview: false };
}

const PROGRESS_ITEMS_LIMIT = 30;
const APPROVALS_PENDING_LIMIT = 15;
const APPROVALS_RECENT_LIMIT = 15;
const FILES_LIMIT = 20;
const ACTIVITY_LIMIT = 15;
/** Recent window для approvals recent + activity feed. */
const ACTIVITY_WINDOW_DAYS = 30;

export function registerClientPortalRoutes(app: FastifyInstance) {
  app.get(
    "/api/servers/:id/client-portal",
    { onRequest: [requireJwt] },
    async (req, reply) => {
      const userId = getUserId(req);
      if (!userId) {
        return reply.status(401).send({ error: "Unauthorized" });
      }
      const { id: serverId } = req.params as { id: string };

      const server = await db.server.findUnique({
        where: { id: serverId },
        select: {
          id: true,
          name: true,
          brandColor: true,
          description: true,
          welcomeMessage: true,
          mode: true,
        },
      });
      if (!server) {
        return reply.status(404).send({ error: "Server not found" });
      }
      if (server.mode !== "CLIENT") {
        // Не leak информацию о существовании server'а через разный код —
        // 404 идентичен «нет такого server'а». Portal только для CLIENT-mode.
        return reply.status(404).send({ error: "Client portal not available for this server" });
      }

      const member = await db.member.findUnique({
        where: { userId_serverId: { userId, serverId } },
        select: { role: true },
      });
      if (!member) {
        return reply.status(403).send({ error: "Not a member of this server" });
      }
      const access = canAccessClientPortal(member.role as MemberRole);
      if (!access.allowed) {
        return reply.status(403).send({ error: "Portal not available for your role" });
      }

      // Visibility filter: для phase 1 OWNER/ADMIN preview видят те же
      // данные что и CLIENT — чтобы preview точно отражал client experience.
      // Internal channels всегда hidden в portal.
      const visibleChannels = await db.channel.findMany({
        where: { serverId, internal: false },
        select: { id: true, name: true, type: true },
      });
      if (visibleChannels.length === 0) {
        // Server без non-internal каналов — портал есть, но пустой. Возвращаем
        // shell с counts=0, frontend покажет empty state.
        return {
          server: {
            id: server.id,
            name: server.name,
            brandColor: server.brandColor,
            description: server.description,
            welcomeMessage: server.welcomeMessage,
            mode: "CLIENT" as const,
          },
          viewer: { role: member.role as MemberRole, isPreview: access.isPreview },
          generatedAt: new Date().toISOString(),
          summary: null,
          progress: { counts: { open: 0, inProgress: 0, review: 0, done: 0 }, items: [] },
          approvals: { pending: [], recent: [] },
          files: [],
          invoices: { outstanding: 0, invoices: [] },
          recentActivity: [],
        } satisfies ClientPortalPayload;
      }
      const visibleChannelIds = visibleChannels.map((c) => c.id);
      const channelMeta = new Map<string, ChannelMeta>(
        visibleChannels.map((c) => [c.id, c]),
      );

      const now = new Date();
      const activitySince = new Date(now.getTime() - ACTIVITY_WINDOW_DAYS * 86_400_000);

      // ── Progress: все non-DONE actions для counts + top items.
      // Counts считаем на полной выборке (без limit) чтобы не врать —
      // в client portal scope action count маленький (десятки/сотни).
      const allActions = await db.actionItem.findMany({
        where: { serverId, channelId: { in: visibleChannelIds } },
        select: { status: true },
        take: 5000,
      });
      const counts = aggregatePortalCounts(
        allActions as Array<{ status: "OPEN" | "IN_PROGRESS" | "REVIEW" | "DONE" }>,
      );

      const progressRows = await db.actionItem.findMany({
        where: {
          serverId,
          channelId: { in: visibleChannelIds },
          status: { in: ["OPEN", "IN_PROGRESS", "REVIEW"] },
        },
        orderBy: [{ priority: "desc" }, { dueAt: "asc" }, { updatedAt: "desc" }],
        take: PROGRESS_ITEMS_LIMIT,
        select: {
          id: true,
          title: true,
          type: true,
          status: true,
          priority: true,
          dueAt: true,
          updatedAt: true,
          channelId: true,
          assignee: { select: { id: true, displayName: true, avatar: true } },
        },
      });
      const progressItems: PortalActionItem[] = progressRows.map((a) => ({
        id: a.id,
        title: a.title,
        type: a.type,
        status: a.status,
        priority: a.priority,
        dueAt: a.dueAt?.toISOString() ?? null,
        channelId: a.channelId,
        channelName: channelMeta.get(a.channelId)?.name ?? "—",
        assignee: a.assignee ?? null,
        updatedAt: a.updatedAt.toISOString(),
      }));

      // ── Approvals.
      const pendingApprovalRows = await db.actionItem.findMany({
        where: {
          serverId,
          channelId: { in: visibleChannelIds },
          requiresApproval: true,
          approvalStatus: "PENDING",
        },
        orderBy: { updatedAt: "desc" },
        take: APPROVALS_PENDING_LIMIT,
        select: {
          id: true,
          title: true,
          type: true,
          approvalStatus: true,
          approvalNote: true,
          approvedAt: true,
          updatedAt: true,
          channelId: true,
          approver: { select: { id: true, displayName: true, avatar: true } },
          createdBy: { select: { id: true, displayName: true, avatar: true } },
        },
      });
      const recentApprovalRows = await db.actionItem.findMany({
        where: {
          serverId,
          channelId: { in: visibleChannelIds },
          approvalStatus: { in: ["APPROVED", "REJECTED"] },
          approvedAt: { gte: activitySince },
        },
        orderBy: { approvedAt: "desc" },
        take: APPROVALS_RECENT_LIMIT,
        select: {
          id: true,
          title: true,
          type: true,
          approvalStatus: true,
          approvalNote: true,
          approvedAt: true,
          updatedAt: true,
          channelId: true,
          approver: { select: { id: true, displayName: true, avatar: true } },
          createdBy: { select: { id: true, displayName: true, avatar: true } },
        },
      });
      const mapApproval = (
        a: (typeof pendingApprovalRows)[number],
      ): PortalApproval => ({
        id: a.id,
        title: a.title,
        type: a.type,
        approvalStatus: a.approvalStatus as "PENDING" | "APPROVED" | "REJECTED",
        approvalNote: a.approvalNote,
        approvedAt: a.approvedAt?.toISOString() ?? null,
        approver: a.approver ?? null,
        requestedBy: a.createdBy ?? null,
        channelId: a.channelId,
        channelName: channelMeta.get(a.channelId)?.name ?? "—",
        updatedAt: a.updatedAt.toISOString(),
      });

      // ── Files: recent attachments из visible channels.
      // Attachment → Message → Channel.serverId, фильтруем по channelId IN.
      const fileRows = await db.attachment.findMany({
        where: {
          message: {
            channelId: { in: visibleChannelIds },
            deletedAt: null,
          },
        },
        orderBy: { createdAt: "desc" },
        take: FILES_LIMIT,
        select: {
          id: true,
          filename: true,
          mimeType: true,
          size: true,
          url: true,
          thumbnailUrl: true,
          createdAt: true,
          message: {
            select: {
              channelId: true,
              user: { select: { id: true, displayName: true, avatar: true } },
            },
          },
        },
      });
      const files: PortalFile[] = fileRows
        .filter((f) => f.message?.channelId)
        .map((f) => ({
          id: f.id,
          filename: f.filename,
          mimeType: f.mimeType,
          size: f.size,
          url: f.url,
          thumbnailUrl: f.thumbnailUrl,
          createdAt: f.createdAt.toISOString(),
          channelId: f.message!.channelId!,
          channelName: channelMeta.get(f.message!.channelId!)?.name ?? "—",
          uploadedBy: f.message?.user ?? null,
        }));

      // ── Recent activity feed: merge tasks-done + approvals events,
      // sort by timestamp desc, take ACTIVITY_LIMIT.
      const recentDoneRows = await db.actionItem.findMany({
        where: {
          serverId,
          channelId: { in: visibleChannelIds },
          status: "DONE",
          updatedAt: { gte: activitySince },
        },
        orderBy: { updatedAt: "desc" },
        take: ACTIVITY_LIMIT,
        select: {
          id: true,
          title: true,
          updatedAt: true,
          channelId: true,
          assignee: { select: { displayName: true } },
        },
      });
      const activity: PortalActivity[] = [];
      for (const row of recentDoneRows) {
        activity.push({
          kind: "task-done",
          actionItemId: row.id,
          title: row.title,
          timestamp: row.updatedAt.toISOString(),
          channelName: channelMeta.get(row.channelId)?.name ?? "—",
          actor: row.assignee?.displayName ?? null,
        });
      }
      for (const row of recentApprovalRows) {
        if (!row.approvedAt) continue;
        activity.push({
          kind: row.approvalStatus === "APPROVED" ? "approved" : "rejected",
          actionItemId: row.id,
          title: row.title,
          timestamp: row.approvedAt.toISOString(),
          channelName: channelMeta.get(row.channelId)?.name ?? "—",
          actor: row.approver?.displayName ?? null,
        });
      }
      activity.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
      const recentActivity = activity.slice(0, ACTIVITY_LIMIT);

      // ── v0.86 #24 phase 2: Invoices. CLIENT видит SENT+PAID. OWNER/ADMIN
      // preview видят те же — чтобы preview точно отражал client experience.
      // DRAFT/CANCELLED доступны только через admin routes.
      const invoiceRows = await db.invoice.findMany({
        where: { serverId, status: { in: ["SENT", "PAID"] } },
        orderBy: [{ status: "asc" }, { issuedAt: "desc" }],
        take: 50,
        select: {
          id: true,
          number: true,
          title: true,
          status: true,
          currency: true,
          amountTotal: true,
          issuedAt: true,
          dueAt: true,
          paidAt: true,
          _count: { select: { items: true } },
        },
      });
      const invoices: PortalInvoice[] = invoiceRows.map((inv) => ({
        id: inv.id,
        number: inv.number,
        title: inv.title,
        status: inv.status as "SENT" | "PAID",
        currency: inv.currency,
        amountTotal: inv.amountTotal,
        issuedAt: inv.issuedAt?.toISOString() ?? null,
        dueAt: inv.dueAt?.toISOString() ?? null,
        paidAt: inv.paidAt?.toISOString() ?? null,
        itemCount: inv._count.items,
      }));
      const outstanding = invoiceRows
        .filter((inv) => inv.status === "SENT")
        .reduce((sum, inv) => sum + inv.amountTotal, 0);

      // ── v0.86 #24 phase 2: AI digest (3-5 line summary).
      // Fire-and-forget — если AI не configured ИЛИ упал → summary=null,
      // UI gracefully скрывает блок. Кэширование пока нет (per-request
      // generate); phase 3 — кэшировать на 6h в Server table.
      let summary: ClientPortalPayload["summary"] = null;
      try {
        summary = await buildAiDigest({
          serverName: server.name,
          counts,
          pendingApprovals: pendingApprovalRows.length,
          outstandingInvoices: invoiceRows.filter((i) => i.status === "SENT").length,
          recentDecisions: recentApprovalRows.slice(0, 5).map((a) => ({
            title: a.title,
            decision: a.approvalStatus,
          })),
          recentClosed: recentDoneRows.slice(0, 5).map((r) => r.title),
        });
      } catch (err) {
        req.log.warn({ err }, "Portal AI digest failed");
      }

      const payload: ClientPortalPayload = {
        server: {
          id: server.id,
          name: server.name,
          brandColor: server.brandColor,
          description: server.description,
          welcomeMessage: server.welcomeMessage,
          mode: "CLIENT",
        },
        viewer: { role: member.role as MemberRole, isPreview: access.isPreview },
        generatedAt: now.toISOString(),
        summary,
        progress: { counts, items: progressItems },
        approvals: {
          pending: pendingApprovalRows.map(mapApproval),
          recent: recentApprovalRows.map(mapApproval),
        },
        files,
        invoices: { outstanding, invoices },
        recentActivity,
      };
      return payload;
    },
  );
}

/**
 * v0.86 #24 phase 2: AI digest для client-facing summary.
 *
 * Compact prompt — calm RU 3-5 sentences. Specifically НЕ marketing tone —
 * operational, факты. Skipping если AI not configured (returns null).
 */
async function buildAiDigest(ctx: {
  serverName: string;
  counts: { open: number; inProgress: number; review: number; done: number };
  pendingApprovals: number;
  outstandingInvoices: number;
  recentDecisions: Array<{ title: string; decision: string }>;
  recentClosed: string[];
}): Promise<{ text: string; generatedAt: string } | null> {
  const factsParts: string[] = [];
  factsParts.push(
    `Проект "${ctx.serverName}". В работе: ${ctx.counts.inProgress + ctx.counts.review}. ` +
      `Завершено: ${ctx.counts.done}. Открыто: ${ctx.counts.open}.`,
  );
  if (ctx.pendingApprovals > 0) {
    factsParts.push(`Ожидают одобрения: ${ctx.pendingApprovals}.`);
  }
  if (ctx.outstandingInvoices > 0) {
    factsParts.push(`Неоплаченных счетов: ${ctx.outstandingInvoices}.`);
  }
  if (ctx.recentClosed.length > 0) {
    factsParts.push(
      `Недавно завершено: ${ctx.recentClosed.slice(0, 3).map((t) => `"${t}"`).join(", ")}.`,
    );
  }
  if (ctx.recentDecisions.length > 0) {
    factsParts.push(
      `Недавние решения: ${ctx.recentDecisions
        .map((d) => `"${d.title}" (${d.decision === "APPROVED" ? "одобрено" : "отклонено"})`)
        .join(", ")}.`,
    );
  }
  const facts = factsParts.join("\n");

  const messages = [
    {
      role: "system" as const,
      content:
        "Ты — calm operational assistant внутри клиентского портала Eclipse Chat. " +
        "Сгенерируй 3-5 коротких предложений по-русски, без маркетинга и эмоций. " +
        "Сухие факты + acknowledgement что важно клиенту. Не упоминай что ты AI. " +
        "Не используй маркеры (•/-/—). Не выдумывай факты которых нет в input'е.",
    },
    {
      role: "user" as const,
      content: `Факты:\n${facts}\n\nСводка:`,
    },
  ];

  try {
    const result = await chat(messages, { maxTokens: 250, temperature: 0.3 });
    const trimmed = result.text.trim();
    if (!trimmed) return null;
    return {
      text: trimmed.slice(0, 1200),
      generatedAt: new Date().toISOString(),
    };
  } catch (err) {
    if (err instanceof AINotConfiguredError) {
      return null;
    }
    throw err;
  }
}
