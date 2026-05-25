import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import { EMOJI_SHORTCODES } from "./RichContent";
import { BOT_ROLE_LABELS } from "../lib/botRoles";

/**
 * AI role-mention keyword'ы — список синхронизирован с
 * apps/server/src/ai/assistant.ts AI_MENTION_KEYWORDS.
 *
 * Каждая запись: keyword (вставляется в текст без `@`) + display lable
 * с RU-именем роли.
 */
const AI_MENTION_SUGGESTIONS: ReadonlyArray<{
  kw: string;
  label: string;
}> = [
  { kw: "ai", label: BOT_ROLE_LABELS.GENERIC + " · @ai" },
  { kw: "moderator", label: BOT_ROLE_LABELS.MODERATOR + " · @moderator" },
  { kw: "pm", label: BOT_ROLE_LABELS.PM + " · @pm" },
  { kw: "knowledge", label: BOT_ROLE_LABELS.KNOWLEDGE + " · @knowledge" },
  { kw: "sales", label: BOT_ROLE_LABELS.SALES + " · @sales" },
];

/**
 * Autocomplete popover для @ mentions и :emoji shortcodes в textarea composer'е.
 *
 * Использование: parent отслеживает textarea state через `useTextareaAutocomplete`
 * helper, передаёт сюда `trigger` (kind + word). Popover показывает filtered list,
 * keyboard navigation + click. Parent рендерит результат через `onSelect`.
 *
 * Positioning: minimal viable — popover absolute, anchor через `anchorEl.getBoundingClientRect()`.
 * НЕ tracking caret-pixel position (что требует canvas measurement + line height tracking).
 * Это appendix-style popover ниже textarea — UX как Discord/Slack.
 */

export type AutocompleteTrigger = {
  kind: "@" | ":";
  /** Текущее слово после trigger char (без самого `@` / `:`). */
  word: string;
  /** Индекс trigger char в textarea (inclusive). */
  startIdx: number;
};

export type AutocompleteItem = {
  /** Lookup key — для @ это name, для : это shortcode. */
  key: string;
  /** Visual: emoji char для :, отображаемое имя для @. */
  display: string;
  /** Текст для вставки в textarea (без trigger char). */
  insertText: string;
  /** v1.2.23 — для custom-emoji item: URL картинки для preview-img в popover. */
  imageUrl?: string;
};

type Props = {
  trigger: AutocompleteTrigger;
  /** Известные member display names — для @-autocomplete. */
  members: string[];
  /** v1.2.23 — custom-emoji map активного сервера (shortcode → URL).
   *  Если пустой/undefined — `:` показывает только Unicode shortcodes. */
  customEmojis?: Record<string, string>;
  anchorRect: DOMRect | null;
  onSelect: (item: AutocompleteItem) => void;
  onDismiss: () => void;
};

// v1.5.7 — visual layer вынесен в .ec-popover-* классы (components.css).
// Inline остаются только positioning + dynamic state. Базовая cinematic
// frame + entry-anim + hover left-rail приходят из CSS.

const wrapPositionStyle: CSSProperties = {
  position: "fixed",
  zIndex: 200,
  minWidth: 240,
  maxWidth: 320,
  maxHeight: 260,
  overflowY: "auto",
  padding: 4,
};

function buildItems(
  trigger: AutocompleteTrigger,
  members: string[],
  customEmojis?: Record<string, string>,
): AutocompleteItem[] {
  const q = trigger.word.toLowerCase();
  if (trigger.kind === "@") {
    // AI role-mention suggestions: показываем СНАЧАЛА если query матчится
    // (или query пустой). Каждый сопоставляется по keyword + по локализованному
    // label-фрагменту (модератор / менеджер / знания / продажи / бот).
    const aiMatches = AI_MENTION_SUGGESTIONS.filter((s) => {
      if (q === "") return true;
      return (
        s.kw.toLowerCase().startsWith(q) ||
        s.label.toLowerCase().includes(q)
      );
    });
    const memberMatches = members
      .filter((m) => m.toLowerCase().includes(q))
      .sort((a, b) => {
        const sa = a.toLowerCase().startsWith(q) ? 0 : 1;
        const sb = b.toLowerCase().startsWith(q) ? 0 : 1;
        if (sa !== sb) return sa - sb;
        return a.localeCompare(b);
      })
      .slice(0, 12);
    const aiItems = aiMatches.map((s) => ({
      key: `ai:${s.kw}`,
      display: s.label,
      // Insert: `@<keyword> ` — пробел после для удобства
      insertText: `@${s.kw} `,
    }));
    const memberItems = memberMatches.map((name) => ({
      key: `m:${name}`,
      display: name,
      insertText: `@${name} `,
    }));
    return [...aiItems, ...memberItems];
  }
  // kind === ':' — Unicode shortcodes + custom server emoji.
  // Priority: custom server emoji (этот сервер) ВЫШЕ Unicode (более
  // близкие к контексту). Внутри каждой группы — startsWith матчи
  // первыми.
  const unicodeEntries = Object.entries(EMOJI_SHORTCODES);
  const unicodeMatches = unicodeEntries
    .filter(([code]) => code.toLowerCase().includes(q))
    .sort(([a], [b]) => {
      const sa = a.toLowerCase().startsWith(q) ? 0 : 1;
      const sb = b.toLowerCase().startsWith(q) ? 0 : 1;
      if (sa !== sb) return sa - sb;
      return a.localeCompare(b);
    })
    .slice(0, 12);
  const unicodeItems: AutocompleteItem[] = unicodeMatches.map(([code, emoji]) => ({
    key: `u:${code}`,
    display: `${emoji}  :${code}:`,
    insertText: `${emoji} `,
  }));

  if (!customEmojis) return unicodeItems;
  const customEntries = Object.entries(customEmojis);
  // Skip коды которые есть в Unicode whitelist — RichContent отдаёт
  // приоритет Unicode'у, autocomplete тоже не должен предлагать дубли.
  const customMatches = customEntries
    .filter(
      ([code]) =>
        code.toLowerCase().includes(q) && !(code in EMOJI_SHORTCODES),
    )
    .sort(([a], [b]) => {
      const sa = a.toLowerCase().startsWith(q) ? 0 : 1;
      const sb = b.toLowerCase().startsWith(q) ? 0 : 1;
      if (sa !== sb) return sa - sb;
      return a.localeCompare(b);
    })
    .slice(0, 12);
  const customItems: AutocompleteItem[] = customMatches.map(([code, url]) => ({
    key: `c:${code}`,
    display: `:${code}:`,
    // Вставляем literal `:shortcode:` — RichContent на render подменит
    // на <img>. Trailing space для удобства typing'а после.
    insertText: `:${code}: `,
    imageUrl: url,
  }));

  return [...customItems, ...unicodeItems];
}

