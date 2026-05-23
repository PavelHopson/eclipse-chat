import type { FastifyInstance } from "fastify";
import { promises as fs } from "node:fs";
import path from "node:path";
import { z } from "zod";
import sharp from "sharp";
import { db } from "../db.js";
import { getUserId, requireJwt } from "../auth/requireJwt.js";
import { ensureServerActive } from "../lib/serverGating.js";

/**
 * v1.2.20 — Custom emoji per-server (backend MVP).
 *
 * Routes:
 *   GET    /api/servers/:id/emojis           — list (member-only)
 *   POST   /api/servers/:id/emojis           — upload (OWNER + ADMIN)
 *   DELETE /api/emojis/:id                   — delete (uploader OR OWNER/ADMIN)
 *
 * Storage: webp 128×128 (sharp resize) в `/uploads/emojis/<serverId>-<id>.webp`.
 * Shortcode: [a-z0-9_-]{2,30}, lowercase, unique per server (DB constraint).
 *
 * Не реализовано в MVP (отдельные слайсы):
 *   - Frontend autocomplete `:shortcode:` в композере
 *   - Picker UI (extend EmojiPicker.tsx)
 *   - Parser `:shortcode:` → <img> в RichContent
 *   - Использование в reactions (server-side whitelist расширить)
 */

const EMOJI_BODY_LIMIT = 8 * 1024 * 1024;
const EMOJI_MAX_BINARY = 5 * 1024 * 1024;
const EMOJI_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
]);

/** Жёсткий лимит на количество emoji per server — защита от abuse. */
const MAX_EMOJIS_PER_SERVER = 100;

/** Какие роли могут upload + delete (помимо самого uploader'а). */
const ADMIN_ROLES = new Set(["OWNER", "ADMIN"]);

const SHORTCODE_RE = /^[a-z0-9_-]{2,30}$/;

const uploadEmojiBody = z.object({
  shortcode: z
    .string()
    .min(2)
    .max(30)
    .transform((s) => s.toLowerCase()),
  contentType: z.string().min(3).max(40),
  dataBase64: z.string().min(1),
});

function emojisDir(): string {
  const base = process.env.UPLOADS_DIR ?? "./uploads";
  return path.join(base, "emojis");
}

function emojiUrl(filename: string): string {
  return `/uploads/emojis/${filename}`;
}

