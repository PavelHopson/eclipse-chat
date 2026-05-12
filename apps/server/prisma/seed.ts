import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();

/**
 * Seed + idempotent migration logic для Step 1 (v0.4 Server/Member)
 * + v0.6 (PostgreSQL, Channel.serverId NOT NULL).
 *
 * Что делает (идемпотентно — повторный запуск ничего не ломает):
 *  1. Гарантирует system user (`system@eclipse-chat.local`)
 *  2. Гарантирует "Default Server" (owner = system user или первый
 *     обычный user если такие уже есть)
 *  3. Все existing users становятся Member of Default Server
 *     (первый — OWNER, остальные — MEMBER)
 *  4. Гарантирует канал `#general` внутри Default Server
 *  5. Любые legacy каналы без serverId (теоретически — после v0.6
 *     быть не должно, NOT NULL) переносит в Default Server
 *
 * Порядок важен: с v0.6 `Channel.serverId` NOT NULL — канал нельзя
 * создать без сервера.
 */

const SYSTEM_USER_EMAIL = "system@eclipse-chat.local";
const SYSTEM_USER_DISPLAY_NAME = "Eclipse System";
/** Hash для невалидного пароля — system user никогда не логинится. */
const SYSTEM_USER_PASSWORD_HASH = "system-no-login-please";

async function ensureSystemUser() {
  return p.user.upsert({
    where: { email: SYSTEM_USER_EMAIL },
    create: {
      email: SYSTEM_USER_EMAIL,
      passwordHash: SYSTEM_USER_PASSWORD_HASH,
      displayName: SYSTEM_USER_DISPLAY_NAME,
    },
    update: {},
  });
}

async function ensureDefaultServer(): Promise<{
  id: string;
  inviteCode: string;
  isNew: boolean;
}> {
  const existing = await p.server.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true, inviteCode: true },
  });
  if (existing) {
    return { ...existing, isNew: false };
  }

  // Owner = первый реальный user, иначе system user
  const realUser = await p.user.findFirst({
    where: { email: { not: SYSTEM_USER_EMAIL } },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  const systemUser = realUser ? null : await ensureSystemUser();
  const ownerId = realUser?.id ?? systemUser!.id;

  const server = await p.server.create({
    data: {
      name: "Default Server",
      ownerId,
    },
    select: { id: true, inviteCode: true },
  });
  console.log(`✓ Created Default Server (id=${server.id}, inviteCode=${server.inviteCode})`);
  return { ...server, isNew: true };
}

async function ensureAllUsersAreMembers(serverId: string, ownerId: string) {
  const users = await p.user.findMany({ select: { id: true } });
  let ensured = 0;
  for (const user of users) {
    const role = user.id === ownerId ? "OWNER" : "MEMBER";
    await p.member.upsert({
      where: { userId_serverId: { userId: user.id, serverId } },
      create: { userId: user.id, serverId, role },
      update: {},
    });
    ensured++;
  }
  console.log(`✓ Ensured ${ensured} member row(s) on Default Server`);
}

async function ensureGeneralChannel(serverId: string): Promise<void> {
  await p.channel.upsert({
    where: { slug: "general" },
    create: { name: "General", slug: "general", serverId },
    update: {},
  });
  console.log("✓ Channel #general ensured (in Default Server)");
}

async function main() {
  // 1. system user (если нужен — создастся, если есть — пропустится)
  await ensureSystemUser();

  // 2. Default Server (его owner = первый реальный user или system)
  const server = await ensureDefaultServer();

  // 3. Все users → Member of Default Server
  const ownerInfo = await p.server.findUnique({
    where: { id: server.id },
    select: { ownerId: true },
  });
  if (ownerInfo) {
    await ensureAllUsersAreMembers(server.id, ownerInfo.ownerId);
  }

  // 4. #general канал внутри Default Server
  await ensureGeneralChannel(server.id);

  // 5. Cleanup: legacy каналы без serverId (теоретически быть не должно
  //    с v0.6 NOT NULL, но проверим на всякий случай через raw SQL —
  //    Prisma client при NOT NULL вообще не позволит select с null)
  // ничего делать не нужно — schema enforces NOT NULL

  console.log("Seed complete.");
}

void main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => p.$disconnect());
