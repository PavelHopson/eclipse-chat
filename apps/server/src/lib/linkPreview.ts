/**
 * Link preview fetcher (v0.67).
 *
 * Server-side fetch URL → parse OG meta tags → cache в БД на 7 дней.
 * Used by GET /api/embeds/preview?url=
 *
 * # SSRF protection (главный risk этой фичи)
 *
 * User присылает URL, мы fetch с сервера. Naive impl позволит:
 *   - http://localhost:6379/ — Redis Spring4Shell-style probing
 *   - http://10.0.0.1/admin — internal hosts
 *   - http://169.254.169.254/ — AWS metadata service (если бы был AWS)
 *
 * Защиты в этом модуле:
 *   1. Только http/https schemes (no file://, gopher://, etc).
 *   2. Hostname → DNS resolve(A + AAAA) → check каждый IP не из private
 *      ranges (RFC 1918, loopback, link-local, multicast, reserved).
 *      Если хоть один IP private — reject (защита от DNS rebinding
 *      partial — first lookup может вернуть public IP, follow-up
 *      private; fetch использует socket-level lookup, не resolve'нный
 *      IP, поэтому защита неполная, но base case закрыт).
 *   3. Timeout 8s через AbortController.
 *   4. Max body 5 MB (preview хватит первых ~256KB для всех meta).
 *   5. Content-Type должен начинаться с text/html (no PDF / image
 *      preview tries — slishком easy abuse).
 *   6. Redirects max 5, каждый чекается через тот же scheme/IP check.
 *
 * # Cache
 *
 * Upsert в LinkEmbed table per normalizedUrl. TTL OK=7 days,
 * FAILED=24 hours (чтобы bad URL не долбили repeatedly).
 *
 * # OG parsing
 *
 * Regex-based, без HTML parser deps. Достаточно для 95% сайтов
 * (Twitter / GitHub / Medium / habr / lenta / etc). Fragile к
 * weird HTML, но если parser fall — fallback на <title> и hostname.
 */

import { lookup as dnsLookup } from "node:dns/promises";
import { db } from "../db.js";

const FETCH_TIMEOUT_MS = 8_000;
const MAX_BODY_BYTES = 5 * 1024 * 1024; // 5 MB
const TTL_OK_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const TTL_FAILED_MS = 24 * 60 * 60 * 1000; // 24 hours
const MAX_REDIRECTS = 5;

const USER_AGENT =
  "EclipseChat-LinkPreview/0.67 (+https://app.star-crm.ru/eclipse-chat/)";

export type LinkPreview = {
  url: string;
  status: "OK" | "FAILED";
  title: string | null;
  description: string | null;
  image: string | null;
  siteName: string | null;
};

/**
 * Нормализация URL: lower-case host, удаление fragment'а. Keep query
 * (часть OG-карточек зависит от ?utm_source=X). Возвращает null если
 * URL невалидный.
 */
export function normalizeUrl(raw: string): string | null {
  try {
    const u = new URL(raw);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    u.hash = "";
    u.hostname = u.hostname.toLowerCase();
    // Strip default ports
    if (
      (u.protocol === "http:" && u.port === "80") ||
      (u.protocol === "https:" && u.port === "443")
    ) {
      u.port = "";
    }
    return u.toString();
  } catch {
    return null;
  }
}

/**
 * Проверка IPv4/IPv6 — это private / loopback / link-local / multicast /
 * reserved (т.е. не safe для fetch'а пользовательского URL).
 *
 * IPv4 private ranges (RFC 1918):
 *   10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16
 * + loopback 127.0.0.0/8
 * + link-local 169.254.0.0/16 (включает AWS metadata!)
 * + multicast 224.0.0.0/4
 * + reserved 240.0.0.0/4
 * + 0.0.0.0/8 (this network)
 *
 * IPv6:
 *   ::1 loopback, fc00::/7 ULA, fe80::/10 link-local, ff00::/8 multicast,
 *   ::ffff:0:0/96 IPv4-mapped (нужно проверять wrapped IPv4 тоже)
 */
function isPrivateAddress(ip: string): boolean {
  // IPv4-mapped IPv6: ::ffff:127.0.0.1 → check внутренний
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip);
  if (mapped) return isPrivateAddress(mapped[1]);

  // IPv4
  if (/^\d+\.\d+\.\d+\.\d+$/.test(ip)) {
    const parts = ip.split(".").map(Number);
    if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
      return true; // malformed → unsafe
    }
    const [a, b] = parts;
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true; // link-local
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a >= 224) return true; // multicast + reserved
    return false;
  }

  // IPv6
  const lower = ip.toLowerCase();
  if (lower === "::" || lower === "::1") return true;
  if (lower.startsWith("fe8") || lower.startsWith("fe9") || lower.startsWith("fea") || lower.startsWith("feb")) {
    return true; // fe80::/10 link-local
  }
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // fc00::/7 ULA
  if (lower.startsWith("ff")) return true; // ff00::/8 multicast
  return false;
}

