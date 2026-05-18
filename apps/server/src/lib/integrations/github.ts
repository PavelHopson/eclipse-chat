/**
 * v0.89 #26 phase 2 — GitHub webhook incoming bridge.
 *
 * Receives GH events (push / pull_request / issues / release / ping),
 * forms human-readable text, posts в Eclipse channel through system bot.
 *
 * Security:
 *   - HMAC-SHA256 signature verify (header `X-Hub-Signature-256`).
 *   - Constant-time comparison через `crypto.timingSafeEqual`.
 *   - Reject если `webhookSecret` not configured (integration not yet
 *     activated).
 *
 * Supported events (phase 2): push, pull_request (opened/closed/merged),
 * issues (opened/closed/reopened), release (published), ping.
 *
 * Skipped events: workflow_run, deployment_status, etc — too noisy.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

/** Verify HMAC signature. Returns true если matches. */
export function verifyGitHubSignature(
  body: string,
  signatureHeader: string | undefined,
  secret: string,
): boolean {
  if (!signatureHeader || !signatureHeader.startsWith("sha256=")) return false;
  const sigHex = signatureHeader.slice("sha256=".length);
  if (!/^[0-9a-fA-F]{64}$/.test(sigHex)) return false;
  const expected = createHmac("sha256", secret).update(body, "utf8").digest();
  let provided: Buffer;
  try {
    provided = Buffer.from(sigHex, "hex");
  } catch {
    return false;
  }
  if (provided.length !== expected.length) return false;
  return timingSafeEqual(provided, expected);
}

/** Безопасно усекаем строку до n char + ellipsis. */
function truncate(s: string, n: number): string {
  if (typeof s !== "string") return "";
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

/**
 * Маршрутизируем GitHub event → markdown-friendly текст для Eclipse channel.
 *
 * Returns null если event-тип не поддерживается ИЛИ payload не парсится —
 * caller silently skip'ает (200 OK для webhook, чтобы GH не retried).
 */
export function formatGitHubEvent(
  eventType: string,
  payload: unknown,
): string | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as Record<string, unknown>;

  switch (eventType) {
    case "ping": {
      const zen = typeof p.zen === "string" ? p.zen : "pong";
      return `🛰 GitHub webhook connected. Zen: _${truncate(zen, 200)}_`;
    }
    case "push": {
      const repo = (p.repository as Record<string, unknown>)?.full_name;
      const ref = typeof p.ref === "string" ? p.ref.replace("refs/heads/", "") : "";
      const commits = Array.isArray(p.commits) ? p.commits : [];
      const pusher = (p.pusher as Record<string, unknown>)?.name;
      if (commits.length === 0) return null;
      const lines = commits.slice(0, 5).map((c: unknown) => {
        const commit = c as Record<string, unknown>;
        const msg =
          typeof commit.message === "string"
            ? commit.message.split("\n")[0]
            : "(empty)";
        const author =
          (commit.author as Record<string, unknown>)?.username ??
          (commit.author as Record<string, unknown>)?.name ??
          "—";
        return `• ${truncate(msg, 120)} _(${author})_`;
      });
      const extra =
        commits.length > 5 ? `\n_+${commits.length - 5} ещё_` : "";
      return [
        `📦 **${repo ?? "repo"}** \`${ref}\` — ${commits.length} commit'а от **${pusher ?? "—"}**`,
        ...lines,
        extra,
      ]
        .filter(Boolean)
        .join("\n");
    }
    case "pull_request": {
      const action = typeof p.action === "string" ? p.action : "";
      if (!["opened", "closed", "reopened", "ready_for_review"].includes(action)) {
        return null;
      }
      const pr = p.pull_request as Record<string, unknown> | undefined;
      if (!pr) return null;
      const repo = (p.repository as Record<string, unknown>)?.full_name;
      const number = pr.number;
      const title = typeof pr.title === "string" ? pr.title : "(no title)";
      const author = (pr.user as Record<string, unknown>)?.login ?? "—";
      const url = typeof pr.html_url === "string" ? pr.html_url : "";
      const merged = pr.merged === true;
      const verb =
        action === "opened"
          ? "🟢 открыл"
          : action === "closed"
            ? merged
              ? "🟣 смержил"
              : "🔴 закрыл"
            : action === "reopened"
              ? "♻️ переоткрыл"
              : "👀 готов к ревью";
      return `**${repo ?? "repo"}** PR #${number}: **${author}** ${verb} _«${truncate(title, 120)}»_\n${url}`;
    }
    case "issues": {
      const action = typeof p.action === "string" ? p.action : "";
      if (!["opened", "closed", "reopened"].includes(action)) return null;
      const issue = p.issue as Record<string, unknown> | undefined;
      if (!issue) return null;
      const repo = (p.repository as Record<string, unknown>)?.full_name;
      const number = issue.number;
      const title = typeof issue.title === "string" ? issue.title : "(no title)";
      const author = (issue.user as Record<string, unknown>)?.login ?? "—";
      const url = typeof issue.html_url === "string" ? issue.html_url : "";
      const verb =
        action === "opened" ? "🟢 открыл" : action === "closed" ? "🔴 закрыл" : "♻️ переоткрыл";
      return `**${repo ?? "repo"}** issue #${number}: **${author}** ${verb} _«${truncate(title, 120)}»_\n${url}`;
    }
    case "release": {
      const action = typeof p.action === "string" ? p.action : "";
      if (action !== "published") return null;
      const release = p.release as Record<string, unknown> | undefined;
      if (!release) return null;
      const repo = (p.repository as Record<string, unknown>)?.full_name;
      const tag = typeof release.tag_name === "string" ? release.tag_name : "—";
      const name = typeof release.name === "string" ? release.name : "";
      const url = typeof release.html_url === "string" ? release.html_url : "";
      return `🚀 **${repo ?? "repo"}** релиз \`${tag}\` ${name ? `— ${truncate(name, 120)}` : ""}\n${url}`;
    }
    default:
      return null;
  }
}
