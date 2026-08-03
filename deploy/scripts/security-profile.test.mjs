import assert from "node:assert/strict";
import test from "node:test";
import { renderMarkdown, selectSecurityProfiles } from "./security-profile.mjs";

test("always includes the baseline gate", () => {
  const selection = selectSecurityProfiles(["README.md"]);
  assert.deepEqual(selection.profiles.map((profile) => profile.id), ["baseline"]);
});

test("selects access and realtime profiles for Socket.IO authorization changes", () => {
  const selection = selectSecurityProfiles([
    "apps/server/src/lib/realtimeAccess.ts",
    "apps/server/src/voicePresence.ts",
  ]);
  assert.deepEqual(selection.profiles.map((profile) => profile.id), [
    "baseline",
    "identity-access",
    "realtime-voice",
  ]);
});

test("normalizes Windows paths and deduplicates evidence", () => {
  const selection = selectSecurityProfiles([
    "apps\\server\\src\\routes\\attachments.ts",
    "apps/server/src/routes/attachments.ts",
  ]);
  assert.equal(selection.files.length, 1);
  assert.match(renderMarkdown(selection), /Uploads and media/);
});

test("requires access review for regular API route files", () => {
  const selection = selectSecurityProfiles(["apps/server/src/routes/users.ts"]);
  assert.ok(selection.profiles.some((profile) => profile.id === "identity-access"));
});

test("combines access and realtime review for the personal voice digest", () => {
  const result = selectSecurityProfiles([
    "apps/server/src/routes/personalDigest.ts",
  ]);

  assert.deepEqual(
    result.profiles.map((profile) => profile.id),
    ["baseline", "identity-access", "realtime-voice"],
  );
});

test("combines access and AI controls for agent routes", () => {
  const selection = selectSecurityProfiles(["apps/server/src/routes/bots.ts"]);
  assert.ok(selection.profiles.some((profile) => profile.id === "identity-access"));
  assert.ok(selection.profiles.some((profile) => profile.id === "ai-mcp"));
});
