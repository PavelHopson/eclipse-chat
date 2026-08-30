import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import test from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const source = path => readFileSync(join(root, path), "utf8");
const css = source("apps/web/src/styles/workspace-polish.css");

test("production release backs up both documented databases before checkout mutation", () => {
  const workflow = source(".github/workflows/deploy-prod.yml");
  const deploy = workflow.slice(workflow.indexOf("- name: Deploy via SSH"));
  const backupStart = deploy.indexOf("Pre-deploy verified database backups");
  const backupEnd = deploy.indexOf('echo "==> Pre-pull');
  assert.ok(backupStart > 0 && backupStart < backupEnd);
  const backup = deploy.slice(backupStart, backupEnd);
  for (const guard of ['set -euo pipefail', 'umask 077', 'set -o noclobber', 'readlink -f /var/www/eclipse-chat', 'backup_root=/var/backups/eclipse-chat', 'mktemp -d', 'for database in eclipse_chat star_crm_prod; do', 'pg_dump --format=custom --no-owner --no-acl', 'pg_restore --list', '/var/www/app.star-crm.ru/backend/.env', '/etc/star-crm-backup.env', '^DB_DATABASE=', '^PGDATABASE=']) {
    assert.ok(backup.includes(guard), guard);
  }
  assert.doesNotMatch(backup, /rm -|find .*delete|DROP DATABASE|CREATE DATABASE/);
  assert.doesNotMatch(backup, /for database in eclipse_chat star_crm;|PGPASSWORD|DB_PASSWORD|source .*\.env/);
  assert.match(workflow, /environment: production/);
  assert.match(workflow, /UI and release contracts/);
});

