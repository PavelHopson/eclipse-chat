import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import fastifyStatic from "@fastify/static";
import Fastify, { type FastifyInstance } from "fastify";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * 00-144: бывший участник не должен получать файл вложения ни одним путём,
 * действующий участник — должен. Тест поднимает тот же стек выдачи, что и
 * index.ts (публичная статика /uploads/ + авторизованный media-маршрут) на
 * реальных файлах во временной папке; БД и проверка media-cookie замоканы
 * таблицами членства, которые тест меняет по ходу (исключение, выход из
 * группы DM, понижение роли, logout).
 */

const fixtures = vi.hoisted(() => ({
  /** selector media-cookie → userId живой сессии (нет ключа = сессия мертва). */
  sessions: new Map<string, string>(),
  /** `${userId}:${serverId}` → role. */
  members: new Map<string, string>(),
  /** messageId → attachment scope (то, что вернул бы Prisma). */
  attachments: new Map<string, { url: string; thumbnailUrl: string | null; message: unknown }>(),
  /** url → serverId для TrainingVideo (source=file). */
  trainingVideos: new Map<string, string>(),
}));

vi.mock("../auth/mediaSession.js", () => ({
  validateMediaSession: async (rawCookies: string | undefined, selector: string) => {
    if (!rawCookies?.includes(`ec-media-${selector}=`)) return null;
    const userId = fixtures.sessions.get(selector);
    return userId ? { userId, sessionId: `sid-${selector}` } : null;
  },
}));

vi.mock("../db.js", () => ({
  db: {
    member: {
      findUnique: async ({ where }: { where: { userId_serverId: { userId: string; serverId: string } } }) => {
        const { userId, serverId } = where.userId_serverId;
        const role = fixtures.members.get(`${userId}:${serverId}`);
        return role ? { role } : null;
      },
    },
    trainingVideo: {
      findFirst: async ({ where }: { where: { url: string; source: string } }) => {
        const serverId = where.source === "file" ? fixtures.trainingVideos.get(where.url) : undefined;
        return serverId ? { serverId } : null;
      },
    },
    attachment: {
      findFirst: async ({ where }: { where: { messageId: string; OR: [{ url: string }, { thumbnailUrl: string }] } }) => {
        const row = fixtures.attachments.get(where.messageId);
        if (!row) return null;
        const wanted = where.OR[0].url;
        if (row.url !== wanted && row.thumbnailUrl !== wanted) return null;
        return { message: row.message };
      },
    },
  },
}));

const SEL = {
  alice: "a".repeat(22),
  bob: "b".repeat(22),
  carol: "c".repeat(22),
} as const;
const cookie = (...selectors: string[]) =>
  selectors.map((s) => `ec-media-${s}=signed-token`).join("; ");

const CHANNEL_MSG = "cmsgchannel0001";
const DM_MSG = "cmsgdirect00001";
const INTERNAL_MSG = "cmsginternal001";
const CHANNEL_FILE = `${CHANNEL_MSG}-0-1764000000000-report.pdf`;
const CHANNEL_THUMB = `${CHANNEL_MSG}-1-1764000000001-thumb.webp`;
const CHANNEL_IMAGE = `${CHANNEL_MSG}-1-1764000000001-photo.jpg`;
const DM_FILE = `${DM_MSG}-0-1764000000002-voice.webm`;
const INTERNAL_FILE = `${INTERNAL_MSG}-0-1764000000003-plan.pdf`;
const TRAINING_FILE = "1764000000004-0a1b2c3d4e5f.mp4";
const PDF_BYTES =Buffer.from("%PDF-1.4\n% eclipse attachment fixture\n");

let uploads: string;
let app: FastifyInstance;

function channelScope(overrides: Record<string, unknown> = {}) {
  return {
    deletedAt: null,
    expiresAt: null,
    channel: { serverId: "srv-1", internal: false, server: { mode: "ENGINEERING" } },
    conversation: null,
    ...overrides,
  };
}

