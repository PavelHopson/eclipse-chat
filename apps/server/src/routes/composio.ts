import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getUserId, requireJwt } from "../auth/requireJwt.js";
import { db } from "../db.js";
import { recordAudit } from "../security/audit.js";
import { encryptSecret, decryptSecret } from "../security/twoFactor.js";
import {
  ComposioError,
  disconnectConnection,
  executeAction,
  initiateConnection,
  isComposioEnabled,
  listActionsForApp,
  listSupportedApps,
  verifyConnection,
} from "../lib/composio.js";

/**
 * v1.0.1 #11.5 Composio Automation Expansion — REST routes.
 *
 *   Admin (OWNER):
 *     GET    /api/composio/status                                 — is enabled?
 *     GET    /api/composio/apps                                   — supported apps
 *     GET    /api/servers/:id/composio/connections                — server's connected apps
 *     POST   /api/servers/:id/composio/connect                    — initiate OAuth
 *     GET    /api/composio/callback                               — OAuth return target
 *     DELETE /api/servers/:id/composio/connections/:connectionId  — disconnect
 *     GET    /api/servers/:id/composio/connections/:connectionId/actions
 *                                                                 — actions for connected app
 *     POST   /api/servers/:id/composio/connections/:connectionId/execute
 *                                                                 — manual execute (testing)
 *
 * Graceful disable: если COMPOSIO_API_KEY не set — все endpoints возвращают
 * 503 «Composio not configured». UI показывает «требуется ENV setup».
 */

const APP_NAME_RE = /^[a-z0-9][a-z0-9_-]{1,63}$/i;

async function requireServerOwner(
  serverId: string,
  userId: string | null,
): Promise<
  { ok: true } | { ok: false; status: 401 | 403 | 404; error: string }
> {
  if (!userId) return { ok: false, status: 401, error: "Unauthorized" };
  const member = await db.member.findUnique({
    where: { userId_serverId: { userId, serverId } },
    select: { role: true },
  });
  if (!member) return { ok: false, status: 403, error: "Not a member" };
  if (member.role !== "OWNER") {
    return { ok: false, status: 403, error: "Только OWNER может управлять Composio-подключениями" };
  }
  return { ok: true };
}

function callbackUrl(): string {
  const base = process.env.PUBLIC_BASE_URL?.replace(/\/+$/, "") ?? "";
  return `${base}/api/composio/callback`;
}

function ensureEnabledOrSend(reply: import("fastify").FastifyReply): boolean {
  if (!isComposioEnabled()) {
    void reply.status(503).send({
      error:
        "Composio не настроен. Добавьте COMPOSIO_API_KEY в .env (получить ключ на composio.dev).",
    });
    return false;
  }
  return true;
}

function handleComposioError(err: unknown, reply: import("fastify").FastifyReply): void {
  if (err instanceof ComposioError) {
    void reply.status(err.status >= 400 && err.status < 600 ? err.status : 502).send({
      error: err.message,
      detail: err.detail ?? null,
    });
    return;
  }
  void reply.status(500).send({
    error: err instanceof Error ? err.message : "Composio internal error",
  });
}

