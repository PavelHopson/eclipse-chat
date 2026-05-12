import type { CSSProperties, ReactNode } from "react";

type Props = {
  content: string;
  /** Список known display names (для mention detection). Регистронезависимый match. */
  mentionNames?: string[];
  /** Display name текущего user'а — для подсветки «mention касается меня». */
  currentUserName?: string;
};

/**
 * Простой rich-content renderer для message text. Поддерживает:
 *   - @<Name> mentions (если Name in mentionNames)
 *   - URLs (http/https)
 *
 * Mentions подсвечиваются accent-цветом, при упоминании самого user'а —
 * с micro-glow ring. Не поддерживает markdown — это отдельная фича.
 *
 * Regex'ы простые без greedy: имя — буквы/цифры/пробелы/подчёркивания/
 * дефисы до конца слова или известного name'а. Whitespace-aware.
 */

const mentionStyle: CSSProperties = {
  display: "inline-block",
  padding: "0 4px",
  background: "var(--ec-accent-soft)",
  color: "var(--ec-accent)",
  borderRadius: "var(--ec-radius-xs)",
  fontWeight: 600,
};

const meMentionStyle: CSSProperties = {
  ...mentionStyle,
  background: "hsl(40 70% 60% / 0.18)",
  color: "var(--ec-warn)",
  boxShadow: "0 0 6px hsl(40 70% 60% / 0.4)",
};

const urlStyle: CSSProperties = {
  color: "var(--ec-accent)",
  textDecoration: "underline",
  textUnderlineOffset: 2,
  wordBreak: "break-all",
};

const URL_RE = /(https?:\/\/[^\s<>"']+)/g;

/**
 * Detect @<DisplayName> где DisplayName ∈ mentionNames. Greedy-longest-match:
 * пробуем имена начиная с самых длинных (чтобы «@Pavel Hopson» имел приоритет
 * над «@Pavel»).
 */
function detectMentions(text: string, names: string[]): Array<{ start: number; end: number; name: string }> {
  if (names.length === 0) return [];
  const sorted = [...names].sort((a, b) => b.length - a.length);
  const found: Array<{ start: number; end: number; name: string }> = [];
  let i = 0;
  while (i < text.length) {
    if (text[i] !== "@") {
      i++;
      continue;
    }
    let matched: { name: string; len: number } | null = null;
    for (const name of sorted) {
      // Регистронезависимое сравнение
      if (text.slice(i + 1, i + 1 + name.length).toLowerCase() === name.toLowerCase()) {
        const after = text[i + 1 + name.length];
        // Граница: end-of-string или non-word char
        if (after === undefined || /[\s.,!?;:)"'\-]/.test(after)) {
          matched = { name, len: name.length };
          break;
        }
      }
    }
    if (matched) {
      found.push({ start: i, end: i + 1 + matched.len, name: matched.name });
      i += 1 + matched.len;
    } else {
      i++;
    }
  }
  return found;
}

export function RichContent({ content, mentionNames = [], currentUserName }: Props) {
  const mentions = detectMentions(content, mentionNames);
  const result: ReactNode[] = [];
  let lastIdx = 0;

  for (let mi = 0; mi < mentions.length; mi++) {
    const m = mentions[mi];
    if (m.start > lastIdx) {
      // Plain text сегмент с URL-разметкой
      result.push(renderTextWithUrls(content.slice(lastIdx, m.start), `t-${mi}`));
    }
    const isMe = currentUserName != null && m.name.toLowerCase() === currentUserName.toLowerCase();
    result.push(
      <span key={`m-${mi}`} style={isMe ? meMentionStyle : mentionStyle}>
        @{m.name}
      </span>,
    );
    lastIdx = m.end;
  }
  if (lastIdx < content.length) {
    result.push(renderTextWithUrls(content.slice(lastIdx), "t-tail"));
  }
  if (result.length === 0) return <>{content}</>;
  return <>{result}</>;
}

function renderTextWithUrls(text: string, keyPrefix: string): ReactNode {
  const parts = text.split(URL_RE);
  if (parts.length === 1) return <span key={keyPrefix}>{text}</span>;
  return (
    <span key={keyPrefix}>
      {parts.map((p, i) => {
        if (i % 2 === 1) {
          return (
            <a
              key={`${keyPrefix}-u${i}`}
              href={p}
              target="_blank"
              rel="noopener noreferrer"
              style={urlStyle}
            >
              {p}
            </a>
          );
        }
        return <span key={`${keyPrefix}-t${i}`}>{p}</span>;
      })}
    </span>
  );
}

/** Check если content упоминает currentUserName — используется для notification escalation. */
export function contentMentionsMe(content: string, mentionNames: string[], currentUserName?: string): boolean {
  if (!currentUserName) return false;
  const mentions = detectMentions(content, mentionNames);
  return mentions.some((m) => m.name.toLowerCase() === currentUserName.toLowerCase());
}
