/**
 * v0.85 #27 phase 4 — mention parser для push triggers.
 *
 * Extracts `@<word>` tokens из content и резолвит их к userId'ам через
 * server members (case-insensitive displayName match).
 *
 * Limitations (phase 4, pragmatic v1):
 *   - displayName matching по first-word: `@Pavel` matches «Pavel» AND «Pavel
 *     Hopson». Это OK для большинства case'ов; фронт уже использует
 *     первое слово как primary handle.
 *   - Multi-word names: `@John Smith` matches только «John» (mention parser
 *     не cross'ит whitespace).
 *   - No proper mention-token system — frontend хранит plaintext `@Pavel`.
 *     Phase 5+ — добавить tokenized mentions с user-id pinning при autocomplete.
 *   - Special chars excluded из regex: `email@example.com` НЕ match'ит
 *     (`.` ломает word-boundary).
 *
 * NOT для AI mentions (`@ai`, `@pm` etc) — те обрабатываются в
 * `ai/assistant.ts` через `resolveAiMention`. Этот хелпер игнорирует
 * AI-keywords (skipped в caller — он matches только реальных members).
 */

import { db } from "../db.js";

/**
 * Extracts unique mention tokens из content. Возвращает downcased
 * displayName candidates, sorted by appearance.
 *
 * Regex: `@` followed by `[\p{L}\p{N}_-]+` (Unicode letters/digits/underscore/
 * hyphen). Word boundary before — чтобы `email@example.com` не match'ило.
 */
export function extractMentionTokens(content: string): string[] {
  if (!content) return [];
  // (?<![:\w]) — не match'им после `:` (URL/email) или word char.
  const re = /(?<![:\w])@([\p{L}\p{N}_-]+)/gu;
  const seen = new Set<string>();
  const tokens: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = re.exec(content)) !== null) {
    const t = match[1].toLowerCase();
    if (t.length === 0 || t.length > 64) continue;
    if (seen.has(t)) continue;
    seen.add(t);
    tokens.push(t);
  }
  return tokens;
}

/**
 * Резолвит mention tokens к userId'ам через server members. Matches на
 * first-word displayName (case-insensitive). Возвращает Set userIds.
 *
 * Excludes:
 *   - senderId (no self-notify)
 *   - users чьи tokens не нашлись (silent skip)
 */
export async function resolveMentions(
  serverId: string,
  tokens: readonly string[],
  senderId: string,
): Promise<Set<string>> {
  if (tokens.length === 0) return new Set();
  // Загружаем members + user'а одной выборкой. Filter в JS — Postgres ILIKE
  // с N tokens был бы дороже + менее explicit.
  const members = await db.member.findMany({
    where: { serverId },
    select: {
      userId: true,
      user: { select: { displayName: true } },
    },
  });
  const tokenSet = new Set(tokens);
  const matched = new Set<string>();
  for (const m of members) {
    if (m.userId === senderId) continue;
    const name = m.user.displayName.trim();
    if (!name) continue;
    // First-word match (whitespace splits).
    const firstWord = name.split(/\s+/, 1)[0].toLowerCase();
    if (tokenSet.has(firstWord)) {
      matched.add(m.userId);
    }
  }
  return matched;
}
