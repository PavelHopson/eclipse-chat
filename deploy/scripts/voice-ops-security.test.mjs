import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const policyPath = new URL("../../apps/web/src/lib/voiceOpsPolicy.ts", import.meta.url);
const roomPath = new URL("../../apps/web/src/components/agent-office/VoiceOpsRoom.tsx", import.meta.url);

test("Voice Ops allowlist remains read-only and blocks mutable capabilities", async () => {
  const policy = await readFile(policyPath, "utf8");
  assert.match(policy, /effect:\s*"read-only"/);
  assert.doesNotMatch(policy, /effect:\s*"(?:write|execute|network|shell)"/);
  assert.match(policy, /Заблокировано: командная строка, запись, установка, развёртывание, секреты/);
});

test("Voice Ops UI keeps kill switch fail-closed and performs no remote execution", async () => {
  const room = await readFile(roomPath, "utf8");
  assert.match(room, /useState\(true\)/);
  assert.match(room, /if \(!plan \|\| !approved \|\| killSwitch\) return/);
  assert.match(room, /setKillSwitch\(true\)/);
  assert.doesNotMatch(room, /\bfetch\s*\(|WebSocket\s*\(|EventSource\s*\(|navigator\.mediaDevices/);
});
