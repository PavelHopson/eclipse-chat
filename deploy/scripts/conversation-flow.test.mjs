import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import test from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const source = path => readFileSync(join(root, path), "utf8");
const composer = source("apps/web/src/components/MessageInput.tsx");
// Exercise the actual pure parsing/validation functions, not a copied implementation.
const ast = ts.createSourceFile("MessageInput.tsx", composer, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const names = ["SLASH_COMMANDS", "TEXT_MACRO_COMMANDS", "parseSlashCommand", "parseTextMacroCommand",
  "ATTACHMENT_MAX_BYTES", "ATTACHMENT_MAX_BYTES_VIDEO", "MAX_PER_MESSAGE", "ALLOWED_MIME",
  "clientSizeLimit", "validateComposerFile", "dataTransferHasType", "isHtmlDragArtifact", "attachmentFilesFromDrop"];
const selected = ast.statements.filter(node =>
  ts.isFunctionDeclaration(node) ? names.includes(node.name?.text) :
  ts.isVariableStatement(node) && node.declarationList.declarations.some(decl => names.includes(decl.name.getText(ast))));
const scope = {};
runInNewContext(ts.transpileModule(selected.map(node => node.getText(ast)).join("\n") +
  "\nObject.assign(result, { parseSlashCommand, parseTextMacroCommand, clientSizeLimit, validateComposerFile, attachmentFilesFromDrop, MAX_PER_MESSAGE });",
  { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText,
  { result: scope, Set, Array });

test("all five operator types and text macros stay available", () => {
  for (const [command, type] of [["task", "TASK"], ["decision", "DECISION"], ["followup", "FOLLOW_UP"], ["risk", "RISK"], ["requirement", "REQUIREMENT"]]) {
    const parsed = scope.parseSlashCommand("/" + command + " Проверить выпуск");
    assert.equal(parsed.type, type);
    assert.equal(parsed.title, "Проверить выпуск");
  }
  assert.equal(scope.parseSlashCommand("/task "), null);
  assert.equal(scope.parseSlashCommand("Обычное сообщение"), null);
  assert.match(scope.parseTextMacroCommand("/shrug"), /ツ/);
});
test("upload limits stay 10 files, 50 MiB files, 200 MiB video; HTML is not accepted", () => {
  const MiB = 1024 * 1024;
  const check = (type, size) => scope.validateComposerFile({ type, size, name: "attachment" });
  assert.equal(scope.MAX_PER_MESSAGE, 10);
  assert.equal(scope.clientSizeLimit("video/mp4"), 200 * MiB);
  assert.equal(scope.clientSizeLimit("application/pdf"), 50 * MiB);
  assert.equal(check("application/pdf", 50 * MiB), null);
  assert.match(check("application/pdf", 50 * MiB + 1), /50/);
  assert.equal(check("video/mp4", 200 * MiB), null);
  assert.match(check("video/mp4", 200 * MiB + 1), /200/);
  assert.match(check("text/html", 100), /Не поддерживается/);
  assert.match(check("application/javascript", 100), /Не поддерживается/);
  assert.equal(check("", 100), null, "unknown browser MIME is validated authoritatively on server");
});
test("HTML drag artifacts are not converted into file uploads", () => {
  const image = { type: "image/png", name: "photo.png" };
  const files = scope.attachmentFilesFromDrop({ files: [{ type: "text/html" }, image], types: ["text/html", "Files"] });
  assert.equal(files.length, 1);
  assert.equal(files[0], image);
});
test("send failure retains draft, blocks double submit and never clears a different room", () => {
  assert.match(composer, /sendingRef.current \|\| disabled/);
  assert.match(composer, /if \(!ok\) throw new Error/);
  assert.match(composer, /draftKeyRef.current === sendingKey/);
  assert.match(composer, /catch \{[\s\S]*setSendError/);
  assert.match(composer, /sendingRef.current = false/);
  assert.match(composer, /e.nativeEvent.isComposing/);
  assert.match(composer, /pendingRef.current/);
  assert.match(composer, /URL.revokeObjectURL\(item.previewUrl\)/);
  assert.match(composer, /onTaskRequestHandled\?\.\(\)/);
});
test("message overflow menu keeps every action and supports keyboard/viewport dismissal", () => {
  const list = source("apps/web/src/components/MessageList.tsx");
  const menu = source("apps/web/src/components/MessageActions.tsx");
  for (const action of ["copy", "memory", "edit", "unpin", "pin", "delete"]) assert.ok(list.includes('id: "' + action + '"'));
  for (const feature of ["onReply", "onTask", "onReact", "onPickReaction", 'role="menu"', '"ArrowDown"', '"ArrowUp"', '"Escape"', '"Home"', '"End"', "createPortal"]) assert.ok(menu.includes(feature), feature);
  assert.match(menu, /window.innerHeight - 24/);
  assert.match(menu, /removeEventListener\("pointerdown"/);
  assert.match(list, /hasPermission\(currentRole, "TASK_CREATE"\)/);
});
test("tasks stay searchable, with both list and board; server-confirmed updates", () => {
  const board = source("apps/web/src/components/StatusBoard.tsx");
  const execution = source("apps/web/src/components/IntelligencePanel.tsx");
  const hook = source("apps/web/src/hooks/useServerActions.ts");
  assert.match(board, /useState<"list" \| "board">\("list"\)/);
  assert.match(board, /aria-label="Найти задачу"/);
  assert.match(board, /Сбросить фильтры/);
  assert.match(board, /onCreateTask/);
  assert.match(board, /blockedByOpen/);
  assert.match(board, /ApprovalChip/);
  assert.match(execution, /MessageActionChip key=/);
  assert.doesNotMatch(execution, /Набери в композере/);
  const update = hook.slice(hook.indexOf("const updateStatus"));
  assert.ok(update.indexOf("await apiJson") < update.indexOf("setActions("));
  assert.match(update, /return true/);
  assert.match(update, /return false/);
});
test("media uses existing URL resolver and safe download attributes, no new unsafe HTML", () => {
  const media = source("apps/web/src/components/Attachments.tsx");
  assert.match(media, /resolveAssetUrl\(a.url\)/);
  assert.match(media, /rel="noopener noreferrer"/);
  assert.match(media, /Повторить загрузку видео/);
  assert.match(media, /Повторить загрузку изображения/);
  assert.doesNotMatch(media, /dangerouslySetInnerHTML/);
  assert.doesNotMatch(media, /style.transform = "translateY/);
  const css = source("apps/web/src/styles/conversation-flow.css");
  assert.match(css, /object-fit: contain/);
  assert.match(css, /prefers-reduced-motion: no-preference/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.doesNotMatch(css, /animation:[^;]*infinite/);
});