/**
 * DNS resolve hostname → vérify все IP not private. Throws при reject.
 * Caveat: DNS rebinding (attacker DNS возвращает public IP при resolve,
 * potом private при fetch). Полная защита требует кастомного http agent
 * с pinned IP — для v1 base case (block private at resolve) достаточно.
 */
async function assertPublicHost(hostname: string): Promise<void> {
  // Если hostname сам по себе IP literal — проверяем напрямую
  if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname) || /[:]/.test(hostname)) {
    if (isPrivateAddress(hostname)) {
      throw new Error(`URL hostname is a private address: ${hostname}`);
    }
    return;
  }
  // localhost / .local — block
  if (hostname === "localhost" || hostname.endsWith(".local") || hostname.endsWith(".internal")) {
    throw new Error(`URL hostname is local: ${hostname}`);
  }
  // DNS lookup → проверяем все returned IPs
  let addresses: Array<{ address: string; family: number }>;
  try {
    addresses = await dnsLookup(hostname, { all: true });
  } catch (err) {
    throw new Error(`DNS lookup failed for ${hostname}`);
  }
  for (const a of addresses) {
    if (isPrivateAddress(a.address)) {
      throw new Error(`URL hostname resolves to private address: ${hostname} → ${a.address}`);
    }
  }
}

/**
 * Регекс-парсер OG meta tags + fallback. Берёт первые matches, не пытается
 * быть полноценным HTML parser. Достаточно для 95% сайтов.
 *
 * Ищет:
 *   <meta property="og:title" content="...">
 *   <meta property="og:description" content="...">
 *   <meta property="og:image" content="...">
 *   <meta property="og:site_name" content="...">
 *   <title>...</title>
 *   <meta name="description" content="...">
 *
 * Поддерживает single + double quotes, content/property в любом порядке.
 */
function extractMeta(html: string): {
  title: string | null;
  description: string | null;
  image: string | null;
  siteName: string | null;
} {
  // Truncate parsing до первых 256KB — meta-теги все в <head>, нет
  // смысла парсить 5 MB body.
  const head = html.slice(0, 256 * 1024);

  const ogMatch = (prop: string): string | null => {
    // Принимаем <meta property="og:X" content="..."> и обратный порядок.
    const re = new RegExp(
      `<meta[^>]*?(?:property|name)=["']${prop}["'][^>]*?content=["']([^"']*?)["'][^>]*?>|<meta[^>]*?content=["']([^"']*?)["'][^>]*?(?:property|name)=["']${prop}["'][^>]*?>`,
      "i",
    );
    const m = re.exec(head);
    if (!m) return null;
    const raw = (m[1] ?? m[2] ?? "").trim();
    return raw || null;
  };

  const titleMatch = /<title[^>]*>([^<]+)<\/title>/i.exec(head);
  const fallbackTitle = titleMatch ? decodeEntities(titleMatch[1].trim()) : null;

  const title = decodeMaybe(ogMatch("og:title")) ?? fallbackTitle;
  const description =
    decodeMaybe(ogMatch("og:description")) ?? decodeMaybe(ogMatch("description"));
  const image = decodeMaybe(ogMatch("og:image"));
  const siteName = decodeMaybe(ogMatch("og:site_name"));

  return {
    title: clamp(title, 300),
    description: clamp(description, 600),
    image: clamp(image, 2048),
    siteName: clamp(siteName, 100),
  };
}