export async function registerComposioRoutes(app: FastifyInstance) {
  /**
   * GET /api/composio/status — health-check feature flag.
   * Доступен всем authenticated users (UI показывает «not configured» banner
   * для всех ролей; реальный setup — у OWNER).
   */
  app.get(
    "/api/composio/status",
    { onRequest: [requireJwt] },
    async () => ({
      enabled: isComposioEnabled(),
      callbackUrl: isComposioEnabled() ? callbackUrl() : null,
    }),
  );

  /**
   * GET /api/composio/apps — supported apps по Composio platform.
   * OWNER-only — список доступен только тем, кто планирует подключать.
   * Cache TTL не реализован (call'и редкие, Composio сам кэширует).
   */
  app.get(
    "/api/composio/apps",
    { onRequest: [requireJwt] },
    async (req, reply) => {
      if (!ensureEnabledOrSend(reply)) return;
      const userId = getUserId(req);
      if (!userId) return reply.status(401).send({ error: "Unauthorized" });
      // OWNER-check pragmatic: проверяем что user — OWNER хотя бы одного сервера.
      const anyOwner = await db.member.findFirst({
        where: { userId, role: "OWNER" },
        select: { id: true },
      });
      if (!anyOwner) {
        return reply.status(403).send({ error: "Только OWNER может смотреть Composio apps" });
      }
      try {
        const apps = await listSupportedApps();
        return { apps };
      } catch (err) {
        handleComposioError(err, reply);
      }
    },
  );

  /**
   * GET /api/servers/:id/composio/connections — список подключённых apps.
   * Member-readable (showed read-only details for non-owners).
   */
  app.get(
    "/api/servers/:id/composio/connections",
    { onRequest: [requireJwt] },
    async (req, reply) => {
      const { id: serverId } = req.params as { id: string };
      const userId = getUserId(req);
      if (!userId) return reply.status(401).send({ error: "Unauthorized" });
      const member = await db.member.findUnique({
        where: { userId_serverId: { userId, serverId } },
        select: { role: true },
      });
      if (!member) return reply.status(403).send({ error: "Not a member" });
      const connections = await db.composioConnection.findMany({
        where: { serverId },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          appName: true,
          displayName: true,
          status: true,
          createdAt: true,
          lastUsedAt: true,
          createdBy: { select: { id: true, displayName: true } },
        },
      });
      return {
        connections: connections.map((c) => ({
          id: c.id,
          appName: c.appName,
          displayName: c.displayName,
          status: c.status,
          createdAt: c.createdAt.toISOString(),
          lastUsedAt: c.lastUsedAt?.toISOString() ?? null,
          createdBy: c.createdBy,
        })),
      };
    },
  );

  /**
   * POST /api/servers/:id/composio/connect — initiate OAuth для app'а.
   * Body: { appName, displayName? }
   * Returns: { redirectUrl } — frontend opens этот URL (popup или new tab).
   *
   * Анти-duplicate: если уже есть ACTIVE connection для (serverId, appName) —
   * 409. User должен disconnect старую перед connect новой.
   */
  app.post(
    "/api/servers/:id/composio/connect",
    { onRequest: [requireJwt] },
    async (req, reply) => {
      const { id: serverId } = req.params as { id: string };
      const userId = getUserId(req);
      const auth = await requireServerOwner(serverId, userId);
      if (!auth.ok) return reply.status(auth.status).send({ error: auth.error });
      if (!ensureEnabledOrSend(reply)) return;

      const body = z
        .object({
          appName: z.string().regex(APP_NAME_RE, { message: "Invalid app name" }),
          displayName: z.string().trim().min(1).max(120).optional(),
        })
        .safeParse(req.body);
      if (!body.success) {
        return reply.status(400).send({ error: body.error.issues[0]?.message ?? "Invalid body" });
      }
      const appName = body.data.appName.toLowerCase();
      const displayName = body.data.displayName?.trim() || appName;

      const existing = await db.composioConnection.findUnique({
        where: { serverId_appName: { serverId, appName } },
        select: { id: true, status: true },
      });
      if (existing && existing.status === "ACTIVE") {
        return reply.status(409).send({
          error: `Уже есть активное подключение к ${appName}. Отключите его перед новым.`,
        });
      }

      // Pack state в entity_id: serverId:userId:nonce. Used в callback validation.
      const ownerExternalId = `eclipse:${serverId}:${userId}`;
      try {
        const init = await initiateConnection({
          appName,
          redirectUri: callbackUrl(),
          ownerExternalId,
        });
        // Записываем pre-connection с PENDING status (will be promoted в callback).
        if (existing) {
          await db.composioConnection.update({
            where: { id: existing.id },
            data: {
              displayName,
              composioConnId: init.connectionId,
              status: "PENDING",
              encryptedAuth: encryptSecret(JSON.stringify({})),
            },
          });
        } else {
          await db.composioConnection.create({
            data: {
              serverId,
              appName,
              displayName,
              composioConnId: init.connectionId,
              status: "PENDING",
              encryptedAuth: encryptSecret(JSON.stringify({})),
              createdByUserId: userId!,
            },
          });
        }
        return {
          redirectUrl: init.redirectUrl,
          connectionId: init.connectionId,
        };
      } catch (err) {
        handleComposioError(err, reply);
      }
    },
  );

  /**
   * GET /api/composio/callback — public OAuth return target (никаких
   * требований к JWT, потому что user возвращается после redirect'а на
   * Composio, JWT cookie сохраняется).
   *
   * Composio passes back connection ID via query param. Мы:
   *   1. verify connection через Composio API (статус ACTIVE)
   *   2. parse entity_id → проверяем что (serverId, userId) совпадает с pending row
   *   3. promote PENDING → ACTIVE
   *   4. audit log
   *
   * Frontend: callback returns HTML с auto-close window + postMessage к opener
   * (если popup) или redirect к AdminPanel.
   */
  app.get(
    "/api/composio/callback",
    async (req, reply) => {
      if (!isComposioEnabled()) {
        return reply.type("text/html").send(callbackHtml({
          ok: false,
          message: "Composio не настроен на этом сервере.",
        }));
      }
      const query = req.query as Record<string, string | undefined>;
      const connectionId = query.connectedAccountId ?? query.connection_id;
      if (!connectionId) {
        return reply.type("text/html").send(callbackHtml({
          ok: false,
          message: "Не получен connection ID от Composio.",
        }));
      }
      try {
        const status = await verifyConnection(connectionId);
        if (!status.active) {
          return reply.type("text/html").send(callbackHtml({
            ok: false,
            message: "Connection не активна. Попробуйте подключиться заново.",
          }));
        }
        // Parse entity_id обратно — eclipse:<serverId>:<userId>.
        const parts = status.ownerExternalId?.split(":") ?? [];
        if (parts.length !== 3 || parts[0] !== "eclipse") {
          return reply.type("text/html").send(callbackHtml({
            ok: false,
            message: "Неверная связка connection. Возможно, callback от чужого сервера.",
          }));
        }
        const [, serverId, userId] = parts;
        const row = await db.composioConnection.findUnique({
          where: {
            serverId_appName: {
              serverId,
              appName: status.appName ?? "",
            },
          },
          select: { id: true, composioConnId: true, displayName: true, appName: true },
        });
        if (!row || row.composioConnId !== connectionId) {
          return reply.type("text/html").send(callbackHtml({
            ok: false,
            message: "Connection не найдена в Eclipse БД. Попробуйте connect заново.",
          }));
        }
        await db.composioConnection.update({
          where: { id: row.id },
          data: { status: "ACTIVE" },
        });
        recordAudit("COMPOSIO_CONNECTED", {
          userId,
          req,
          metadata: { connectionId: row.id, appName: row.appName, serverId },
        });
        return reply.type("text/html").send(callbackHtml({
          ok: true,
          message: `✓ ${row.displayName} подключён к серверу.`,
        }));
      } catch (err) {
        return reply.type("text/html").send(callbackHtml({
          ok: false,
          message: err instanceof Error ? err.message : "Composio verify failed",
        }));
      }
    },
  );

  /**
   * DELETE /api/servers/:id/composio/connections/:connectionId — disconnect.
   * Удаляет на Composio side + удаляет Eclipse row. OWNER only.
   */
  app.delete(
    "/api/servers/:id/composio/connections/:connectionId",
    { onRequest: [requireJwt] },
    async (req, reply) => {
      const { id: serverId, connectionId } = req.params as {
        id: string;
        connectionId: string;
      };
      const userId = getUserId(req);
      const auth = await requireServerOwner(serverId, userId);
      if (!auth.ok) return reply.status(auth.status).send({ error: auth.error });
      if (!ensureEnabledOrSend(reply)) return;

      const row = await db.composioConnection.findUnique({
        where: { id: connectionId },
        select: { id: true, serverId: true, appName: true, composioConnId: true },
      });
      if (!row || row.serverId !== serverId) {
        return reply.status(404).send({ error: "Connection not found" });
      }
      try {
        await disconnectConnection(row.composioConnId).catch(() => {
          /* Composio side может уже быть disconnected — продолжаем. */
        });
        await db.composioConnection.delete({ where: { id: row.id } });
        recordAudit("COMPOSIO_DISCONNECTED", {
          userId,
          req,
          metadata: { connectionId: row.id, appName: row.appName, serverId },
        });
        return { ok: true };
      } catch (err) {
        handleComposioError(err, reply);
      }
    },
  );

  /**
   * GET /api/servers/:id/composio/connections/:connectionId/actions —
   * list available actions для подключённого app'а. OWNER only (для
   * automation rule setup).
   */
  app.get(
    "/api/servers/:id/composio/connections/:connectionId/actions",
    { onRequest: [requireJwt] },
    async (req, reply) => {
      const { id: serverId, connectionId } = req.params as {
        id: string;
        connectionId: string;
      };
      const userId = getUserId(req);
      const auth = await requireServerOwner(serverId, userId);
      if (!auth.ok) return reply.status(auth.status).send({ error: auth.error });
      if (!ensureEnabledOrSend(reply)) return;

      const row = await db.composioConnection.findUnique({
        where: { id: connectionId },
        select: { id: true, serverId: true, appName: true, status: true },
      });
      if (!row || row.serverId !== serverId) {
        return reply.status(404).send({ error: "Connection not found" });
      }
      if (row.status !== "ACTIVE") {
        return reply.status(400).send({ error: `Connection не ACTIVE (status=${row.status})` });
      }
      try {
        const actions = await listActionsForApp(row.appName);
        return { actions };
      } catch (err) {
        handleComposioError(err, reply);
      }
    },
  );

  /**
   * POST /api/servers/:id/composio/connections/:connectionId/execute —
   * manual execute action (для testing из UI или ad-hoc). OWNER only.
   * Body: { actionName, params: object }.
   *
   * Production execute идёт через automation engine (см. automation.ts
   * COMPOSIO_ACTION handler) — этот endpoint только для test/debug.
   */
  app.post(
    "/api/servers/:id/composio/connections/:connectionId/execute",
    { onRequest: [requireJwt] },
    async (req, reply) => {
      const { id: serverId, connectionId } = req.params as {
        id: string;
        connectionId: string;
      };
      const userId = getUserId(req);
      const auth = await requireServerOwner(serverId, userId);
      if (!auth.ok) return reply.status(auth.status).send({ error: auth.error });
      if (!ensureEnabledOrSend(reply)) return;

      const body = z
        .object({
          actionName: z.string().min(1).max(128),
          params: z.record(z.unknown()).default({}),
        })
        .safeParse(req.body);
      if (!body.success) {
        return reply.status(400).send({ error: body.error.issues[0]?.message ?? "Invalid body" });
      }

      const row = await db.composioConnection.findUnique({
        where: { id: connectionId },
        select: {
          id: true,
          serverId: true,
          appName: true,
          composioConnId: true,
          status: true,
        },
      });
      if (!row || row.serverId !== serverId) {
        return reply.status(404).send({ error: "Connection not found" });
      }
      if (row.status !== "ACTIVE") {
        return reply.status(400).send({ error: `Connection не ACTIVE` });
      }

      const started = Date.now();
      try {
        const result = await executeAction({
          connectionId: row.composioConnId,
          actionName: body.data.actionName,
          params: body.data.params,
        });
        const latencyMs = Date.now() - started;
        await db.composioConnection.update({
          where: { id: row.id },
          data: { lastUsedAt: new Date() },
        });
        recordAudit("COMPOSIO_ACTION_EXECUTED", {
          userId,
          req,
          metadata: {
            connectionId: row.id,
            appName: row.appName,
            actionName: body.data.actionName,
            success: result.success,
            latencyMs,
          },
        });
        return {
          ...result,
          latencyMs,
        };
      } catch (err) {
        handleComposioError(err, reply);
      }
    },
  );
}

