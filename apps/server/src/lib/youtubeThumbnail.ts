import { promises as fs } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtu.be",
  "www.youtu.be",
]);

const VIDEO_ID_RE = /^[a-zA-Z0-9_-]{11}$/;
const MAX_SOURCE_BYTES = 3 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 8_000;
const PROVIDER_RETRY_MS = 5 * 60 * 1_000;
const inFlight = new Map<string, Promise<Buffer>>();
const providerRetryAt = new WeakMap<typeof fetch, number>();
let upstreamTail: Promise<void> = Promise.resolve();

export class YouTubeThumbnailProviderUnavailableError extends Error {
  readonly retryAfterSeconds: number;

  constructor(retryAfterSeconds: number, options?: ErrorOptions) {
    super("YouTube thumbnail provider is temporarily unavailable", options);
    this.name = "YouTubeThumbnailProviderUnavailableError";
    this.retryAfterSeconds = Math.max(1, Math.ceil(retryAfterSeconds));
  }
}

function cleanVideoId(value: string | null): string | null {
  if (!value) return null;
  const id = value.trim().split(/[?&#/]/)[0] ?? "";
  return VIDEO_ID_RE.test(id) ? id : null;
}

export function parseYouTubeVideoId(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    const host = url.hostname.toLowerCase().replace(/\.$/, "");
    if (!YOUTUBE_HOSTS.has(host)) return null;

    if (host === "youtu.be" || host === "www.youtu.be") {
      return cleanVideoId(url.pathname.replace(/^\/+/, ""));
    }
    if (url.pathname === "/watch") {
      return cleanVideoId(url.searchParams.get("v"));
    }
    const parts = url.pathname.split("/").filter(Boolean);
    return ["embed", "shorts", "live"].includes(parts[0] ?? "")
      ? cleanVideoId(parts[1] ?? null)
      : null;
  } catch {
    return null;
  }
}

export function isYouTubeVideoId(value: string): boolean {
  return VIDEO_ID_RE.test(value);
}

function thumbnailCacheDir(): string {
  const base = process.env.UPLOADS_DIR ?? "./uploads";
  return path.join(base, "youtube-thumbnails");
}

async function readLimitedBody(response: Response): Promise<Buffer> {
  const declaredLength = Number(response.headers.get("content-length") ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_SOURCE_BYTES) {
    throw new Error("YouTube thumbnail exceeds the allowed size");
  }
  if (!response.body) throw new Error("YouTube thumbnail response is empty");

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_SOURCE_BYTES) {
        await reader.cancel();
        throw new Error("YouTube thumbnail exceeds the allowed size");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  if (total === 0) throw new Error("YouTube thumbnail response is empty");
  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)), total);
}

async function fetchThumbnailUpstream(videoId: string, fetchImpl: typeof fetch): Promise<Response> {
  const previous = upstreamTail;
  let release = () => {};
  upstreamTail = new Promise<void>((resolve) => {
    release = resolve;
  });
  await previous;

  try {
    const now = Date.now();
    const retryAt = providerRetryAt.get(fetchImpl) ?? 0;
    if (retryAt > now) {
      throw new YouTubeThumbnailProviderUnavailableError((retryAt - now) / 1_000);
    }

    try {
      const response = await fetchImpl(`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`, {
        headers: { Accept: "image/avif,image/webp,image/jpeg" },
        redirect: "error",
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (response.ok) {
        providerRetryAt.delete(fetchImpl);
        return response;
      }
      if (response.status === 403 || response.status === 429 || response.status >= 500) {
        providerRetryAt.set(fetchImpl, Date.now() + PROVIDER_RETRY_MS);
        throw new YouTubeThumbnailProviderUnavailableError(PROVIDER_RETRY_MS / 1_000);
      }
      throw new Error(`YouTube thumbnail upstream returned ${response.status}`);
    } catch (error) {
      if (error instanceof YouTubeThumbnailProviderUnavailableError || error instanceof Error && error.message.startsWith("YouTube thumbnail upstream returned")) {
        throw error;
      }
      providerRetryAt.set(fetchImpl, Date.now() + PROVIDER_RETRY_MS);
      throw new YouTubeThumbnailProviderUnavailableError(PROVIDER_RETRY_MS / 1_000, {
        cause: error,
      });
    }
  } finally {
    release();
  }
}

export type YouTubeThumbnailOptions = {
  cacheDir?: string;
  fetchImpl?: typeof fetch;
};

export async function loadYouTubeThumbnail(
  videoId: string,
  options: YouTubeThumbnailOptions = {},
): Promise<Buffer> {
  if (!isYouTubeVideoId(videoId)) throw new Error("Invalid YouTube video id");
  const cacheDir = options.cacheDir ?? thumbnailCacheDir();
  const cachePath = path.join(cacheDir, `${videoId}.webp`);

  try {
    return await fs.readFile(cachePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }

  const key = `${cacheDir}:${videoId}`;
  const existing = inFlight.get(key);
  if (existing) return existing;

  const task = (async () => {
    const fetchImpl = options.fetchImpl ?? fetch;
    const response = await fetchThumbnailUpstream(videoId, fetchImpl);
    const contentType = (response.headers.get("content-type") ?? "").toLowerCase();
    if (!contentType.startsWith("image/jpeg") && !contentType.startsWith("image/webp")) {
      throw new Error("YouTube thumbnail upstream returned an unsupported content type");
    }

    const source = await readLimitedBody(response);
    const encoded = await sharp(source, { failOn: "error", limitInputPixels: 16_777_216 })
      .resize(640, 360, { fit: "cover", position: "centre", withoutEnlargement: true })
      .webp({ quality: 84, effort: 4 })
      .toBuffer();

    await fs.mkdir(cacheDir, { recursive: true });
    const temporaryPath = `${cachePath}.${process.pid}.${Date.now()}.tmp`;
    await fs.writeFile(temporaryPath, encoded, { flag: "wx" });
    try {
      await fs.rename(temporaryPath, cachePath);
    } catch (error) {
      await fs.rm(temporaryPath, { force: true });
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    }
    return encoded;
  })();

  inFlight.set(key, task);
  try {
    return await task;
  } finally {
    inFlight.delete(key);
  }
}
