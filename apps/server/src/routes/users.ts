import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { z } from "zod";
import sharp from "sharp";
import { db } from "../db.js";
import { getUserId, requireJwt } from "../auth/requireJwt.js";
import { broadcastActivityChange, broadcastStatusChange, isOnline } from "../presence.js";

const updateProfileBody = z.object({
  displayName: z.string().min(1).max(64).optional(),
  bio: z.string().max(280).nullable().optional(),
});

const updateStatusBody = z.object({
  status: z.enum(["ONLINE", "IDLE", "DND", "INVISIBLE"]),
});

/**
 * v1.5.45 Discord-parity A3: PATCH /api/users/me/activity body.
 *
 * Все поля optional + nullable; не-присланные не трогаются, null'ом
 * сбрасываются в БД. Frontend Discord-style submit'ит обе строки
 * вместе (даже если меняется только одна), но строгая независимость
 * каждого поля даёт гибкость (clear только emoji через `{ activityEmoji: null }`).
 *
 * Длины: activityText 128 (Discord parity), activityEmoji 64 (cover
 * длинных ZWJ-sequences типа семейных эмодзи с skin-tone modifiers).
 */
const updateActivityBody = z.object({
  activityText: z.string().max(128).nullable().optional(),
  activityEmoji: z.string().max(64).nullable().optional(),
});

/**
 * v1.5.49 Discord-parity B5: PATCH /api/users/me/quiet-hours body.
 *
 * Все три поля optional + nullable; undefined → не меняем, null → сбрасываем.
 *
 * `quietFrom` / `quietTo` — HH:MM формат (24-hour), validated regex.
 * `timezone` — IANA name (e.g. "Europe/Moscow"). Validated runtime через
 * `Intl.DateTimeFormat({ timeZone: ... })` constructor — throws TypeError
 * на invalid. Backend ловит в route handler и возвращает 400.
 *
 * Поля независимые: set только timezone без quietFrom/To не запрещён
 * (хотя без time fields quiet effectively disabled).
 */