function resetFixtures() {
  fixtures.sessions.clear();
  fixtures.sessions.set(SEL.alice, "alice");
  fixtures.sessions.set(SEL.bob, "bob");
  fixtures.sessions.set(SEL.carol, "carol");
  fixtures.members.clear();
  fixtures.members.set("alice:srv-1", "OWNER");
  fixtures.members.set("bob:srv-1", "MEMBER");
  fixtures.members.set("alice:srv-client", "OWNER");
  fixtures.members.set("bob:srv-client", "VIEWER");
  fixtures.attachments.clear();
  fixtures.trainingVideos.clear();
  fixtures.trainingVideos.set(`/uploads/training-videos/${TRAINING_FILE}`, "srv-1");
  fixtures.attachments.set(CHANNEL_MSG, {
    url: `/uploads/attachments/${CHANNEL_IMAGE}`,
    thumbnailUrl: `/uploads/attachments/${CHANNEL_THUMB}`,
    message: channelScope(),
  });
  fixtures.attachments.set(DM_MSG, {
    url: `/uploads/attachments/${DM_FILE}`,
    thumbnailUrl: null,
    message: {
      deletedAt: null,
      expiresAt: null,
      channel: null,
      conversation: {
        isGroup: true,
        userAId: null,
        userBId: null,
        participants: [{ userId: "alice" }, { userId: "bob" }],
      },
    },
  });
  fixtures.attachments.set(INTERNAL_MSG, {
    url: `/uploads/attachments/${INTERNAL_FILE}`,
    thumbnailUrl: null,
    message: channelScope({
      channel: { serverId: "srv-client", internal: true, server: { mode: "CLIENT" } },
    }),
  });
}

beforeAll(async () => {
  uploads = mkdtempSync(path.join(tmpdir(), "ec-attachments-"));
  mkdirSync(path.join(uploads, "attachments"), { recursive: true });
  mkdirSync(path.join(uploads, "icons"), { recursive: true });
  for (const file of [CHANNEL_FILE, CHANNEL_IMAGE, CHANNEL_THUMB, DM_FILE, INTERNAL_FILE]) {
    writeFileSync(path.join(uploads, "attachments", file), PDF_BYTES);
  }
  writeFileSync(path.join(uploads, "icons", "server.webp"), Buffer.from("RIFF0000WEBPVP8 "));
  writeFileSync(path.join(uploads, "outside.txt"), "outside");
  mkdirSync(path.join(uploads, "training-videos"), { recursive: true });
  mkdirSync(path.join(uploads, "tables"), { recursive: true });
  writeFileSync(path.join(uploads, "training-videos", TRAINING_FILE), PDF_BYTES);
  writeFileSync(path.join(uploads, "tables", "legacy-cell.pdf"), PDF_BYTES);
  process.env.UPLOADS_DIR = uploads;

  const { isPublicUploadPath, registerAttachmentMediaRoutes } = await import("./attachmentMedia.js");
  app = Fastify();
  // Та же регистрация публичной статики, что в index.ts.
  await app.register(fastifyStatic, {
    root: uploads,
    prefix: "/uploads/",
    decorateReply: false,
    allowedPath: (pathName) => isPublicUploadPath(pathName),
  });
  await registerAttachmentMediaRoutes(app);
  await app.ready();
});

afterAll(async () => {
  await app?.close();
  delete process.env.UPLOADS_DIR;
  rmSync(uploads, { recursive: true, force: true });
});

beforeEach(() => {
  resetFixtures();
});

const media = (file: string, selectors: string[], headers: Record<string, string> = {}) =>
  app.inject({
    method: "GET",
    url: `/api/attachments/media/${file}`,
    headers: selectors.length ? { cookie: cookie(...selectors), ...headers } : headers,
  });