test("clean topbar preserves production logout and workspace boundaries", () => {
  assert.match(css, /ec-logout-btn::before\s*\{\s*border: 0/);
  assert.match(css, /ec-shell__top-actions :is\(\.ec-shell__user-chip, \.ec-logout-btn\)[\s\S]*box-shadow: none !important/);
  const shell = source("apps/web/src/pages/AppShell.tsx");
  assert.doesNotMatch(shell, /WorkspacePreviewPage|workspace-preview-fixtures|window\.fetch\s*=/);
  assert.match(shell, /<LogoutButton onLogout=\{onLogout\} \/>/);
});

test("workspace menu is portalled and fits top/bottom triggers on small screens", () => {
  const menu = source("apps/web/src/components/server/ServerActionsMenu.tsx");
  assert.match(source("apps/web/src/components/ChannelList.tsx"), /renderMode="portal"/);
  const fn = menu.slice(menu.indexOf("function computePosition("), menu.indexOf("export function ServerActionsMenu"))
    .replace("trigger: HTMLElement | null", "trigger").replace("): MenuPosition", ")");
  for (const [width, height, top, bottom] of [[390,844,60,104], [390,844,738,774], [320,568,500,540], [1440,900,60,100]]) {
    const result = runInNewContext(fn + "; computePosition(trigger)", {
      window: { innerWidth: width, innerHeight: height },
      trigger: { getBoundingClientRect: () => ({left: 90, top, bottom}) },
    });
    assert.ok(result.top >= 12 && result.left >= 12);
    assert.ok(result.left + result.width <= width - 12);
    assert.ok(result.top + result.maxHeight <= height - 12);
    if (bottom > height - 100) assert.ok(result.top < top - 100, "bottom trigger opens upward");
  }
  assert.match(menu, /ArrowDown/);
  assert.match(menu, /triggerRef.current\?\.focus\(\)/);
});

test("rail has one surface priority and channel icon IDs are preserved", () => {
  const rail = source("apps/web/src/components/ServerRail.tsx");
  assert.match(rail, /const surface = platformAdminActive/);
  assert.doesNotMatch(rail, /active=\{(?:dmsActive|officeActive|homeActive)\}/);
  const icons = source("apps/web/src/components/icons/ChannelCustomIcons.tsx");
  assert.equal(new Set([...icons.matchAll(/"ec:([a-z]+)"/g)].map(match => match[1])).size, 30);
  assert.doesNotMatch(icons, /<svg|--emoji|renderCustomIcon/);
  assert.match(icons, /weight="regular"/);
});

test("pointer preserves reduced-motion, coarse pointers, text input and cleanup", () => {
  const pointer = source("apps/web/src/components/EclipsePointer.tsx");
  assert.match(pointer, /prefers-reduced-motion: reduce/);
  assert.match(pointer, /pointer: fine/);
  assert.match(pointer, /input, textarea, select, \[contenteditable=true\], video, iframe, :disabled/);
  assert.match(pointer, /cancelAnimationFrame\(frame\)/);
  assert.match(pointer, /removeEventListener\("pointermove", move\)/);
  assert.match(pointer, /if \(!frame\) frame = requestAnimationFrame/);
});

test("admin grouping keeps protected accounts and danger confirmations", () => {
  const admin = source("apps/web/src/components/PlatformAdminPanel.tsx");
  assert.match(admin, /ec-platform-admin__users-table/);
  assert.doesNotMatch(admin, /ec-platform-admin__table ec-ai-provider-table/);
  assert.equal((admin.match(/disabled=\{actionsTarget.id === currentUserId \|\| actionsTarget.isPlatformOwner\}/g) ?? []).length, 3);
  assert.ok(admin.includes('setDeleteConfirmText("")'));
  assert.match(admin, /Восстановить доступ для/);
  const modal = source("apps/web/src/components/Modal.tsx");
  assert.match(modal, /useId\(\)/);
  assert.match(modal, /if \(!topmost\(\)\) return/);
  assert.match(modal, /previousFocus\?\.isConnected/);
});

test("video management is optional while upload limits and confirmation remain", () => {
  const video = source("apps/web/src/components/TeamTrainingLibrary.tsx");
  const serverRoutes = source("apps/server/src/routes/servers.ts");
  const thumbnailRoute = serverRoutes.slice(
    serverRoutes.indexOf('"/api/training-videos/:id/thumbnail"'),
    serverRoutes.indexOf('"/api/training-videos/:id"', serverRoutes.indexOf('"/api/training-videos/:id/thumbnail"')),
  );
  assert.match(video, /canEdit && manageOpen && activeSection/);
  assert.match(video, /200 \* 1024 \* 1024/);
  assert.match(video, /if \(!canUploadFiles \|\| busy\) return/);
  assert.match(video, /title: "Удалить видео\?"/);
  assert.match(video, /onLoadedMetadata/);
  assert.match(video, /ArrowRight/);
  assert.match(video, /useTrainingVideoPoster/);
  assert.match(video, /const activeVideo = activeVideoIndex >= 0/);
  assert.match(video, /api\/training-videos\/\$\{encodeURIComponent\(videoId\)\}\/thumbnail/);
  assert.match(video, /playerState === "error"/);
  assert.match(video, /host: playerHost/);
  assert.match(video, /origin: window\.location\.origin/);
  assert.match(video, /playerHost === "standard"/);
  assert.match(video, /setPlayerHost\("privacy"\)/);
  assert.match(video, /message\.event === "onError"/);
  assert.match(video, /toYouTubeWatchUrl/);
  assert.match(video, /Открыть YouTube/);
  assert.match(video, /TrainingVideoViewer/);
  assert.match(video, /VideoPlayer key=\{video\.id\}/);
  assert.match(video, /Открыть экран просмотра/);
  assert.match(video, /Нет соединения с YouTube/);
  assert.match(video, /youtubeDirectPosterUrl/);
  assert.match(video, /canReplace=\{canEdit\}/);
  assert.match(video, /replaceVideoWithFile/);
  assert.match(video, /Заменить файлом/);
  assert.match(serverRoutes, /"\/api\/training-videos\/:id\/replace-file"/);
  assert.match(serverRoutes, /if \(!canManageTraining\(member\.role\)\)/);
  assert.match(serverRoutes, /if \(video\.source !== "youtube"\)/);
  assert.ok(video.indexOf("function YouTubeTrainingPlayer") < video.indexOf("<iframe"), "YouTube iframe is created only inside the viewer");
  assert.match(thumbnailRoute, /onRequest: \[requireJwt\]/);
  assert.match(thumbnailRoute, /rateLimit: \{ max: 120/);
  assert.match(thumbnailRoute, /loadMember\(req, reply, video\.serverId\)/);
  assert.match(thumbnailRoute, /loadYouTubeThumbnail\(youtubeId\)/);
  assert.match(css, /ec-team-training__videos[\s\S]*max-height: none/);
  assert.match(css, /ec-team-training-video__poster/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /ec-dmx__search input[\s\S]*border: 0 !important/);
});

test("desktop external media bridge is restricted to official YouTube HTTPS URLs", () => {
  const desktop = source("apps/desktop/src-tauri/src/lib.rs");
  const capability = source("apps/desktop/src-tauri/capabilities/remote-external-media.json");
  const browserBridge = source("apps/web/src/lib/openExternalMedia.ts");

  assert.match(desktop, /fn open_external_media/);
  assert.match(desktop, /parsed\.scheme\(\) != "https"/);
  assert.match(desktop, /allowed_host/);
  assert.match(desktop, /parsed\.username\(\)\.is_empty\(\)/);
  assert.match(capability, /https:\/\/app\.star-crm\.ru\/eclipse-chat\/\*/);
  assert.match(capability, /allow-open-external-media/);
  assert.doesNotMatch(capability, /shell:allow-open/);
  assert.match(browserBridge, /YOUTUBE_HOSTS/);
  assert.match(browserBridge, /window\.location\.assign\(url\)/);
});
