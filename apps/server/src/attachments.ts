/**
 * Attachment storage helper.
 *
 * Base64-pattern (как с avatars в v0.5 Step 2): клиент шлёт inline
 * `{ filename, mimeType, dataBase64 }`, backend декодирует, валидирует
 * mime/size + magic-bytes, для images делает sharp thumbnail 512×512,
 * кладёт всё на disk в `UPLOADS_DIR/attachments/`, возвращает Attachment-
 * row data.
 *
 * Лимиты:
 *   - 50 MB по умолчанию, 200 MB для video/* (config-driven)
 *   - До 10 attachments per message (по zod-схеме в channels.ts POST)
 *   - Allowed MIME: широкий — images, documents (Office), архивы, video,
 *     audio. Полный список ниже в ALLOWED_MIME.
 *   - Magic-bytes sniffing: клиент-объявленный mime сверяется с актуальной
 *     сигнатурой буфера, чтобы нельзя было залить .exe под видом image/png.
 *
 * Будущая v0.10+ Files API через MinIO + presigned URLs может переписать
 * этот модуль на S3 SDK без изменения public API.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import sharp from "sharp";

/**
 * Базовый размер (фото/документы/архивы/аудио). 50 MB достаточно для:
 * iPhone 15 raw photo (~18 MB), x-ray PDF (~30 MB), rar архивы с
 * исходниками. Видео получает отдельный, увеличенный cap (см. ниже).
 */
export const ATTACHMENT_MAX_BYTES = 50 * 1024 * 1024;
/**
 * Для video/*: 200 MB. Покрывает phone-captured 4K 60s clip (~150 MB)
 * без принудительной транскодировки на клиенте. Sync с nginx
 * `client_max_body_size` (см. deploy/nginx/eclipse-chat.conf — поднят
 * до 900m чтобы вместить base64-envelope: 200 MB * 1.34 + JSON ≈ 268 MB
 * на видео, ещё с запасом под параллельные attachments).
 */
export const ATTACHMENT_MAX_BYTES_VIDEO = 200 * 1024 * 1024;
export const ATTACHMENTS_PER_MESSAGE = 10;
/** body limit учитывает base64 overhead ~34% + JSON envelope + 10 attachments. */
export const MESSAGE_BODY_LIMIT_WITH_ATTACHMENTS = 900 * 1024 * 1024;

/**
 * Allowed MIME — широкий operational набор: images (10 типов вкл. HEIC/
 * AVIF/TIFF), Office (docx/xlsx/pptx/odt/csv), архивы (zip/rar/7z/tar/gz),
 * video (mp4/webm/mov/mkv/avi), audio (mp3/wav/ogg/webm), PDF/JSON/text.
 * Каждый тип проверяется на magic-bytes — клиент-объявленный mime ничего
 * не значит, если первые байты не совпадают с сигнатурой формата.
 *
 * SVG включён, но обрабатывается осторожно: text-based, может содержать
 * <script>. Frontend никогда не рендерит SVG inline (использует <img src>
 * который выключает active content).
 */
const ALLOWED_MIME = new Set([
  // Images
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
  "image/heic",
  "image/heif",
  "image/bmp",
  "image/tiff",
  "image/svg+xml",
  // Documents
  "application/pdf",
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/json",
  // Office (Open XML)
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // docx
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // xlsx
  "application/vnd.openxmlformats-officedocument.presentationml.presentation", // pptx
  // OpenDocument
  "application/vnd.oasis.opendocument.text", // odt
  "application/vnd.oasis.opendocument.spreadsheet", // ods
  "application/vnd.oasis.opendocument.presentation", // odp
  // Archives
  "application/zip",
  "application/x-rar-compressed",
  "application/vnd.rar",
  "application/x-7z-compressed",
  "application/x-tar",
  "application/gzip",
  "application/x-bzip2",
  // Video
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-matroska",
  "video/x-msvideo",
  // Audio
  "audio/mpeg",
  "audio/wav",
  "audio/x-wav",
  "audio/ogg",
  "audio/webm",
  "audio/mp4",
  "audio/aac",
]);

