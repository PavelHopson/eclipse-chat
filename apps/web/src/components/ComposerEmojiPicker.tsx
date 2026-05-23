import { useEffect, useRef, useState, type CSSProperties } from "react";

type Props = {
  onPick: (emoji: string) => void;
  onClose: () => void;
  anchorRect: DOMRect | null;
};

type Category = {
  id: string;
  label: string;
  emojis: string[];
};

const CATEGORIES: Category[] = [
  {
    id: "smileys",
    label: "Эмоции",
    emojis: [
      "😀", "😃", "😄", "😁", "😆", "😅", "😂", "🤣",
      "😊", "🙂", "😉", "😌", "😍", "🥰", "😘", "🤩",
      "🤔", "🫡", "😎", "🥲",
    ],
  },
  {
    id: "gestures",
    label: "Жесты",
    emojis: [
      "👍", "👎", "👌", "✌️", "🤞", "🤝", "🙌", "👏",
      "🙏", "👋", "💪", "🤘",
    ],
  },
  {
    id: "hearts",
    label: "Сердца",
    emojis: [
      "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍",
      "💖", "💗", "💞", "💔",
    ],
  },
  {
    id: "nature",
    label: "Природа",
    emojis: [
      "🐶", "🐱", "🦊", "🐻", "🐼", "🐨", "🐯", "🦁",
      "🌸", "🌿", "🌙", "⭐",
    ],
  },
  {
    id: "food",
    label: "Еда",
    emojis: [
      "🍎", "🍌", "🍇", "🍓", "🍕", "🍔", "🍟", "🌮",
      "🍣", "🍰", "🍪", "☕",
    ],
  },
  {
    id: "activities",
    label: "Спорт",
    emojis: [
      "⚽", "🏀", "🏈", "🎾", "🎮", "🎲", "🎸", "🎤",
    ],
  },
  {
    id: "objects",
    label: "Объекты",
    emojis: [
      "🔥", "✨", "💯", "🎉", "🎊", "🎁", "💡", "⚡",
      "🚀", "💎", "📌", "⏰",
    ],
  },
  {
    id: "symbols",
    label: "Знаки",
    emojis: [
      "✅", "❌", "⚠️", "❓", "❗", "🔔", "🔒", "💬",
    ],
  },
];

const POPOVER_W = 320;
const POPOVER_H = 280;

export function ComposerEmojiPicker({ onPick, onClose, anchorRect }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [activeId, setActiveId] = useState<string>(CATEGORIES[0].id);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const style: CSSProperties = { position: "fixed" };
  if (anchorRect) {
    const margin = 8;
    let left = anchorRect.left;
    let top = anchorRect.top - POPOVER_H - margin;
    if (top < margin) top = anchorRect.bottom + margin;
    if (left + POPOVER_W > window.innerWidth - margin) {
      left = window.innerWidth - POPOVER_W - margin;
    }
    if (left < margin) left = margin;
    style.left = left;
    style.top = top;
  }

  const active = CATEGORIES.find((c) => c.id === activeId) ?? CATEGORIES[0];

  return (
    <div
      ref={ref}
      className="ec-emoji-picker"
      style={style}
      role="dialog"
      aria-label="Выбрать эмодзи"
    >
      <div className="ec-emoji-picker__tabs" role="tablist">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            role="tab"
            aria-selected={c.id === activeId}
            aria-label={c.label}
            title={c.label}
            className="ec-emoji-picker__tab"
            onClick={() => setActiveId(c.id)}
          >
            {c.emojis[0]}
          </button>
        ))}
      </div>
      <div className="ec-emoji-picker__category-label">{active.label}</div>
      <div className="ec-emoji-picker__grid" role="tabpanel">
        {active.emojis.map((e) => (
          <button
            key={e}
            type="button"
            className="ec-emoji-picker__cell"
            aria-label={`Эмодзи ${e}`}
            onClick={() => {
              onPick(e);
              onClose();
            }}
          >
            {e}
          </button>
        ))}
      </div>
    </div>
  );
}
