import type { ChannelType } from "../../lib/socket";
import { VoiceChannelIcon } from "./EclipseIcons";

type IconTone =
  | "violet"
  | "gold"
  | "pink"
  | "teal"
  | "blue"
  | "red"
  | "green";

export type ChannelIconId =
  | "ec:chat"
  | "ec:bell"
  | "ec:announce"
  | "ec:pin"
  | "ec:voice"
  | "ec:idea"
  | "ec:brain"
  | "ec:target"
  | "ec:rocket"
  | "ec:flame"
  | "ec:flow"
  | "ec:tools"
  | "ec:gear"
  | "ec:wrench"
  | "ec:box"
  | "ec:bars"
  | "ec:trend"
  | "ec:money"
  | "ec:vault"
  | "ec:gem"
  | "ec:paint"
  | "ec:game"
  | "ec:film"
  | "ec:music"
  | "ec:screen"
  | "ec:coffee"
  | "ec:pizza"
  | "ec:globe"
  | "ec:moon"
  | "ec:star";

export type ChannelIconPreset = {
  id: ChannelIconId;
  label: string;
  tone: IconTone;
};

export const CHANNEL_ICON_PRESETS: readonly ChannelIconPreset[] = [
  { id: "ec:chat", label: "Чат", tone: "violet" },
  { id: "ec:bell", label: "Сигнал", tone: "pink" },
  { id: "ec:announce", label: "Анонс", tone: "red" },
  { id: "ec:pin", label: "Пин", tone: "pink" },
  { id: "ec:voice", label: "Эфир", tone: "violet" },
  { id: "ec:idea", label: "Идея", tone: "gold" },
  { id: "ec:brain", label: "Мозг", tone: "pink" },
  { id: "ec:target", label: "Цель", tone: "blue" },
  { id: "ec:rocket", label: "Запуск", tone: "red" },
  { id: "ec:flame", label: "Горячее", tone: "red" },
  { id: "ec:flow", label: "Поток", tone: "teal" },
  { id: "ec:tools", label: "Сборка", tone: "pink" },
  { id: "ec:gear", label: "Система", tone: "violet" },
  { id: "ec:wrench", label: "Ремонт", tone: "gold" },
  { id: "ec:box", label: "Релиз", tone: "gold" },
  { id: "ec:bars", label: "Метрики", tone: "teal" },
  { id: "ec:trend", label: "Рост", tone: "blue" },
  { id: "ec:money", label: "Деньги", tone: "gold" },
  { id: "ec:vault", label: "Сейф", tone: "green" },
  { id: "ec:gem", label: "Премиум", tone: "violet" },
  { id: "ec:paint", label: "Дизайн", tone: "pink" },
  { id: "ec:game", label: "Игры", tone: "violet" },
  { id: "ec:film", label: "Видео", tone: "red" },
  { id: "ec:music", label: "Музыка", tone: "violet" },
  { id: "ec:screen", label: "Экран", tone: "blue" },
  { id: "ec:coffee", label: "Кофе", tone: "gold" },
  { id: "ec:pizza", label: "Пицца", tone: "red" },
  { id: "ec:globe", label: "Мир", tone: "blue" },
  { id: "ec:moon", label: "Ночь", tone: "violet" },
  { id: "ec:star", label: "Избранное", tone: "gold" },
] as const;

type GlyphProps = {
  type: ChannelType;
  icon?: string | null;
  size?: number;
  className?: string;
};

const CUSTOM_ICON_IDS = new Set<string>(CHANNEL_ICON_PRESETS.map((preset) => preset.id));

function svgProps(size: number) {
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
}

function getPreset(icon: ChannelIconId) {
  return CHANNEL_ICON_PRESETS.find((preset) => preset.id === icon) ?? null;
}

export function isCustomChannelIcon(value: string | null | undefined): value is ChannelIconId {
  return value != null && CUSTOM_ICON_IDS.has(value);
}

function renderFallbackGlyph(type: ChannelType, size: number) {
  if (type === "VOICE") {
    return <VoiceChannelIcon size={size} />;
  }

  if (type === "BROADCAST") {
    return (
      <svg {...svgProps(size)}>
        <path d="M4 11.2 17.6 6.3v11.4L4 12.8v-1.6Z" />
        <path d="M18 9h2.8v6H18" />
        <path d="M8.7 14.2 7.9 17a1.7 1.7 0 0 0 3.1 1.2" />
      </svg>
    );
  }

  if (type === "EXECUTION") {
    return (
      <svg {...svgProps(size)}>
        <rect x="3.6" y="4" width="6.2" height="6.2" rx="1.2" />
        <rect x="14.2" y="4" width="6.2" height="4.2" rx="1.2" />
        <rect x="14.2" y="11.8" width="6.2" height="8.2" rx="1.2" />
        <rect x="3.6" y="13.8" width="6.2" height="6.2" rx="1.2" />
      </svg>
    );
  }

  return (
    <span className="ec-channel-glyph__hash" aria-hidden>
      #
    </span>
  );
}

