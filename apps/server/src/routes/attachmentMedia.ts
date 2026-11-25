import path from "node:path";
import fastifyStatic from "@fastify/static";
import type { FastifyInstance, FastifyReply } from "fastify";
import { validateMediaSession } from "../auth/mediaSession.js";
import { db } from "../db.js";
import { hasPermission } from "../lib/permissions.js";

/**
 * 00-144: вложения сообщений больше не раздаются публичной статикой.
 *
 * Раньше `/uploads/attachments/<file>` отдавал nginx (alias) и Fastify-static
 * без какой-либо проверки: кто однажды увидел ссылку, тот читал файл
 * навсегда — в том числе бывший участник сервера / группы DM.
 *
 * Теперь единственный путь к файлу — `GET /api/attachments/media/<file>`.
 * Авторизация — HttpOnly media-cookie (`auth/mediaSession.ts`, Path=
 * /api/attachments/, SameSite=Strict): она привязана к живой refresh-сессии,
 * не принимается после logout/бана/удаления аккаунта. Доступ к конкретному
 * файлу проверяется на каждом запросе по текущему членству:
 *   - канал сервера → Member существует (+ internal-комнаты CLIENT-режима
 *     только с ROOM_VIEW_INTERNAL, как у GET /api/channels/:id/messages);
 *   - DM → пользователь — участник беседы (1-to-1 или группа);
 *   - удалённое / истёкшее (исчезающее) сообщение → недоступно.
 * Ответ всегда `private, no-store`, поэтому браузер и SW не держат копию,
 * которую можно открыть после исключения.
 *
 * URL не содержит selector сессии: он стабилен между ротациями refresh-
 * токена (иначе уже отрисованные <img>/<audio> ломались бы каждые 15 минут).
 * Сервер проверяет каждую media-cookie браузера (их несколько при
 * мульти-аккаунте) и пускает, если доступ есть хотя бы у одной валидной
 * сессии. Чужую валидную cookie подложить нельзя (HMAC + живая сессия),
 * а своя cookie другого аккаунта того же браузера не раскрывает данные
 * постороннему.
 */

const FILE_RE = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,239}$/;
const MEDIA_COOKIE_RE = /^(?:__Secure-)?ec-media-([A-Za-z0-9_-]{22})=/;
/**
 * Сколько имён media-cookie рассматриваем. Берём с запасом: скрипт соседнего
 * приложения на том же хосте может подложить мусорные cookie с более
 * длинным Path (браузер пошлёт их первыми) и вытеснить настоящую. Мусор
 * отсекается HMAC-проверкой до БД, поэтому перебор дешёвый.
 */
const MAX_MEDIA_COOKIES = 32;
/** Сколько валидных сессий (каждая — запрос в БД) учитываем за запрос. */
const MAX_MEDIA_SESSIONS = 4;

export function attachmentsRoot(): string {
  return path.resolve(process.env.UPLOADS_DIR ?? "./uploads", "attachments");
}

/**
 * Фильтр для публичной статики `/uploads/`: аватарки, иконки и баннеры
 * остаются публичными; закрытые каталоги — никогда:
 *   - `attachments/` — вложения сообщений (маршрут ниже);
 *   - `training-videos/` — файлы обучающей библиотеки сервера (маршрут ниже);
 *   - `tables/` — файлы FILE-ячеек таблиц; маршруты таблиц удалены в
 *     v1.6.48, UI их не показывает, публично отдавать нечего.
 * Нормализуем percent-encoding, `\`, `.`/`..` и регистр (ФС Windows
 * регистронезависима), сомнительный путь — запрещаем.
 */
const PRIVATE_UPLOAD_DIRS = ["attachments", "training-videos", "tables"];

export function isPublicUploadPath(pathName: string): boolean {
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathName);
  } catch {
    return false;
  }
  if (decoded.includes("\0")) return false;
  const normalized = path.posix
    .normalize(`/${decoded.replace(/\\/g, "/")}`)
    .toLowerCase();
  return !PRIVATE_UPLOAD_DIRS.some(
    (dir) => normalized === `/${dir}` || normalized.startsWith(`/${dir}/`),
  );
}

export function trainingVideosRoot(): string {
  return path.resolve(process.env.UPLOADS_DIR ?? "./uploads", "training-videos");
}

/** Selectors всех media-cookie из заголовка, без дублей, не больше лимита. */
export function mediaSelectorsFromCookieHeader(raw: string | undefined): string[] {
  if (!raw) return [];
  const out: string[] = [];
  for (const part of raw.split(";")) {
    const match = MEDIA_COOKIE_RE.exec(part.trim());
    if (match && !out.includes(match[1])) out.push(match[1]);
    if (out.length >= MAX_MEDIA_COOKIES) break;
  }
  return out;
}

/**
 * Имя файла вложения начинается с id сообщения (`<cuid>-<pos>-<ts>-...`,
 * см. processAttachment). Это даёт индексированный поиск по messageId
 * вместо скана Attachment.url.
 */
export function messageIdFromAttachmentFile(file: string): string | null {
  if (!FILE_RE.test(file) || file.includes("..")) return null;
  const dash = file.indexOf("-");
  if (dash <= 0) return null;
  return file.slice(0, dash);
}

type AttachmentScope = {
  deletedAt: Date | null;
  expiresAt: Date | null;
  channel: {
    serverId: string;
    internal: boolean;
    server: { mode: string };
  } | null;
  conversation: {
    isGroup: boolean;
    userAId: string | null;
    userBId: string | null;
    participants: { userId: string }[];
  } | null;
};

