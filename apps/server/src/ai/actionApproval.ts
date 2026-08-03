import { createHash } from "node:crypto";
import { z } from "zod";
import { db } from "../db.js";
import { recordAudit } from "../security/audit.js";
import {
  updateTableRowArgsSchema,
  validateUpdateTableRowRequest,
  type UpdateTableRowPreview,
} from "./tools/updateTableRow.js";
import type { ToolCallContext, ToolResult } from "./tools/types.js";

export const BOT_ACTION_APPROVAL_TTL_MS = 24 * 60 * 60 * 1000;
export const BOT_ACTION_EXECUTION_LEASE_MS = 5 * 60 * 1000;
export const MAX_PENDING_APPROVALS_PER_BOT = 20;
export const MAX_PENDING_APPROVALS_PER_SERVER = 50;
export const MAX_APPROVAL_PAYLOAD_BYTES = 64 * 1024;

const EMPTY_SCRUBBED_PAYLOAD = "{}";

const previewSchema = z.object({
  kind: z.literal("update_table_row"),
  tableName: z.string().max(120),
  rowId: z.string().max(128),
  updates: z.array(z.object({
    fieldName: z.string().max(120),
    value: z.string().max(240),
  })).max(50),
  totalUpdates: z.number().int().min(1).max(50),
});

export type BotActionApprovalPreview = z.infer<typeof previewSchema>;

export function requiresOwnerApproval(
  toolName: string,
  approvalBypass = false,
): boolean {
  return !approvalBypass && toolName === "update_table_row";
}

