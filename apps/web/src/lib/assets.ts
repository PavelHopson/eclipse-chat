/**
 * Resolve backend-provided asset paths for path-based deploys.
 *
 * Backend stores uploads as `/uploads/...`; production frontend lives under
 * `/eclipse-chat/`, so browser URLs must become `/eclipse-chat/uploads/...`.
 */
export function resolveAssetUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  if (/^(https?:|data:|blob:)/i.test(raw)) return raw;

  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  const path = raw.startsWith("/") ? raw : `/${raw}`;

  if (!base) return path;
  if (path === base || path.startsWith(`${base}/`)) return path;
  return `${base}${path}`;
}
