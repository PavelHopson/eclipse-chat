import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

// 00-144: client-side half of the attachment access contract. The server
// route is covered by apps/server/src/routes/attachmentMedia.test.ts.
const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');

test('web resolves message attachments only through the authorized media route', async () => {
  const assets = await read('apps/web/src/lib/assets.ts');
  // Load the pure resolver and exercise it with a production BASE_URL.
  const js = ts.transpileModule(assets.replace(/import\.meta\.env\.BASE_URL/g, 'BASE_URL'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  runInNewContext(js, { exports, BASE_URL: '/eclipse-chat/' });
  const resolve = exports.resolveAssetUrl;
  assert.equal(
    resolve('/uploads/training-videos/abc.mp4'),
    '/eclipse-chat/api/attachments/training-videos/abc.mp4',
  );
  assert.equal(
    resolve('/uploads/attachments/cmsg-0-1-a.png'),
    '/eclipse-chat/api/attachments/media/cmsg-0-1-a.png',
  );
  assert.equal(
    resolve('/eclipse-chat/uploads/attachments/cmsg-0-1-a.png'),
    '/eclipse-chat/api/attachments/media/cmsg-0-1-a.png',
  );
  assert.equal(resolve('/uploads/icons/server.webp'), '/eclipse-chat/uploads/icons/server.webp');
  assert.equal(resolve('/uploads/attachments/a/b.png'), '/eclipse-chat/uploads/attachments/a/b.png');
  assert.equal(resolve('https://cdn.example.test/x.png'), 'https://cdn.example.test/x.png');
  assert.equal(resolve(null), null);
});

test('service worker never caches attachments and the app keeps the media cookie alive', async () => {
  const sw = await read('apps/web/public/sw.js');
  assert.match(sw, /url\.pathname\.includes\("\/uploads\/training-videos\/"\)/);
  assert.match(sw, /url\.pathname\.includes\("\/uploads\/tables\/"\)/);
  const bypass = sw.indexOf('url.pathname.includes("/uploads/attachments/")');
  const uploadsCache = sw.indexOf('url.pathname.includes("/uploads/")) {');
  assert.ok(bypass > 0, 'missing /uploads/attachments/ bypass');
  assert.ok(bypass < uploadsCache, 'attachments bypass must run before uploads cache-first');

  const shell = await read('apps/web/src/pages/AppShell.tsx');
  assert.match(shell, /useMediaSessionKeeper\(user\.id\)/);
  const keeper = await read('apps/web/src/hooks/useMediaSessionKeeper.ts');
  assert.match(keeper, /api\/auth\/media-session/);
  assert.match(keeper, /refreshAccessToken\(\)/);
});
