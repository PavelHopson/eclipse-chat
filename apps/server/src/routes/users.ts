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
const AVATAR_BODY_LIMIT = 7 * 1024 * 1024;
const AVATAR_MAX_BINARY = 5 * 1024 * 1024;
const AVATAR_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

const uploadAvatarBody = z.object({
  /** Mime: должен быть jpeg/png/webp. На вход sharp принимает любой raster — выход всегда webp. */
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
        return reply.status(415).send({ error: "Only jpeg/png/webp supported" });
      }
      const buf = Buffer.from(parsed.data.dataBase64, "base64");
      if (buf.length === 0) {
        return reply.status(400).send({ error: "Empty file" });
      }
      if (buf.length > AVATAR_MAX_BINARY) {
        return reply.status(413).send({ error: "File too large (max 5MB)" });
      }
      // sharp: resize до 256x256 (cover crop) + конверт в webp (стабильный, мелкий)
      const resized = await sharp(buf)
        .rotate() // учесть EXIF orientation
        .resize(256, 256, { fit: "cover", position: "center" })
        .webp({ quality: 88 })
        .toBuffer()
        .catch(() => null);
      if (!resized) {
        return reply.status(400).send({ error: "Image processing failed" });
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
