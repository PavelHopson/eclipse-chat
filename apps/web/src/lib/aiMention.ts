/**
 * Frontend mirror of apps/server/src/ai/assistant.ts mention detector.
 *
 * Used by useMessages — на send detect'ит mention в outgoing text, чтобы
 * показать AI typing indicator до прихода bot reply (или 30s timeout).
 *
 * Mirror server-side ai/assistant.ts keyword table + regex. При изменении
 * серверного списка — синхронизировать вручную (как с lib/botRoles.ts).
 */
import type { BotRole } from "./botRoles";

const AI_MENTION_KEYWORDS: ReadonlyArray<{ kw: string; role: BotRole }> = [
  { kw: "moderator", role: "MODERATOR" },
  { kw: "модератор", role: "MODERATOR" },
  { kw: "мод", role: "MODERATOR" },
  { kw: "pm", role: "PM" },
  { kw: "менеджер", role: "PM" },
  { kw: "knowledge", role: "KNOWLEDGE" },
  { kw: "kb", role: "KNOWLEDGE" },
  { kw: "знания", role: "KNOWLEDGE" },
  { kw: "sales", role: "SALES" },
  { kw: "продажи", role: "SALES" },
  { kw: "ai", role: "GENERIC" },
  { kw: "ии", role: "GENERIC" },
  { kw: "аи", role: "GENERIC" },
];

const KEYWORDS_ALT = [...AI_MENTION_KEYWORDS]
  .map((k) => k.kw)
  .sort((a, b) => b.length - a.length)
  .join("|");

const AI_MENTION_REGEX = new RegExp(
  `(?:^|\\s)@(${KEYWORDS_ALT})(?=\\s|$|[?.!,;:])`,
  "iu",
);

export type AiMentionMatch = { role: BotRole; keyword: string };

export function resolveAiMention(content: string): AiMentionMatch | null {
  const m = AI_MENTION_REGEX.exec(content);
  if (!m || !m[1]) return null;
  const kw = m[1].toLowerCase();
  const entry = AI_MENTION_KEYWORDS.find((e) => e.kw === kw);
  if (!entry) return null;
  return { role: entry.role, keyword: kw };
}
