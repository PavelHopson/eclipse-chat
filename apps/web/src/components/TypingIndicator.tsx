import type { CSSProperties } from "react";
import type { TypingUser } from "../hooks/useMessages";

type Props = {
  users: TypingUser[];
};

const wrap: CSSProperties = {
  padding: "0 var(--ec-space-5) 4px",
  minHeight: 22,
  display: "flex",
  alignItems: "center",
  fontSize: "var(--ec-text-xs)",
  color: "var(--ec-text-muted)",
  pointerEvents: "none",
};

function format(users: TypingUser[]): string {
  if (users.length === 0) return "";
  if (users.length === 1) return `${users[0].displayName} печатает`;
  if (users.length === 2) return `${users[0].displayName} и ${users[1].displayName} печатают`;
  if (users.length === 3) {
    return `${users[0].displayName}, ${users[1].displayName} и ${users[2].displayName} печатают`;
  }
  return `${users[0].displayName} и ещё ${users.length - 1} печатают`;
}

export function TypingIndicator({ users }: Props) {
  if (users.length === 0) {
    // оставляем wrap чтобы не было layout-shift при появлении
    return <div style={wrap} aria-live="polite" aria-atomic="true" />;
  }
  return (
    <div style={wrap} aria-live="polite" aria-atomic="true">
      <span className="ec-typing">
        <span className="ec-typing-dot" />
        <span className="ec-typing-dot" />
        <span className="ec-typing-dot" />
      </span>
      <span style={{ marginLeft: 8 }}>{format(users)}…</span>
    </div>
  );
}
