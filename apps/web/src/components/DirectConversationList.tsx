import type { CSSProperties } from "react";
import { Avatar } from "./Avatar";
import type { DmConversation } from "../hooks/useDirectConversations";

type Props = {
  conversations: DmConversation[];
  loading: boolean;
  error: string | null;
  selectedDmId: string | null;
  onSelect: (id: string) => void;
  /** Кто сейчас online (userId Set). Из presence-tracker через MemberList API
   *  — но для DM нам нужен глобальный online tracker. Пока берём из useMembers
   *  активного сервера если есть; иначе все offline. */
  onlineUserIds?: Set<string>;
};

const wrap: CSSProperties = {
  background: "var(--ec-surface-1)",
  borderRight: "1px solid var(--ec-border-subtle)",
  display: "flex",
  flexDirection: "column",
  minWidth: 0,
};

const headerStyle: CSSProperties = {
  padding: "var(--ec-space-3) var(--ec-space-4)",
  borderBottom: "1px solid var(--ec-border-subtle)",
  display: "flex",
  alignItems: "center",
  gap: 8,
};

const listScroll: CSSProperties = {
  flex: 1,
  overflow: "auto",
  padding: "var(--ec-space-3) var(--ec-space-2)",
  display: "flex",
  flexDirection: "column",
  gap: 2,
};

const rowStyle = (active: boolean): CSSProperties => ({
  display: "grid",
  gridTemplateColumns: "auto 1fr auto",
  alignItems: "center",
  gap: "var(--ec-space-2)",
  padding: "var(--ec-space-2)",
  borderRadius: "var(--ec-radius-sm)",
  fontSize: "var(--ec-text-sm)",
  color: active ? "var(--ec-text-strong)" : "var(--ec-text)",
  background: active ? "var(--ec-surface-2)" : "transparent",
  border: 0,
  textAlign: "left",
  cursor: "pointer",
  width: "100%",
  transition: "background var(--ec-dur-fast) var(--ec-ease)",
});

const presenceDot: CSSProperties = {
  position: "absolute",
  bottom: -1,
  right: -1,
  width: 10,
  height: 10,
  borderRadius: "var(--ec-radius-full)",
  border: "2px solid var(--ec-surface-1)",
};

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffMs = now - then;
  const diffMin = Math.round(diffMs / 60_000);
  if (diffMin < 1) return "сейчас";
  if (diffMin < 60) return `${diffMin}м`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `${diffH}ч`;
  const diffD = Math.round(diffH / 24);
  if (diffD < 7) return `${diffD}д`;
  return new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

