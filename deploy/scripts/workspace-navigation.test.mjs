import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import test from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const read = path => readFileSync(join(root, path), "utf8");
function functions(path, names, globals = {}) {
  const source = read(path);
  const ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const code = ast.statements.filter(node => ts.isFunctionDeclaration(node) && names.includes(node.name?.text)).map(node => node.getText(ast)).join("\n");
  const exports = {};
  runInNewContext(ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React } }).outputText,
    { exports, Date, Map, Set, Number, ...globals });
  return exports;
}
const nav = functions("apps/web/src/lib/conversationNavigation.ts", ["replyLabel", "isDirectMention", "incomingAfter", "panelWidth", "localDateInput", "readingAnchor"]);
const thread = functions("apps/web/src/hooks/useThread.ts", ["normalize", "mergeThreadReply"]);

test("Russian reply counts cover all endings", () => {
  for (const [count, label] of [[0, "ответов"], [1, "ответ"], [2, "ответа"], [5, "ответов"], [11, "ответов"], [21, "ответ"], [24, "ответа"], [112, "ответов"]])
    assert.equal(nav.replyLabel(count), count + " " + label);
});
test("mentions use exact Unicode-aware display names, not prefix or email matches", () => {
  assert.equal(nav.isDirectMention("@Павел, посмотри", "Павел"), true);
  assert.equal(nav.isDirectMention("Ответ @павел хопсон.", "Павел Хопсон"), true);
  assert.equal(nav.isDirectMention("@ПавелДругой", "Павел"), false);
  assert.equal(nav.isDirectMention("user@Павел.ru", "Павел"), false);
  assert.equal(nav.isDirectMention("@A[1]!", "A[1]"), true);
  assert.equal(nav.isDirectMention("текст", ""), false);
});
test("unread batches exclude own, pending, deleted messages and history replacement", () => {
  const row = (id, extra = {}) => ({ id, user: { id: "other" }, ...extra });
  const messages = [row("old"), row("one"), row("mine", { user: { id: "me" } }), row("pending", { pending: true }), row("deleted", { deletedAt: "now" }), row("two")];
  assert.equal(nav.incomingAfter(messages, "old", "me").map(row => row.id).join(","), "one,two");
  assert.equal(nav.incomingAfter(messages, "missing", "me").length, 0);
});
test("panel width and local datetime preferences reject invalid values", () => {
  assert.equal(nav.panelWidth(NaN), 400);
  assert.equal(nav.panelWidth(Infinity), 400);
  assert.equal(nav.panelWidth(-5), 320);
  assert.equal(nav.panelWidth(99999), 560);
  assert.equal(nav.panelWidth(500, 380), 380);
  assert.equal(nav.localDateInput("invalid"), "");
  assert.equal(nav.localDateInput(null), "");
  assert.match(nav.localDateInput("2026-08-28T09:15:00.000Z"), /^2026-08-28T\d{2}:15$/);
});
test("HTTP and socket acknowledgement converge without duplicate replies", () => {
  const payload = { rootId: "root", messageId: "server-reply", content: "reply", userId: "me", displayName: "Имя", avatar: null, createdAt: "2026-08-28T09:00:00Z", attachments: [{ id: "file", filename: "note.txt" }] };
  const pending = { id: "local", content: "reply", user: { id: "me" }, pending: true };
  const initial = { root: { id: "root" }, replies: [pending], channelId: "channel" };
  const socketFirst = thread.mergeThreadReply(initial, payload);
  const httpNext = thread.mergeThreadReply(socketFirst, payload, "local");
  assert.equal(httpNext.replies.length, 1);
  assert.equal(httpNext.replies[0].id, "server-reply");
  assert.equal(httpNext.replies[0].pending, undefined);
  assert.equal(httpNext.replies[0].attachments[0].id, "file");
  assert.equal(thread.mergeThreadReply(initial, { ...payload, rootId: "other" }), initial, "late events cannot modify another thread");
  assert.equal(thread.mergeThreadReply(null, payload), null);
});
test("connection states follow transport/browser events and clean up handlers", () => {
  const handlers = new Map(), windowHandlers = new Map(), timers = new Map(), states = [];
  const navigator = { onLine: true };
  let cleanup, timerId = 0, connects = 0;
  const socket = { connected: false, on: (name, fn) => handlers.set(name, fn), off: name => handlers.delete(name), connect: () => { connects++; } };
  const hook = functions("apps/web/src/hooks/useConversationConnection.ts", ["useConversationConnection"], {
    navigator, window: { addEventListener: (name, fn) => windowHandlers.set(name, fn), removeEventListener: name => windowHandlers.delete(name) },
    useState: initial => { const value = typeof initial === "function" ? initial() : initial; states.push(value); return [value, value => states.push(value)]; },
    useEffect: effect => { cleanup = effect(); }, useCallback: fn => fn,
    setTimeout: fn => { timers.set(++timerId, fn); return timerId; }, clearTimeout: id => timers.delete(id),
  }).useConversationConnection(socket);
  handlers.get("connect_error")();
  assert.equal(states.at(-1), "reconnecting");
  navigator.onLine = false; windowHandlers.get("offline")();
  assert.equal(states.at(-1), "offline");
  hook.retry(); assert.equal(connects, 0, "offline retry never sends");
  navigator.onLine = true; windowHandlers.get("online")();
  assert.equal(connects, 1);
  socket.connected = true; handlers.get("connect")();
  assert.equal(states.at(-1), "recovered");
  [...timers.values()][0](); assert.equal(states.at(-1), "online");
  hook.retry(); assert.equal(states.at(-1), "online", "connected transport is not stuck reconnecting");
  cleanup(); assert.equal(handlers.size, 0); assert.equal(windowHandlers.size, 0); assert.equal(timers.size, 0);
});
test("thread loading/retry and late responses are scoped to the selected root", () => {
  const hook = read("apps/web/src/hooks/useThread.ts");
  assert.match(hook, /cancelled/);
  assert.match(hook, /data\?\.root\.id === rootId/);
  assert.match(hook, /rootRef\.current === rootId/);
  assert.match(hook, /sendingRef\.current/);
  assert.match(hook, /socket\.on\("connect", reconnect\)/);
  assert.match(hook, /socket\.off\("connect", reconnect\)/);
  assert.doesNotMatch(hook, /console\.(log|error)/);
});
test("layout focus never filters messages and resize is frame-bounded", () => {
  const layout = read("apps/web/src/hooks/useWorkspaceLayout.ts");
  assert.doesNotMatch(layout, /messages\.filter|useFocusMode/);
  assert.match(layout, /localStorage\.setItem\(WIDTH_KEY/);
  const resize = read("apps/web/src/components/PanelResizeHandle.tsx");
  assert.match(resize, /requestAnimationFrame/);
  assert.match(resize, /setPointerCapture/);
  assert.match(resize, /aria-valuenow/);
  assert.match(resize, /ArrowLeft/);
  const app = read("apps/web/src/pages/AppShell.tsx");
  assert.match(app, /<LogoutButton onLogout=\{onLogout\} \/>/);
  assert.match(app, /<StatusBoard/);
  assert.match(app, /readingAnchor/);
});
test("search preview is escaped React content and keyboard/close/retry stay available", () => {
  const search = read("apps/web/src/components/SearchOverlay.tsx");
  assert.doesNotMatch(search, /dangerouslySetInnerHTML|innerHTML\s*=/);
  assert.match(search, /setPreview\(null\)/);
  assert.match(search, /document\.activeElement === last/);
  assert.match(search, /ArrowDown/);
  assert.match(search, /onRetry=\{onRetry\}/);
  assert.match(search, /localDateInput\(filters\.since\)/);
  assert.match(search, /К результатам/);
});
test("drafting and sending have separate availability, reduced motion is explicit", () => {
  const composer = read("apps/web/src/components/MessageInput.tsx");
  assert.match(composer, /sendDisabled \|\| isRecording/);
  assert.match(composer, /!sendDisabled/);
  assert.doesNotMatch(composer, /disabled=\{disabled \|\| sendDisabled/);
  assert.match(composer, /field\.focus\(\{ preventScroll: true \}\)/);
  const css = read("apps/web/src/styles/workspace-navigation.css");
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.doesNotMatch(css, /transition:\s*(all|width)|animation:.*infinite/);
});
test("production workspace wires real conversation components without fixture dependencies", () => {
  const shell = read("apps/web/src/pages/AppShell.tsx");
  assert.match(shell, /<ThreadPanel/);
  assert.match(shell, /<SearchOverlay/);
  assert.match(shell, /<ConnectionNotice/);
  assert.match(shell, /useConversationConnection\(socket\)/);
  assert.doesNotMatch(shell, /previewConversation|workspace-preview|previewTasks/);
});
