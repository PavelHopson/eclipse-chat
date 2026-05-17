/**
 * Extract first http(s) URL из message content (v0.67).
 *
 * Используется в MessageList чтобы понять, надо ли рендерить
 * LinkEmbedCard под сообщением. Один URL per message — preview
 * card занимает место, не делаем гирлянду.
 *
 * Regex синхронизирован с RichContent.tsx TOKEN_RE — что
 * подсвечивается как auto-link, то и идёт в preview.
 *
 * Возвращает null если URL не найден или явно short-circuit
 * mention (например `@example.com` — это mention pattern,
 * не link).
 */

const URL_RE = /https?:\/\/[^\s<>"')]+/i;

/**
 * Не превью'им trivially-internal/asset URLs — нет смысла fetch'ить
 * own привью own attachments или localhost.
 */
const SKIP_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
]);

export function extractFirstUrl(content: string): string | null {
  if (!content) return null;
  const m = URL_RE.exec(content);
  if (!m) return null;
  // Trim trailing punctuation которое URL_RE захватил
  // (regex намеренно не super-strict — RichContent рендерит auto-link
  // тем же pattern, consistency важнее точности границ).
  let url = m[0].replace(/[.,;:!?)\]}'"`]+$/, "");
  if (!url) return null;

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    if (SKIP_HOSTS.has(parsed.hostname.toLowerCase())) return null;
    // Skip own assets — наш собственный path /eclipse-chat/uploads/...
    if (parsed.pathname.startsWith("/eclipse-chat/uploads/")) return null;
    return url;
  } catch {
    return null;
  }
}
