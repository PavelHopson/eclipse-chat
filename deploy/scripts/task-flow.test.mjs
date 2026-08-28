import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import test from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const source = path => readFileSync(join(root, path), "utf8");
const exports = {};
runInNewContext(ts.transpileModule(source("apps/web/src/lib/actionDraft.ts"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports, Date, Set });
const { prepareActionDraft, actionDraftTitle, actionDuePreset } = exports;
const now = new Date("2026-08-28T12:00:00Z").getTime();
const draft = { type: "TASK", title: "  Проверить интерфейс  ", description: " Детали ", priority: "NORMAL", assigneeUserId: "user-1", dueAt: "" };

test("task draft preserves all five object types and source text is only a title suggestion", () => {
  assert.equal(Object.keys(exports.ACTION_KIND).length, 5);
  assert.equal(actionDraftTitle("  **Проверить**\n интерфейс  "), "Проверить интерфейс");
  assert.equal(actionDraftTitle("x".repeat(300)).length, 160);
  assert.equal(actionDraftTitle(""), "");
});
test("draft submits normalized fields and never permits assignment without permission", () => {
  const result = prepareActionDraft(draft, { canAssign: false, existingTypes: [], now });
  assert.equal(result.ok, true);
  assert.equal(result.input.title, "Проверить интерфейс");
  assert.equal(result.input.description, "Детали");
  assert.equal(result.input.assigneeUserId, null);
  assert.equal(prepareActionDraft(draft, { canAssign: true, existingTypes: [], now }).input.assigneeUserId, "user-1");
});
test("duplicates, blank titles and oversized descriptions are rejected before sending", () => {
  assert.equal(prepareActionDraft(draft, { canAssign: true, existingTypes: ["TASK"], now }).field, "type");
  assert.equal(prepareActionDraft({ ...draft, title: " " }, { canAssign: true, existingTypes: [], now }).field, "title");
  assert.equal(prepareActionDraft({ ...draft, description: "x".repeat(4001) }, { canAssign: true, existingTypes: [], now }).field, "description");
});
test("invalid and past dates are rejected; decisions do not leak hidden owner or date fields", () => {
  for (const dueAt of ["invalid", "2026-08-27T12:00"]) {
    assert.equal(prepareActionDraft({ ...draft, dueAt }, { canAssign: true, existingTypes: [], now }).field, "dueAt");
  }
  const result = prepareActionDraft({ ...draft, type: "DECISION", dueAt: "invalid" }, { canAssign: true, existingTypes: [], now });
  assert.equal(result.input.assigneeUserId, null);
  assert.equal(result.input.dueAt, null);
  assert.ok(new Date(actionDuePreset(0, new Date(now))).getTime() > now);
});
test("open and complete are separate controls; failed requests retain draft and release the submit lock", () => {
  const chip = source("apps/web/src/components/MessageActionChip.tsx");
  assert.match(chip, /onClick=\{\(\) => onOpen\(action.id\)\}/);
  assert.match(chip, /done \? "OPEN" : "DONE"/);
  assert.match(chip, /aria-pressed=\{done\}/);
  const form = source("apps/web/src/components/MessageActionModal.tsx");
  assert.match(form, /if \(busy.current\) return/);
  assert.match(form, /finally \{[\s\S]*busy.current = false/);
  assert.doesNotMatch(form, /setTitle\(""/);
  assert.match(form, /form=\{formId\}/);
  assert.match(form, /aria-invalid=/);
});
test("docked details leave chat interactive; overlay traps focus and nested dialogs win Escape", () => {
  const drawer = source("apps/web/src/components/ActionItemDrawer.tsx");
  assert.match(drawer, /role=\{docked \? "region" : "dialog"\}/);
  assert.match(drawer, /if \(modal && modal !== panel\) return/);
  assert.match(drawer, /!docked && e.key === "Tab"/);
  assert.match(drawer, /previousFocus\?\.isConnected/);
  const shell = source("apps/web/src/pages/AppShell.tsx");
  assert.match(shell, /setPendingSourceJump\(\{ channelId, messageId \}\)/);
  assert.equal((shell.match(/onOpenAction=\{setOpenActionItemId\}/g) ?? []).length >= 2, true);
  assert.match(shell, /<LogoutButton onLogout=\{onLogout\} \/>/);
  assert.doesNotMatch(shell, /previewTasks|workspace-preview-tasks/);
});
test("server validation and role checks stay the authority; no creation in a deleted or foreign room", () => {
  const route = source("apps/server/src/routes/actions.ts");
  for (const guard of ["onRequest: [requireJwt]", "validateActionCreationAccess(", "requireChannelMember(userId, message.channelId)", "if (message.deletedAt)", "Assignee is not a member of this server", "createActionBody.safeParse(req.body)"]) assert.ok(route.includes(guard), guard);
  const css = source("apps/web/src/styles/task-flow.css");
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /@media \(max-width: 540px\)/);
});