function renderCustomIcon(icon: ChannelIconId, size: number) {
  if (icon === "ec:chat") {
    return (
      <svg {...svgProps(size)}>
        <path d="M6 7.2h8.4a3.2 3.2 0 0 1 0 6.4H10l-3.2 2.9v-2.9H6a3.2 3.2 0 0 1 0-6.4Z" />
        <path d="M13.8 9.7h3a2.6 2.6 0 0 1 0 5.2h-.8v2.2l-2.5-2.2" />
      </svg>
    );
  }

  if (icon === "ec:bell") {
    return (
      <svg {...svgProps(size)}>
        <path d="M12 4.6a3.4 3.4 0 0 1 3.4 3.4v1.3c0 1.5.5 2.9 1.4 4l1 1.2H6.2l1-1.2a6.5 6.5 0 0 0 1.4-4V8A3.4 3.4 0 0 1 12 4.6Z" />
        <path d="M10.2 18.1a1.9 1.9 0 0 0 3.6 0" />
      </svg>
    );
  }

  if (icon === "ec:announce") {
    return (
      <svg {...svgProps(size)}>
        <path d="M4.2 11.4 16.6 7v10L4.2 12.6v-1.2Z" />
        <path d="M16.7 10.2h3v3.6h-3" />
        <path d="m8.1 14.1-.9 3a1.7 1.7 0 0 0 3.2 1.1" />
      </svg>
    );
  }

  if (icon === "ec:pin") {
    return (
      <svg {...svgProps(size)}>
        <path d="M14.8 4.8 19 9l-3 1.5-1.8 5-1.6-1.6-4.6 4.6" />
        <path d="M9.1 6.4 17.5 14.8" />
      </svg>
    );
  }

  if (icon === "ec:voice") {
    return <VoiceChannelIcon size={size} />;
  }

  if (icon === "ec:idea") {
    return (
      <svg {...svgProps(size)}>
        <path d="M12 5a4.8 4.8 0 0 1 3.7 7.9c-.9 1-1.5 1.9-1.7 2.8H10c-.2-.9-.8-1.8-1.7-2.8A4.8 4.8 0 0 1 12 5Z" />
        <path d="M9.9 17.5h4.2" />
        <path d="M10.4 20h3.2" />
      </svg>
    );
  }

  if (icon === "ec:brain") {
    return (
      <svg {...svgProps(size)}>
        <path d="M9 7.1a2.8 2.8 0 0 1 5 1.3 2.6 2.6 0 0 1 2.8 3.8 2.8 2.8 0 0 1-1.3 5.1 2.8 2.8 0 0 1-5 1.1 2.8 2.8 0 0 1-4.8-2.4A2.7 2.7 0 0 1 6 10.8 2.8 2.8 0 0 1 9 7.1Z" />
        <path d="M10.2 8.4v7.4" />
        <path d="M13.8 9.1v5.8" />
      </svg>
    );
  }

  if (icon === "ec:target") {
    return (
      <svg {...svgProps(size)}>
        <circle cx="12" cy="12" r="7.2" />
        <circle cx="12" cy="12" r="3.5" />
        <path d="M12 4.8v2.3M19.2 12h-2.3M12 16.9v2.3M7.1 12H4.8" />
      </svg>
    );
  }

  if (icon === "ec:rocket") {
    return (
      <svg {...svgProps(size)}>
        <path d="M14 4.5c2.7.5 4.9 2.7 5.4 5.4l-4.2 4.2-5.4-5.4 4.2-4.2Z" />
        <path d="M9.8 9 7 11.8v3.8h3.8l2.8-2.8" />
        <path d="m7.5 16.5-2 2" />
        <path d="m16.4 7.6-2 2" />
      </svg>
    );
  }

  if (icon === "ec:flame") {
    return (
      <svg {...svgProps(size)}>
        <path d="M12.8 4.8c1.3 2.4.8 3.8-.7 5.1-1.2 1.1-1.6 2-1.6 3.3A3.4 3.4 0 0 0 17.3 14c0 3.2-2.3 5.6-5.4 5.6S6.4 17.4 6.4 14c0-2.9 1.6-4.6 3.3-6.3 1.2-1.1 2.3-2.1 3.1-2.9Z" />
      </svg>
    );
  }

  if (icon === "ec:flow") {
    return (
      <svg {...svgProps(size)}>
        <path d="M6.1 7.4a2.2 2.2 0 1 1 0-4.4 2.2 2.2 0 0 1 0 4.4Z" />
        <path d="M18 21a2.2 2.2 0 1 0 0-4.4 2.2 2.2 0 0 0 0 4.4Z" />
        <path d="M6 5.2c3.8 0 5.1 2.6 5.1 5.2s1.3 5.2 5.1 5.2" />
      </svg>
    );
  }

  if (icon === "ec:tools") {
    return (
      <svg {...svgProps(size)}>
        <path d="m8.2 7.3 8.5 8.5" />
        <path d="M6.5 11.4 4 14l1.8 1.8 2.6-2.5" />
        <path d="M17.5 4.2a3.2 3.2 0 0 0-3.6 4.2l-5.5 5.5a2 2 0 0 0 2.8 2.8l5.5-5.5a3.2 3.2 0 0 0 4.2-3.6l-2.2 2.2-2.8-2.8 2.2-2.8Z" />
      </svg>
    );
  }

  if (icon === "ec:gear") {
    return (
      <svg {...svgProps(size)}>
        <circle cx="12" cy="12" r="2.8" />
        <path d="M12 5.2v1.6M12 17.2v1.6M18.8 12h-1.6M6.8 12H5.2M16.8 7.2l-1.1 1.1M8.3 15.7l-1.1 1.1M16.8 16.8l-1.1-1.1M8.3 8.3 7.2 7.2" />
        <circle cx="12" cy="12" r="6.1" opacity="0.55" />
      </svg>
    );
  }

  if (icon === "ec:wrench") {
    return (
      <svg {...svgProps(size)}>
        <path d="M14.6 5.1a4 4 0 0 0 4.3 5.3L11 18.3a2.2 2.2 0 1 1-3.1-3.1l7.9-7.9a4 4 0 0 0-1.2-2.2Z" />
      </svg>
    );
  }

  if (icon === "ec:box") {
    return (
      <svg {...svgProps(size)}>
        <path d="m12 4.5 7 3.8v7.4L12 19.5 5 15.7V8.3L12 4.5Z" />
        <path d="M12 19.5v-7.4" />
        <path d="m5 8.3 7 3.8 7-3.8" />
      </svg>
    );
  }

  if (icon === "ec:bars") {
    return (
      <svg {...svgProps(size)}>
        <path d="M6.2 18.5V10.8" />
        <path d="M12 18.5V6.4" />
        <path d="M17.8 18.5v-9.7" />
        <path d="M4.6 18.5h14.8" />
      </svg>
    );
  }

  if (icon === "ec:trend") {
    return (
      <svg {...svgProps(size)}>
        <path d="M5 18.2h14" />
        <path d="m6.6 14.8 3.5-3.5 2.8 2.8 5-5" />
        <path d="M14.8 9h3.1v3.1" />
      </svg>
    );
  }

  if (icon === "ec:money") {
    return (
      <svg {...svgProps(size)}>
        <circle cx="12" cy="12" r="6.5" />
        <path d="M12 8.4v7.1" />
        <path d="M14.6 9.6c-.5-.8-1.4-1.2-2.6-1.2-1.5 0-2.6.8-2.6 2 0 1.1.8 1.7 2.6 2l1 .2c1.6.3 2.5.9 2.5 2.1 0 1.4-1.2 2.3-3 2.3-1.4 0-2.5-.5-3.1-1.4" />
      </svg>
    );
  }

  if (icon === "ec:vault") {
    return (
      <svg {...svgProps(size)}>
        <rect x="4.4" y="5" width="15.2" height="14" rx="2" />
        <circle cx="12" cy="12" r="2.4" />
        <path d="M12 9.6v4.8M9.6 12h4.8" />
        <path d="M7.2 8.2h2" />
      </svg>
    );
  }

  if (icon === "ec:gem") {
    return (
      <svg {...svgProps(size)}>
        <path d="m7 7 2.4-2.6h5.2L17 7l-5 10L7 7Z" />
        <path d="M9.4 4.4 12 7l2.6-2.6" />
        <path d="M7 7h10" />
      </svg>
    );
  }

  if (icon === "ec:paint") {
    return (
      <svg {...svgProps(size)}>
        <path d="M12.3 5a7.3 7.3 0 1 0 0 14.6c1.2 0 2-.7 2-1.7 0-.9-.5-1.4-.5-2 0-.7.7-1.3 1.7-1.3h.7A4.9 4.9 0 0 0 21 9.8 4.8 4.8 0 0 0 16.2 5Z" />
        <circle cx="8.3" cy="10" r=".8" />
        <circle cx="11.3" cy="8.2" r=".8" />
        <circle cx="14.8" cy="8.8" r=".8" />
        <circle cx="8.8" cy="13.5" r=".8" />
      </svg>
    );
  }

  if (icon === "ec:game") {
    return (
      <svg {...svgProps(size)}>
        <path d="M7.5 9.2h9a4 4 0 0 1 3.8 5l-1.1 3.7a1.8 1.8 0 0 1-3.2.5l-2.2-2.8H10l-2.2 2.8a1.8 1.8 0 0 1-3.2-.5l-1.1-3.7a4 4 0 0 1 4-5Z" />
        <path d="M8.3 12.6h3M9.8 11.1v3" />
        <circle cx="15.6" cy="12.1" r=".7" fill="currentColor" stroke="none" />
        <circle cx="17.8" cy="14.1" r=".7" fill="currentColor" stroke="none" />
      </svg>
    );
  }

  if (icon === "ec:film") {
    return (
      <svg {...svgProps(size)}>
        <rect x="4.2" y="6.2" width="15.6" height="11.6" rx="2" />
        <path d="M4.2 10.2h15.6M8 6.2v11.6M16 6.2v11.6" />
      </svg>
    );
  }

  if (icon === "ec:music") {
    return (
      <svg {...svgProps(size)}>
        <path d="M14.4 5.2v9.3a2.6 2.6 0 1 1-1.8-2.5V7.3l5-1.2v6.5a2.6 2.6 0 1 1-1.8-2.5V4.8l-1.4.4Z" />
      </svg>
    );
  }

  if (icon === "ec:screen") {
    return (
      <svg {...svgProps(size)}>
        <rect x="3.8" y="5.2" width="16.4" height="11.3" rx="2" />
        <path d="M9 19.2h6" />
        <path d="M12 16.5v2.7" />
      </svg>
    );
  }

  if (icon === "ec:coffee") {
    return (
      <svg {...svgProps(size)}>
        <path d="M6.2 9.2h8.4v4.2a3.9 3.9 0 0 1-3.9 3.9h-.6a3.9 3.9 0 0 1-3.9-3.9V9.2Z" />
        <path d="M14.6 10h1.7a2 2 0 0 1 0 4h-1.7" />
        <path d="M7.4 19.2h8.8" />
        <path d="M8.6 6.2v1.5M11.8 5.4v2.3M14.8 6.2v1.5" />
      </svg>
    );
  }

  if (icon === "ec:pizza") {
    return (
      <svg {...svgProps(size)}>
        <path d="M5.7 7.4A12.8 12.8 0 0 1 18.3 7.4L12 18.9 5.7 7.4Z" />
        <path d="M8.3 9.4h7.4" />
        <circle cx="10" cy="11.4" r=".8" fill="currentColor" stroke="none" />
        <circle cx="13.8" cy="13" r=".8" fill="currentColor" stroke="none" />
      </svg>
    );
  }

  if (icon === "ec:globe") {
    return (
      <svg {...svgProps(size)}>
        <circle cx="12" cy="12" r="7.2" />
        <path d="M4.8 12h14.4" />
        <path d="M12 4.8a10.6 10.6 0 0 1 0 14.4" />
        <path d="M12 4.8a10.6 10.6 0 0 0 0 14.4" />
      </svg>
    );
  }

  if (icon === "ec:moon") {
    return (
      <svg {...svgProps(size)}>
        <path d="M16.9 5.6a6.8 6.8 0 1 0 1.5 11.8 7.5 7.5 0 0 1-1.5-11.8Z" />
      </svg>
    );
  }

  return (
    <svg {...svgProps(size)}>
      <path d="m12 4.8 2 4.1 4.5.7-3.2 3.1.8 4.4L12 15l-4.1 2.1.8-4.4-3.2-3.1 4.5-.7L12 4.8Z" />
    </svg>
  );
}

export function getChannelIconLabel(value: string | null | undefined, type: ChannelType): string {
  if (value && isCustomChannelIcon(value)) {
    return getPreset(value)?.label ?? "Иконка";
  }

  if (type === "VOICE") return "Голосовой канал";
  if (type === "BROADCAST") return "Канал вещания";
  if (type === "EXECUTION") return "Execution-канал";
  return "Текстовый канал";
}

export function ChannelGlyph({
  type,
  icon,
  size = 16,
  className,
}: GlyphProps) {
  const custom = icon && isCustomChannelIcon(icon) ? getPreset(icon) : null;
  const glyphClassName = [
    "ec-channel-glyph",
    custom ? "ec-channel-glyph--custom" : icon ? "ec-channel-glyph--emoji" : "ec-channel-glyph--plain",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  if (custom) {
    return (
      <span className={glyphClassName} data-tone={custom.tone} aria-hidden>
        {renderCustomIcon(custom.id, size)}
      </span>
    );
  }

  if (icon) {
    return (
      <span className={glyphClassName} aria-hidden>
        {icon}
      </span>
    );
  }

  return (
    <span className={glyphClassName} aria-hidden>
      {renderFallbackGlyph(type, size)}
    </span>
  );
}
