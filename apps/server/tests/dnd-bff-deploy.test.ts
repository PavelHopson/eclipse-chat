import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(
  fileURLToPath(new URL("../../../.github/workflows/deploy-dnd-bff.yml", import.meta.url)),
  "utf8",
);

describe("DnD BFF dark deployment", () => {
  it("is manual, production-gated and pinned", () => {
    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).toContain("confirm_dark_launch");
    expect(workflow).toContain("environment: production");
    expect(workflow).toMatch(/appleboy\/ssh-action@[0-9a-f]{40}/);
    expect(workflow).toMatch(/DND_COMMIT="[0-9a-f]{40}"/);
    expect(workflow).toMatch(/AI_HUB_COMMIT="[0-9a-f]{40}"/);
    expect(workflow).toContain('test "$(id -u)" -eq 0');
    expect(workflow).toContain("bootstrap-dark.sh");
    expect(workflow).not.toContain("set -x");
  });
});