const IMAGE_MIME = new Set([
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

/**
 * Возвращает per-mime size cap. Видео имеет повышенный лимит, всё остальное —
 * 50 MB default. Используется в processAttachment для validation и в
 * sizeLimitFor() ниже для frontend message budget calculation.
 */
function sizeLimitFor(mime: string): number {
  if (mime.startsWith("video/")) return ATTACHMENT_MAX_BYTES_VIDEO;
  return ATTACHMENT_MAX_BYTES;
}
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
    case "image/avif": return "avif";
    case "image/heic": return "heic";
    case "image/heif": return "heif";
    case "image/bmp":  return "bmp";
    case "image/tiff": return "tiff";
    case "image/svg+xml": return "svg";
    case "application/pdf": return "pdf";
    case "text/plain": return "txt";
    case "text/markdown": return "md";
    case "text/csv": return "csv";
    case "application/json": return "json";
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document": return "docx";
    case "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": return "xlsx";
    case "application/vnd.openxmlformats-officedocument.presentationml.presentation": return "pptx";
    case "application/vnd.oasis.opendocument.text": return "odt";
    case "application/vnd.oasis.opendocument.spreadsheet": return "ods";
    case "application/vnd.oasis.opendocument.presentation": return "odp";
    case "application/zip": return "zip";
    case "application/x-rar-compressed":
    case "application/vnd.rar": return "rar";
    case "application/x-7z-compressed": return "7z";
    case "application/x-tar": return "tar";
    case "application/gzip": return "gz";
    case "application/x-bzip2": return "bz2";
    case "video/mp4": return "mp4";
    case "video/webm": return "webm";
    case "video/quicktime": return "mov";
    case "video/x-matroska": return "mkv";
    case "video/x-msvideo": return "avi";
    case "audio/mpeg": return "mp3";
    case "audio/wav":
    case "audio/x-wav": return "wav";
    case "audio/ogg": return "ogg";
    case "audio/webm": return "weba";
    case "audio/mp4": return "m4a";
    case "audio/aac": return "aac";
    default: return "bin";
  }
}

/**
 * Magic-bytes sniffer.
 *
 * Возвращает grouped format-family, который физически соответствует
 * содержимому буфера. Если клиент объявил `image/png`, но первые байты
 * = `MZ` (Windows PE), sniff вернёт "pe" → isMimeConsistent() returns
 * false → upload отклоняется 415.
 *
 * Family-grouping (не точный mime) выбран чтобы избежать сложного
 * unzip-распознавания docx vs xlsx vs pptx (они все ZIP под капотом).
 * Достаточно убедиться что .docx это zip-контейнер, а не маскирующийся
 * исполняемый файл. Тонкая typing'а делается через original mime + ext.
 *
 * Edge case — text-based форматы (svg/txt/md/csv/json): нет magic bytes.
 * Для них возвращаем "text" — sniff соглашается, если буфер выглядит как
 * UTF-8/ASCII (нет null-байтов в первых 256 байтах).
 */
type SniffFamily =
  | "jpeg" | "png" | "webp" | "gif" | "bmp" | "tiff" | "heif" | "avif"
  | "pdf"
  | "zip" // .zip / .docx / .xlsx / .pptx / .odt / .ods / .odp / .jar
  | "rar" | "sevenz" | "tar" | "gzip" | "bzip2"
  | "mp4" // .mp4 / .mov / .m4a / audio/mp4
  | "webm" // .webm / .mkv (Matroska container)
  | "avi"
  | "mp3" | "wav" | "ogg" | "flac"
  | "text"
  | "unknown";

