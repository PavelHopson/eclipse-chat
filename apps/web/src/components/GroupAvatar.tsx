import type { CSSProperties } from "react";
import { Avatar } from "./Avatar";

/**
 * Composite avatar для group DM: 2 stacked avatars + counter если participants > 2.
 *
 * Pattern: front avatar — слегка приподнят и right-смещён; back avatar —
 * глубже на серой подложке. Когда participants ≥ 3 — внизу-справа маленький
 * pill с количеством остальных («+2», «+5»…), стилизованный под semantic
 * accent (cool sky) чтобы не путать с unread bubble.
 *
 * Если participants пустые (corner case при загрузке) — рендерим
 * generic group glyph как fallback.
 */

type Participant = {
  id: string;
  displayName: string;
  avatar: string | null;
};

type Props = {
  participants: Participant[];
  /** Size общего bounding box. Внутренние avatars вычисляются как ~70% от него. */
  size?: number;
};

export function GroupAvatar({ participants, size = 32 }: Props) {
  const innerSize = Math.round(size * 0.72);
  const wrap: CSSProperties = {
    position: "relative",
    width: size,
    height: size,
    flexShrink: 0,
  };

  if (participants.length === 0) {
    return (
      <span
        style={{
          ...wrap,
          display: "grid",
          placeItems: "center",
          borderRadius: "var(--ec-radius-md)",
          background: "var(--ec-accent-soft)",
          color: "var(--ec-accent)",
        }}
        aria-hidden
      >
        <svg width={Math.round(size * 0.55)} height={Math.round(size * 0.55)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 00-3-3.87" />
          <path d="M16 3.13a4 4 0 010 7.75" />
        </svg>
      </span>
    );
  }

  // Берём первые два participant'а для composite. Остальные считаются в "+N".
  const [first, second] = participants;
  const extra = participants.length - 2;

  return (
    <span style={wrap} aria-hidden>
      {/* Back avatar — second participant (или generic если только один). */}
      {second && (
        <span
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            borderRadius: "var(--ec-radius-full)",
            boxShadow: "0 0 0 2px var(--ec-surface-1)",
          }}
        >
          <Avatar url={second.avatar} name={second.displayName} size={innerSize} />
        </span>
      )}
      {/* Front avatar — first participant. */}
      <span
        style={{
          position: "absolute",
          right: 0,
          bottom: 0,
          borderRadius: "var(--ec-radius-full)",
          boxShadow: "0 0 0 2px var(--ec-surface-1)",
        }}
      >
        <Avatar url={first.avatar} name={first.displayName} size={innerSize} />
      </span>
      {/* +N counter если есть остальные. Маленький cool-sky pill. */}
      {extra > 0 && (
        <span
          style={{
            position: "absolute",
            right: -4,
            top: -4,
            minWidth: 16,
            height: 16,
            padding: "0 4px",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: "var(--ec-radius-full)",
            background: "var(--ec-accent)",
            color: "var(--ec-accent-text, #fff)",
            fontSize: "0.55rem",
            fontWeight: 700,
            fontFeatureSettings: '"tnum"',
            boxShadow: "0 0 0 2px var(--ec-surface-1)",
          }}
        >
          +{extra}
        </span>
      )}
    </span>
  );
}

/**
 * Auto-derived group title из participants. Frontend fallback когда
 * `conversation.name` = null. Берёт первые 3 displayName, добавляет «+N»
 * если есть остальные.
 *
 * Не включает текущего пользователя — в title группы себя обычно не
 * указываем (даже если технически participant).
 */
export function deriveGroupTitle(
  participants: Participant[],
  excludeUserId: string,
  fallback = "Группа",
): string {
  const others = participants.filter((p) => p.id !== excludeUserId);
  if (others.length === 0) return fallback;
  const head = others.slice(0, 3).map((p) => p.displayName).join(", ");
  const extra = others.length - 3;
  return extra > 0 ? `${head} +${extra}` : head;
}
