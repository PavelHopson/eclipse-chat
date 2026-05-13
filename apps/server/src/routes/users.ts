import type { FastifyInstance } from "fastify";
import { promises as fs } from "node:fs";
import path from "node:path";
import { z } from "zod";
import sharp from "sharp";
import { db } from "../db.js";
import { getUserId, requireJwt } from "../auth/requireJwt.js";
import { broadcastStatusChange } from "../presence.js";

const updateProfileBody = z.object({
  displayName: z.string().min(1).max(64).optional(),
  bio: z.string().max(280).nullable().optional(),
});

const updateStatusBody = z.object({
  status: z.enum(["ONLINE", "IDLE", "DND", "INVISIBLE"]),
});

/**
 * Avatar upload через JSON + base64 (не multipart).
 *
 * Решение принято 12.05.2026 после того как локальная сеть Pavel'а не
 * смогла установить @fastify/multipart (ECONNRESET от registry.npmjs.org).
 * Заодно убрана отдельная зависимость, body parsing идёт штатным
 * Fastify JSON parser. Лимит 7 MB на body (base64 5 MB binary ≈ 6.7 MB).
 *
 * Будущая полноценная Files API (v0.9) всё равно пойдёт через MinIO +
 * presigned URLs, не через multipart — тогда вернуться к этому решению
 * не понадобится.
 */
/**
 * Лимиты бампнуты в v0.9.2 после фидбека от Pavel'я:
 * iPhone-сделанные фото (HEIC/JPEG) часто 10-15 MB и проходить под 5 MB
 * не должны. Теперь 20 MB binary + 27 MB body (base64 overhead ~34%).
 */
const AVATAR_BODY_LIMIT = 27 * 1024 * 1024;
const AVATAR_MAX_BINARY = 20 * 1024 * 1024;
/**
 * Sharp на входе принимает большинство raster-форматов. HEIC/HEIF/AVIF
 * требуют libheif/libaom на сервере — если они не установлены, sharp
 * thrown'ет и мы вернём понятный 400 с hint'ом про конвертацию.
 *
 * Список MIME широкий — пусть sharp сам разруливает: если формат не
 * поддержан, поймаем в catch и user-friendly message. На выход всегда webp.
 */
const AVATAR_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
  "image/heic",
  "image/heif",
  "image/bmp",
  "image/tiff",
]);

const uploadAvatarBody = z.object({
  /** Mime — расширенный список raster-форматов. Sharp конвертирует в webp. */
  contentType: z.string().min(3).max(40),
  /** Base64 без префикса `data:...;base64,` — клиент чистит сам. */
  dataBase64: z.string().min(1),
});

/**
 * Каталог для аватарок. В проде указывается через env (`UPLOADS_DIR`),
 * обычно `/var/www/eclipse-chat/uploads`. В dev — `./uploads` относительно
 * cwd процесса (apps/server при tsx watch).
 */
function avatarsDir(): string {
  const base = process.env.UPLOADS_DIR ?? "./uploads";
  return path.join(base, "avatars");
}

/** Относительный URL под который положены файлы. Frontend prefixит BASE_URL. */
function avatarUrl(filename: string): string {
  return `/uploads/avatars/${filename}`;
}

function extFromMime(mime: string): string {
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/png") return "png";
  return "webp";
}

function publicProfile(u: {
  id: string;
  email: string;
  displayName: string;
  avatar: string | null;
  bio: string | null;
  status?: "ONLINE" | "IDLE" | "DND" | "INVISIBLE";
  createdAt: Date;
}) {
  return {
    id: u.id,
    email: u.email,
    displayName: u.displayName,
    avatar: u.avatar,
    bio: u.bio,
    status: u.status ?? "ONLINE",
    createdAt: u.createdAt.toISOString(),
  };
}