export function sniffMime(buf: Buffer): SniffFamily {
  if (buf.length < 4) return "unknown";
  const b = buf;
  // Images
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpeg";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "png";
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38) return "gif";
  if (b[0] === 0x42 && b[1] === 0x4d) return "bmp";
  if (b.length >= 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46) {
    // RIFF container: WEBP | WAV | AVI by tag at offset 8.
    const tag = b.slice(8, 12).toString("ascii");
    if (tag === "WEBP") return "webp";
    if (tag === "WAVE") return "wav";
    if (tag === "AVI ") return "avi";
  }
  if (
    (b[0] === 0x49 && b[1] === 0x49 && b[2] === 0x2a && b[3] === 0x00) ||
    (b[0] === 0x4d && b[1] === 0x4d && b[2] === 0x00 && b[3] === 0x2a)
  ) return "tiff";
  // HEIC/AVIF/MP4/MOV/M4A — все ISO Base Media (offset 4-7 = "ftyp")
  if (
    b.length >= 12 &&
    b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70
  ) {
    const brand = b.slice(8, 12).toString("ascii");
    if (brand.startsWith("heic") || brand.startsWith("heix") || brand.startsWith("mif1") || brand.startsWith("hevc")) {
      return "heif";
    }
    if (brand.startsWith("avif") || brand.startsWith("avis")) return "avif";
    // Остальные ftyp-варианты — mp4-family (mp4, mov, m4a, m4v).
    return "mp4";
  }
  // PDF
  if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) return "pdf";
  // ZIP family (zip / docx / xlsx / pptx / odt / ods / odp / jar). PK\x03\x04.
  if (b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04) return "zip";
  // Также zip-with-spanning (empty / spanned archive) — редко, но допустим.
  if (b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x05 && b[3] === 0x06) return "zip";
  // RAR (v1.5+ или v5.0+)
  if (b.length >= 7 && b[0] === 0x52 && b[1] === 0x61 && b[2] === 0x72 && b[3] === 0x21 && b[4] === 0x1a && b[5] === 0x07) {
    return "rar";
  }
  // 7z
  if (
    b.length >= 6 &&
    b[0] === 0x37 && b[1] === 0x7a && b[2] === 0xbc && b[3] === 0xaf && b[4] === 0x27 && b[5] === 0x1c
  ) return "sevenz";
  // gzip
  if (b[0] === 0x1f && b[1] === 0x8b) return "gzip";
  // bzip2
  if (b[0] === 0x42 && b[1] === 0x5a && b[2] === 0x68) return "bzip2";
  // tar — ustar magic в offset 257 (если файл достаточно большой)
  if (
    b.length >= 263 &&
    b[257] === 0x75 && b[258] === 0x73 && b[259] === 0x74 && b[260] === 0x61 && b[261] === 0x72
  ) return "tar";
  // Matroska / WebM
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return "webm";
  // Ogg
  if (b[0] === 0x4f && b[1] === 0x67 && b[2] === 0x67 && b[3] === 0x53) return "ogg";
  // FLAC
  if (b[0] === 0x66 && b[1] === 0x4c && b[2] === 0x61 && b[3] === 0x43) return "flac";
  // MP3 — ID3v2 header или MPEG frame sync
  if (b[0] === 0x49 && b[1] === 0x44 && b[2] === 0x33) return "mp3";
  if (b[0] === 0xff && (b[1] & 0xe0) === 0xe0) return "mp3";
  // Text-based: предполагаем utf-8 ASCII, если нет null-байтов в первых 256.
  const sample = b.slice(0, Math.min(256, b.length));
  let hasNull = false;
  for (let i = 0; i < sample.length; i++) {
    if (sample[i] === 0) { hasNull = true; break; }
  }
  if (!hasNull) return "text";
  return "unknown";
}

/**
 * Совместим ли клиент-объявленный mime с распознанной family-сигнатурой?
 *
 * Логика: для каждого MIME-типа есть набор допустимых sniff-семейств.
 * Например image/jpeg → ["jpeg"]; application/vnd.oasis.opendocument.text →
 * ["zip"] (ODF == zip); video/mp4 → ["mp4"]; audio/mp4 → ["mp4"] (тот же
 * контейнер).
 *
 * Если клиент отправил text/plain — sniff "text" совпадает. Если отправил
 * application/json, sniff "text" совпадает (json — это plain text). И так
 * далее.
 *
 * Возвращает false если sniff пришёл "unknown" — это значит мы не смогли
 * распознать формат, и мы предпочитаем reject, а не trust.
 */
export function isMimeConsistent(mime: string, sniffed: SniffFamily): boolean {
  if (sniffed === "unknown") return false;
  const allowed = MIME_TO_FAMILY[mime];
  if (!allowed) return false; // mime не в whitelist'е
  return allowed.includes(sniffed);
}

