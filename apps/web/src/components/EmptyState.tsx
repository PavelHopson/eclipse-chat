import type { CSSProperties, ReactNode } from "react";

/**
 * EmptyState — единый calm-layout для empty data states.
 *
 * Заменяет ad-hoc `<div className="ec-empty">` usage по всей кодовой
 * базе на reusable component с consistent visual rhythm. SVG icon
 * предоставляется через `icon` prop из EmptyIcons.tsx — минимальный
 * line-art set в Eclipse-почерке (layered void + cyan accent).
 *
 * Tone (по brief Pavel'я + Codex review):
 *  - НЕ stub-кнопки, НЕ AI marketing copy
 *  - Calm, операторский, объясняет «что значит пустота» + «как это
 *    заполняется»
 *  - Optional action — только если действие очевидно (создать первое
 *    сообщение, переключить server, и т.п.)
 */

type Props = {
  icon: ReactNode;
  title: string;
  hint?: string;
  action?: ReactNode;
  /** compact = меньше padding, smaller icon. Default false. */
  compact?: boolean;
};

const wrap: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: "var(--ec-space-3)",
  textAlign: "center",
  flex: 1,
  minHeight: 0,
};

const iconWrap = (compact: boolean): CSSProperties => ({
  // v1.1.22: размер увеличен (84→96) под detailed game-иконки;
  // border убран — у game-иконок собственный glow/smoke, лишняя
  // рамка конфликтует. Остаётся subtle radial-подложка.
  width: compact ? 64 : 96,
  height: compact ? 64 : 96,
  borderRadius: "50%",
  display: "grid",
  placeItems: "center",
  color: "var(--ec-text-dim)",
  background:
    "radial-gradient(circle at 50% 45%, hsl(258 90% 66% / 0.1), hsl(208 30% 12% / 0) 72%)",
});

const titleStyle: CSSProperties = {
  fontSize: "var(--ec-text-lg)",
  fontWeight: 600,
  color: "var(--ec-text)",
  margin: 0,
};

const hintStyle: CSSProperties = {
  fontSize: "var(--ec-text-sm)",
  color: "var(--ec-text-muted)",
  maxWidth: "34ch",
  lineHeight: 1.5,
  margin: 0,
};

export function EmptyState({ icon, title, hint, action, compact = false }: Props) {
  return (
    <div
      style={{
        ...wrap,
        padding: compact ? "var(--ec-space-4)" : "var(--ec-space-6) var(--ec-space-4)",
      }}
    >
      <div style={iconWrap(compact)} aria-hidden>
        {icon}
      </div>
      <h3 style={titleStyle}>{title}</h3>
      {hint && <p style={hintStyle}>{hint}</p>}
      {action && <div style={{ marginTop: "var(--ec-space-2)" }}>{action}</div>}
    </div>
  );
}
