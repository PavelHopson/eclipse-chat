import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const nginxPath = new URL('../nginx/eclipse-chat.conf', import.meta.url);
const indexPath = new URL('../../apps/web/index.html', import.meta.url);
const bootPath = new URL('../../apps/web/public/boot-preferences.js', import.meta.url);

const locationBody = (source, prefix) => {
  const marker = 'location ^~ ' + prefix + ' {';
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, 'missing ' + prefix + ' location');

  let depth = 0;
  for (let index = source.indexOf('{', start); index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  assert.fail('unterminated ' + prefix + ' location');
};

test('nginx serves the application with a strict browser security contract', async () => {
  const source = await readFile(nginxPath, 'utf8');
  const app = locationBody(source, '/eclipse-chat/');
  const assets = locationBody(source, '/eclipse-chat/assets/');
  const uploads = locationBody(source, '/eclipse-chat/uploads/');

  assert.match(app, /Content-Security-Policy/);
  assert.match(app, /script-src 'self'/);
  assert.doesNotMatch(app, /script-src[^;]*'unsafe-inline'/);
  assert.match(app, /frame-ancestors 'none'/);
  assert.match(app, /object-src 'none'/);
  assert.match(app, /Permissions-Policy "camera=\(self\), microphone=\(self\)/);
  assert.match(app, /X-Content-Type-Options "nosniff"/);
  assert.match(app, /Referrer-Policy "strict-origin-when-cross-origin"/);
  assert.match(app, /X-Frame-Options "DENY"/);
  assert.match(app, /gzip on/);
  assert.match(app, /application\/manifest\+json/);

  assert.match(assets, /Cache-Control "public, max-age=31536000, immutable"/);
  assert.match(assets, /gzip on/);
  assert.match(assets, /X-Content-Type-Options "nosniff"/);

  assert.match(uploads, /Cache-Control "public, max-age=3600"/);
  assert.match(uploads, /Content-Security-Policy "default-src 'none'/);
  assert.match(uploads, /sandbox; frame-ancestors 'none'/);
  assert.match(uploads, /Cross-Origin-Resource-Policy "same-origin"/);
  assert.match(uploads, /X-Content-Type-Options "nosniff"/);
  assert.match(uploads, /Referrer-Policy "strict-origin-when-cross-origin"/);
  assert.match(uploads, /X-Frame-Options "DENY"/);
});

test('theme bootstrap remains CSP-compatible', async () => {
  const [html, boot] = await Promise.all([
    readFile(indexPath, 'utf8'),
    readFile(bootPath, 'utf8'),
  ]);

  assert.match(html, /<script src="\.\/boot-preferences\.js"><\/script>/);
  assert.doesNotMatch(html, /<script>\s*\(function/);
  assert.match(boot, /setAttribute\('data-density'/);
  assert.match(boot, /setAttribute\('data-ec-theme'/);
  assert.match(boot, /setAttribute\('data-focus-dim'/);
});
