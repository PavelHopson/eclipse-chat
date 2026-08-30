import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const source = path => readFileSync(join(root, path), "utf8");

test("account vault stores session slots but never passwords", () => {
  const vault = source("apps/web/src/lib/accountVault.ts");
  assert.match(vault, /ec\.auth\.accounts\.v1/);
  assert.match(vault, /activateStoredAccount/);
  assert.match(vault, /refreshToken/);
  assert.doesNotMatch(vault, /password\s*:/i);
  assert.doesNotMatch(vault, /localStorage\.setItem\([^\n]*password/i);
});

test("account switching is reachable from both status and settings", () => {
  const shell = source("apps/web/src/pages/AppShell.tsx");
  const status = source("apps/web/src/components/StatusMenu.tsx");
  const settings = source("apps/web/src/components/settings/SettingsTreeNav.tsx");
  assert.match(shell, /onSwitchAccount/);
  assert.match(shell, /AddAccountModal/);
  assert.match(status, /createPortal/);
  assert.match(status, /Добавить аккаунт/);
  assert.match(settings, /Аккаунты на устройстве/);
});

test("unified motion keeps the ambient brand controllable and all other motion event-driven", () => {
  const css = source("apps/web/src/styles/ui-unification.css");
  const pointer = source("apps/web/src/components/EclipsePointer.tsx");
  assert.match(css, /ec-brand-arrival/);
  assert.match(css, /ec-brand-eclipse-live/);
  const loops = [...css.matchAll(/animation:\s*([^;]+\binfinite\b)/g)].map(match => match[1]);
  assert.equal(loops.length, 3);
  assert.ok(loops.every(value => /ec-brand-/.test(value)));
  assert.match(css, /html\[data-ec-motion="quiet"\][\s\S]+animation:\s*none\s*!important/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /ec-icon-signal/);
  assert.match(css, /svg:not\(\.ec-ui-icon\)[\s\S]+animation:\s*ec-icon-signal/);
  assert.match(pointer, /--ec-pointer-velocity/);
  assert.match(pointer, /dataset\.mode/);
  assert.match(pointer, /pointer: fine/);
});

test("ordinary login and logout preserve independent device sessions", () => {
  const auth = source("apps/server/src/routes/auth.ts");
  const login = auth.slice(auth.indexOf('"/api/auth/login"'), auth.indexOf('"/api/auth/refresh"'));
  const logout = auth.slice(auth.indexOf('"/api/auth/logout"'), auth.indexOf('"/api/auth/me"'));
  assert.doesNotMatch(login, /deleteAllUserRefresh/);
  assert.match(logout, /deleteRefreshByRawForUser/);
  assert.doesNotMatch(logout, /deleteAllUserRefresh/);
});
