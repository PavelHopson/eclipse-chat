import type { FastifyRequest } from "fastify";
import { db } from "../db.js";
import type { Prisma } from "@prisma/client";

/**
 * Audit log helper.
 *
 * Никогда не throws — fail silently если БД упала, чтобы не блокировать
 * основную функциональность. Все calls fire-and-forget через void.
 *
 * Никаких PII: только id'шники, type, IP (для security), UA (для fingerprint),
 * metadata в JSON-string (что менялось, target ids).
 */

type AuditEventType = Prisma.AuditLogCreateInput["type"];

export function recordAudit(
  type: AuditEventType,
  opts: {
    userId?: string | null;
    req?: FastifyRequest;
    metadata?: Record<string, unknown>;
  },
): void {
  const ip = opts.req
    ? (opts.req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ||
      opts.req.ip ||
      null
    : null;
  const ua = opts.req?.headers["user-agent"] || null;
  const metaStr = opts.metadata ? safeStringify(opts.metadata) : null;

  void db.auditLog
    .create({
      data: {
        type,
        userId: opts.userId ?? null,
        ipAddress: ip,
        userAgent: ua ? String(ua).slice(0, 500) : null,
        metadata: metaStr,
      },
    })
    .catch(() => {
      /* silent — audit fail не блокирует main flow */
    });
}

/**
 * Safely JSON.stringify с trunc до 4 KB. Не падаем на circular references.
 */
function safeStringify(obj: Record<string, unknown>): string {
  try {
    const s = JSON.stringify(obj);
    return s.length > 4000 ? s.slice(0, 4000) + "..." : s;
  } catch {
    return "{}";
  }
}