const HHMM_RE = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const updateQuietHoursBody = z.object({
  quietFrom: z.string().regex(HHMM_RE).nullable().optional(),
  quietTo: z.string().regex(HHMM_RE).nullable().optional(),
  timezone: z.string().min(1).max(80).nullable().optional(),
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
const PROFILE_GALLERY_LIMIT = 8;
const PROFILE_IMAGE_MAX_PIXELS = 60_000_000;
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

type ProfileMediaKind = "banner" | "gallery";

function profileMediaDir(kind: ProfileMediaKind): string {
  const base = process.env.UPLOADS_DIR ?? "./uploads";
  return path.join(base, kind === "banner" ? "profile-banners" : "profile-gallery");
}

function profileMediaUrl(kind: ProfileMediaKind, filename: string): string {
  const directory = kind === "banner" ? "profile-banners" : "profile-gallery";
  return `/uploads/${directory}/${filename}`;
}

async function deleteProfileMediaFile(
  kind: ProfileMediaKind,
  url: string | null | undefined,
): Promise<void> {
  if (!url) return;
  const filename = path.basename(url);
  if (!filename) return;
  await fs.unlink(path.join(profileMediaDir(kind), filename)).catch(() => undefined);
}

async function processProfileMedia(
  app: FastifyInstance,
  input: z.infer<typeof uploadAvatarBody>,
  kind: ProfileMediaKind,
): Promise<{ buffer: Buffer } | { error: string; status: number }> {
  if (!AVATAR_MIME.has(input.contentType)) {
    return {
      error: `Формат ${input.contentType} не поддерживается. Используй JPEG, PNG, WebP, GIF, AVIF, HEIC, BMP или TIFF.`,
      status: 415,
    };
  }
  const source = Buffer.from(input.dataBase64, "base64");
  if (source.length === 0) return { error: "Пустой файл", status: 400 };
  if (source.length > AVATAR_MAX_BINARY) {
    return {
      error: `Файл слишком большой (${(source.length / 1024 / 1024).toFixed(1)} MB). Максимум 20 MB.`,
      status: 413,
    };
  }

  try {
    const image = sharp(source, {
      failOn: "none",
      limitInputPixels: PROFILE_IMAGE_MAX_PIXELS,
    });
    const metadata = await image.metadata();
    if (!metadata.width || !metadata.height) {
      throw new Error(`Image metadata пустая (формат ${metadata.format ?? "unknown"} нечитаем)`);
    }

    const pipeline = sharp(source, {
      failOn: "none",
      limitInputPixels: PROFILE_IMAGE_MAX_PIXELS,
    }).rotate();
    const resized = kind === "banner"
      ? pipeline.resize(1600, 600, { fit: "cover", position: "center" })
      : pipeline.resize(1600, 1600, { fit: "inside", withoutEnlargement: true });
    const buffer = await resized.webp({ quality: 88 }).toBuffer();
    if (buffer.length < 800) throw new Error("Обработанное изображение повреждено");
    return { buffer };
  } catch (error) {
    const details = error instanceof Error ? error.message : String(error);
    app.log.warn(
      { err: error, mime: input.contentType, size: source.length, kind },
      "Profile media processing failed",
    );
    const heicHint = /heif|heic|libheif|unsupported image format/i.test(details) ||
      /heic|heif/i.test(input.contentType)
      ? " Сервер не смог прочитать HEIC/HEIF — выбери JPEG, PNG или WebP."
      : "";
    return {
      error: `Не удалось обработать изображение.${heicHint}`,
      status: 400,
    };
  }
}

async function persistProfileMedia(
  userId: string,
  kind: ProfileMediaKind,
  buffer: Buffer,
): Promise<string> {
  const dir = profileMediaDir(kind);
  await fs.mkdir(dir, { recursive: true });
  const filename = `${userId}-${randomUUID()}.webp`;
  await fs.writeFile(path.join(dir, filename), buffer);
  return profileMediaUrl(kind, filename);
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
  profileBanner?: string | null;
  profileImages?: Array<{ id: string; url: string; position: number; createdAt: Date }>;
  bio: string | null;
  status?: "ONLINE" | "IDLE" | "DND" | "INVISIBLE";
  /// v1.5.45 Discord-parity A3 — fields optional на типе чтобы старые
  /// callsite'ы (которые не select'ят их) не падали; БД всегда вернёт
  /// nullable string'и через db.user.findUnique без явного select.
  activityText?: string | null;
  activityEmoji?: string | null;
  /// v1.5.49 Discord-parity B5 — quiet hours. Three optional fields.
  quietFrom?: string | null;
  quietTo?: string | null;
  timezone?: string | null;
  createdAt: Date;
}) {
  return {
    id: u.id,
    email: u.email,
    displayName: u.displayName,
    avatar: u.avatar,
    profileBanner: u.profileBanner ?? null,
    profileImages: (u.profileImages ?? []).map((image) => ({
      id: image.id,
      url: image.url,
      position: image.position,
      createdAt: image.createdAt.toISOString(),
    })),
    bio: u.bio,
    status: u.status ?? "ONLINE",
    activityText: u.activityText ?? null,
    activityEmoji: u.activityEmoji ?? null,
    quietFrom: u.quietFrom ?? null,
    quietTo: u.quietTo ?? null,
    timezone: u.timezone ?? null,
    createdAt: u.createdAt.toISOString(),
  };
}

const profileMediaInclude = {
  profileImages: { orderBy: [{ position: "asc" as const }, { createdAt: "asc" as const }] },
};

function loadProfileUser(userId: string) {
  return db.user.findUnique({
    where: { id: userId },
    include: profileMediaInclude,
  });
}

const publicProfileQuery = z.object({
  serverId: z.string().min(1).max(128).optional(),
});

export type ProfileAccess = {
  role: string | null;
  joinedAt: Date | null;
  canMessage: boolean;
};

/**
 * Object-level authorization for GET /api/users/:userId/profile.
 * An authenticated account may view itself, a member of the same workspace,
 * an accepted friend, or a participant from an existing DM. Merely knowing a
 * user id is not enough.
 */
async function resolveProfileAccess(
  viewerId: string,
  targetId: string,
  serverId?: string,
): Promise<ProfileAccess | null> {
  if (viewerId === targetId) {
    const ownMembership = serverId
      ? await db.member.findUnique({
          where: { userId_serverId: { userId: targetId, serverId } },
          select: { role: true, joinedAt: true },
        })
      : null;
    return {
      role: ownMembership?.role ?? null,
      joinedAt: ownMembership?.joinedAt ?? null,
      canMessage: false,
    };
  }

  const [userAId, userBId] = viewerId < targetId
    ? [viewerId, targetId]
    : [targetId, viewerId];
  const friendship = await db.friendship.findUnique({
    where: { userAId_userBId: { userAId, userBId } },
    select: { status: true },
  });

  if (serverId) {
    const memberships = await db.member.findMany({
      where: { serverId, userId: { in: [viewerId, targetId] } },
      select: { userId: true, role: true, joinedAt: true },
    });
    if (memberships.length === 2) {
      const targetMembership = memberships.find((member) => member.userId === targetId);
      return {
        role: targetMembership?.role ?? null,
        joinedAt: targetMembership?.joinedAt ?? null,
        canMessage: friendship?.status !== "BLOCKED",
      };
    }
  }

  if (friendship?.status === "ACCEPTED") {
    return { role: null, joinedAt: null, canMessage: true };
  }
  if (friendship?.status === "BLOCKED") return null;

  const conversation = await db.directConversation.findFirst({
    where: {
      OR: [
        { isGroup: false, userAId: viewerId, userBId: targetId },
        { isGroup: false, userAId: targetId, userBId: viewerId },
        {
          isGroup: true,
          AND: [
            { participants: { some: { userId: viewerId } } },
            { participants: { some: { userId: targetId } } },
          ],
        },
      ],
    },
    select: { id: true },
  });
  return conversation ? { role: null, joinedAt: null, canMessage: true } : null;
}

type LoadedProfileUser = NonNullable<Awaited<ReturnType<typeof loadProfileUser>>>;

export function publicViewedProfile(
  user: LoadedProfileUser,
  viewerId: string,
  access: ProfileAccess,
) {
  const visibleOnline = user.status !== "INVISIBLE" && isOnline(user.id);
  return {
    id: user.id,
    displayName: user.displayName,
    avatar: user.avatar,
    profileBanner: user.profileBanner,
    bio: user.bio,
    status: user.id === viewerId ? user.status : user.status === "INVISIBLE" ? "INVISIBLE" : user.status,
    activityText: user.activityText,
    activityEmoji: user.activityEmoji,
    createdAt: user.createdAt.toISOString(),
    online: visibleOnline,
    isSelf: user.id === viewerId,
    canMessage: access.canMessage,
    serverContext: access.role && access.joinedAt
      ? { role: access.role, joinedAt: access.joinedAt.toISOString() }
      : null,
    profileImages: user.profileImages.map((image) => ({
      id: image.id,
      url: image.url,
      position: image.position,
      createdAt: image.createdAt.toISOString(),
    })),
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
      const user = await loadProfileUser(userId);
      if (!user) {
        return reply.status(404).send({ error: "User not found" });
      }
      return { user: publicProfile(user) };
    },
  );

  app.get(
    "/api/users/:userId/profile",
    {
      onRequest: [requireJwt],
      config: { rateLimit: { max: 120, timeWindow: 60 * 1000 } },
    },
    async (req, reply) => {
      const viewerId = getUserId(req);
      if (!viewerId) return reply.status(401).send({ error: "Unauthorized" });
      const targetId = (req.params as { userId?: string }).userId;
      if (!targetId || targetId.length > 128) {
        return reply.status(400).send({ error: "Invalid user id" });
      }
      const parsedQuery = publicProfileQuery.safeParse(req.query);
      if (!parsedQuery.success) {
        return reply.status(400).send({ error: "Invalid profile context" });
      }

      const access = await resolveProfileAccess(
        viewerId,
        targetId,
        parsedQuery.data.serverId,
      );
      // Return the same status for a missing and inaccessible account so the
      // endpoint cannot be used to enumerate platform users.
      if (!access) return reply.status(404).send({ error: "Profile not found" });

      const target = await loadProfileUser(targetId);
      if (!target || target.deletedAt || target.bannedAt) {
        return reply.status(404).send({ error: "Profile not found" });
      }
      return { user: publicViewedProfile(target, viewerId, access) };
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
        const user = await loadProfileUser(userId);
        if (!user) {
          return reply.status(404).send({ error: "User not found" });
        }
        return { user: publicProfile(user) };
      }
      await db.user.update({ where: { id: userId }, data });
      const user = await loadProfileUser(userId);
      if (!user) return reply.status(404).send({ error: "User not found" });
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
        // Verify input через metadata — даёт чёткую error если sharp не
        // распознаёт format (HEIC без libheif, corrupt JPEG, и т.д.).
        const meta = await sharp(buf, { failOn: "none" }).metadata();
        if (!meta.width || !meta.height) {
          throw new Error(
            `Image metadata пустая (формат ${meta.format ?? "unknown"} нечитаем)`,
          );
        }
        resized = await sharp(buf, { failOn: "none" })
          .rotate() // EXIF orientation
          .resize(512, 512, { fit: "cover", position: "center" })
          .webp({ quality: 90 })
          .toBuffer();
        // Sanity check: webp с реальным контентом не бывает < 800 байт.
        // Если получили tiny output — sharp вернул "успех" с corrupt результатом.
        if (resized.length < 800) {
          throw new Error(
            `Sharp вернул подозрительно маленький webp (${resized.length} байт) — формат скорее всего не поддержан`,
          );
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        app.log.warn(
          { err, mime: parsed.data.contentType, size: buf.length },
          "Avatar sharp processing failed",
        );
        // HEIC без libheif даёт `Input file contains unsupported image format`
        const hint =
          /heif|heic|libheif|unsupported image format/i.test(message) ||
          /heic|heif/i.test(parsed.data.contentType)
            ? " Похоже, HEIC/HEIF из iPhone. Сервер не имеет libheif — нужен JPEG/PNG/WebP. На iPhone: Фото → Поделиться → Параметры → формат «Совместимый» (JPEG)."
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
      await db.user.update({
        where: { id: userId },
        data: { avatar: url },
      });
      const updated = await loadProfileUser(userId);
      if (!updated) return reply.status(404).send({ error: "User not found" });
      return { user: publicProfile(updated), url };
    },
  );

  app.post(
    "/api/users/me/profile/banner",
    {
      onRequest: [requireJwt],
      bodyLimit: AVATAR_BODY_LIMIT,
      config: { rateLimit: { max: 10, timeWindow: 15 * 60 * 1000 } },
    },
    async (req, reply) => {
      const userId = getUserId(req);
      if (!userId) return reply.status(401).send({ error: "Unauthorized" });
      const parsed = uploadAvatarBody.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid body", details: parsed.error.flatten() });
      }
      const processed = await processProfileMedia(app, parsed.data, "banner");
      if ("error" in processed) {
        return reply.status(processed.status).send({
          error: processed.error,
        });
      }

      const existing = await db.user.findUnique({
        where: { id: userId },
        select: { profileBanner: true },
      });
      if (!existing) return reply.status(404).send({ error: "User not found" });
      const url = await persistProfileMedia(userId, "banner", processed.buffer);
      try {
        await db.user.update({ where: { id: userId }, data: { profileBanner: url } });
      } catch (error) {
        await deleteProfileMediaFile("banner", url);
        throw error;
      }
      await deleteProfileMediaFile("banner", existing.profileBanner);
      const updated = await loadProfileUser(userId);
      if (!updated) return reply.status(404).send({ error: "User not found" });
      return { user: publicProfile(updated), url };
    },
  );

  app.delete(
    "/api/users/me/profile/banner",
    { onRequest: [requireJwt] },
    async (req, reply) => {
      const userId = getUserId(req);
      if (!userId) return reply.status(401).send({ error: "Unauthorized" });
      const existing = await db.user.findUnique({
        where: { id: userId },
        select: { profileBanner: true },
      });
      if (!existing) return reply.status(404).send({ error: "User not found" });
      await db.user.update({ where: { id: userId }, data: { profileBanner: null } });
      await deleteProfileMediaFile("banner", existing.profileBanner);
      const updated = await loadProfileUser(userId);
      if (!updated) return reply.status(404).send({ error: "User not found" });
      return { user: publicProfile(updated) };
    },
  );

  app.post(
    "/api/users/me/profile/images",
    {
      onRequest: [requireJwt],
      bodyLimit: AVATAR_BODY_LIMIT,
      config: { rateLimit: { max: 16, timeWindow: 15 * 60 * 1000 } },
    },
    async (req, reply) => {
      const userId = getUserId(req);
      if (!userId) return reply.status(401).send({ error: "Unauthorized" });
      const parsed = uploadAvatarBody.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid body", details: parsed.error.flatten() });
      }
      const existing = await db.userProfileImage.findMany({
        where: { userId },
        select: { position: true },
        orderBy: { position: "desc" },
      });
      if (existing.length >= PROFILE_GALLERY_LIMIT) {
        return reply.status(409).send({
          error: `В профиле уже ${PROFILE_GALLERY_LIMIT} изображений. Удали одно, чтобы добавить новое.`,
        });
      }
      const processed = await processProfileMedia(app, parsed.data, "gallery");
      if ("error" in processed) {
        return reply.status(processed.status).send({
          error: processed.error,
        });
      }
      const url = await persistProfileMedia(userId, "gallery", processed.buffer);
      let galleryFull = false;
      try {
        await db.$transaction(async (tx) => {
          const current = await tx.userProfileImage.findMany({
            where: { userId },
            select: { position: true },
            orderBy: { position: "desc" },
          });
          if (current.length >= PROFILE_GALLERY_LIMIT) {
            galleryFull = true;
            return;
          }
          await tx.userProfileImage.create({
            data: {
              userId,
              url,
              position: (current[0]?.position ?? -1) + 1,
            },
          });
        }, { isolationLevel: "Serializable" });
      } catch (error) {
        await deleteProfileMediaFile("gallery", url);
        throw error;
      }
      if (galleryFull) {
        await deleteProfileMediaFile("gallery", url);
        return reply.status(409).send({
          error: `В профиле уже ${PROFILE_GALLERY_LIMIT} изображений. Удали одно, чтобы добавить новое.`,
        });
      }
      const updated = await loadProfileUser(userId);
      if (!updated) return reply.status(404).send({ error: "User not found" });
      return { user: publicProfile(updated), url };
    },
  );

  app.delete(
    "/api/users/me/profile/images/:imageId",
    { onRequest: [requireJwt] },
    async (req, reply) => {
      const userId = getUserId(req);
      if (!userId) return reply.status(401).send({ error: "Unauthorized" });
      const imageId = (req.params as { imageId?: string }).imageId;
      if (!imageId || imageId.length > 128) {
        return reply.status(400).send({ error: "Invalid image id" });
      }
      const image = await db.userProfileImage.findFirst({
        where: { id: imageId, userId },
      });
      if (!image) return reply.status(404).send({ error: "Image not found" });
      await db.userProfileImage.delete({ where: { id: image.id } });
      await deleteProfileMediaFile("gallery", image.url);
      const updated = await loadProfileUser(userId);
      if (!updated) return reply.status(404).send({ error: "User not found" });
      return { user: publicProfile(updated) };
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
      const statusUpdate = await db.user.update({
        where: { id: userId },
        data: { status: parsed.data.status },
      });
      // Broadcast change в socket — клиенты в member-list'ах обновят dot
      broadcastStatusChange(userId, parsed.data.status);
      const updated = await loadProfileUser(userId);
      if (!updated) return reply.status(404).send({ error: "User not found" });
      return { user: publicProfile(updated), status: statusUpdate.status };
    },
  );

  /**
   * v1.5.45 Discord-parity A3: PATCH /api/users/me/activity — set/clear
   * custom user status (text + emoji).
   *
   * Body { activityText?, activityEmoji? } — каждое optional + nullable:
   *   undefined → не меняем
   *   null → стираем (сохраняем NULL в БД)
   *   string → новое значение (trim'ится; empty-string-after-trim
   *            трактуется как null чтобы не оставлять "" в БД)
   *
   * Broadcast в server-rooms где user member — клиенты live обновляют
   * MemberList rows + DM list rows + own profile cache.
   *
   * Rate limit: 30 / 5 min — Discord activity Discord обновляется до
   * нескольких раз в час типично; жёсткий limit ловит спам-ботов
   * с минимальным impact'ом на нормальный UX.
   */
  app.patch(
    "/api/users/me/activity",
    {
      onRequest: [requireJwt],
      config: {
        rateLimit: { max: 30, timeWindow: 5 * 60 * 1000 },
      },
    },
    async (req, reply) => {
      const userId = getUserId(req);
      if (!userId) {
        return reply.status(401).send({ error: "Unauthorized" });
      }
      const parsed = updateActivityBody.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: "Invalid body",
          details: parsed.error.flatten(),
        });
      }
      const data: { activityText?: string | null; activityEmoji?: string | null } = {};
      if (parsed.data.activityText !== undefined) {
        if (parsed.data.activityText === null) {
          data.activityText = null;
        } else {
          const trimmed = parsed.data.activityText.trim();
          data.activityText = trimmed.length === 0 ? null : trimmed;
        }
      }
      if (parsed.data.activityEmoji !== undefined) {
        if (parsed.data.activityEmoji === null) {
          data.activityEmoji = null;
        } else {
          const trimmed = parsed.data.activityEmoji.trim();
          data.activityEmoji = trimmed.length === 0 ? null : trimmed;
        }
      }
      if (Object.keys(data).length === 0) {
        // Идемпотентный no-op — клиент прислал пустой body или только
        // undefined fields. Возвращаем current state без UPDATE.
        const user = await loadProfileUser(userId);
        if (!user) {
          return reply.status(404).send({ error: "User not found" });
        }
        return { user: publicProfile(user) };
      }
      const activityUpdate = await db.user.update({
        where: { id: userId },
        data,
      });
      broadcastActivityChange(userId, {
        activityText: activityUpdate.activityText,
        activityEmoji: activityUpdate.activityEmoji,
      });
      const updated = await loadProfileUser(userId);
      if (!updated) return reply.status(404).send({ error: "User not found" });
      return { user: publicProfile(updated) };
    },
  );

  /**
   * v1.5.49 Discord-parity B5: PATCH /api/users/me/quiet-hours.
   *
   * Set / clear quiet-hours window для skip'а push notifications.
   * Body { quietFrom?, quietTo?, timezone? } — каждое optional + nullable:
   *   - undefined → не меняем
   *   - null → сбрасываем
   *   - HH:MM string → новое значение (regex-validated)
   *   - IANA timezone string → runtime-validated через Intl.DateTimeFormat
   *
   * Idempotent no-op если все три undefined.
   *
   * Rate limit: 30 / 15 min — нечастая операция; ставит мягкий cap на
   * spam-bot scenarios.
   */
  app.patch(
    "/api/users/me/quiet-hours",
    {
      onRequest: [requireJwt],
      config: {
        rateLimit: { max: 30, timeWindow: 15 * 60 * 1000 },
      },
    },
    async (req, reply) => {
      const userId = getUserId(req);
      if (!userId) {
        return reply.status(401).send({ error: "Unauthorized" });
      }
      const parsed = updateQuietHoursBody.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: "Invalid body",
          details: parsed.error.flatten(),
        });
      }

      // Validate timezone runtime — IANA name должен быть acceptable для
      // Intl.DateTimeFormat. Invalid name throws RangeError.
      if (parsed.data.timezone !== undefined && parsed.data.timezone !== null) {
        try {
          new Intl.DateTimeFormat("en-GB", { timeZone: parsed.data.timezone });
        } catch {
          return reply.status(400).send({ error: "Invalid timezone (IANA name expected)" });
        }
      }

      const data: { quietFrom?: string | null; quietTo?: string | null; timezone?: string | null } = {};
      if (parsed.data.quietFrom !== undefined) data.quietFrom = parsed.data.quietFrom;
      if (parsed.data.quietTo !== undefined) data.quietTo = parsed.data.quietTo;
      if (parsed.data.timezone !== undefined) data.timezone = parsed.data.timezone;

      if (Object.keys(data).length === 0) {
        const user = await loadProfileUser(userId);
        if (!user) {
          return reply.status(404).send({ error: "User not found" });
        }
        return { user: publicProfile(user) };
      }
      await db.user.update({
        where: { id: userId },
        data,
      });
      const updated = await loadProfileUser(userId);
      if (!updated) return reply.status(404).send({ error: "User not found" });
      return { user: publicProfile(updated) };
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
      await db.user.update({
        where: { id: userId },
        data: { avatar: null },
      });
      const updated = await loadProfileUser(userId);
      if (!updated) return reply.status(404).send({ error: "User not found" });
      return { user: publicProfile(updated) };
    },
  );
}
