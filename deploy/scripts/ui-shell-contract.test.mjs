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

test("workspace v2 activates and owns its complete responsive theme layer", () => {
  const shell = source("apps/web/src/pages/AppShell.tsx");
  const appCss = source("apps/web/src/styles/app.css");
  const workspaceCss = source("apps/web/src/styles/workspace-v2.css");
  const socialCss = source("apps/web/src/styles/workspace-v2-server-social.css");
  const accountCss = source("apps/web/src/styles/workspace-v2-account.css");
  const tokens = source("apps/web/src/styles/tokens.css");
  const v2Css = [workspaceCss, socialCss, accountCss].join("\n");
  const baseImport = appCss.indexOf('@import "./workspace-v2.css";');
  const socialImport = appCss.indexOf('@import "./workspace-v2-server-social.css";');
  const accountImport = appCss.indexOf('@import "./workspace-v2-account.css";');
  const backdropValues = [...v2Css.matchAll(/(?:-webkit-)?backdrop-filter\s*:\s*([^;]+);/g)].map((match) => match[1].trim());

  assert.match(shell, /ec-shell ec-workspace-v2/);
  assert.ok(baseImport >= 0, "workspace base stylesheet is imported");
  assert.ok(baseImport < socialImport && socialImport < accountImport, "workspace styles keep base, social, account order");
  assert.match(workspaceCss, /--ec-ws-backdrop:/);
  assert.match(workspaceCss, /html\[data-ec-theme="solar"\] \.ec-shell\.ec-workspace-v2 \{/);
  assert.match(workspaceCss, /--ec-ws-canvas:\s*var\(--ec-bg\)/);
  assert.match(workspaceCss, /--ec-ws-text:\s*var\(--ec-text\)/);
  assert.doesNotMatch(workspaceCss, /background(?:-color)?:\s*#[0-2][0-9a-f]{2,7}\b/i);
  assert.doesNotMatch(socialCss, /^\.(?!ec-workspace-v2)/m);
  assert.doesNotMatch(accountCss, /^\.(?!ec-workspace-v2)/m);
  assert.doesNotMatch(v2Css, /(?:linear|radial)-gradient\s*\(/i);
  assert.ok(backdropValues.length > 0 && backdropValues.every((value) => value === "none"), "workspace blur stays disabled");
  assert.match(socialCss, /\.ec-workspace-v2[\s\S]*:focus-visible/);
  assert.match(accountCss, /\.ec-workspace-v2[\s\S]*:focus-visible/);
  assert.match(socialCss, /@media \(max-width: 1024px\)/);
  assert.match(socialCss, /@media \(max-width: 760px\)/);
  assert.match(accountCss, /@media \(max-width: 1024px\)/);
  assert.match(accountCss, /@media \(max-width: 760px\) \{[\s\S]*?\.ec-workspace-v2 \.ec-settings-panel/);
  assert.match(socialCss, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(accountCss, /@media \(prefers-reduced-motion: reduce\)/);
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

test("workspace ID is visible in server settings and remains above overflowing menu actions", () => {
  const hub = source("apps/web/src/components/ServerHubModal.tsx");
  const menu = source("apps/web/src/components/server/ServerActionsMenu.tsx");
  const css = source("apps/web/src/styles/components.css");
  const copyAction = menu.indexOf('{ key: "copy-id", label: "Копировать ID пространства"');
  const createChannelAction = menu.indexOf('{ key: "create-channel"');

  assert.match(hub, /id="ec-workspace-id-title"/);
  assert.match(hub, /<code>\{server\.id\}<\/code>/);
  assert.match(hub, /copyWorkspaceId/);
  assert.match(css, /\.ec-hub-workspace-id \{/);
  assert.ok(copyAction >= 0 && copyAction < createChannelAction);
});

test("AI office is localized and lets the user select a workspace in place", () => {
  const office = source("apps/web/src/components/agent-office/AgentOffice.tsx");

  for (const label of ["Контент", "Творческая студия", "Аудит процессов", "Голосовые команды", "Передача рядом", "Презентации", "Сборка", "Требования"]) {
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

  assert.match(room, /Творческая студия/);
  assert.match(room, /Как пользоваться/);
  assert.match(room, /От идеи до готового файла — четыре шага/);
  assert.match(room, /Что делать сейчас/);
  assert.match(room, /Безопасный режим/);
  assert.match(room, /Проверочный пакет: 0 кредитов/);
  assert.match(room, /Подтвердить задание/);
  assert.match(room, /Квитанция выполнения/);
  assert.match(room, /Скачать и отправить рядом/);
  assert.match(room, /Jarvis не получает путь к файлу/);
  assert.match(css, /\.ec-creative-guide \{/);
  assert.match(css, /\.ec-creative-next \{/);
  assert.match(css, /grid-template-areas:[\s\S]*?"queue main"[\s\S]*?"queue side"/);
  assert.match(css, /\.ec-creative-guide header button:focus-visible/);
  assert.match(css, /@media \(max-width: 700px\)/);
  assert.match(css, /@media \(max-width: 520px\)/);
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