/** Дёшевый inline HTML для OAuth callback page (auto-close + postMessage). */
function callbackHtml(args: { ok: boolean; message: string }): string {
  const bg = args.ok ? "#0B0F14" : "#0B0F14";
  const accent = args.ok ? "hsl(152 58% 52%)" : "hsl(0 72% 60%)";
  const safeMessage = String(args.message).replace(/[<>&"]/g, (c) => {
    if (c === "<") return "&lt;";
    if (c === ">") return "&gt;";
    if (c === "&") return "&amp;";
    return "&quot;";
  });
  return `<!doctype html>
<html lang="ru"><head><meta charset="utf-8"><title>Composio · Eclipse Chat</title></head>
<body style="margin:0;background:${bg};color:hsl(210 18% 88%);font-family:system-ui,-apple-system,sans-serif;display:grid;place-items:center;min-height:100vh;">
  <div style="text-align:center;padding:32px;max-width:480px;">
    <div style="font-size:48px;color:${accent};margin-bottom:16px;">${args.ok ? "✓" : "⚠"}</div>
    <div style="font-size:16px;color:hsl(210 22% 96%);font-weight:600;margin-bottom:8px;">
      Composio
    </div>
    <p style="color:hsl(210 14% 62%);font-size:14px;line-height:1.6;margin:0 0 24px;">${safeMessage}</p>
    <button onclick="window.close()" style="padding:10px 20px;background:transparent;border:1px solid hsl(195 70% 60%);color:hsl(195 70% 60%);border-radius:8px;cursor:pointer;font-weight:600;">
      Закрыть окно
    </button>
  </div>
  <script>
    try { if (window.opener) window.opener.postMessage({ type: 'composio.callback', ok: ${args.ok} }, '*'); } catch(e) {}
    setTimeout(() => { try { window.close(); } catch(e) {} }, 5000);
  </script>
</body></html>`;
}
