import { memo, useMemo } from "react";
import type { CSSProperties, ReactNode } from "react";

type Props = {
  content: string;
  /** Список known display names (для mention detection). Регистронезависимый match. */
  mentionNames?: string[];
  /** Display name текущего user'а — для подсветки «mention касается меня». */
  currentUserName?: string;
  /**
   * v1.2.22 — Custom-emoji map активного сервера (shortcode → URL).
   * Имеет приоритет ниже Unicode `EMOJI_SHORTCODES` (чтобы `:smile:` всегда
   * был 😄, даже если кто-то загрузит `smile` как картинку). Передаётся из
   * `useServerEmojis(activeServerId)` через AppShell.
   */
  customEmojis?: Record<string, string>;
};

/**
 * Rich-content renderer для message text. Поддерживает:
 *   - @<Name> mentions (если Name in mentionNames)
 *   - Markdown inline: **bold**, italic (*x* or _x_), `code`, ~~strike~~
 *   - URLs (http/https) — auto-link, target=_blank
 *   - Emoji shortcodes: :smile: → 😄 (~40 popular)
 *
 * Mentions подсвечиваются accent-цветом, при упоминании самого user'а —
 * с micro-glow ring. Markdown не поддерживает nesting (e.g. **bold *italic***)
 * — это намеренно, чтобы не плодить parser-bugs в чат-сообщениях.
 *
 * Безопасность: НИКАКОГО dangerouslySetInnerHTML — React сам escape'ит все
 * text-content. Markdown tokenizer работает чисто над строкой, output —
 * structured React-элементы.
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
  background: "color-mix(in srgb, var(--ec-warn) 18%, transparent)",
  color: "var(--ec-warn)",
  boxShadow: "0 0 6px color-mix(in srgb, var(--ec-warn) 40%, transparent)",
};

const urlStyle: CSSProperties = {
  color: "var(--ec-accent)",
  textDecoration: "underline",
  textUnderlineOffset: 2,
  wordBreak: "break-all",
};

const codeStyle: CSSProperties = {
  fontFamily: "var(--ec-font-mono)",
  fontSize: "0.9em",
  background: "var(--ec-surface-3)",
  padding: "0.08rem 0.35rem",
  borderRadius: "var(--ec-radius-sm)",
  border: "1px solid var(--ec-border-subtle)",
  color: "var(--ec-text-strong)",
};

const emojiStyle: CSSProperties = {
  fontSize: "1.15em",
  lineHeight: 1,
  verticalAlign: "middle",
};

const customEmojiStyle: CSSProperties = {
  display: "inline-block",
  width: "1.4em",
  height: "1.4em",
  verticalAlign: "-0.3em",
  objectFit: "contain",
};

/**
 * Whitelist emoji shortcodes — самые популярные. Не пытаемся быть Slack/Discord
 * с тысячами вариантов: hot-list 40+ покрывает 95% использования. Расширение
 * списка — отдельный commit, чтобы было видно что добавилось.
 */
export const EMOJI_SHORTCODES: Record<string, string> = {
  smile: "😄", laughing: "😆", joy: "😂", grin: "😁", wink: "😉",
  heart: "❤️", heartbeat: "💓", sparkling_heart: "💖",
  fire: "🔥", rocket: "🚀", tada: "🎉", sparkles: "✨", star: "⭐",
  "+1": "👍", "-1": "👎", thumbsup: "👍", thumbsdown: "👎",
  eyes: "👀", wave: "👋", thinking: "🤔", confused: "😕", facepalm: "🤦",
  ok: "👌", clap: "👏", muscle: "💪", pray: "🙏",
  warning: "⚠️", exclamation: "❗", question: "❓",
  check: "✅", x: "❌", white_check_mark: "✅",
  bug: "🐛", construction: "🚧", wrench: "🔧", hammer: "🔨",
  computer: "💻", phone: "📱", email: "📧", bell: "🔔", mute: "🔕",
  coffee: "☕", beer: "🍺", pizza: "🍕", cake: "🎂",
  sunny: "☀️", cloud: "☁️", rainbow: "🌈",
  zap: "⚡", boom: "💥", point_right: "👉", point_left: "👈",
  hourglass: "⏳", clock: "🕐", calendar: "📅",
  lock: "🔒", unlock: "🔓", key: "🔑",
  bulb: "💡", memo: "📝", book: "📖", chart: "📊", chart_up: "📈", chart_down: "📉",
  robot: "🤖", alien: "👽", ghost: "👻",
};

const MENTION_BOUNDARY_RE = /[\s.,!?;:)"'\-]/;
/**
 * Tokenizer regex: capture-group ordered by precedence.
 * 1. `code`        — protects inner content from other markdown
 * 2. **bold**
 * 3. *italic* / _italic_
 * 4. ~~strike~~
 * 5. URL (http/https)
 * 6. :shortcode:   — emoji
 *
 * `[^\n]` boundaries не дают парсеру схватить multi-line markdown через
 * \n — каждая строка обрабатывается независимо.
 */
