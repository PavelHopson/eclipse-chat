import type { CSSProperties } from "react";
import { useEffect, useRef } from "react";
import { Avatar } from "./Avatar";
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
  gap: 6,
};

const rowBase: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "40px 1fr",
  gap: 10,
  padding: "0.35rem 0.5rem",
  borderRadius: 8,
  fontSize: "0.92rem",
  lineHeight: 1.45,
};

const groupedRow: CSSProperties = {
  ...rowBase,
  paddingTop: 0,
  paddingBottom: 2,
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
      {messages.map((m, i) => {
        // Группировка: если предыдущее сообщение того же автора и в пределах 5 минут —
        // прячем аватар и header у текущего. Это первый шаг к нормальной chat-ленте
        // (полноценная группировка с day-separators — задача v0.6 redesign).
        const prev = i > 0 ? messages[i - 1] : null;
        const sameAuthor = prev?.user.id === m.user.id;
        const closeInTime =
          prev != null && new Date(m.createdAt).getTime() - new Date(prev.createdAt).getTime() < 5 * 60 * 1000;
        const grouped = Boolean(sameAuthor && closeInTime);
        return (
          <article key={m.id} style={grouped ? groupedRow : rowBase}>
            <div style={{ display: "flex", justifyContent: "center", paddingTop: grouped ? 0 : 2 }}>
              {grouped ? null : <Avatar url={m.user.avatar} name={m.user.displayName} size={32} />}
            </div>
            <div style={{ minWidth: 0 }}>
              {!grouped && (
                <header style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                  <strong style={{ color: "#dadde3" }}>{m.user.displayName}</strong>
                  <time style={{ opacity: 0.4, fontSize: "0.72rem" }} dateTime={m.createdAt}>
                    {m.createdAt.slice(11, 16)}
                  </time>
                </header>
              )}
              <p style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{m.content}</p>
            </div>
          </article>
        );
      })}
    </div>
  );
}
