import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  formatGitHubEvent,
  normalizeGitHubRepository,
  repositoryFromGitHubPayload,
  verifyGitHubSignature,
} from "../src/lib/integrations/github.js";

const repository = {
  full_name: "PavelHopson/eclipse-chat",
  html_url: "https://github.com/PavelHopson/eclipse-chat",
};

describe("GitHub webhook security", () => {
  it("verifies only a valid sha256 signature", () => {
    const body = JSON.stringify({ repository });
    const secret = "test-secret-which-is-not-production";
    const signature = `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;

    expect(verifyGitHubSignature(body, signature, secret)).toBe(true);
    expect(verifyGitHubSignature(`${body} `, signature, secret)).toBe(false);
    expect(verifyGitHubSignature(body, "sha256=bad", secret)).toBe(false);
    expect(verifyGitHubSignature(body, undefined, secret)).toBe(false);
  });

  it("accepts canonical owner/repository names and rejects URL-shaped input", () => {
    expect(normalizeGitHubRepository("PavelHopson/eclipse-chat")).toBe("PavelHopson/eclipse-chat");
    expect(normalizeGitHubRepository("https://github.com/PavelHopson/eclipse-chat")).toBeNull();
    expect(repositoryFromGitHubPayload({ repository })).toBe("PavelHopson/eclipse-chat");
  });
});

describe("GitHub operational event formatter", () => {
  it("creates a verified CI failure with a GitHub source link", () => {
    const result = formatGitHubEvent("workflow_run", {
      action: "completed",
      repository,
      sender: { login: "github-actions[bot]" },
      workflow_run: {
        name: "Security Gate",
        conclusion: "failure",
        html_url: "https://github.com/PavelHopson/eclipse-chat/actions/runs/42",
        head_branch: "master",
        run_number: 42,
        updated_at: "2026-08-03T12:00:00Z",
      },
    });

    expect(result?.event).toMatchObject({
      source: "github",
      verified: true,
      kind: "workflow",
      status: "failure",
      repository: "PavelHopson/eclipse-chat",
      ref: "master",
    });
    expect(result?.event.sourceUrl).toBe("https://github.com/PavelHopson/eclipse-chat/actions/runs/42");
  });

  it("never exposes an off-GitHub source URL", () => {
    const result = formatGitHubEvent("pull_request", {
      action: "opened",
      number: 12,
      repository,
      pull_request: {
        number: 12,
        title: "Safe title",
        html_url: "https://attacker.example/phishing",
        head: { ref: "feature/safe" },
        additions: 2,
        deletions: 1,
        changed_files: 1,
        updated_at: "2026-08-03T12:00:00Z",
      },
    });

    expect(result?.event.sourceUrl).toBe("https://github.com/PavelHopson/eclipse-chat");
  });

  it("maps deployment states to an operational status", () => {
    const result = formatGitHubEvent("deployment_status", {
      repository,
      deployment: { environment: "production", ref: "master" },
      deployment_status: { state: "success", updated_at: "2026-08-03T12:00:00Z" },
    });

    expect(result?.event).toMatchObject({
      kind: "deployment",
      status: "success",
      title: "Deploy · production",
      ref: "master",
    });
  });
});