/** Может ли userId прямо сейчас читать сообщение, к которому прикреплён файл. */
export async function canUserReadAttachmentMessage(
  scope: AttachmentScope,
  userId: string,
): Promise<boolean> {
  if (scope.deletedAt) return false;
  if (scope.expiresAt && scope.expiresAt.getTime() <= Date.now()) return false;
  if (scope.channel) {
    const member = await db.member.findUnique({
      where: { userId_serverId: { userId, serverId: scope.channel.serverId } },
      select: { role: true },
    });
    if (!member) return false;
    if (
      scope.channel.server.mode === "CLIENT" &&
      scope.channel.internal &&
      !hasPermission(member.role, "ROOM_VIEW_INTERNAL")
    ) {
      return false;
    }
    return true;
  }
  if (scope.conversation) {
    const c = scope.conversation;
    const members = c.isGroup
      ? c.participants.map((p) => p.userId)
      : [c.userAId, c.userBId].filter((v): v is string => v !== null);
    return members.includes(userId);
  }
  return false;
}

function mediaHeaders(reply: FastifyReply): void {
  reply.header("Cache-Control", "private, no-store");
  reply.header("Vary", "Cookie");
  reply.header(
    "Content-Security-Policy",
    "default-src 'none'; style-src 'unsafe-inline'; img-src data:; sandbox; frame-ancestors 'none'",
  );
  reply.header("Cross-Origin-Resource-Policy", "same-origin");
  reply.header("X-Content-Type-Options", "nosniff");
  reply.header("Referrer-Policy", "strict-origin-when-cross-origin");
  reply.header("X-Frame-Options", "DENY");
}

export async function registerAttachmentMediaRoutes(app: FastifyInstance) {
  // Отдельный encapsulated-контекст: decorateReply не конфликтует с
  // глобальной регистрацией /uploads/ (decorateReply:false), serve:false —
  // никаких автоматических маршрутов, только reply.sendFile ниже.
  await app.register(async (scope) => {
    await scope.register(fastifyStatic, {
      root: attachmentsRoot(),
      serve: false,
      decorateReply: true,
      cacheControl: false,
      etag: false,
      lastModified: false,
    });

    scope.get(
      "/api/attachments/media/:file",
      { config: { rateLimit: { max: 600, timeWindow: 60 * 1000 } } },
      async (req, reply) => {
        mediaHeaders(reply);
        const { file } = req.params as { file: string };
        const messageId = messageIdFromAttachmentFile(file);
        if (!messageId) return reply.status(404).send({ error: "Not found" });

        const userIds = await mediaUserIds(req.headers.cookie);
        if (userIds.length === 0) return reply.status(401).send({ error: "Unauthorized" });

        const relative = `/uploads/attachments/${file}`;
        const attachment = await db.attachment.findFirst({
          where: { messageId, OR: [{ url: relative }, { thumbnailUrl: relative }] },
          select: {
            message: {
              select: {
                deletedAt: true,
                expiresAt: true,
                channel: {
                  select: { serverId: true, internal: true, server: { select: { mode: true } } },
                },
                conversation: {
                  select: {
                    isGroup: true,
                    userAId: true,
                    userBId: true,
                    participants: { select: { userId: true } },
                  },
                },
              },
            },
          },
        });
        // 404 и для «нет файла», и для «нет доступа»: не подтверждаем
        // существование вложения постороннему.
        if (!attachment) return reply.status(404).send({ error: "Not found" });
        let allowed = false;
        for (const userId of userIds) {
          if (await canUserReadAttachmentMessage(attachment.message, userId)) {
            allowed = true;
            break;
          }
        }
        if (!allowed) return reply.status(404).send({ error: "Not found" });

        // Content-Type — по расширению, которое сервер сам выбрал из
        // проверенного magic-bytes MIME (extFromMime), как раньше у nginx.
        return reply.sendFile(file);
      },
    );

    /**
     * Файлы обучающей библиотеки сервера (`TrainingVideo`, source=file).
     * Доступ — как у GET /api/servers/:id/training-library: любой текущий
     * участник сервера. Путь под /api/attachments/, потому что media-cookie
     * выдаётся только на этот Path.
     */
    scope.get(
      "/api/attachments/training-videos/:file",
      { config: { rateLimit: { max: 600, timeWindow: 60 * 1000 } } },
      async (req, reply) => {
        mediaHeaders(reply);
        const { file } = req.params as { file: string };
        if (!FILE_RE.test(file) || file.includes("..")) {
          return reply.status(404).send({ error: "Not found" });
        }
        const userIds = await mediaUserIds(req.headers.cookie);
        if (userIds.length === 0) return reply.status(401).send({ error: "Unauthorized" });

        // Таблица маленькая (видео на сервер), индекс по url не нужен.
        const video = await db.trainingVideo.findFirst({
          where: { url: `/uploads/training-videos/${file}`, source: "file" },
          select: { serverId: true },
        });
        if (!video) return reply.status(404).send({ error: "Not found" });
        let allowed = false;
        for (const userId of userIds) {
          const member = await db.member.findUnique({
            where: { userId_serverId: { userId, serverId: video.serverId } },
            select: { role: true },
          });
          if (member) {
            allowed = true;
            break;
          }
        }
        if (!allowed) return reply.status(404).send({ error: "Not found" });
        return reply.sendFile(file, trainingVideosRoot());
      },
    );
  });
}

/** userId всех валидных media-сессий браузера (подпись проверяется до БД). */
async function mediaUserIds(cookieHeader: string | undefined): Promise<string[]> {
  const userIds: string[] = [];
  for (const selector of mediaSelectorsFromCookieHeader(cookieHeader)) {
    const session = await validateMediaSession(cookieHeader, selector);
    if (session && !userIds.includes(session.userId)) userIds.push(session.userId);
    if (userIds.length >= MAX_MEDIA_SESSIONS) break;
  }
  return userIds;
}
