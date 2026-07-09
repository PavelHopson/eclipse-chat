import { useMemo, useState, type ReactNode } from "react";
import "../styles/dm-home.css";
import { Avatar } from "./Avatar";
import { GroupAvatar, deriveGroupTitle } from "./GroupAvatar";
import { EmptyState } from "./EmptyState";
import { EmptyDmIcon } from "./EmptyIcons";
import type {
  DmConversation,
  DmConversationGroup,
} from "../hooks/useDirectConversations";
import { dmStatusMeta } from "../lib/dmPresence";

type Props = {
  conversations: DmConversation[];
  loading: boolean;
  error: string | null;
  selectedDmId: string | null;
  onSelect: (id: string) => void;
  /** Кто сейчас online (userId Set). */
  onlineUserIds?: Set<string>;
  /** Id текущего пользователя — для derive group title без меня. */
  currentUserId: string;
  /** Открывает CreateGroupDmModal. Если undefined — кнопка скрыта. */
  onCreateGroup?: () => void;
  /** Начать новую переписку — открывает «Друзья» (выбор собеседника).
   *  Если undefined — кнопка «Новое сообщение» скрыта. */
  onNewMessage?: () => void;
  /** Вход «Друзья» (FriendsPanel) — рендерится над списком ЛС. */
  friendsPanel?: ReactNode;
};

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffMin = Math.round((now - then) / 60_000);
  if (diffMin < 1) return "сейчас";
  if (diffMin < 60) return `${diffMin}м`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `${diffH}ч`;
  const diffD = Math.round(diffH / 24);
  if (diffD < 7) return `${diffD}д`;
  return new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}


function GroupRow({
  c,
  active,
  currentUserId,
  onSelect,
}: {
  c: DmConversationGroup;
  active: boolean;
  currentUserId: string;
  onSelect: (id: string) => void;
}) {
  const title = c.name?.trim() || deriveGroupTitle(c.participants, currentUserId);
  const preview = c.lastMessage
    ? `${c.lastMessage.mine ? "Вы: " : ""}${c.lastMessage.content}`
    : `${c.participants.length} участников`;
  const isUnread = c.unread > 0;
  return (
    <button
      type="button"
      onClick={() => onSelect(c.id)}
      className={`ec-dmx-row${active ? " is-active" : ""}${isUnread ? " is-unread" : ""}`}
      title={c.participants.map((p) => p.displayName).join(", ")}
    >
      <span className="ec-dmx-row__av">
        <GroupAvatar participants={c.participants} size={40} />
      </span>
      <span className="ec-dmx-row__main">
        <span className="ec-dmx-row__top">
          <span className="ec-dmx-row__name">{title}</span>
          <span className="ec-dmx-row__time">
            {c.lastMessage ? relativeTime(c.lastMessage.createdAt) : ""}
          </span>
        </span>
        <span className="ec-dmx-row__sub">
          <span className="ec-dmx-row__sub-text">{preview}</span>
        </span>
      </span>
      {isUnread && (
        <span className="ec-dmx-row__unread" aria-label={`${c.unread} непрочитанных`}>
          {c.unread > 99 ? "99+" : c.unread}
        </span>
      )}
    </button>
  );
}

