/**
 * System bot user helper — auto-creates `system@eclipse-chat.local`
 * shadow user на first need. Используется для posting через webhook
 * receiver, table row→task conversion (`Table` → `ActionItem`), и
 * прочих system-driven messages.
 *
 * Password = `!system-no-login!` — невалидный для bcrypt, no login.
 * Frontend через `serializeUser` распознаёт его как bot по email.
 */

import { db } from "../db.js";

const SYSTEM_EMAIL = "system@eclipse-chat.local";

let cached: string | null = null;

/** Возвращает userId системного шадоу-юзера. Cached после первого вызова. */
export async function getSystemBotUserId(): Promise<string> {
  if (cached) return cached;
  let user = await db.user.findUnique({
    where: { email: SYSTEM_EMAIL },
    select: { id: true },
  });
  if (!user) {
    user = await db.user.create({
      data: {
        email: SYSTEM_EMAIL,
        displayName: "System",
        passwordHash: "!system-no-login!",
      },
      select: { id: true },
    });
  }
  cached = user.id;
  return user.id;
}