describe("00-144: доступ к вложениям после исключения", () => {
  it("действующий участник получает файл и миниатюру без кэширования", async () => {
    const full = await media(CHANNEL_IMAGE, [SEL.bob]);
    expect(full.statusCode).toBe(200);
    expect(full.rawPayload.equals(PDF_BYTES)).toBe(true);
    expect(full.headers["cache-control"]).toBe("private, no-store");
    expect(full.headers["content-security-policy"]).toContain("sandbox");
    expect(full.headers["x-content-type-options"]).toBe("nosniff");

    const thumb = await media(CHANNEL_THUMB, [SEL.bob]);
    expect(thumb.statusCode).toBe(200);
    expect(thumb.headers["content-type"]).toMatch(/^image\/webp/);
  });

  it("поддерживает Range (перемотка аудио/видео) для участника", async () => {
    const res = await media(CHANNEL_IMAGE, [SEL.bob], { range: "bytes=0-3" });
    expect(res.statusCode).toBe(206);
    expect(res.body).toBe("%PDF");
  });

  it("исключённый участник теряет доступ к файлу и миниатюре сразу", async () => {
    expect((await media(CHANNEL_IMAGE, [SEL.bob])).statusCode).toBe(200);
    fixtures.members.delete("bob:srv-1"); // kick / leave / удаление сервера
    for (const file of [CHANNEL_IMAGE, CHANNEL_THUMB]) {
      const res = await media(file, [SEL.bob]);
      expect(res.statusCode).toBe(404);
      expect(res.body).not.toContain("PDF");
    }
    // Владелец по-прежнему видит свой файл.
    expect((await media(CHANNEL_IMAGE, [SEL.alice])).statusCode).toBe(200);
  });

  it("посторонний пользователь с валидной сессией не получает файл", async () => {
    expect((await media(CHANNEL_IMAGE, [SEL.carol])).statusCode).toBe(404);
  });

  it("без media-cookie или после logout/бана сессии — 401", async () => {
    expect((await media(CHANNEL_IMAGE, [])).statusCode).toBe(401);
    fixtures.sessions.delete(SEL.bob); // refresh-сессия отозвана
    expect((await media(CHANNEL_IMAGE, [SEL.bob])).statusCode).toBe(401);
  });

  it("мульти-аккаунт: достаточно одной сессии с доступом, но не чужой", async () => {
    expect((await media(CHANNEL_IMAGE, [SEL.carol, SEL.bob])).statusCode).toBe(200);
    fixtures.members.delete("bob:srv-1");
    expect((await media(CHANNEL_IMAGE, [SEL.carol, SEL.bob])).statusCode).toBe(404);
  });

  it("подложенные мусорные media-cookie не вытесняют настоящую", async () => {
    const junk = Array.from({ length: 8 }, (_, i) => `${String(i).repeat(2)}${"z".repeat(20)}`);
    expect((await media(CHANNEL_IMAGE, [...junk, SEL.bob])).statusCode).toBe(200);
  });

  it("DM: участник группы видит файл, вышедший/удалённый из группы — нет", async () => {
    expect((await media(DM_FILE, [SEL.bob])).statusCode).toBe(200);
    expect((await media(DM_FILE, [SEL.carol])).statusCode).toBe(404);
    const dm = fixtures.attachments.get(DM_MSG)!;
    (dm.message as { conversation: { participants: { userId: string }[] } }).conversation.participants = [
      { userId: "alice" },
    ];
    expect((await media(DM_FILE, [SEL.bob])).statusCode).toBe(404);
    expect((await media(DM_FILE, [SEL.alice])).statusCode).toBe(200);
  });

  it("понижение роли закрывает internal-комнату CLIENT-воркспейса", async () => {
    expect((await media(INTERNAL_FILE, [SEL.bob])).statusCode).toBe(200);
    fixtures.members.set("bob:srv-client", "CLIENT");
    expect((await media(INTERNAL_FILE, [SEL.bob])).statusCode).toBe(404);
  });

  it("удалённое и истёкшее (исчезающее) сообщение не отдаёт файл", async () => {
    const row = fixtures.attachments.get(CHANNEL_MSG)!;
    row.message = channelScope({ deletedAt: new Date() });
    expect((await media(CHANNEL_IMAGE, [SEL.alice])).statusCode).toBe(404);
    row.message = channelScope({ expiresAt: new Date(Date.now() - 1000) });
    expect((await media(CHANNEL_IMAGE, [SEL.alice])).statusCode).toBe(404);
  });

  it("файл без записи в БД и traversal не отдаются", async () => {
    // Файл есть на диске, но не принадлежит ни одному Attachment row.
    expect((await media(CHANNEL_FILE, [SEL.alice])).statusCode).toBe(404);
    for (const bad of ["..%2Foutside.txt", "%2e%2e%2F%2e%2e%2Foutside.txt", "x", "..", `${CHANNEL_IMAGE}%00`]) {
      const res = await media(bad, [SEL.alice]);
      expect([400, 404]).toContain(res.statusCode);
      expect(res.body).not.toContain("outside");
    }
  });

  it("прямой публичный URL /uploads/attachments/ закрыт при любом написании", async () => {
    for (const url of [
      `/uploads/attachments/${CHANNEL_IMAGE}`,
      `/uploads/Attachments/${CHANNEL_IMAGE}`,
      `/uploads/%61ttachments/${CHANNEL_IMAGE}`,
      `/uploads//attachments/${CHANNEL_IMAGE}`,
      `/uploads/./attachments/${CHANNEL_IMAGE}`,
      `/uploads/icons/../attachments/${CHANNEL_IMAGE}`,
      `/uploads/attachments%2F${CHANNEL_IMAGE}`,
      `/uploads/attachments/`,
    ]) {
      const res = await app.inject({ method: "GET", url, headers: { cookie: cookie(SEL.alice) } });
      expect(res.statusCode, url).not.toBe(200);
      expect(res.body, url).not.toContain("PDF");
    }
    // Публичные аватарки/иконки серверов продолжают отдаваться.
    const icon = await app.inject({ method: "GET", url: "/uploads/icons/server.webp" });
    expect(icon.statusCode).toBe(200);
  });
});

