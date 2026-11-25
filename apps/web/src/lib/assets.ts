/**
 * Resolve backend-provided asset paths for path-based deploys.
 *
 * Backend stores uploads as `/uploads/...`; production frontend lives under
 * `/eclipse-chat/`, so browser URLs must become `/eclipse-chat/uploads/...`.
 *
 * 00-144: вложения сообщений (`/uploads/attachments/<file>`) и файлы
 * обучающей библиотеки (`/uploads/training-videos/<file>`) больше не
 * публичная статика. Браузер получает их через `/api/attachments/...`:
 * сервер проверяет HttpOnly media-cookie и текущее членство на каждом
 * запросе (см. apps/server/src/routes/attachmentMedia.ts,
 * useMediaSessionKeeper).
 */
const PRIVATE_UPLOAD_ROUTES: ReadonlyArray<readonly [string, string]> = [
  ["/uploads/attachments/", "/api/attachments/media/"],
  ["/uploads/training-videos/", "/api/attachments/training-videos/"],
];

export function resolveAssetUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  if (/^(https?:|data:|blob:)/i.test(raw)) return raw;

  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  let path = raw.startsWith("/") ? raw : `/${raw}`;
  if (base && path === base) return path;
  if (base && path.startsWith(`${base}/`)) path = path.slice(base.length);

  for (const [publicPrefix, privatePrefix] of PRIVATE_UPLOAD_ROUTES) {
    if (!path.startsWith(publicPrefix)) continue;
    const file = path.slice(publicPrefix.length);
    // Файл — один сегмент пути; всё остальное не наш файл.
    if (file && !file.includes("/")) path = `${privatePrefix}${file}`;
    break;
  }

  return `${base}${path}`;
}