const TOKEN_RE =
  /(`[^`\n]+`)|(\*\*[^*\n]+\*\*)|(\*[^*\n]+\*|_[^_\n]+_)|(~~[^~\n]+~~)|(https?:\/\/[^\s<>"']+)|(:[a-z0-9_+-]+:)/gi;

type InlineToken =
  | { type: "text"; text: string }
  | { type: "code"; text: string }
  | { type: "bold"; text: string }
  | { type: "italic"; text: string }
  | { type: "strike"; text: string }
  | { type: "url"; text: string }
  | { type: "emoji"; text: string }
  | { type: "customEmoji"; shortcode: string; url: string };

function tokenize(
  text: string,
  customEmojis?: Record<string, string>,
): InlineToken[] {
  const tokens: InlineToken[] = [];
  TOKEN_RE.lastIndex = 0;
  let lastIdx = 0;
  let m: RegExpExecArray | null;
  while ((m = TOKEN_RE.exec(text)) !== null) {
    if (m.index > lastIdx) {
      tokens.push({ type: "text", text: text.slice(lastIdx, m.index) });
    }
    if (m[1]) {
      tokens.push({ type: "code", text: m[1].slice(1, -1) });
    } else if (m[2]) {
      tokens.push({ type: "bold", text: m[2].slice(2, -2) });
    } else if (m[3]) {
      tokens.push({ type: "italic", text: m[3].slice(1, -1) });
    } else if (m[4]) {
      tokens.push({ type: "strike", text: m[4].slice(2, -2) });
    } else if (m[5]) {
      tokens.push({ type: "url", text: m[5] });
    } else if (m[6]) {
      const code = m[6].slice(1, -1).toLowerCase();
      const unicode = EMOJI_SHORTCODES[code];
      if (unicode) {
        tokens.push({ type: "emoji", text: unicode });
      } else if (customEmojis && customEmojis[code]) {
        tokens.push({ type: "customEmoji", shortcode: code, url: customEmojis[code] });
      } else {
        tokens.push({ type: "text", text: m[6] });
      }
    }
    lastIdx = TOKEN_RE.lastIndex;
  }
  if (lastIdx < text.length) {
    tokens.push({ type: "text", text: text.slice(lastIdx) });
  }
  return tokens;
}

function renderTokens(tokens: InlineToken[], keyPrefix: string): ReactNode[] {
  return tokens.map((tok, i) => {
    const key = `${keyPrefix}-${i}`;
    switch (tok.type) {
      case "text":
        return <span key={key}>{tok.text}</span>;
      case "code":
        return <code key={key} style={codeStyle}>{tok.text}</code>;
      case "bold":
        return <strong key={key}>{tok.text}</strong>;
      case "italic":
        return <em key={key}>{tok.text}</em>;
      case "strike":
        return <s key={key}>{tok.text}</s>;
      case "url":
        return (
          <a
            key={key}
            href={tok.text}
            target="_blank"
            rel="noopener noreferrer"
            style={urlStyle}
          >
            {tok.text}
          </a>
        );
      case "emoji":
        return <span key={key} style={emojiStyle} aria-hidden>{tok.text}</span>;
      case "customEmoji":
        return (
          <img
            key={key}
            src={tok.url}
            alt={`:${tok.shortcode}:`}
            title={`:${tok.shortcode}:`}
            loading="lazy"
            style={customEmojiStyle}
          />
        );
    }
  });
}

function detectMentions(
  text: string,
  names: string[],
): Array<{ start: number; end: number; name: string }> {
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
      if (text.slice(i + 1, i + 1 + name.length).toLowerCase() === name.toLowerCase()) {
        const after = text[i + 1 + name.length];
        if (after === undefined || MENTION_BOUNDARY_RE.test(after)) {
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

// memo + useMemo — RichContent рендерится для каждого видимого сообщения;
// без этого detectMentions+tokenize (regex-скан) гоняется на каждый ре-рендер
// КАЖДОГО сообщения, даже когда менялось соседнее. Самый дешёвый крупный
// перф-выигрыш в ленте (см. аудит P2).
export const RichContent = memo(function RichContent({
  content,
  mentionNames = [],
  currentUserName,
  customEmojis,
}: Props) {
  return useMemo(() => {
  const mentions = detectMentions(content, mentionNames);
  const result: ReactNode[] = [];
  let lastIdx = 0;

  for (let mi = 0; mi < mentions.length; mi++) {
    const m = mentions[mi];
    if (m.start > lastIdx) {
      const segment = content.slice(lastIdx, m.start);
      result.push(...renderTokens(tokenize(segment, customEmojis), `t-${mi}`));
    }
    const isMe =
      currentUserName != null && m.name.toLowerCase() === currentUserName.toLowerCase();
    result.push(
      <span key={`m-${mi}`} style={isMe ? meMentionStyle : mentionStyle}>
        @{m.name}
      </span>,
    );
    lastIdx = m.end;
  }
  if (lastIdx < content.length) {
    const tail = content.slice(lastIdx);
    result.push(...renderTokens(tokenize(tail, customEmojis), "t-tail"));
  }
  if (result.length === 0) return <>{content}</>;
  return <>{result}</>;
  }, [content, mentionNames, currentUserName, customEmojis]);
});

/** Check если content упоминает currentUserName — используется для notification escalation. */
export function contentMentionsMe(
  content: string,
  mentionNames: string[],
  currentUserName?: string,
): boolean {
  if (!currentUserName) return false;
  const mentions = detectMentions(content, mentionNames);
  return mentions.some((m) => m.name.toLowerCase() === currentUserName.toLowerCase());
}
