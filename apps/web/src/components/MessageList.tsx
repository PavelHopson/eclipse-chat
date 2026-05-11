import type { CSSProperties } from "react";
import { useEffect, useRef } from "react";
import type { MessageRow } from "../hooks/useMessages";

type Props = {
  messages: MessageRow[];
  emptyHint?: string;
};

const wrap: CSSProperties = {
  flex: 1,
  overflowY: "auto",
  padding: "16px 18px",
  display: "flex",
  flexDirection: "column",
  gap: 8,
};

const msgBase: CSSProperties = {
  padding: "0.5rem 0.65rem",
  background: "#1a1a22",
  borderRadius: 8,
  fontSize: "0.92rem",
  lineHeight: 1.4,
};

export function MessageList({ messages, emptyHint }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) {
      return;
    }
    // авто-скролл вниз при новых сообщениях, если user уже был у дна
    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (isAtBottom) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages.length]);

  if (messages.length === 0) {
    return (
      <div style={{ ...wrap, alignItems: "center", justifyContent: "center" }}>
        <p style={{ opacity: 0.5 }}>{emptyHint ?? "Сообщений ещё нет"}</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} style={wrap}>
      {messages.map((m) => (
        <article key={m.id} style={msgBase}>
          <header style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <strong style={{ color: "#9ac" }}>{m.user.displayName}</strong>
            <time style={{ opacity: 0.4, fontSize: "0.72rem" }} dateTime={m.createdAt}>
              {m.createdAt.slice(11, 16)}
            </time>
          </header>
          <p style={{ margin: "4px 0 0", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{m.content}</p>
        </article>
      ))}
    </div>
  );
}