export function DirectConversationList({
  conversations,
  loading,
  error,
  selectedDmId,
  onSelect,
  onlineUserIds,
  currentUserId,
  onCreateGroup,
  onNewMessage,
  friendsPanel,
}: Props) {
  const [query, setQuery] = useState("");

  const convoName = (c: DmConversation): string => {
    if (c.isGroup) return c.name?.trim() || deriveGroupTitle(c.participants, currentUserId);
    if (c.saved) return "Избранное";
    return c.other.displayName;
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) => convoName(c).toLowerCase().includes(q));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversations, query]);

  const savedConvo =
    filtered.find((c): c is DmConversation & { saved: true } => !c.isGroup && c.saved === true) ??
    null;
  const regularConvos = filtered.filter(
    (c) => c.isGroup || !(c as { saved?: boolean }).saved,
  );

  return (
    <aside className="ec-dmx" aria-label="Личные сообщения">
      <div className="ec-dmx__head">
        <div className="ec-dmx__title">
          <span className="ec-dmx__dot" aria-hidden />
          Сообщения
        </div>
        {onCreateGroup && (
          <button
            type="button"
            className="ec-dmx__head-btn"
            onClick={onCreateGroup}
            title="Создать группу"
            aria-label="Создать группу"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M19 8v6" />
              <path d="M22 11h-6" />
            </svg>
          </button>
        )}
      </div>

      {onNewMessage && (
        <button
          type="button"
          className="ec-btn ec-btn--primary ec-btn--sm ec-dmx__compose"
          onClick={onNewMessage}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
          </svg>
          Новое сообщение
        </button>
      )}

      <div className="ec-dmx__search">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Найти беседу"
          aria-label="Поиск по личным сообщениям"
        />
      </div>

      {friendsPanel}

      <div className="ec-dmx__label">Личные сообщения</div>

      <div className="ec-dmx__list">
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

        {/* «Избранное» — self-conversation, всегда сверху. */}
        {savedConvo && (
          <>
            <button
              type="button"
              onClick={() => onSelect(savedConvo.id)}
              className={`ec-dmx-row${savedConvo.id === selectedDmId ? " is-active" : ""}`}
            >
              <span className="ec-dmx-row__saved-tile" aria-hidden>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
                </svg>
              </span>
              <span className="ec-dmx-row__main">
                <span className="ec-dmx-row__top">
                  <span className="ec-dmx-row__name">Избранное</span>
                  <span className="ec-dmx-row__time">
                    {savedConvo.lastMessage ? relativeTime(savedConvo.lastMessage.createdAt) : ""}
                  </span>
                </span>
                <span className="ec-dmx-row__sub">
                  <span className="ec-dmx-row__sub-text">
                    {savedConvo.lastMessage?.content ?? "Заметки, ссылки и файлы для себя"}
                  </span>
                </span>
              </span>
            </button>
            <div className="ec-dmx__divider" aria-hidden />
          </>
        )}

        {!loading && !error && regularConvos.length === 0 && (
          query.trim() ? (
            <p className="ec-dmx__empty">Ничего не найдено по «{query.trim()}».</p>
          ) : (
            <EmptyState
              icon={<EmptyDmIcon />}
              title="Пока нет диалогов"
              hint="Начни переписку через «Друзья» выше или собери группу кнопкой ＋."
            />
          )
        )}

        {regularConvos.map((c) => {
          const isActive = c.id === selectedDmId;
          if (c.isGroup) {
            return (
              <GroupRow
                key={c.id}
                c={c}
                active={isActive}
                currentUserId={currentUserId}
                onSelect={onSelect}
              />
            );
          }
          const isOnline = onlineUserIds?.has(c.other.id) ?? false;
          // v1.6.64 — manualStatus авторитетен для ЛС-собеседника (live по socket);
          // members-online (onlineUserIds) пуст в режиме ЛС → лишь fallback при
          // отсутствии manualStatus. Так список presence не серый-всегда, и цвета
          // совпадают с шапкой 1:1 (общий dmStatusMeta).
          const statusMeta = dmStatusMeta(c.other.manualStatus);
          const dotColor =
            statusMeta?.color ??
            (isOnline ? "var(--ec-presence-online)" : "var(--ec-presence-offline)");
          const showOnline = statusMeta ? statusMeta.active : isOnline;
          const hasActivity = Boolean(c.other.activityEmoji || c.other.activityText);
          const isUnread = c.unread > 0;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => onSelect(c.id)}
              className={`ec-dmx-row${isActive ? " is-active" : ""}${isUnread ? " is-unread" : ""}`}
            >
              <span className="ec-dmx-row__av">
                <Avatar url={c.other.avatar} name={c.other.displayName} size={40} />
                <span
                  className="ec-dmx-row__pres"
                  aria-hidden
                  style={{
                    background: dotColor,
                    boxShadow: showOnline ? "0 0 6px hsl(150 50% 50% / 0.5)" : "none",
                  }}
                />
              </span>
              <span className="ec-dmx-row__main">
                <span className="ec-dmx-row__top">
                  <span className="ec-dmx-row__name">{c.other.displayName}</span>
                  <span className="ec-dmx-row__time">
                    {c.lastMessage ? relativeTime(c.lastMessage.createdAt) : ""}
                  </span>
                </span>
                <span className="ec-dmx-row__sub">
                  {hasActivity ? (
                    <>
                      {c.other.activityEmoji && (
                        <span className="ec-dmx-row__emoji">{c.other.activityEmoji}</span>
                      )}
                      <span className="ec-dmx-row__sub-text">{c.other.activityText}</span>
                    </>
                  ) : (
                    <span className="ec-dmx-row__sub-text">
                      {c.lastMessage
                        ? `${c.lastMessage.mine ? "Вы: " : ""}${c.lastMessage.content}`
                        : "Начало разговора"}
                    </span>
                  )}
                </span>
              </span>
              {isUnread && (
                <span className="ec-dmx-row__unread" aria-label={`${c.unread} непрочитанных`}>
                  {c.unread > 99 ? "99+" : c.unread}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </aside>
  );
}
