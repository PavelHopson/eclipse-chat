/**
 * Attachment storage helper.
 *
 * Base64-pattern (как с avatars в v0.5 Step 2): клиент шлёт inline
 * `{ filename, mimeType, dataBase64 }`, backend декодирует, валидирует
 * mime/size, для images делает sharp thumbnail 512×512, кладёт всё на
 * disk в `UPLOADS_DIR/attachments/`, возвращает Attachment-row data.
 *
 * Лимиты:
 *   - 25 MB per attachment (поднимается через бoldyLimit per route)
 *   - До 10 attachments per message (по zod-схеме в channels.ts POST)
 *   - Allowed MIME: image/jpeg|png|webp|gif, application/pdf, text/plain
 *     (расширить — отдельным изменением)
 *
 * Будущая v0.10+ Files API через MinIO + presigned URLs может переписать
 * этот модуль на S3 SDK без изменения public API.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import sharp from "sharp";

export const ATTACHMENT_MAX_BYTES = 25 * 1024 * 1024;
export const ATTACHMENTS_PER_MESSAGE = 10;
/** body limit учитывает base64 overhead ~33% + JSON envelope */
export const MESSAGE_BODY_LIMIT_WITH_ATTACHMENTS = 200 * 1024 * 1024;

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
  "text/plain",
]);

const IMAGE_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
/** Для images > этого порога — рендерим thumbnail 512×512 webp. */
const THUMBNAIL_THRESHOLD = 512;

export type AttachmentInput = {
  filename: string;
  mimeType: string;
  dataBase64: string;
};

export type ProcessedAttachment = {
  filename: string;
  mimeType: string;
  size: number;
  url: string;
  width: number | null;
  height: number | null;
  thumbnailUrl: string | null;
  position: number;
};

function attachmentsDir(): string {
  const base = process.env.UPLOADS_DIR ?? "./uploads";
  return path.join(base, "attachments");
}

/** Относительный URL под который положены файлы. Frontend prefixит BASE_URL. */
function attachmentUrl(filename: string): string {
  return `/uploads/attachments/${filename}`;
}

/**
 * Sanitize имени файла: убираем path-traversal и control chars, оставляем
 * базу без расширения. Расширение восстанавливается из mime.
 */
function sanitizeFilename(raw: string): string {
  const base = path
    .basename(raw)
    .replace(/[^a-zA-Z0-9_.\-]/g, "_")
    .slice(0, 80);
  return base || "file";
}

function extFromMime(mime: string): string {
  switch (mime) {
    case "image/jpeg": return "jpg";
    case "image/png":  return "png";
    case "image/webp": return "webp";
    case "image/gif":  return "gif";
    case "application/pdf": return "pdf";
    case "text/plain": return "txt";
    default: return "bin";
  }
}

/**
 * Обработать один attachment: validate, decode, sharp-resize если image >
 * threshold, write на disk, вернуть row data для Prisma.
 *
 * Throws Error с user-friendly message при failure (caller рендерит 400/413).
 */
export async function processAttachment(
  input: AttachmentInput,
  messageId: string,
  position: number,
): Promise<ProcessedAttachment> {
  if (!ALLOWED_MIME.has(input.mimeType)) {
    throw new Error(`Unsupported mime type: ${input.mimeType}`);
  }
  const buf = Buffer.from(input.dataBase64, "base64");
  if (buf.length === 0) {
    throw new Error("Empty attachment");
  }
  if (buf.length > ATTACHMENT_MAX_BYTES) {
    throw new Error(`Attachment too large (max ${Math.round(ATTACHMENT_MAX_BYTES / 1024 / 1024)}MB)`);
  }

  const dir = attachmentsDir();
  await fs.mkdir(dir, { recursive: true });

  const ext = extFromMime(input.mimeType);
  const baseName = sanitizeFilename(input.filename);
  const filename = `${messageId}-${position}-${Date.now()}-${baseName}.${ext}`;
  const fullPath = path.join(dir, filename);

  let width: number | null = null;
  let height: number | null = null;
  let thumbnailUrl: string | null = null;
  let finalBytes = buf;

  if (IMAGE_MIME.has(input.mimeType) && input.mimeType !== "image/gif") {
    // Для статичных изображений: получим metadata + сделаем thumbnail
    // если > THUMBNAIL_THRESHOLD.
    try {
      const meta = await sharp(buf).metadata();
      width = meta.width ?? null;
      height = meta.height ?? null;
      if (width && height && (width > THUMBNAIL_THRESHOLD || height > THUMBNAIL_THRESHOLD)) {
        const thumb = await sharp(buf)
          .rotate()
          .resize(THUMBNAIL_THRESHOLD, THUMBNAIL_THRESHOLD, {
            fit: "inside",
            withoutEnlargement: true,
          })
          .webp({ quality: 82 })
          .toBuffer();
        const thumbFilename = `${messageId}-${position}-${Date.now()}-thumb.webp`;
        await fs.writeFile(path.join(dir, thumbFilename), thumb);
        thumbnailUrl = attachmentUrl(thumbFilename);
      }
    } catch {
      // sharp может не справиться с экзотическими форматами — fall through
    }
  } else if (input.mimeType === "image/gif") {
    // GIF — пишем как есть, sharp animated workflow не оптимизируем (anim
    // легко портится при resize). Width/height не вытаскиваем.
  }

  await fs.writeFile(fullPath, finalBytes);

  return {
    filename: baseName,
    mimeType: input.mimeType,
    size: finalBytes.length,
    url: attachmentUrl(filename),
    width,
    height,
    thumbnailUrl,
    position,
  };
}

/**
 * Best-effort cleanup files на disk при delete message / attachment.
 * Тихо ignore'ит ошибки — orphan file не critical, основной cleanup
 * через периодический task (TODO v1.x).
 */
export async function unlinkAttachmentFiles(urls: (string | null | undefined)[]): Promise<void> {
  const dir = attachmentsDir();
  await Promise.all(
    urls
      .filter((u): u is string => Boolean(u))
      .map(async (u) => {
        const name = path.basename(u);
        if (!name) return;
        await fs.unlink(path.join(dir, name)).catch(() => undefined);
      }),
  );
}
