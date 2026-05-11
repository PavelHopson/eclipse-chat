import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();

/**
 * Seed + idempotent migration logic для Step 1 (v0.4 Server/Member).
 *
 * Что делает:
 *  1. Гарантирует существование канала #general (исходный seed)
 *  2. Если в БД есть users, но нет ни одного Server — создаёт
 *     "Default Server" с owner = первый user, и переносит туда
 *     все каналы с serverId = NULL
 *  3. Все existing users становятся Member of Default Server
 *     (первый — OWNER, остальные — MEMBER)
 *
 * Идемпотентен: повторный запуск ничего не ломает.
 *
 * После Step 1 этот скрипт остаётся в репо как migration,
 * чтобы любой клон репо на старой dev.db мог корректно догнать.
 */

const SYSTEM_USER_EMAIL = "system@eclipse-chat.local";
const SYSTEM_USER_DISPLAY_NAME = "Eclipse System";
/** Hash для невалидного пароля — system user никогда не логинится. */
const SYSTEM_USER_PASSWORD_HASH = "system-no-login-please";

async function ensureGeneralChannel(): Promise<void> {
  await p.channel.upsert({
    where: { slug: "general" },
    create: { name: "General", slug: "general" },
    update: {},
  });
  console.log("✓ Channel #general ensured");
}

async function migrateToServerModel(): Promise<void> {
  const serverCount = await p.server.count();
  if (serverCount > 0) {
    console.log(`✓ Default Server migration skipped (${serverCount} server(s) already exist)`);
    return;
  }

  let owner = await p.user.findFirst({ orderBy: { createdAt: "asc" } });
  if (!owner) {
    owner = await p.user.upsert({
      where: { email: SYSTEM_USER_EMAIL },
      create: {
        email: SYSTEM_USER_EMAIL,
        passwordHash: SYSTEM_USER_PASSWORD_HASH,
        displayName: SYSTEM_USER_DISPLAY_NAME,
      },
      update: {},
    });
    console.log("✓ Created system user (no users existed before)");
  }

  const defaultServer = await p.server.create({
    data: {
      name: "Default Server",
      ownerId: owner.id,
    },
  });
  console.log(`✓ Created Default Server (id=${defaultServer.id}, inviteCode=${defaultServer.inviteCode})`);

  const orphanChannels = await p.channel.findMany({ where: { serverId: null } });
  if (orphanChannels.length > 0) {
    await p.channel.updateMany({
      where: { serverId: null },
      data: { serverId: defaultServer.id },
    });
    console.log(`✓ Migrated ${orphanChannels.length} legacy channel(s) → Default Server`);
  }

  const users = await p.user.findMany({ select: { id: true } });
  let ensuredMembers = 0;
  for (const user of users) {
    const role = user.id === owner.id ? "OWNER" : "MEMBER";
    await p.member.upsert({
      where: { userId_serverId: { userId: user.id, serverId: defaultServer.id } },
      create: { userId: user.id, serverId: defaultServer.id, role },
      update: {},
    });
    ensuredMembers++;
  }
  console.log(`✓ Ensured ${ensuredMembers} member row(s) on Default Server`);
}

async function main() {
  await ensureGeneralChannel();
  await migrateToServerModel();
  console.log("Seed complete.");
}

void main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => p.$disconnect());
