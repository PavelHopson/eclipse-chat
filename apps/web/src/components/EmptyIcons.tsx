/**
 * EmptyIcons — line-art SVG-сет в Eclipse-почерке для EmptyState.
 *
 * Дизайн:
 *  - 40×40 viewBox, stroke 1.8, line-cap round
 *  - currentColor для stroke (наследуется от parent text-color)
 *  - Один cyan accent acceptable (через explicit stroke color) — но
 *    предпочитаем monochrome, цвет наследуется через EmptyState iconWrap
 *  - Calm, геометрические — НЕ playful / NOT cute
 *
 * Использование:
 *   <EmptyState icon={<EmptyChannelIcon />} title="..." hint="..." />
 */

const baseProps = {
  width: 40,
  height: 40,
  viewBox: "0 0 40 40",
  fill: "none" as const,
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true as const,
};

/** Канал без сообщений — пустая "console" с blinking-cursor линией. */
export function EmptyChannelIcon() {
  return (
    <svg {...baseProps}>
      <rect x="6" y="9" width="28" height="22" rx="3" />
      <path d="M11 16h6" opacity="0.6" />
      <path d="M11 21h12" opacity="0.4" />
      <path d="M11 26h4" stroke="hsl(195 75% 60%)" />
    </svg>
  );
}

/** Пустой DM-разговор — две абстрактные сферы соединены линией. */
export function EmptyDmIcon() {
  return (
    <svg {...baseProps}>
      <circle cx="11" cy="20" r="5" />
      <circle cx="29" cy="20" r="5" />
      <path d="M16 20h8" opacity="0.5" stroke="hsl(195 75% 60%)" />
    </svg>
  );
}

/** Home «СЕГОДНЯ» без событий — calm horizon. */
export function EmptyHomeIcon() {
  return (
    <svg {...baseProps}>
      <path d="M6 28h28" />
      <path d="M14 28a6 6 0 0112 0" stroke="hsl(195 75% 60%)" opacity="0.85" />
      <path d="M20 16v-4" opacity="0.6" />
      <path d="M28 18l-2-2" opacity="0.4" />
      <path d="M12 18l2-2" opacity="0.4" />
    </svg>
  );
}

/** Status Board пуст — grid 3×2 c одним cyan check. */
export function EmptyBoardIcon() {
  return (
    <svg {...baseProps}>
      <rect x="6" y="10" width="9" height="9" rx="1.5" />
      <rect x="17" y="10" width="9" height="9" rx="1.5" />
      <rect x="28" y="10" width="6" height="9" rx="1.5" opacity="0.55" />
      <rect x="6" y="21" width="9" height="9" rx="1.5" opacity="0.55" />
      <path d="M19 14.5l1.7 1.7L24 13" stroke="hsl(195 75% 60%)" />
    </svg>
  );
}

/** Search без результатов — лупа над void'ом. */
export function EmptySearchIcon() {
  return (
    <svg {...baseProps}>
      <circle cx="17" cy="17" r="9" />
      <path d="M24 24l7 7" stroke="hsl(195 75% 60%)" />
    </svg>
  );
}

/** Team Health когда нечего считать — heart-pulse контур. */
export function EmptyHealthIcon() {
  return (
    <svg {...baseProps}>
      <path d="M28 9a5 5 0 00-8 1l-0 1-0-1a5 5 0 00-8 1c-1 4 2 7 8 13 6-6 9-9 8-13z" />
      <path d="M13 22h3l2-4 3 6 2-4h4" stroke="hsl(195 75% 60%)" />
    </svg>
  );
}

/** Incident timeline без событий — calm radio-waves. */
export function EmptyIncidentIcon() {
  return (
    <svg {...baseProps}>
      <circle cx="20" cy="22" r="2" stroke="hsl(195 75% 60%)" />
      <path d="M15 22a5 5 0 0110 0" opacity="0.7" />
      <path d="M10 22a10 10 0 0120 0" opacity="0.4" />
    </svg>
  );
}

/** Files tab без attachments — stacked plates. */
export function EmptyFilesIcon() {
  return (
    <svg {...baseProps}>
      <path d="M11 16l9-6 9 6v12l-9 6-9-6z" opacity="0.45" />
      <path d="M11 22l9 6 9-6" stroke="hsl(195 75% 60%)" />
      <path d="M20 28v6" opacity="0.4" />
    </svg>
  );
}

/** Bots без созданных — circuit-like мини-граф. */
export function EmptyBotsIcon() {
  return (
    <svg {...baseProps}>
      <rect x="10" y="14" width="20" height="12" rx="2" />
      <circle cx="14" cy="20" r="1" fill="currentColor" />
      <circle cx="26" cy="20" r="1" fill="currentColor" />
      <path d="M20 9v3" />
      <circle cx="20" cy="8" r="1.5" stroke="hsl(195 75% 60%)" />
      <path d="M14 26v3M26 26v3" opacity="0.5" />
    </svg>
  );
}

/** Members без участников. */
export function EmptyMembersIcon() {
  return (
    <svg {...baseProps}>
      <circle cx="16" cy="15" r="4" />
      <path d="M9 28a7 7 0 0114 0" />
      <circle cx="27" cy="13" r="3" opacity="0.6" stroke="hsl(195 75% 60%)" />
      <path d="M24 21a5 5 0 0110 0" opacity="0.55" />
    </svg>
  );
}
