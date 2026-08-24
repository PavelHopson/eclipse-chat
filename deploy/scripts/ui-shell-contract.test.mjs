import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

function source(relativePath) {
  return readFileSync(join(root, relativePath), "utf8");
}

test("desktop and mobile docks expose the primary product destinations", () => {
  const rail = source("apps/web/src/components/ServerRail.tsx");
  const bottomNav = source("apps/web/src/components/BottomNav.tsx");

  for (const label of ["Сводка", "Личные", "AI-офис", "Профиль"]) {
    assert.match(rail, new RegExp(`caption=\"${label}\"`));
  }
  assert.match(rail, /caption="Админ"/);
  assert.match(rail, /caption="Система"/);

  for (const label of ["Сводка", "Комнаты", "Личные", "AI-офис", "Я"]) {
    assert.match(bottomNav, new RegExp(`label=\"${label}\"`));
  }
  assert.match(bottomNav, /export type BottomTab = "home" \| "servers" \| "dms" \| "office" \| "me"/);
});

test("workspace overview keeps one next action before secondary context", () => {
  const overview = source("apps/web/src/components/ServerWelcomeHero.tsx");
  const nextStep = overview.indexOf("workspace-next-step");
  const attention = overview.indexOf("workspace-attention-title");
  const about = overview.indexOf('<details className="ec-guide__about">');

  assert.ok(nextStep > 0, "next-step landmark is present");
  assert.ok(attention > nextStep, "live attention follows the next step");
  assert.ok(about > attention, "long workspace context stays secondary");
  assert.doesNotMatch(overview, /depthTiltProps|ec-depth-card/);
  assert.match(overview, /aria-labelledby="workspace-overview-title"/);
});

test("shell redesign preserves focus, touch targets and reduced motion", () => {
  const css = source("apps/web/src/styles/clean-ui.css");
  const tokens = source("apps/web/src/styles/tokens.css");

  assert.match(css, /\.ec-guide__primary:focus-visible/);
  assert.match(css, /\.ec-rail__btn:focus-visible/);
  assert.match(css, /\.ec-bnav__tab:focus-visible/);
  assert.match(css, /\.ec-guide__primary \{[\s\S]*?min-height: 44px/);
  assert.match(css, /\.ec-guide__card \{[\s\S]*?min-height: 44px/);
  assert.match(css, /@media \(max-width: 1024px\) \{[\s\S]*?\.ec-guide__voice-room,[\s\S]*?min-height: 44px/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(tokens, /--ec-bottomnav-height:\s+56px/);
});

test("compact shell uses the dedicated Eclipse mark instead of the wide wordmark", () => {
  const shell = source("apps/web/src/pages/AppShell.tsx");
  const motion = source("apps/web/src/styles/motion.css");
  const mark = source("apps/web/public/brand-mark.svg");

  assert.match(shell, /const brandMarkUrl = .*brand-mark\.svg/);
  assert.doesNotMatch(shell, /const brandMarkUrl = .*eclipse-chat-logo\.png/);
  assert.match(shell, /ec-shell__brand-lockup/);
  assert.match(mark, /viewBox="0 0 64 64"/);
  assert.match(mark, /id="eclipse-rim"/);
  assert.doesNotMatch(motion, /ec-brand-mark-breathe/);
});

test("AI office is localized and lets the user select a workspace in place", () => {
  const office = source("apps/web/src/components/agent-office/AgentOffice.tsx");

  for (const label of ["Контент", "Creative Studio", "Аудит процессов", "Голосовые команды", "Передача рядом", "Презентации", "Сборка", "Требования"]) {
    assert.match(office, new RegExp(`>${label}<`));
  }
  assert.match(office, /props\.workspaces\.map/);
  assert.match(office, /props\.onSelectWorkspace\(item\.id\)/);
  assert.match(office, /Выберите пространство/);
  assert.doesNotMatch(office, />Growth OS<|>Automation Audit<|>Voice Ops<|>Deck Review<|>Builder Review<|>Spec Review</);
});

test("Creative Studio exposes cost, approval, receipt and manual LocalSend boundaries", () => {
  const room = source("apps/web/src/components/agent-office/CreativeStudioRoom.tsx");
  const css = source("apps/web/src/styles/creative-studio.css");

  assert.match(room, /Сначала подтверждение/);
  assert.match(room, /Higgsfield MCP всегда расходует кредиты/);
  assert.match(room, /Подтвердить задание/);
  assert.match(room, /Квитанция выполнения/);
  assert.match(room, /Скачать и отправить рядом/);
  assert.match(room, /Jarvis не получает путь к файлу/);
  assert.match(css, /@media \(max-width: 600px\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});

test("direct messages use a compact actionable welcome state", () => {
  const shell = source("apps/web/src/pages/AppShell.tsx");
  const welcome = source("apps/web/src/components/DirectMessageWelcome.tsx");
  const css = source("apps/web/src/styles/dm-home.css");

  assert.match(shell, /<DirectMessageWelcome onNewMessage=\{openFriends\}/);
  assert.match(welcome, /Продолжите разговор/);
  assert.match(welcome, /Написать сообщение/);
  assert.match(css, /\.ec-dm-welcome \{/);
  assert.match(css, /@media \(max-width: 760px\)/);
});
