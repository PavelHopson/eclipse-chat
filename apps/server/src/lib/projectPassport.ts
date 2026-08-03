import {
  normalizeGitHubRepository,
  type GitHubEventStatus,
  type GitHubExternalEvent,
} from "./integrations/github.js";
import { canAccessRealtimeChannel, type RealtimeWorkspaceMode } from "./realtimeAccess.js";
import type { MemberRole } from "../routes/servers.js";

export type PassportHealthState = "BLOCKED" | "AT_RISK" | "ON_TRACK" | "QUIET";

export type PassportActionSignal = {
  id: string;
  type: "TASK" | "DECISION" | "FOLLOW_UP" | "RISK" | "REQUIREMENT";
  status: "OPEN" | "IN_PROGRESS" | "REVIEW" | "DONE";
  priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  dueAt: Date | null;
  escalatedAt: Date | null;
  channelId: string;
};

export type PassportDeploySignal = Pick<
  GitHubExternalEvent,
  "repository" | "status" | "sourceUrl" | "occurredAt"
>;

export type PassportHealth = {
  state: PassportHealthState;
  reason: string;
  overdueCount: number;
  activeRiskCount: number;
};

export type PassportNextAction =
  | {
      kind: "ACTION";
      label: string;
      actionItemId: string;
      channelId: string;
      sourceUrl: null;
    }
  | {
      kind: "DEPLOY";
      label: string;
      actionItemId: null;
      channelId: null;
      sourceUrl: string;
    }
  | {
      kind: "ROOM";
      label: string;
      actionItemId: null;
      channelId: string;
      sourceUrl: null;
    }
  | {
      kind: "NONE";
      label: string;
      actionItemId: null;
      channelId: null;
      sourceUrl: null;
    };

const GITHUB_EVENT_KINDS = new Set<GitHubExternalEvent["kind"]>([
  "ping",
  "push",
  "pull_request",
  "issue",
  "workflow",
  "release",
  "deployment",
]);
const GITHUB_EVENT_STATUSES = new Set<GitHubEventStatus>([
  "success",
  "failure",
  "pending",
  "neutral",
]);
const DOCUMENT_TAGS = new Set([
  "architecture",
  "doc",
  "docs",
  "document",
  "guide",
  "roadmap",
  "runbook",
  "spec",
]);

export function filterProjectPassportChannels<
  T extends { internal: boolean },
>(
  mode: RealtimeWorkspaceMode,
  role: MemberRole,
  channels: T[],
): T[] {
  return channels.filter((channel) =>
    canAccessRealtimeChannel(mode, channel.internal, role),
  );
}

export function passportExcerpt(value: unknown, max = 220): string {
  if (typeof value !== "string") return "";
  const normalized = value
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return normalized.length > max
    ? `${normalized.slice(0, Math.max(1, max - 1))}…`
    : normalized;
}

export function parsePassportTags(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((tag): tag is string => typeof tag === "string")
      .map((tag) => passportExcerpt(tag, 32).toLowerCase())
      .filter(Boolean)
      .slice(0, 8);
  } catch {
    return [];
  }
}

export function isPassportDocument(kind: string, tags: string[]): boolean {
  return kind === "LINK" || tags.some((tag) => DOCUMENT_TAGS.has(tag));
}

export function firstSafeExternalUrl(value: string | null): string | null {
  if (!value) return null;
  const match = value.match(/https?:\/\/[^\s<>"']+/i);
  if (!match) return null;
  try {
    const url = new URL(match[0]);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    url.username = "";
    url.password = "";
    return url.toString();
  } catch {
    return null;
  }
}

function safeGitHubSourceUrl(value: unknown, repository: string): string {
  const fallback = `https://github.com/${repository}`;
  if (typeof value !== "string") return fallback;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.hostname.toLowerCase() !== "github.com") {
      return fallback;
    }
    url.username = "";
    url.password = "";
    url.hash = "";
    return url.toString();
  } catch {
    return fallback;
  }
}