export function AutocompletePopover({
  trigger,
  members,
  customEmojis,
  anchorRect,
  onSelect,
  onDismiss,
}: Props) {
  const items = useMemo(
    () => buildItems(trigger, members, customEmojis),
    [trigger, members, customEmojis],
  );
  const [activeIdx, setActiveIdx] = useState(0);

  // Reset highlighted при смене query
  useEffect(() => {
    setActiveIdx(0);
  }, [trigger.kind, trigger.word]);

  // Keyboard: ArrowUp/Down, Enter/Tab, Esc.
  // Note: parent textarea также видит эти keys — мы вызываем onSelect ИЗ
  // popover (parent НЕ должен handle отдельно если popover active).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (items.length === 0) {
        if (e.key === "Escape") {
          e.preventDefault();
          onDismiss();
        }
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIdx((i) => (i + 1) % items.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIdx((i) => (i - 1 + items.length) % items.length);
      } else if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        const item = items[activeIdx];
        if (item) onSelect(item);
      } else if (e.key === "Escape") {
        e.preventDefault();
        onDismiss();
      }
    };
    // Capture phase — чтобы перехватить ДО textarea onKeyDown
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [items, activeIdx, onSelect, onDismiss]);

  if (items.length === 0) return null;

  // Positioning: ниже anchor textarea, выровнен по left.
  // Если рядом с нижним краем экрана — popover показывается над textarea.
  const top = anchorRect ? anchorRect.top - 8 : 100;
  const left = anchorRect ? anchorRect.left : 100;
  const transform = "translateY(-100%)"; // popover над textarea (above) — Discord pattern

  return (
    <div
      className="ec-popover-surface"
      style={{
        ...wrapPositionStyle,
        top,
        left,
        transform,
      }}
      role="listbox"
      aria-label={trigger.kind === "@" ? "Упоминание участника" : "Эмоджи"}
    >
      <div className="ec-popover-header">
        {trigger.kind === "@" ? "Упомянуть участника" : "Эмоджи"}
        <span style={{ marginLeft: 6, fontWeight: 400, letterSpacing: 0, textTransform: "none" }}>
          ↑↓ навигация · Enter — вставить · Esc — закрыть
        </span>
      </div>
      {items.map((item, i) => (
        <button
          key={item.key}
          type="button"
          role="option"
          aria-selected={i === activeIdx}
          className={"ec-popover-item" + (i === activeIdx ? " is-active" : "")}
          onMouseEnter={() => setActiveIdx(i)}
          onMouseDown={(e) => {
            // mousedown НЕ blur textarea — important
            e.preventDefault();
          }}
          onClick={() => onSelect(item)}
        >
          {item.imageUrl && (
            <img
              src={item.imageUrl}
              alt=""
              aria-hidden
              width={18}
              height={18}
              loading="lazy"
              style={{ objectFit: "contain", flexShrink: 0 }}
            />
          )}
          <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>
            {item.display}
          </span>
        </button>
      ))}
    </div>
  );
}

/**
 * Detect trigger в textarea text по caret position. Walk back от caret до
 * пробела или начала. Если последовательность вида `<space|start>@word` или
 * `<space|start>:word` — return trigger.
 *
 * Returns null если caret НЕ в активном trigger.
 */
export function detectTrigger(
  text: string,
  caretIdx: number,
): AutocompleteTrigger | null {
  let i = caretIdx - 1;
  while (i >= 0) {
    const ch = text[i];
    if (ch === " " || ch === "\n" || ch === "\t") return null;
    if (ch === "@" || ch === ":") {
      const prev = i > 0 ? text[i - 1] : " ";
      if (prev === " " || prev === "\n" || prev === "\t" || i === 0) {
        const word = text.slice(i + 1, caretIdx);
        // Don't trigger на пустой `:` (caret сразу после) — too noisy
        // Для @ — show even на empty word (member list)
        if (ch === ":" && word.length === 0) return null;
        return {
          kind: ch as "@" | ":",
          startIdx: i,
          word,
        };
      }
      return null;
    }
    // Допустимые word chars: латин/cyrl letters, digits, underscore, hyphen, +
    if (!/[\p{L}\p{N}_+-]/u.test(ch)) return null;
    i--;
  }
  return null;
}
