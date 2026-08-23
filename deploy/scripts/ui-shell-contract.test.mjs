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

  for (const label of ["Сводка", "Личные", "Office", "Профиль"]) {
    assert.match(rail, new RegExp(`caption=\"${label}\"`));
  }
  assert.match(rail, /caption="Админ"/);
  assert.match(rail, /caption="Система"/);

  for (const label of ["Сводка", "Комнаты", "Личные", "Office", "Я"]) {
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