export function parseVerifiedGitHubEvent(
  value: unknown,
): GitHubExternalEvent | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (row.source !== "github" || row.verified !== true) return null;
  if (typeof row.kind !== "string" || !GITHUB_EVENT_KINDS.has(row.kind as GitHubExternalEvent["kind"])) {
    return null;
  }
  if (
    typeof row.status !== "string" ||
    !GITHUB_EVENT_STATUSES.has(row.status as GitHubEventStatus)
  ) {
    return null;
  }
  const repository = normalizeGitHubRepository(row.repository);
  if (!repository) return null;

  const occurredAt = passportExcerpt(row.occurredAt, 64);
  const parsedOccurredAt = occurredAt ? new Date(occurredAt) : null;
  const details = Array.isArray(row.details)
    ? row.details
        .slice(0, 6)
        .flatMap((detail): Array<{ label: string; value: string }> => {
          if (!detail || typeof detail !== "object" || Array.isArray(detail)) return [];
          const item = detail as Record<string, unknown>;
          const label = passportExcerpt(item.label, 40);
          const detailValue = passportExcerpt(item.value, 120);
          return label && detailValue ? [{ label, value: detailValue }] : [];
        })
    : [];

  return {
    source: "github",
    verified: true,
    kind: row.kind as GitHubExternalEvent["kind"],
    repository,
    title: passportExcerpt(row.title, 180) || "GitHub event",
    summary: passportExcerpt(row.summary, 320),
    actor: passportExcerpt(row.actor, 80) || null,
    ref: passportExcerpt(row.ref, 160) || null,
    status: row.status as GitHubEventStatus,
    sourceUrl: safeGitHubSourceUrl(row.sourceUrl, repository),
    occurredAt:
      parsedOccurredAt && !Number.isNaN(parsedOccurredAt.getTime())
        ? parsedOccurredAt.toISOString()
        : null,
    details,
  };
}

function latestDeployFailure(deploys: PassportDeploySignal[]): PassportDeploySignal | null {
  const latestByRepository = new Map<string, PassportDeploySignal>();
  for (const deploy of deploys) {
    if (!latestByRepository.has(deploy.repository)) {
      latestByRepository.set(deploy.repository, deploy);
    }
  }
  return [...latestByRepository.values()].find((deploy) => deploy.status === "failure") ?? null;
}

export function deriveProjectPassportHealth(
  actions: PassportActionSignal[],
  deploys: PassportDeploySignal[],
  now = new Date(),
): PassportHealth {
  const active = actions.filter((action) => action.status !== "DONE");
  const overdue = active.filter((action) => action.dueAt && action.dueAt < now);
  const risks = active.filter((action) => action.type === "RISK");
  const blocker = active.find(
    (action) =>
      action.escalatedAt !== null ||
      action.priority === "URGENT" ||
      (action.type === "RISK" && action.priority === "HIGH"),
  );
  const failedDeploy = latestDeployFailure(deploys);

  if (blocker) {
    return {
      state: "BLOCKED",
      reason: "Есть эскалированный или критичный пункт",
      overdueCount: overdue.length,
      activeRiskCount: risks.length,
    };
  }
  if (failedDeploy) {
    return {
      state: "BLOCKED",
      reason: `Последняя проверка ${failedDeploy.repository} завершилась ошибкой`,
      overdueCount: overdue.length,
      activeRiskCount: risks.length,
    };
  }
  if (overdue.length > 0 || risks.length > 0) {
    return {
      state: "AT_RISK",
      reason: overdue.length > 0 ? "Есть просроченная работа" : "Есть открытые риски",
      overdueCount: overdue.length,
      activeRiskCount: risks.length,
    };
  }
  if (active.length > 0 || deploys.some((deploy) => deploy.status === "success")) {
    return {
      state: "ON_TRACK",
      reason: "Критичных блокеров не обнаружено",
      overdueCount: 0,
      activeRiskCount: 0,
    };
  }
  return {
    state: "QUIET",
    reason: "Активная работа пока не зафиксирована",
    overdueCount: 0,
    activeRiskCount: 0,
  };
}

export function selectProjectPassportNextAction(
  actions: PassportActionSignal[],
  deploys: PassportDeploySignal[],
  roomIds: string[],
): PassportNextAction {
  const active = actions.filter((action) => action.status !== "DONE");
  const blocker = active.find(
    (action) =>
      action.escalatedAt !== null ||
      action.priority === "URGENT" ||
      (action.type === "RISK" && action.priority === "HIGH"),
  );
  if (blocker) {
    return {
      kind: "ACTION",
      label: "Разобрать блокер",
      actionItemId: blocker.id,
      channelId: blocker.channelId,
      sourceUrl: null,
    };
  }
  const failedDeploy = latestDeployFailure(deploys);
  if (failedDeploy) {
    return {
      kind: "DEPLOY",
      label: "Проверить неудачный deploy",
      actionItemId: null,
      channelId: null,
      sourceUrl: failedDeploy.sourceUrl,
    };
  }
  const nextWork = active.find((action) => action.type !== "DECISION");
  if (nextWork) {
    return {
      kind: "ACTION",
      label: "Продолжить работу",
      actionItemId: nextWork.id,
      channelId: nextWork.channelId,
      sourceUrl: null,
    };
  }
  if (roomIds[0]) {
    return {
      kind: "ROOM",
      label: "Открыть рабочую комнату",
      actionItemId: null,
      channelId: roomIds[0],
      sourceUrl: null,
    };
  }
  return {
    kind: "NONE",
    label: "Добавьте первую рабочую комнату",
    actionItemId: null,
    channelId: null,
    sourceUrl: null,
  };
}