export async function registerUserRoutes(app: FastifyInstance) {
  app.get(
    "/api/users/me/profile",
    { onRequest: [requireJwt] },
    async (req, reply) => {
      const userId = getUserId(req);
      if (!userId) {
        return reply.status(401).send({ error: "Unauthorized" });
      }
      const user = await db.user.findUnique({ where: { id: userId } });
      if (!user) {
        return reply.status(404).send({ error: "User not found" });
      }
      return { user: publicProfile(user) };
    },
  );

  app.patch(
    "/api/users/me/profile",
    { onRequest: [requireJwt] },
    async (req, reply) => {
      const userId = getUserId(req);
      if (!userId) {
        return reply.status(401).send({ error: "Unauthorized" });
      }
      const parsed = updateProfileBody.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid body", details: parsed.error.flatten() });
      }
      const data: { displayName?: string; bio?: string | null } = {};
      if (parsed.data.displayName !== undefined) {
        data.displayName = parsed.data.displayName.trim();
      }
      if (parsed.data.bio !== undefined) {
        data.bio = parsed.data.bio === null ? null : parsed.data.bio.trim();
      }
      if (Object.keys(data).length === 0) {
        const user = await db.user.findUnique({ where: { id: userId } });
        if (!user) {
          return reply.status(404).send({ error: "User not found" });
        }
        return { user: publicProfile(user) };
      }
      const user = await db.user.update({ where: { id: userId }, data });
      return { user: publicProfile(user) };
    },
  );

  app.post(
    "/api/users/me/avatar",
    {
      onRequest: [requireJwt],
      bodyLimit: AVATAR_BODY_LIMIT,
    },
    async (req, reply) => {
      const userId = getUserId(req);
      if (!userId) {
        return reply.status(401).send({ error: "Unauthorized" });
      }
      const parsed = uploadAvatarBody.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid body", details: parsed.error.flatten() });
      }
      if (!AVATAR_MIME.has(parsed.data.contentType)) {
        return reply.status(415).send({
          error: `Формат ${parsed.data.contentType} не поддерживается. Используй JPEG, PNG, WebP, GIF, AVIF, HEIC, BMP или TIFF.`,
        });
      }
      const buf = Buffer.from(parsed.data.dataBase64, "base64");
      if (buf.length === 0) {
        return reply.status(400).send({ error: "Пустой файл" });
      }
      if (buf.length > AVATAR_MAX_BINARY) {
        return reply.status(413).send({
          error: `Файл слишком большой (${(buf.length / 1024 / 1024).toFixed(1)} MB). Максимум 20 MB.`,
        });
      }
      // sharp: resize 512×512 (увеличено с 256 после фидбека Pavel'я —
      // 256 был «сломан» на retina; 512×512 webp ≈ 30-50 KB, всё ещё компактно).
      // failOn:"none" — толерантнее к JPEG с мелкими warnings.
      let resized: Buffer;
      try {
        resized = await sharp(buf, { failOn: "none" })
          .rotate() // EXIF orientation
          .resize(512, 512, { fit: "cover", position: "center" })
          .webp({ quality: 90 })
          .toBuffer();
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        app.log.warn({ err, mime: parsed.data.contentType, size: buf.length }, "Avatar sharp processing failed");
        // HEIC без libheif даёт `Input file contains unsupported image format`
        const hint = /heif|heic|libheif/i.test(message)
          ? " Похоже, что HEIC из iPhone — открой Фото → Поделиться → Параметры → выбери «Совместимый» формат, либо загрузи JPEG/PNG."
          : "";
        return reply.status(400).send({
          error: `Не удалось обработать изображение.${hint}`,
          details: message,
        });
      }
      const dir = avatarsDir();
      await fs.mkdir(dir, { recursive: true });
      // Удаляем старый аватар (best-effort) — иначе мусор в FS.
      const existing = await db.user.findUnique({
        where: { id: userId },
        select: { avatar: true },
      });
      if (existing?.avatar) {
        const oldName = path.basename(existing.avatar);
        if (oldName) {
          await fs.unlink(path.join(dir, oldName)).catch(() => undefined);
        }
      }
      const filename = `${userId}-${Date.now()}.${extFromMime("image/webp")}`;
      await fs.writeFile(path.join(dir, filename), resized);
      const url = avatarUrl(filename);
      const updated = await db.user.update({
        where: { id: userId },
        data: { avatar: url },
      });
      return { user: publicProfile(updated), url };
    },
  );

  /**
   * PATCH /api/users/me/status — manual presence override.
   * Сохраняет в БД + broadcast на все server-rooms где user member.
   */
  app.patch(
    "/api/users/me/status",
    { onRequest: [requireJwt] },
    async (req, reply) => {
      const userId = getUserId(req);
      if (!userId) {
        return reply.status(401).send({ error: "Unauthorized" });
      }
      const parsed = updateStatusBody.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid status" });
      }
      const updated = await db.user.update({
        where: { id: userId },
        data: { status: parsed.data.status },
      });
      // Broadcast change в socket — клиенты в member-list'ах обновят dot
      broadcastStatusChange(userId, parsed.data.status);
      return { user: publicProfile(updated), status: updated.status };
    },
  );

  app.delete(
    "/api/users/me/avatar",
    { onRequest: [requireJwt] },
    async (req, reply) => {
      const userId = getUserId(req);
      if (!userId) {
        return reply.status(401).send({ error: "Unauthorized" });
      }
      const existing = await db.user.findUnique({
        where: { id: userId },
        select: { avatar: true },
      });
      if (existing?.avatar) {
        const filename = path.basename(existing.avatar);
        if (filename) {
          await fs.unlink(path.join(avatarsDir(), filename)).catch(() => undefined);
        }
      }
      const updated = await db.user.update({
        where: { id: userId },
        data: { avatar: null },
      });
      return { user: publicProfile(updated) };
    },
  );
}
