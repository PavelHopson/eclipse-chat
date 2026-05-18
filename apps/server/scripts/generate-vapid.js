#!/usr/bin/env node
/**
 * v0.84 #27 phase 3: VAPID key pair generator.
 *
 * Запустить один раз на проде (или локально для dev):
 *   node apps/server/scripts/generate-vapid.js mailto:admin@example.com
 *
 * Вывод — три строки для `.env` сервера + одна строка для `.env` web'а.
 * Ключи должны быть стабильными между restarts — потеряешь private →
 * все existing subscriptions станут недействительны (browser pinned их к
 * паре).
 *
 * Subject — обязательная контактная информация per RFC 8292. Можно
 * mailto:admin@... или https://your-site/. Push-провайдеры (Mozilla
 * Autopush / Google FCM) могут использовать его для контактов при abuse.
 *
 * ESM: apps/server/package.json содержит "type": "module", поэтому
 * `.js` файлы должны использовать `import`, не `require`.
 */
import webPush from "web-push";

const keys = webPush.generateVAPIDKeys();
const subject = process.argv[2] || "mailto:admin@example.com";

console.log("# Eclipse Chat — VAPID keys (v0.84 #27 phase 3)");
console.log("# Сохрани в .env сервера (НЕ коммитить):");
console.log("");
console.log(`VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`);
console.log(`VAPID_SUBJECT=${subject}`);
console.log("");
console.log("# Web .env / build env (public key инжектится в bundle):");
console.log(`VITE_VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log("");
console.log(
  "# После добавления — supervisorctl restart eclipse-chat-server" +
    " + пересобрать web с актуальным VITE_VAPID_PUBLIC_KEY.",
);
