import { createHmac, timingSafeEqual } from "node:crypto";

export type GitHubEventStatus =
  | "success"
  | "failure"
  | "pending"
  | "neutral";

export type GitHubExternalEvent = {
  source: "github";
  verified: true;
  kind:
    | "ping"
    | "push"
    | "pull_request"
    | "issue"
    | "workflow"
    | "release"
    | "deployment";
  repository: string;
  title: string;
  summary: string;
  actor: string | null;
  ref: string | null;
  status: GitHubEventStatus;
  sourceUrl: string;
  occurredAt: string | null;
  details: Array<{ label: string; value: string }>;
};

export type FormattedGitHubEvent = {
  content: string;
  event: GitHubExternalEvent;
};

const REPOSITORY_RE = /^[A-Za-z0-9_.-]{1,100}\/[A-Za-z0-9_.-]{1,100}$/;

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function clean(value: unknown, max = 160): string {
  if (typeof value !== "string") return "";
  const normalized = value.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim();
  return normalized.length > max ? `${normalized.slice(0, max - 1)}…` : normalized;
}

function isoDate(value: unknown): string | null {
  const source = clean(value, 64);
  if (!source) return null;
  const parsed = new Date(source);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function safeGitHubUrl(value: unknown, fallback: string): string {
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

export function normalizeGitHubRepository(value: unknown): string | null {
  const repository = clean(value, 201);
  return REPOSITORY_RE.test(repository) ? repository : null;
}

export function repositoryFromGitHubPayload(payload: unknown): string | null {
  return normalizeGitHubRepository(record(record(payload)?.repository)?.full_name);
}

function actorFromPayload(payload: Record<string, unknown>): string | null {
  const sender = clean(record(payload.sender)?.login, 80);
  const pusher = clean(record(payload.pusher)?.name, 80);
  return sender || pusher || null;
}

function baseEvent(
  payload: Record<string, unknown>,
  kind: GitHubExternalEvent["kind"],
  title: string,
  summary: string,
  status: GitHubEventStatus,
  sourceUrl: unknown,
  options: {
    ref?: string | null;
    occurredAt?: string | null;
    details?: Array<{ label: string; value: string }>;
  } = {},
): GitHubExternalEvent | null {
  const repository = repositoryFromGitHubPayload(payload);
  if (!repository) return null;
  const fallback = `https://github.com/${repository}`;
  return {
    source: "github",
    verified: true,
    kind,
    repository,
    title: clean(title, 180),
    summary: clean(summary, 320),
    actor: actorFromPayload(payload),
    ref: options.ref ? clean(options.ref, 160) : null,
    status,
    sourceUrl: safeGitHubUrl(sourceUrl, fallback),
    occurredAt: options.occurredAt ?? null,
    details: (options.details ?? [])
      .slice(0, 6)
      .map((item) => ({ label: clean(item.label, 40), value: clean(item.value, 120) }))
      .filter((item) => item.label && item.value),
  };
}

function formatted(event: GitHubExternalEvent): FormattedGitHubEvent {
  const actor = event.actor ? ` · ${event.actor}` : "";
  return {
    content: `GitHub · ${event.repository} · ${event.title}${actor}`,
    event,
  };
}

/** Constant-time HMAC-SHA256 verification for X-Hub-Signature-256. */
export function verifyGitHubSignature(
  body: string,
  signatureHeader: string | undefined,
  secret: string,
): boolean {
  if (!signatureHeader || !signatureHeader.startsWith("sha256=")) return false;
  const sigHex = signatureHeader.slice("sha256=".length);
  if (!/^[0-9a-fA-F]{64}$/.test(sigHex)) return false;
  const expected = createHmac("sha256", secret).update(body, "utf8").digest();
  const provided = Buffer.from(sigHex, "hex");
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}

/** Convert a signed GitHub payload into a bounded provenance event. */
export function formatGitHubEvent(
  eventType: string,
  payload: unknown,
): FormattedGitHubEvent | null {
  const p = record(payload);
  if (!p) return null;

  if (eventType === "ping") {
    const event = baseEvent(
      p,
      "ping",
      "Webhook подключён",
      clean(p.zen, 200) || "GitHub подтвердил подключение.",
      "success",
      record(p.repository)?.html_url,
    );
    return event ? formatted(event) : null;
  }

  if (eventType === "push") {
    const ref = clean(p.ref, 180).replace(/^refs\/heads\//, "");
    const commits = Array.isArray(p.commits) ? p.commits : [];
    const deleted = p.deleted === true;
    if (!ref || (!deleted && commits.length === 0)) return null;
    const firstMessages = commits
      .slice(0, 3)
      .map((item) => clean(record(item)?.message, 100).split("\n")[0])
      .filter(Boolean);
    const event = baseEvent(
      p,
      "push",
      deleted ? `Удалена ветка ${ref}` : `${commits.length} commit в ${ref}`,
      deleted
        ? "Ветка удалена в GitHub."
        : firstMessages.join(" · ") || "В репозиторий отправлены изменения.",
      "success",
      p.compare,
      {
        ref,
        details: commits.length > 3
          ? [{ label: "Ещё", value: `${commits.length - 3} commit` }]
          : [],
      },
    );
    return event ? formatted(event) : null;
  }

  if (eventType === "pull_request") {
    const action = clean(p.action, 40);
    if (!["opened", "closed", "reopened", "ready_for_review", "synchronize"].includes(action)) {
      return null;
    }
    const pr = record(p.pull_request);
    if (!pr) return null;
    const number = typeof p.number === "number" ? p.number : pr.number;
    const merged = pr.merged === true;
    const status: GitHubEventStatus = action === "closed" && !merged ? "neutral" : "success";
    const actionLabel = merged
      ? "Слит"
      : action === "opened"
        ? "Открыт"
        : action === "closed"
          ? "Закрыт"
          : action === "ready_for_review"
            ? "Готов к review"
            : action === "synchronize"
              ? "Обновлён"
              : "Переоткрыт";
    const event = baseEvent(
      p,
      "pull_request",
      `${actionLabel} PR #${String(number ?? "?")}`,
      clean(pr.title, 220) || "Pull request без названия",
      status,
      pr.html_url,
      {
        ref: clean(record(pr.head)?.ref, 160) || null,
        occurredAt: isoDate(pr.updated_at),
        details: [
          { label: "Изменения", value: `${Number(pr.additions ?? 0)}+ / ${Number(pr.deletions ?? 0)}−` },
          { label: "Файлы", value: String(pr.changed_files ?? 0) },
        ],
      },
    );
    return event ? formatted(event) : null;
  }

  if (eventType === "issues") {
    const action = clean(p.action, 40);
    if (!["opened", "closed", "reopened"].includes(action)) return null;
    const issue = record(p.issue);
    if (!issue) return null;
    const actionLabel = action === "opened" ? "Открыта" : action === "closed" ? "Закрыта" : "Переоткрыта";
    const event = baseEvent(
      p,
      "issue",
      `${actionLabel} issue #${String(issue.number ?? "?")}`,
      clean(issue.title, 220) || "Issue без названия",
      action === "closed" ? "success" : "pending",
      issue.html_url,
      { occurredAt: isoDate(issue.updated_at) },
    );
    return event ? formatted(event) : null;
  }

  if (eventType === "workflow_run") {
    const action = clean(p.action, 40);
    if (action !== "completed" && action !== "requested" && action !== "in_progress") return null;
    const run = record(p.workflow_run);
    if (!run) return null;
    const conclusion = clean(run.conclusion, 40);
    const status: GitHubEventStatus = conclusion === "success"
      ? "success"
      : conclusion && !["neutral", "skipped", "cancelled"].includes(conclusion)
        ? "failure"
        : action === "completed"
          ? "neutral"
          : "pending";
    const event = baseEvent(
      p,
      "workflow",
      `CI · ${clean(run.name, 120) || "Workflow"}`,
      conclusion ? `Результат: ${conclusion}` : "Workflow выполняется.",
      status,
      run.html_url,
      {
        ref: clean(run.head_branch, 160) || null,
        occurredAt: isoDate(run.updated_at),
        details: [{ label: "Запуск", value: `#${String(run.run_number ?? "?")}` }],
      },
    );
    return event ? formatted(event) : null;
  }

  if (eventType === "release") {
    if (clean(p.action, 40) !== "published") return null;
    const release = record(p.release);
    if (!release) return null;
    const tag = clean(release.tag_name, 120) || "без тега";
    const event = baseEvent(
      p,
      "release",
      `Опубликован релиз ${tag}`,
      clean(release.name, 220) || `Новая версия ${tag} доступна в GitHub.`,
      "success",
      release.html_url,
      {
        ref: tag,
        occurredAt: isoDate(release.published_at),
        details: release.prerelease === true ? [{ label: "Тип", value: "Pre-release" }] : [],
      },
    );
    return event ? formatted(event) : null;
  }

  if (eventType === "deployment_status") {
    const deployment = record(p.deployment);
    const deploymentStatus = record(p.deployment_status);
    if (!deployment || !deploymentStatus) return null;
    const state = clean(deploymentStatus.state, 40);
    const status: GitHubEventStatus = state === "success"
      ? "success"
      : ["failure", "error"].includes(state)
        ? "failure"
        : ["pending", "queued", "in_progress"].includes(state)
          ? "pending"
          : "neutral";
    const environment = clean(deployment.environment, 100) || "environment";
    const repository = repositoryFromGitHubPayload(p);
    const fallbackUrl = repository ? `https://github.com/${repository}/deployments` : "https://github.com";
    const event = baseEvent(
      p,
      "deployment",
      `Deploy · ${environment}`,
      state ? `Статус: ${state}` : "Статус deployment обновлён.",
      status,
      fallbackUrl,
      {
        ref: clean(deployment.ref, 160) || null,
        occurredAt: isoDate(deploymentStatus.updated_at),
      },
    );
    return event ? formatted(event) : null;
  }

  return null;
}