describe("00-144: обучающие видео и файлы таблиц", () => {
  const training = (selectors: string[], headers: Record<string, string> = {}) =>
    app.inject({
      method: "GET",
      url: `/api/attachments/training-videos/${TRAINING_FILE}`,
      headers: selectors.length ? { cookie: cookie(...selectors), ...headers } : headers,
    });

  it("участник сервера смотрит видео (с перемоткой), бывший участник — нет", async () => {
    const ok = await training([SEL.bob]);
    expect(ok.statusCode).toBe(200);
    expect(ok.headers["cache-control"]).toBe("private, no-store");
    expect(ok.headers["content-type"]).toMatch(/^video\/mp4/);
    expect((await training([SEL.bob], { range: "bytes=0-3" })).statusCode).toBe(206);

    fixtures.members.delete("bob:srv-1");
    expect((await training([SEL.bob])).statusCode).toBe(404);
    expect((await training([SEL.alice])).statusCode).toBe(200);
  });

  it("без сессии — 401, посторонний и неизвестный файл — 404", async () => {
    expect((await training([])).statusCode).toBe(401);
    expect((await training([SEL.carol])).statusCode).toBe(404);
    const unknown = await app.inject({
      method: "GET",
      url: "/api/attachments/training-videos/missing.mp4",
      headers: { cookie: cookie(SEL.alice) },
    });
    expect(unknown.statusCode).toBe(404);
    const traversal = await app.inject({
      method: "GET",
      url: "/api/attachments/training-videos/..%2Foutside.txt",
      headers: { cookie: cookie(SEL.alice) },
    });
    expect(traversal.statusCode).toBe(404);
  });

  it("прямые /uploads/training-videos/ и /uploads/tables/ закрыты", async () => {
    for (const url of [
      `/uploads/training-videos/${TRAINING_FILE}`,
      `/uploads/Training-Videos/${TRAINING_FILE}`,
      "/uploads/tables/legacy-cell.pdf",
      "/uploads/%74ables/legacy-cell.pdf",
    ]) {
      const res = await app.inject({ method: "GET", url, headers: { cookie: cookie(SEL.alice) } });
      expect(res.statusCode, url).not.toBe(200);
      expect(res.body, url).not.toContain("PDF");
    }
  });
});