function decodeMaybe(s: string | null): string | null {
  return s ? decodeEntities(s) : null;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function clamp(s: string | null, max: number): string | null {
  if (!s) return null;
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

/**
 * Resolve relative URL (например, og:image="/img/cover.jpg") относительно
 * базового URL'а. Если absolute — возвращает как есть. Null если invalid.
 */
function resolveAbsoluteUrl(maybeRelative: string | null, baseUrl: string): string | null {
  if (!maybeRelative) return null;
  try {
    return new URL(maybeRelative, baseUrl).toString();
  } catch {
    return null;
  }
}

/**
 * Fetch URL → OG-meta. Возвращает structured preview либо throws.
 * Reuses existing fetch / native AbortController — no SDK deps.
 *
 * Manual redirect handling — Node fetch follows automatically, но
 * мы хотим re-проверять каждый redirect target через SSRF guard.
 * `redirect: "manual"` + iterate ≤ MAX_REDIRECTS.
 */
async function fetchPreview(urlIn: string): Promise<LinkPreview> {
  let currentUrl = urlIn;
  let response: Response | null = null;

  for (let redirectsLeft = MAX_REDIRECTS; redirectsLeft >= 0; redirectsLeft--) {
    const parsed = new URL(currentUrl);
    await assertPublicHost(parsed.hostname);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      response = await fetch(currentUrl, {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "text/html,application/xhtml+xml",
          "Accept-Language": "en,ru;q=0.9",
        },
      });
    } finally {
      clearTimeout(timer);
    }

    // 3xx → resolve Location relative to current URL, loop
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw new Error(`Redirect status ${response.status} without Location header`);
      const next = new URL(location, currentUrl).toString();
      if (next === currentUrl) throw new Error("Redirect loop");
      currentUrl = next;
      continue;
    }
    break;
  }

  if (!response) throw new Error("No response (max redirects exceeded)");
  if (response.status >= 400) {
    throw new Error(`HTTP ${response.status}`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("text/html")) {
    throw new Error(`Non-HTML content-type: ${contentType || "(none)"}`);
  }

  // Streaming read с size cap. Если body > MAX_BODY_BYTES — abort.
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Response body is empty");
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    if (value) {
      total += value.length;
      if (total > MAX_BODY_BYTES) {
        await reader.cancel();
        throw new Error(`Body exceeds ${MAX_BODY_BYTES} bytes`);
      }
      chunks.push(value);
    }
  }
  // Concat + decode (assume utf-8; fallback ok если запинается).
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    bytes.set(c, offset);
    offset += c.length;
  }
  const html = new TextDecoder("utf-8", { fatal: false }).decode(bytes);

  const meta = extractMeta(html);
  const absoluteImage = resolveAbsoluteUrl(meta.image, currentUrl);

  return {
    url: currentUrl,
    status: "OK",
    title: meta.title,
    description: meta.description,
    image: absoluteImage,
    siteName: meta.siteName ?? new URL(currentUrl).hostname,
  };
}

/**
 * Public API — кэшированный link preview.
 * Сначала проверяет DB cache, если miss/expired — fetch, upsert, return.
 * Failed fetches тоже кэшируются (TTL 24h) чтобы не долбить bad URL.
 */
export async function getLinkPreview(rawUrl: string): Promise<LinkPreview> {
  const normalized = normalizeUrl(rawUrl);
  if (!normalized) {
    throw new Error("Invalid URL");
  }

  // Hit cache?
  const now = new Date();
  const cached = await db.linkEmbed.findUnique({ where: { url: normalized } });
  if (cached && cached.expiresAt > now) {
    if (cached.status === "OK") {
      return {
        url: cached.url,
        status: "OK",
        title: cached.title,
        description: cached.description,
        image: cached.image,
        siteName: cached.siteName,
      };
    }
    return {
      url: cached.url,
      status: "FAILED",
      title: null,
      description: null,
      image: null,
      siteName: new URL(normalized).hostname,
    };
  }

  // Miss / expired — fetch.
  try {
    const preview = await fetchPreview(normalized);
    const expiresAt = new Date(now.getTime() + TTL_OK_MS);
    await db.linkEmbed.upsert({
      where: { url: normalized },
      create: {
        url: normalized,
        status: "OK",
        title: preview.title,
        description: preview.description,
        image: preview.image,
        siteName: preview.siteName,
        expiresAt,
      },
      update: {
        status: "OK",
        title: preview.title,
        description: preview.description,
        image: preview.image,
        siteName: preview.siteName,
        fetchedAt: now,
        expiresAt,
        error: null,
      },
    });
    return preview;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const expiresAt = new Date(now.getTime() + TTL_FAILED_MS);
    await db.linkEmbed.upsert({
      where: { url: normalized },
      create: {
        url: normalized,
        status: "FAILED",
        expiresAt,
        error: msg.slice(0, 500),
      },
      update: {
        status: "FAILED",
        fetchedAt: now,
        expiresAt,
        error: msg.slice(0, 500),
        title: null,
        description: null,
        image: null,
        siteName: null,
      },
    });
    return {
      url: normalized,
      status: "FAILED",
      title: null,
      description: null,
      image: null,
      siteName: new URL(normalized).hostname,
    };
  }
}