export async function registerEmojiRoutes(app: FastifyInstance) {
  /**
   * GET /api/servers/:id/emojis — список custom-emoji сервера.
   * Доступ: любой member. Возвращает массив { id, shortcode, url,
   * uploader: { id, displayName } | null, createdAt }.
   */
  app.get("/api/servers/:id/emojis", { onRequest: [requireJwt] }, async (req, reply) => {
    const { id: serverId } = req.params as { id: string };
    const userId = getUserId(req);
    if (!userId) return reply.status(401).send({ error: "Unauthorized" });

    const member = await db.member.findUnique({
      where: { userId_serverId: { userId, serverId } },
      select: { id: true },
    });
    if (!member) return reply.status(403).send({ error: "Not a member of this server" });

    const rows = await db.emoji.findMany({
      where: { serverId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        shortcode: true,
        url: true,
        createdAt: true,
        uploader: { select: { id: true, displayName: true } },
      },
    });
    return {
      emojis: rows.map((e) => ({
        id: e.id,
        shortcode: e.shortcode,
        url: e.url,
        createdAt: e.createdAt.toISOString(),
        uploader: e.uploader,
      })),
    };
  });

  /**
   * POST /api/servers/:id/emojis — загрузить новый emoji.
   * Доступ: OWNER + ADMIN. JSON+base64 (как server-icon).
   * Body: { shortcode, contentType, dataBase64 }.
   */
  app.post(
    "/api/servers/:id/emojis",
    {
      onRequest: [requireJwt],
      bodyLimit: EMOJI_BODY_LIMIT,
    },
    async (req, reply) => {
      const { id: serverId } = req.params as { id: string };
      const userId = getUserId(req);
      if (!userId) return reply.status(401).send({ error: "Unauthorized" });

      const member = await db.member.findUnique({
        where: { userId_serverId: { userId, serverId } },
        select: { id: true, role: true },
      });
      if (!member) return reply.status(403).send({ error: "Not a member of this server" });
      if (!ADMIN_ROLES.has(member.role)) {
        return reply.status(403).send({ error: "Only OWNER and ADMIN can upload emoji" });
      }

      // Suspend-gate (Platform Admin can freeze server writes).
      const active = await ensureServerActive(serverId, reply);
      if (!active) return reply;

      const parsed = uploadEmojiBody.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid body" });
      }
      if (!SHORTCODE_RE.test(parsed.data.shortcode)) {
        return reply.status(400).send({
          error: "Shortcode: 2–30 символов [a-z0-9_-] (lowercase)",
        });
      }
      if (!EMOJI_MIME.has(parsed.data.contentType)) {
        return reply.status(415).send({
          error: `Формат ${parsed.data.contentType} не поддерживается. Используй JPEG, PNG, WebP, GIF или AVIF.`,
        });
      }

      // Лимит per server.
      const count = await db.emoji.count({ where: { serverId } });
      if (count >= MAX_EMOJIS_PER_SERVER) {
        return reply.status(409).send({
          error: `Лимит ${MAX_EMOJIS_PER_SERVER} emoji на сервер достигнут. Удали неиспользуемые.`,
        });
      }

      // Shortcode unique per server.
      const dup = await db.emoji.findUnique({
        where: { serverId_shortcode: { serverId, shortcode: parsed.data.shortcode } },
        select: { id: true },
      });
      if (dup) {
        return reply.status(409).send({
          error: `Shortcode :${parsed.data.shortcode}: уже занят на этом сервере`,
        });
      }

      const buf = Buffer.from(parsed.data.dataBase64, "base64");
      if (buf.length === 0) {
        return reply.status(400).send({ error: "Пустой файл" });
      }
      if (buf.length > EMOJI_MAX_BINARY) {
        return reply.status(413).send({
          error: `Файл слишком большой (${(buf.length / 1024 / 1024).toFixed(1)} MB). Максимум ${EMOJI_MAX_BINARY / 1024 / 1024} MB.`,
        });
      }

      let resized: Buffer;
      try {
        const meta = await sharp(buf, { failOn: "none" }).metadata();
        if (!meta.width || !meta.height) {
          throw new Error(`Image metadata пустая (${meta.format ?? "unknown"})`);
        }
        resized = await sharp(buf, { failOn: "none" })
          .rotate()
          .resize(128, 128, { fit: "cover", position: "center" })
          .webp({ quality: 85 })
          .toBuffer();
        if (resized.length < 300) {
          throw new Error(`Sharp вернул corrupt webp (${resized.length} байт)`);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        app.log.warn(
          { err, mime: parsed.data.contentType, size: buf.length },
          "Emoji sharp failed",
        );
        return reply.status(400).send({
          error: "Не удалось обработать картинку",
          details: message,
        });
      }

      // Create row first, then file (id даёт уникальное имя).
      const row = await db.emoji.create({
        data: {
          serverId,
          shortcode: parsed.data.shortcode,
          url: "", // обновим ниже после записи файла
          uploaderId: userId,
        },
      });
      const filename = `${serverId}-${row.id}.webp`;
      const dir = emojisDir();
      try {
        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(path.join(dir, filename), resized);
      } catch (err) {
        // Rollback row если файл не записался.
        await db.emoji.delete({ where: { id: row.id } }).catch(() => undefined);
        const message = err instanceof Error ? err.message : String(err);
        return reply.status(500).send({ error: "Не удалось сохранить файл", details: message });
      }
      const url = emojiUrl(filename);
      const updated = await db.emoji.update({
        where: { id: row.id },
        data: { url },
        include: { uploader: { select: { id: true, displayName: true } } },
      });

      return reply.status(201).send({
        emoji: {
          id: updated.id,
          shortcode: updated.shortcode,
          url: updated.url,
          createdAt: updated.createdAt.toISOString(),
          uploader: updated.uploader,
        },
      });
    },
  );

  /**
   * DELETE /api/emojis/:id — удалить emoji.
   * Доступ: uploader OR OWNER/ADMIN сервера.
   */
  app.delete(
    "/api/emojis/:id",
    { onRequest: [requireJwt] },
    async (req, reply) => {
      const { id: emojiId } = req.params as { id: string };
      const userId = getUserId(req);
      if (!userId) return reply.status(401).send({ error: "Unauthorized" });

      const row = await db.emoji.findUnique({
        where: { id: emojiId },
        select: { id: true, serverId: true, url: true, uploaderId: true },
      });
      if (!row) return reply.status(404).send({ error: "Emoji not found" });

      const isUploader = row.uploaderId === userId;
      let canDelete = isUploader;
      if (!canDelete) {
        const member = await db.member.findUnique({
          where: { userId_serverId: { userId, serverId: row.serverId } },
          select: { role: true },
        });
        canDelete = !!member && ADMIN_ROLES.has(member.role);
      }
      if (!canDelete) {
        return reply.status(403).send({
          error: "Удалять может только uploader или OWNER/ADMIN сервера",
        });
      }

      // Suspend-gate.
      const active = await ensureServerActive(row.serverId, reply);
      if (!active) return reply;

      await db.emoji.delete({ where: { id: emojiId } });

      // Best-effort cleanup файла. Если упало (файл уже исчез) — не fatal.
      if (row.url) {
        const filename = path.basename(row.url);
        if (filename) {
          await fs.unlink(path.join(emojisDir(), filename)).catch(() => undefined);
        }
      }

      return { ok: true };
    },
  );
}