export function parseBotActionApprovalPreview(
  raw: string,
): BotActionApprovalPreview | null {
  try {
    const parsed = previewSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function parseBotActionApprovalPayload(raw: string): unknown | null {
  try {
    const candidate: unknown = JSON.parse(raw);
    return candidate !== null && typeof candidate === "object" && !Array.isArray(candidate)
      ? candidate
      : null;
  } catch {
    return null;
  }
}

export async function expirePendingBotActionApprovals(
  serverId?: string,
): Promise<number> {
  const now = new Date();
  const executionLeaseCutoff = new Date(now.getTime() - BOT_ACTION_EXECUTION_LEASE_MS);
  const [expired, abandoned] = await db.$transaction([
    db.botActionApproval.updateMany({
      where: {
        status: "PENDING",
        expiresAt: { lte: now },
        ...(serverId ? { serverId } : {}),
      },
      data: {
        status: "EXPIRED",
        payload: EMPTY_SCRUBBED_PAYLOAD,
        preview: EMPTY_SCRUBBED_PAYLOAD,
        failureCode: "expired",
        decidedAt: now,
      },
    }),
    db.botActionApproval.updateMany({
      where: {
        status: "EXECUTING",
        updatedAt: { lte: executionLeaseCutoff },
        ...(serverId ? { serverId } : {}),
      },
      data: {
        status: "FAILED",
        payload: EMPTY_SCRUBBED_PAYLOAD,
        preview: EMPTY_SCRUBBED_PAYLOAD,
        failureCode: "execution_timeout",
      },
    }),
  ]);
  return expired.count + abandoned.count;
}

type QueuedApproval = {
  approvalPending: true;
  approvalId: string;
  expiresAt: string;
  message: string;
};

export async function queueBotActionApproval(
  toolName: string,
  rawArgs: unknown,
  ctx: ToolCallContext,
): Promise<ToolResult<QueuedApproval>> {
  if (toolName !== "update_table_row") {
    return { ok: false, error: `Tool "${toolName}" does not support owner approval` };
  }

  const validated = await validateUpdateTableRowRequest(rawArgs, ctx);
  if (!validated.ok) return validated;

  const payload = JSON.stringify(validated.data.args);
  if (Buffer.byteLength(payload, "utf8") > MAX_APPROVAL_PAYLOAD_BYTES) {
    return { ok: false, error: "Изменение слишком большое для безопасного подтверждения" };
  }

  const preview: UpdateTableRowPreview = {
    ...validated.data.preview,
    tableName: validated.data.preview.tableName.slice(0, 120),
    rowId: validated.data.preview.rowId.slice(0, 128),
    updates: validated.data.preview.updates.map((update) => ({
      fieldName: update.fieldName.slice(0, 120),
      value: update.value.slice(0, 240),
    })),
  };
  const previewJson = JSON.stringify(preview);
  const requestHash = createHash("sha256")
    .update(`${toolName}\0${payload}`)
    .digest("hex");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + BOT_ACTION_APPROVAL_TTL_MS);

  await expirePendingBotActionApprovals(ctx.serverId);

  const existing = await db.botActionApproval.findFirst({
    where: {
      botId: ctx.botId,
      serverId: ctx.serverId,
      tool: toolName,
      requestHash,
      status: "PENDING",
      expiresAt: { gt: now },
    },
    select: { id: true, expiresAt: true },
  });
  if (existing) {
    return {
      ok: true,
      data: {
        approvalPending: true,
        approvalId: existing.id,
        expiresAt: existing.expiresAt.toISOString(),
        message: "Изменение уже ожидает решения владельца пространства",
      },
    };
  }

  const [pendingBotCount, pendingServerCount] = await Promise.all([
    db.botActionApproval.count({
      where: { botId: ctx.botId, status: "PENDING", expiresAt: { gt: now } },
    }),
    db.botActionApproval.count({
      where: { serverId: ctx.serverId, status: "PENDING", expiresAt: { gt: now } },
    }),
  ]);
  if (pendingBotCount >= MAX_PENDING_APPROVALS_PER_BOT) {
    return { ok: false, error: "У агента слишком много действий, ожидающих решения владельца" };
  }
  if (pendingServerCount >= MAX_PENDING_APPROVALS_PER_SERVER) {
    return { ok: false, error: "Очередь решений пространства заполнена. Сначала обработайте ожидающие действия" };
  }

  const approval = await db.botActionApproval.create({
    data: {
      serverId: ctx.serverId,
      botId: ctx.botId,
      sourceChannelId: ctx.channelId ?? null,
      tool: toolName,
      payload,
      preview: previewJson,
      requestHash,
      expiresAt,
    },
    select: { id: true, expiresAt: true },
  });

  recordAudit("BOT_ACTION_APPROVAL_REQUESTED", {
    userId: ctx.botUserId,
    metadata: {
      approvalId: approval.id,
      botId: ctx.botId,
      serverId: ctx.serverId,
      tool: toolName,
      sourceChannelId: ctx.channelId ?? null,
    },
  });

  return {
    ok: true,
    data: {
      approvalPending: true,
      approvalId: approval.id,
      expiresAt: approval.expiresAt.toISOString(),
      message: "Изменение не выполнено: оно ожидает решения владельца пространства",
    },
  };
}

export async function claimBotActionApproval(
  serverId: string,
  approvalId: string,
  ownerUserId: string,
) {
  await expirePendingBotActionApprovals(serverId);
  const now = new Date();
  const claimed = await db.botActionApproval.updateMany({
    where: {
      id: approvalId,
      serverId,
      status: "PENDING",
      expiresAt: { gt: now },
    },
    data: {
      status: "EXECUTING",
      decidedAt: now,
      decidedByUserId: ownerUserId,
    },
  });
  if (claimed.count !== 1) return null;
  return db.botActionApproval.findUnique({ where: { id: approvalId } });
}

export async function completeBotActionApproval(
  approvalId: string,
  status: "SUCCEEDED" | "FAILED",
  failureCode?: string,
): Promise<void> {
  await db.botActionApproval.updateMany({
    where: { id: approvalId, status: "EXECUTING" },
    data: {
      status,
      payload: EMPTY_SCRUBBED_PAYLOAD,
      preview: EMPTY_SCRUBBED_PAYLOAD,
      failureCode: failureCode?.slice(0, 64) ?? null,
    },
  });
}

export async function rejectBotActionApproval(
  serverId: string,
  approvalId: string,
  ownerUserId: string,
): Promise<boolean> {
  await expirePendingBotActionApprovals(serverId);
  const rejected = await db.botActionApproval.updateMany({
    where: { id: approvalId, serverId, status: "PENDING", expiresAt: { gt: new Date() } },
    data: {
      status: "REJECTED",
      payload: EMPTY_SCRUBBED_PAYLOAD,
      preview: EMPTY_SCRUBBED_PAYLOAD,
      decidedAt: new Date(),
      decidedByUserId: ownerUserId,
    },
  });
  return rejected.count === 1;
}

export function isValidQueuedUpdatePayload(raw: unknown): boolean {
  return updateTableRowArgsSchema.safeParse(raw).success;
}