export function DirectConversationList({
  conversations,
  loading,
  error,
  selectedDmId,
  onSelect,
  onlineUserIds,
}: Props) {
  const savedConvo = conversations.find((c) => c.saved) ?? null;
  const regularConvos = conversations.filter((c) => !c.saved);
  return (
    <aside style={wrap} aria-label="Личные сообщения">
      <header style={headerStyle}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ec-accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
        </svg>
        <strong style={{ color: "var(--ec-text-strong)", fontSize: "var(--ec-text-base)" }}>
          Личные сообщения
        </strong>
      </header>

      <div style={listScroll}>
        {loading && conversations.length === 0 && (
          <div className="ec-skeleton-list" aria-label="Загрузка диалогов">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="ec-skeleton-row">
                <div className="ec-skeleton-row__avatar" />
                <div className="ec-skeleton-row__bars">
                  <div className="ec-skeleton-row__bar" />
                  <div className="ec-skeleton-row__bar ec-skeleton-row__bar--sub" />
                </div>
              </div>
            ))}
          </div>
        )}
        {error && (
          <p style={{ color: "var(--ec-danger)", fontSize: "var(--ec-text-sm)", padding: "var(--ec-space-2)", margin: 0 }}>
            {error}
          </p>
        )}

        {/* «Избранное» — self-conversation, всегда закреплено сверху. */}
        {savedConvo && (
          <>
            <button
              type="button"
              onClick={() => onSelect(savedConvo.id)}
              style={{
                ...rowStyle(savedConvo.id === selectedDmId),
                marginBottom: 2,
              }}
              onMouseEnter={(e) => {
                if (savedConvo.id !== selectedDmId)
                  e.currentTarget.style.background = "var(--ec-surface-2)";
              }}
              onMouseLeave={(e) => {
                if (savedConvo.id !== selectedDmId)
                  e.currentTarget.style.background = "transparent";
              }}
            >
              <span
                aria-hidden
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "var(--ec-radius-md)",
                  display: "grid",
                  placeItems: "center",
                  background: "var(--ec-accent-soft)",
                  color: "var(--ec-accent)",
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
                </svg>
              </span>
              <span style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  Избранное
                </span>
                <span
                  style={{
                    fontSize: "var(--ec-text-2xs)",
                    color: "var(--ec-text-dim)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {savedConvo.lastMessage?.content ?? "Заметки, ссылки и файлы для себя"}
                </span>
              </span>
              <span style={{ fontSize: "0.6rem", color: "var(--ec-text-dim)" }}>
                {savedConvo.lastMessage ? relativeTime(savedConvo.lastMessage.createdAt) : ""}
              </span>
            </button>
            <div
              style={{
                height: 1,
                background: "var(--ec-border-subtle)",
                margin: "var(--ec-space-1) var(--ec-space-2) var(--ec-space-2)",
              }}
              aria-hidden
            />
          </>
        )}

        {!loading && !error && regularConvos.length === 0 && (
          <div className="ec-empty" style={{ padding: "var(--ec-space-5) var(--ec-space-3)" }}>
            <div className="ec-empty-icon" aria-hidden>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
              </svg>
            </div>
            <div className="ec-empty-title">Пусто</div>
            <div className="ec-empty-hint">
              Открой профиль участника в любом сервере и нажми «Написать в личку».
            </div>
          </div>
        )}

        {regularConvos.map((c) => {
          const isActive = c.id === selectedDmId;
          const isOnline = onlineUserIds?.has(c.other.id) ?? false;
          const isInvisible = c.other.manualStatus === "INVISIBLE";
          const showOnline = isOnline && !isInvisible;
          const preview = c.lastMessage?.content ?? "Начало разговора";
          const isUnread = c.unread > 0;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => onSelect(c.id)}
              style={{
                ...rowStyle(isActive),
                ...(isUnread ? { color: "var(--ec-text-strong)", fontWeight: 600 } : {}),
              }}
              onMouseEnter={(e) => {
                if (!isActive) e.currentTarget.style.background = "var(--ec-surface-2)";
              }}
              onMouseLeave={(e) => {
                if (!isActive) e.currentTarget.style.background = "transparent";
              }}
            >
              <span style={{ position: "relative", display: "inline-block" }}>
                <Avatar url={c.other.avatar} name={c.other.displayName} size={32} />
                <span
                  aria-hidden
                  style={{
                    ...presenceDot,
                    background: showOnline
                      ? c.other.manualStatus === "IDLE"
                        ? "var(--ec-presence-idle)"
                        : c.other.manualStatus === "DND"
                        ? "var(--ec-presence-dnd)"
                        : "var(--ec-presence-online)"
                      : "var(--ec-presence-offline)",
                    boxShadow: showOnline ? "0 0 6px hsl(150 50% 50% / 0.5)" : "none",
                  }}
                />
              </span>
              <span style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}>
                  {c.other.displayName}
                </span>
                <span style={{
                  fontSize: "var(--ec-text-2xs)",
                  color: isUnread ? "var(--ec-text-muted)" : "var(--ec-text-dim)",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}>
                  {c.lastMessage?.mine && "Вы: "}{preview}
                </span>
              </span>
              <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                <span style={{ fontSize: "0.6rem", color: "var(--ec-text-dim)" }}>
                  {c.lastMessage ? relativeTime(c.lastMessage.createdAt) : ""}
                </span>
                {isUnread && (
                  <span
                    aria-label={`${c.unread} непрочитанных`}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      minWidth: 18,
                      height: 18,
                      padding: "0 5px",
                      borderRadius: "var(--ec-radius-full)",
                      background: "var(--ec-accent)",
                      color: "var(--ec-accent-text, #fff)",
                      fontSize: "0.6rem",
                      fontWeight: 700,
                      fontFeatureSettings: '"tnum"',
                      boxShadow: "0 0 8px hsl(195 70% 60% / 0.5)",
                    }}
                  >
                    {c.unread > 99 ? "99+" : c.unread}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