const MIME_TO_FAMILY: Record<string, SniffFamily[]> = {
  // Images
  "image/jpeg": ["jpeg"],
  "image/png":  ["png"],
  "image/webp": ["webp"],
  "image/gif":  ["gif"],
  "image/bmp":  ["bmp"],
  "image/tiff": ["tiff"],
  "image/avif": ["avif", "heif"], // некоторые AVIF файлы имеют ftyp=mif1
  "image/heic": ["heif"],
  "image/heif": ["heif"],
  "image/svg+xml": ["text"],
  // Documents
  "application/pdf": ["pdf"],
  "text/plain":     ["text"],
  "text/markdown":  ["text"],
  "text/csv":       ["text"],
  "application/json": ["text"],
  // Office (Open XML and ODF — все ZIP-контейнеры)
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ["zip"],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ["zip"],
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": ["zip"],
  "application/vnd.oasis.opendocument.text": ["zip"],
  "application/vnd.oasis.opendocument.spreadsheet": ["zip"],
  "application/vnd.oasis.opendocument.presentation": ["zip"],
  // Archives
  "application/zip":              ["zip"],
  "application/x-rar-compressed": ["rar"],
  "application/vnd.rar":          ["rar"],
  "application/x-7z-compressed":  ["sevenz"],
  "application/x-tar":            ["tar", "gzip"], // tar.gz часто шлётся как x-tar
  "application/gzip":             ["gzip"],
  "application/x-bzip2":          ["bzip2"],
  // Video
  "video/mp4":         ["mp4"],
  "video/webm":        ["webm"],
  "video/quicktime":   ["mp4"], // QuickTime тоже ISO BMFF
  "video/x-matroska":  ["webm"],
  "video/x-msvideo":   ["avi"],
  // Audio
  "audio/mpeg": ["mp3"],
  "audio/wav":  ["wav"],
  "audio/x-wav": ["wav"],
  "audio/ogg":  ["ogg"],
  "audio/webm": ["webm"],
  "audio/mp4":  ["mp4"],
  "audio/aac":  ["mp4", "mp3"], // raw AAC может приходить как mp3-frame-sync
};

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
  const limit = sizeLimitFor(input.mimeType);
  if (buf.length > limit) {
    throw new Error(`Attachment too large (max ${Math.round(limit / 1024 / 1024)}MB)`);
  }
  // Magic-bytes preflight: клиент не может «обмануть» mime — содержимое
  // буфера должно соответствовать заявленному типу. Без этого можно было
  // бы загрузить .exe под видом image/png и хранить на сервере.
  const sniffed = sniffMime(buf);
  if (!isMimeConsistent(input.mimeType, sniffed)) {
    throw new Error(
      `Attachment content does not match declared type ${input.mimeType} (detected: ${sniffed})`,
    );
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
    // если > THUMBNAIL_THRESHOLD. failOn:"none" — толерантнее к minor JPEG
    // warnings; HEIC/AVIF попытается, если libheif/libaom доступны.
    try {
      const meta = await sharp(buf, { failOn: "none" }).metadata();
      width = meta.width ?? null;
      height = meta.height ?? null;
      if (width && height && (width > THUMBNAIL_THRESHOLD || height > THUMBNAIL_THRESHOLD)) {
        const thumb = await sharp(buf, { failOn: "none" })
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

      // Для HEIC/HEIF/AVIF/TIFF/BMP — конвертируем original в JPEG, чтобы
      // фронт точно мог отрендерить (browsers HEIC не показывают).
      // Webp оставим только для thumbnail; full-size берём jpeg q=90.
      const NEEDS_CONVERSION = new Set([
        "image/heic",
        "image/heif",
        "image/avif",
        "image/tiff",
        "image/bmp",
      ]);
      if (NEEDS_CONVERSION.has(input.mimeType)) {
        try {
          const converted = await sharp(buf, { failOn: "none" })
            .rotate()
            .jpeg({ quality: 90 })
            .toBuffer();
          finalBytes = Buffer.from(converted);
          // mime override — для DB row mime будет input.mimeType, но
          // url-расширение jpg чтобы browser корректно отрендерил.
          // (Браузер игнорит mime в `<img>`, читает magic bytes; jpg-extension
          // помогает только nginx mime-detect, который для inline img не критичен.)
        } catch (convErr) {
          // если не получилось — оставим original buf
        }
      }
    } catch {
      // sharp вообще упал — fall through, файл сохранится как есть, UI
      // покажет attachment chip вместо preview (graceful degradation).
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
