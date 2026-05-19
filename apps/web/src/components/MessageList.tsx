import type { CSSProperties } from "react";
import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { Attachments } from "./Attachments";
import { Avatar } from "./Avatar";
import { EmojiPicker } from "./EmojiPicker";
import { RichContent } from "./RichContent";
import { LinkEmbedCard } from "./LinkEmbedCard";
import { extractFirstUrl } from "../lib/linkExtract";
import type { ActionItemStatus, ActionItemType, MessageRow } from "../hooks/useMessages";
import type { MemberRole } from "../hooks/useMembers";
import {
  BOT_ROLE_COLORS,
  BOT_ROLE_LABELS,
  isBotRole,
  type BotRole,
} from "../lib/botRoles";

type Props = {
  messages: MessageRow[];
  emptyHint?: string;
  channelName?: string | null;
  listKey?: string | null;
  currentUserId?: string;
  currentUserName?: string;
  currentRole?: MemberRole | null;
  /** Bot typing: shimmer «{label} собирает ответ» (v0.40 local + v0.48 socket). */
  pendingBotTyping?: { role: BotRole; label: string } | null;
  /** Display names известных members активного сервера — для @mention detection. */
  mentionNames?: string[];
  onRetry?: (messageId: string) => Promise<boolean>;
  onEdit?: (messageId: string, content: string) => Promise<boolean>;
  onDelete?: (messageId: string) => Promise<boolean>;
  onPin?: (messageId: string) => Promise<boolean>;
  onUnpin?: (messageId: string) => Promise<boolean>;
  onToggleReaction?: (messageId: string, emoji: string) => Promise<boolean>;
  onCreateAction?: (messageId: string, type: ActionItemType) => Promise<boolean>;
  onToggleActionStatus?: (actionId: string, nextStatus: ActionItemStatus) => Promise<boolean>;
  /** Открыть Thread panel для этого root message. Скрывает кнопку если не задано. */
  onOpenThread?: (messageId: string) => void;
  /** v0.61: запустить shared listening для audio attachment'а. */
  onPlayShared?: (attachmentId: string) => void | Promise<void>;
};

const shell: CSSProperties = {
  flex: 1,
  minHeight: 0,
  position: "relative",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
};

const wrap: CSSProperties = {
  flex: 1,
  overflowY: "auto",
  padding: "var(--ec-space-4) var(--ec-space-5) var(--ec-space-2)",
  display: "flex",
  flexDirection: "column",
  gap: 2,
};

const rowBase: CSSProperties = {
  position: "relative",
  display: "grid",
  gridTemplateColumns: "44px 1fr",
  columnGap: "var(--ec-space-3)",
  padding: "var(--ec-space-2) var(--ec-space-2)",
  paddingRight: 12,
  borderRadius: "var(--ec-radius-md)",
  transition: "background var(--ec-dur-fast) var(--ec-ease)",
};

const rowGrouped: CSSProperties = {
  ...rowBase,
  paddingTop: 2,
  paddingBottom: 2,
};

const rowPinned: CSSProperties = {
  ...rowBase,
  background: "hsl(40 70% 60% / 0.06)",
  borderLeft: "2px solid var(--ec-warn)",
  paddingLeft: 6,
};

const daySeparator: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "var(--ec-space-3)",
  margin: "var(--ec-space-4) 0 var(--ec-space-2)",
  fontSize: "var(--ec-text-2xs)",
  letterSpacing: "var(--ec-tracking-caps)",
  textTransform: "uppercase",
  color: "var(--ec-text-dim)",
};

const dayLine: CSSProperties = {
  flex: 1,
  height: 1,
  background: "var(--ec-border-subtle)",
};

const stickyTime: CSSProperties = {
  fontFamily: "var(--ec-font-mono)",
  fontSize: "var(--ec-text-2xs)",
  color: "var(--ec-text-dim)",
  whiteSpace: "nowrap",
  paddingTop: 4,
  opacity: 0,
  transition: "opacity var(--ec-dur-fast) var(--ec-ease)",
};

const actionsBar: CSSProperties = {
  position: "absolute",
  top: -10,
  right: 12,
  display: "flex",
  gap: 2,
  padding: 2,
  background: "var(--ec-surface-2)",
  border: "1px solid var(--ec-border-subtle)",
  borderRadius: "var(--ec-radius-md)",
  boxShadow: "var(--ec-shadow-sm)",
  opacity: 0,
  transition: "opacity var(--ec-dur-fast) var(--ec-ease)",
  pointerEvents: "none",
  zIndex: 2,
};

const actionBtn: CSSProperties = {
  width: 26,
  height: 26,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "transparent",
  border: 0,
  borderRadius: "var(--ec-radius-sm)",
  color: "var(--ec-text-muted)",
  cursor: "pointer",
  transition: "background var(--ec-dur-fast) var(--ec-ease), color var(--ec-dur-fast) var(--ec-ease)",
};

const failedTag: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  marginLeft: "var(--ec-space-2)",
  padding: "0.05rem 0.45rem",
  background: "var(--ec-danger-soft)",
  color: "var(--ec-danger)",
  border: "1px solid var(--ec-danger)",
  borderRadius: "var(--ec-radius-full)",
  fontSize: "var(--ec-text-2xs)",
  fontWeight: 600,
  letterSpacing: "var(--ec-tracking-wide)",
};

const editAreaWrap: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
  marginTop: 4,
};

function labelForAction(type: ActionItemType): string {
  if (type === "DECISION") return "Decision";
  if (type === "FOLLOW_UP") return "Follow-up";
  return "Task";
}

function tintForAction(type: ActionItemType, status: ActionItemStatus) {
  if (status === "DONE") {
    return {
      bg: "color-mix(in srgb, var(--ec-surface-3) 75%, transparent)",
      fg: "var(--ec-text-dim)",
      border: "var(--ec-border-subtle)",
    };
  }
  if (type === "DECISION") {
    return {
      bg: "hsl(47 85% 58% / 0.12)",
      fg: "hsl(47 88% 68%)",
      border: "hsl(47 72% 46% / 0.32)",
    };
  }
  if (type === "FOLLOW_UP") {
    return {
      bg: "hsl(170 70% 52% / 0.12)",
      fg: "hsl(170 74% 64%)",
      border: "hsl(170 64% 46% / 0.28)",
    };
  }
  return {
    bg: "var(--ec-accent-soft)",
    fg: "var(--ec-accent)",
    border: "var(--ec-border-accent)",
  };
}

const editTextarea: CSSProperties = {
  width: "100%",
  minHeight: 60,
  padding: "0.5rem 0.6rem",
  background: "var(--ec-input-bg)",
  color: "var(--ec-text)",
  border: "1px solid var(--ec-accent)",
  boxShadow: "0 0 0 3px var(--ec-accent-soft)",
  borderRadius: "var(--ec-radius-md)",
  fontSize: "var(--ec-text-base)",
  lineHeight: "var(--ec-leading-normal)",
  fontFamily: "var(--ec-font-sans)",
  resize: "vertical",
};

function formatTime(iso: string): string {
  return iso.slice(11, 16);
}

function formatDay(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yest = new Date(today);
  yest.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (sameDay(d, today)) return "Сегодня";
  if (sameDay(d, yest)) return "Вчера";
  return d.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: d.getFullYear() === today.getFullYear() ? undefined : "numeric",
  });
}

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

function canModerate(role: MemberRole | null | undefined): boolean {
  return role === "OWNER" || role === "ADMIN" || role === "MODERATOR";
}

const BOTTOM_THRESHOLD_PX = 96;

function isNearBottom(el: HTMLDivElement): boolean {
  return el.scrollHeight - el.scrollTop - el.clientHeight < BOTTOM_THRESHOLD_PX;
}

export function MessageList({
  messages,
  emptyHint,
  channelName,
  listKey,
  currentUserId,
  currentUserName,
  currentRole,
  pendingBotTyping,
  mentionNames = [],
  onRetry,
  onEdit,
  onDelete,
  onPin,
  onUnpin,
  onToggleReaction,
  onCreateAction,
  onToggleActionStatus,
  onOpenThread,
  onPlayShared,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [pickerFor, setPickerFor] = useState<{ messageId: string; rect: DOMRect } | null>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [unreadAnchorId, setUnreadAnchorId] = useState<string | null>(null);
  const [newMessagesCount, setNewMessagesCount] = useState(0);
  const atBottomRef = useRef(true);
  const listKeyRef = useRef<string | null>(listKey ?? null);
  const tailIdRef = useRef<string | null>(null);
  const messageCountRef = useRef(0);

  const clearNewMessageMarker = useCallback(() => {
    setUnreadAnchorId(null);
    setNewMessagesCount(0);
  }, []);

  const syncBottomState = useCallback(() => {
    const el = containerRef.current;
    const next = !el || isNearBottom(el);
    if (atBottomRef.current !== next) {
      atBottomRef.current = next;
      setIsAtBottom(next);
    }
    return next;
  }, []);

  const scrollToLatest = useCallback(
    (behavior: ScrollBehavior = "smooth") => {
      const el = containerRef.current;
      if (!el) return;
      el.scrollTo({ top: el.scrollHeight, behavior });
      atBottomRef.current = true;
      setIsAtBottom(true);
      clearNewMessageMarker();
    },
    [clearNewMessageMarker],
  );

  const handleScroll = useCallback(() => {
    if (syncBottomState()) clearNewMessageMarker();
  }, [clearNewMessageMarker, syncBottomState]);

  useEffect(() => {
    const nextListKey = listKey ?? null;
    if (listKeyRef.current === nextListKey) return;
    listKeyRef.current = nextListKey;
    tailIdRef.current = null;
    messageCountRef.current = 0;
    atBottomRef.current = true;
    setIsAtBottom(true);
    clearNewMessageMarker();
    setPickerFor(null);
    setEditingId(null);
    setEditDraft("");
    requestAnimationFrame(() => scrollToLatest("auto"));
  }, [listKey, clearNewMessageMarker, scrollToLatest]);

  const tail = messages[messages.length - 1];

  useEffect(() => {
    const previousTailId = tailIdRef.current;
    const previousCount = messageCountRef.current;
    tailIdRef.current = tail?.id ?? null;
    messageCountRef.current = messages.length;

    if (!tail) {
      atBottomRef.current = true;
      setIsAtBottom(true);
      clearNewMessageMarker();
      return;
    }

    if (!previousTailId || previousCount === 0) {
      requestAnimationFrame(() => scrollToLatest("auto"));
      return;
    }

    if (tail.id === previousTailId) return;

    const isOwnMessage = Boolean(currentUserId && tail.user.id === currentUserId);
    if (atBottomRef.current || isOwnMessage || tail.pending) {
      requestAnimationFrame(() => scrollToLatest(isOwnMessage ? "smooth" : "auto"));
      return;
    }

    setUnreadAnchorId((current) => current ?? tail.id);
    setNewMessagesCount((count) => count + 1);
  }, [
    tail?.id,
    tail?.user.id,
    tail?.pending,
    messages.length,
    currentUserId,
    clearNewMessageMarker,
    scrollToLatest,
  ]);

  useEffect(() => {
    if (unreadAnchorId && !messages.some((m) => m.id === unreadAnchorId)) {
      clearNewMessageMarker();
    }
  }, [messages, unreadAnchorId, clearNewMessageMarker]);

  const handleCopy = async (m: MessageRow) => {
    try {
      await navigator.clipboard.writeText(m.content);
      setCopiedId(m.id);
      setTimeout(() => setCopiedId((cur) => (cur === m.id ? null : cur)), 1400);
    } catch {
      /* fail silently */
    }
  };

  const beginEdit = (m: MessageRow) => {
    setEditingId(m.id);
    setEditDraft(m.content);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditDraft("");
  };

  const commitEdit = async (m: MessageRow) => {
    if (!onEdit) return;
    const trimmed = editDraft.trim();
    if (trimmed === "" || trimmed === m.content) {
      cancelEdit();
      return;
    }
    const ok = await onEdit(m.id, trimmed);
    if (ok) cancelEdit();
  };

  const handleDelete = async (m: MessageRow) => {
    if (!onDelete) return;
    if (!window.confirm("Удалить сообщение?")) return;
    await onDelete(m.id);
  };

  // Loading state — skeleton screens вместо пустого блока с текстом «Загрузка…».
  // designer-skills (loading-states): «show layout shape before content loads».
  // emptyHint === "Загрузка…" — convention из useMessages/useDirectMessages.
  const isLoading = emptyHint === "Загрузка…";

  if (messages.length === 0 && isLoading) {
    return (
      <div
        ref={containerRef}
        className="ec-message-list"
        style={{ ...wrap, paddingTop: "var(--ec-space-6)" }}
        aria-busy="true"
        aria-label="Загружаем сообщения"
      >
        {[80, 65, 90, 55, 75].map((widthPct, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              gap: "var(--ec-space-3)",
              padding: "var(--ec-space-2) var(--ec-space-5)",
              marginBottom: "var(--ec-space-2)",
              opacity: 1 - i * 0.12,
            }}
          >
            <div
              className="ec-skeleton"
              style={{ width: 36, height: 36, borderRadius: "50%", flexShrink: 0 }}
              aria-hidden
            />
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
              <div
                className="ec-skeleton"
                style={{ width: 120, height: 12, borderRadius: 6 }}
                aria-hidden
              />
              <div
                className="ec-skeleton"
                style={{ width: `${widthPct}%`, height: 14, borderRadius: 6 }}
                aria-hidden
              />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div
        ref={containerRef}
        className="ec-message-list ec-aurora-bg"
        style={{ ...wrap, justifyContent: "center" }}
      >
        <div className="ec-empty">
          <div
            className="ec-empty-icon ec-anim-limbus"
            style={{
              background: "var(--ec-accent-soft)",
              color: "var(--ec-accent)",
              boxShadow:
                "0 0 0 1px var(--ec-accent), 0 0 28px hsl(195 70% 60% / 0.35), inset 0 0 18px hsl(195 70% 60% / 0.18)",
            }}
            aria-hidden
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
            </svg>
          </div>
          <div
            className="ec-empty-title"
            style={{ fontSize: "var(--ec-text-2xl)", letterSpacing: "var(--ec-tracking-tight)" }}
          >
            {channelName ? (
              <>
                Начните разговор в{" "}
                <span style={{ color: "var(--ec-accent)" }}>#{channelName}</span>
              </>
            ) : (
              "Сообщений пока нет"
            )}
          </div>
          <div className="ec-empty-hint" style={{ maxWidth: 380 }}>
            {emptyHint ?? "Будьте первым — напишите что-нибудь ниже."}
          </div>
        </div>
      </div>
    );
  }

  const canMod = canModerate(currentRole);

  return (
    <div className="ec-message-list-shell" style={shell}>
      <div ref={containerRef} className="ec-message-list" style={wrap} onScroll={handleScroll}>
      {pickerFor && onToggleReaction && (
        <EmojiPicker
          anchorRect={pickerFor.rect}
          onPick={(emoji) => {
            void onToggleReaction(pickerFor.messageId, emoji);
          }}
          onClose={() => setPickerFor(null)}
        />
      )}
      {messages.map((m, i) => {
        const prev = i > 0 ? messages[i - 1] : null;
        const sameAuthor = prev?.user.id === m.user.id;
        const closeInTime =
          prev != null && new Date(m.createdAt).getTime() - new Date(prev.createdAt).getTime() < 5 * 60 * 1000;
        const grouped = Boolean(sameAuthor && closeInTime);
        const newDay = !prev || dayKey(m.createdAt) !== dayKey(prev.createdAt);
        const isMine = currentUserId && m.user.id === currentUserId;
        const isCopied = copiedId === m.id;
        const isEditing = editingId === m.id;
        const isDeleted = m.deletedAt != null;
        const isPinned = m.pinnedAt != null;

        // Right action visibility:
        //  copy   — always (if не deleted/pending/failed)
        //  edit   — only own + not deleted + not pending/failed
        //  delete — own OR moderator + not deleted + not pending/failed
        //  pin    — moderator only + not deleted
        //  unpin  — moderator only + pinned + not deleted
        const showActions = !m.pending && !m.failed && !isDeleted && !isEditing;
        const showEdit = showActions && Boolean(isMine && onEdit);
        const showDelete = showActions && Boolean((isMine || canMod) && onDelete);
        const showPin = showActions && Boolean(canMod && onPin && !isPinned);
        const showUnpin = showActions && Boolean(canMod && onUnpin && isPinned);
        const canCreateActions = showActions && Boolean(onCreateAction);
        const existingTypes = new Set(m.actionItems.map((item) => item.type));

        const rowStyle = isPinned ? rowPinned : grouped && !newDay ? rowGrouped : rowBase;

        return (
          <Fragment key={m.id}>
            {newDay && (
              <div style={daySeparator} role="separator">
                <span style={dayLine} aria-hidden />
                <span>{formatDay(m.createdAt)}</span>
                <span style={dayLine} aria-hidden />
              </div>
            )}
            {unreadAnchorId === m.id && (
              <div className="ec-unread-divider" role="separator" aria-label="Новые сообщения">
                <span>Новые сообщения</span>
              </div>
            )}
            <article
              className="ec-message-row ec-anim-message-enter"
              style={{
                ...rowStyle,
                opacity: m.pending ? 0.6 : 1,
                /* v0.39: stagger cascade на первые 12 messages при mount.
                   Socket-arrival messages в established channel'е получают
                   0ms delay = instant fade-up. */
                animationDelay: i < 12 ? `${i * 25}ms` : "0ms",
              }}
              onMouseEnter={(e) => {
                if (!isPinned) e.currentTarget.style.background = "var(--ec-surface-1)";
                const time = e.currentTarget.querySelector<HTMLElement>("[data-sticky-time]");
                if (time) time.style.opacity = "1";
                const bar = e.currentTarget.querySelector<HTMLElement>("[data-actions]");
                if (bar) {
                  bar.style.opacity = "1";
                  bar.style.pointerEvents = "auto";
                }
              }}
              onMouseLeave={(e) => {
                if (!isPinned) e.currentTarget.style.background = "transparent";
                const time = e.currentTarget.querySelector<HTMLElement>("[data-sticky-time]");
                if (time) time.style.opacity = "0";
                const bar = e.currentTarget.querySelector<HTMLElement>("[data-actions]");
                if (bar) {
                  bar.style.opacity = "0";
                  bar.style.pointerEvents = "none";
                }
              }}
            >
              <div style={{ display: "flex", justifyContent: "center" }}>
                {grouped && !newDay && !isPinned ? (
                  <span data-sticky-time style={stickyTime}>
                    {formatTime(m.createdAt)}
                  </span>
                ) : (
                  <span
                    className={m.user.isBot ? "ec-avatar-halo ec-avatar-halo--ai" : undefined}
                    style={{ display: "inline-block", borderRadius: "50%" }}
                  >
                    <Avatar url={m.user.avatar} name={m.user.displayName} size={36} />
                  </span>
                )}
              </div>
              <div style={{ minWidth: 0 }}>
                {(!grouped || newDay || isPinned) && (
                  <header style={{ display: "flex", alignItems: "baseline", gap: "var(--ec-space-2)", marginBottom: 2 }}>
                    <strong style={{ color: "var(--ec-text-strong)", fontSize: "var(--ec-text-base)", fontWeight: 600 }}>
                      {m.user.displayName}
                    </strong>
                    {m.user.isBot && (() => {
                      // Если бот имеет taxonomy-роль (Bot row с role) — рисуем
                      // role-aware badge с цветом + RU-лейблом. Для system @ai
                      // bot (без Bot row) или GENERIC — generic violet BOT.
                      const role: BotRole | null =
                        m.user.botRole && isBotRole(m.user.botRole) ? m.user.botRole : null;
                      const useRole = role && role !== "GENERIC";
                      const c = useRole
                        ? BOT_ROLE_COLORS[role!]
                        : BOT_ROLE_COLORS.GENERIC;
                      const label = useRole ? BOT_ROLE_LABELS[role!] : "AI_AGENT";
                      return (
                        <span
                          title={
                            useRole
                              ? `Бот · ${BOT_ROLE_LABELS[role!]}`
                              : "Сообщение от бота"
                          }
                          aria-label={useRole ? BOT_ROLE_LABELS[role!] : "бот"}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 3,
                            padding: "0.05rem 0.4rem",
                            background: c.bg,
                            color: c.fg,
                            border: `1px solid ${c.border}`,
                            borderRadius: "var(--ec-radius-full)",
                            fontSize: "0.62rem",
                            fontWeight: 700,
                            letterSpacing: "var(--ec-tracking-caps)",
                            textTransform: "uppercase",
                            lineHeight: 1.3,
                          }}
                        >
                          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                            <rect x="3" y="11" width="18" height="10" rx="2" />
                            <circle cx="12" cy="5" r="2" />
                            <path d="M12 7v4" />
                            <line x1="8" y1="16" x2="8" y2="16" />
                            <line x1="16" y1="16" x2="16" y2="16" />
                          </svg>
                          {label}
                        </span>
                      );
                    })()}
                    <time
                      dateTime={m.createdAt}
                      style={{
                        fontFamily: "var(--ec-font-mono)",
                        fontSize: "var(--ec-text-2xs)",
                        color: "var(--ec-text-dim)",
                      }}
                    >
                      {formatTime(m.createdAt)}
                    </time>
                    {isPinned && (
                      <span
                        title="Закреплено"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 3,
                          color: "var(--ec-warn)",
                          fontSize: "var(--ec-text-2xs)",
                          fontWeight: 600,
                          letterSpacing: "var(--ec-tracking-wide)",
                        }}
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                          <line x1="12" y1="17" x2="12" y2="22" />
                          <path d="M5 17h14V5l-2 2-2-2-2 2-2-2-2 2-2-2-2 2z" />
                        </svg>
                        ЗАКРЕПЛЕНО
                      </span>
                    )}
                    {m.pending && (
                      <span style={{ fontSize: "var(--ec-text-2xs)", color: "var(--ec-text-dim)" }}>отправляется…</span>
                    )}
                    {m.failed && (
                      <span style={failedTag}>
                        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                          <circle cx="12" cy="12" r="10" />
                          <line x1="12" y1="8" x2="12" y2="12" />
                          <line x1="12" y1="16" x2="12.01" y2="16" />
                        </svg>
                        Ошибка
                      </span>
                    )}
                  </header>
                )}
                {isEditing ? (
                  <div style={editAreaWrap}>
                    <textarea
                      value={editDraft}
                      onChange={(e) => setEditDraft(e.target.value)}
                      autoFocus
                      style={editTextarea}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          void commitEdit(m);
                        } else if (e.key === "Escape") {
                          cancelEdit();
                        }
                      }}
                    />
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <button type="button" className="ec-btn ec-btn--primary ec-btn--sm" onClick={() => void commitEdit(m)}>
                        Сохранить
                      </button>
                      <button type="button" className="ec-btn ec-btn--sm" onClick={cancelEdit}>
                        Отмена
                      </button>
                      <span style={{ fontSize: "var(--ec-text-2xs)", color: "var(--ec-text-dim)" }}>
                        Enter — сохранить · Esc — отмена
                      </span>
                    </div>
                  </div>
                ) : isDeleted ? (
                  <p
                    style={{
                      margin: 0,
                      color: "var(--ec-text-dim)",
                      fontStyle: "italic",
                      fontSize: "var(--ec-text-base)",
                    }}
                  >
                    сообщение удалено
                  </p>
                ) : (
                  <>
                    {m.content && (
                      <p
                        style={{
                          margin: 0,
                          color: "var(--ec-text)",
                          whiteSpace: "pre-wrap",
                          wordBreak: "break-word",
                          fontSize: "var(--ec-text-base)",
                          lineHeight: "var(--ec-leading-normal)",
                        }}
                      >
                        <RichContent
                          content={m.content}
                          mentionNames={mentionNames}
                          currentUserName={currentUserName}
                        />
                        {m.editedAt && (
                          <span
                            title={`Изменено ${new Date(m.editedAt).toLocaleString("ru-RU")}`}
                            style={{
                              marginLeft: 6,
                              fontSize: "var(--ec-text-2xs)",
                              color: "var(--ec-text-dim)",
                            }}
                          >
                            (изменено)
                          </span>
                        )}
                      </p>
                    )}
                    {m.attachments.length > 0 && (
                      <Attachments
                        attachments={m.attachments}
                        onPlayShared={onPlayShared}
                      />
                    )}
                    {/* v0.67: OG link preview под телом сообщения. Только
                        если нет attachments (visually noisy с обоими) и
                        URL extracted из content. */}
                    {m.attachments.length === 0 && m.content && (() => {
                      const url = extractFirstUrl(m.content);
                      return url ? <LinkEmbedCard url={url} /> : null;
                    })()}
                  </>
                )}
                {m.failed && onRetry && (
                  <button
                    type="button"
                    onClick={() => void onRetry(m.id)}
                    className="ec-btn ec-btn--sm"
                    style={{ marginTop: 4, color: "var(--ec-danger)", borderColor: "var(--ec-danger)" }}
                  >
                    Повторить
                  </button>
                )}
                {!isDeleted && !isEditing && m.reactions.length > 0 && (
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 4 }}>
                    {m.reactions.map((r) => (
                      <button
                        key={r.emoji}
                        type="button"
                        className="ec-anim-reaction-pop"
                        onClick={() => void onToggleReaction?.(m.id, r.emoji)}
                        title={r.mine ? "Снять реакцию" : "Поддержать"}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          padding: "1px 7px 1px 5px",
                          background: r.mine ? "var(--ec-accent-soft)" : "var(--ec-surface-2)",
                          border: r.mine ? "1px solid var(--ec-border-accent)" : "1px solid var(--ec-border-subtle)",
                          borderRadius: "var(--ec-radius-full)",
                          color: r.mine ? "var(--ec-accent)" : "var(--ec-text-muted)",
                          cursor: "pointer",
                          fontSize: "0.8rem",
                          lineHeight: 1.4,
                          transition: "background var(--ec-dur-fast) var(--ec-ease), border-color var(--ec-dur-fast) var(--ec-ease), transform var(--ec-dur-fast) var(--ec-ease)",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = "translateY(-1px)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = "translateY(0)";
                        }}
                      >
                        <span aria-hidden style={{ fontSize: "0.95rem" }}>{r.emoji}</span>
                        <span style={{ fontWeight: 600, fontFeatureSettings: '"tnum"' }}>{r.count}</span>
                      </button>
                    ))}
                  </div>
                )}
                {!isDeleted && !isEditing && (m.threadReplyCount ?? 0) > 0 && onOpenThread && (
                  <button
                    type="button"
                    onClick={() => onOpenThread(m.id)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      marginTop: 6,
                      padding: "0.22rem 0.6rem",
                      background: "var(--ec-accent-soft)",
                      border: "1px solid var(--ec-border-accent)",
                      borderRadius: "var(--ec-radius-full)",
                      color: "var(--ec-accent)",
                      fontSize: "var(--ec-text-2xs)",
                      fontWeight: 600,
                      cursor: "pointer",
                      letterSpacing: "var(--ec-tracking-wide)",
                      transition: "transform var(--ec-dur-fast) var(--ec-ease)",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = "translateY(-1px)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = "translateY(0)";
                    }}
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
                    </svg>
                    {m.threadReplyCount} {m.threadReplyCount === 1 ? "ответ" : "ответов"} в треде
                  </button>
                )}
                {!isDeleted && !isEditing && m.actionItems.length > 0 && (
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                    {m.actionItems.map((action) => {
                      const tint = tintForAction(action.type, action.status);
                      return (
                        <button
                          key={action.id}
                          type="button"
                          title={
                            action.status === "OPEN"
                              ? "Отметить как выполненное"
                              : "Вернуть в открытые action items"
                          }
                          onClick={() =>
                            void onToggleActionStatus?.(
                              action.id,
                              action.status === "OPEN" ? "DONE" : "OPEN",
                            )
                          }
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            maxWidth: "100%",
                            padding: "0.26rem 0.65rem",
                            borderRadius: "var(--ec-radius-full)",
                            border: `1px solid ${tint.border}`,
                            background: tint.bg,
                            color: tint.fg,
                            cursor: onToggleActionStatus ? "pointer" : "default",
                            transition: "transform var(--ec-dur-fast) var(--ec-ease)",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.transform = "translateY(-1px)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.transform = "translateY(0)";
                          }}
                        >
                          <span
                            style={{
                              fontSize: "var(--ec-text-2xs)",
                              fontWeight: 700,
                              letterSpacing: "var(--ec-tracking-wide)",
                              textTransform: "uppercase",
                              flexShrink: 0,
                            }}
                          >
                            {labelForAction(action.type)}
                          </span>
                          <span
                            style={{
                              color: action.status === "DONE" ? "var(--ec-text-dim)" : "var(--ec-text)",
                              fontSize: "var(--ec-text-xs)",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              maxWidth: 240,
                            }}
                          >
                            {action.title}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              {showActions && (
                <div data-actions className="ec-message-actions" style={actionsBar}>
                  {onOpenThread && (
                    <button
                      type="button"
                      style={actionBtn}
                      aria-label="Открыть тред"
                      title="Ответить в треде"
                      onClick={() => onOpenThread(m.id)}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = "var(--ec-accent-soft)";
                        e.currentTarget.style.color = "var(--ec-accent)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "transparent";
                        e.currentTarget.style.color = "var(--ec-text-muted)";
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
                      </svg>
                    </button>
                  )}
                  {onToggleReaction && (
                    <button
                      type="button"
                      style={actionBtn}
                      aria-label="Добавить реакцию"
                      title="Реакция"
                      onClick={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        setPickerFor({ messageId: m.id, rect });
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = "var(--ec-surface-3)";
                        e.currentTarget.style.color = "var(--ec-text)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "transparent";
                        e.currentTarget.style.color = "var(--ec-text-muted)";
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <circle cx="12" cy="12" r="10" />
                        <path d="M8 14s1.5 2 4 2 4-2 4-2" />
                        <line x1="9" y1="9" x2="9.01" y2="9" />
                        <line x1="15" y1="9" x2="15.01" y2="9" />
                      </svg>
                    </button>
                  )}
                  <button
                    type="button"
                    style={actionBtn}
                    aria-label="Копировать"
                    title={isCopied ? "Скопировано" : "Копировать"}
                    onClick={() => void handleCopy(m)}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "var(--ec-surface-3)";
                      e.currentTarget.style.color = "var(--ec-text)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                      e.currentTarget.style.color = "var(--ec-text-muted)";
                    }}
                  >
                    {isCopied ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ec-ok)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <rect x="9" y="9" width="13" height="13" rx="2" />
                        <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                      </svg>
                    )}
                  </button>
                  {showEdit && (
                    <button
                      type="button"
                      style={actionBtn}
                      aria-label="Редактировать"
                      title="Редактировать"
                      onClick={() => beginEdit(m)}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = "var(--ec-surface-3)";
                        e.currentTarget.style.color = "var(--ec-text)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "transparent";
                        e.currentTarget.style.color = "var(--ec-text-muted)";
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 113 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </button>
                  )}
                  {canCreateActions && !existingTypes.has("TASK") && (
                    <button
                      type="button"
                      style={actionBtn}
                      aria-label="Сделать задачей"
                      title="Сделать задачей"
                      onClick={() => void onCreateAction?.(m.id, "TASK")}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = "var(--ec-surface-3)";
                        e.currentTarget.style.color = "var(--ec-accent)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "transparent";
                        e.currentTarget.style.color = "var(--ec-text-muted)";
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d="M9 11l3 3L22 4" />
                        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                      </svg>
                    </button>
                  )}
                  {canCreateActions && !existingTypes.has("DECISION") && (
                    <button
                      type="button"
                      style={actionBtn}
                      aria-label="Зафиксировать решение"
                      title="Зафиксировать решение"
                      onClick={() => void onCreateAction?.(m.id, "DECISION")}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = "hsl(47 85% 58% / 0.12)";
                        e.currentTarget.style.color = "var(--ec-warn)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "transparent";
                        e.currentTarget.style.color = "var(--ec-text-muted)";
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d="M12 2l7 4v6c0 5-3.8 8.7-7 10-3.2-1.3-7-5-7-10V6l7-4z" />
                      </svg>
                    </button>
                  )}
                  {canCreateActions && !existingTypes.has("FOLLOW_UP") && (
                    <button
                      type="button"
                      style={actionBtn}
                      aria-label="Поставить follow-up"
                      title="Поставить follow-up"
                      onClick={() => void onCreateAction?.(m.id, "FOLLOW_UP")}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = "hsl(170 70% 52% / 0.12)";
                        e.currentTarget.style.color = "var(--ec-ok)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "transparent";
                        e.currentTarget.style.color = "var(--ec-text-muted)";
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d="M5 12h14" />
                        <path d="M13 5l7 7-7 7" />
                      </svg>
                    </button>
                  )}
                  {showUnpin && (
                    <button
                      type="button"
                      style={{ ...actionBtn, color: "var(--ec-warn)" }}
                      aria-label="Открепить"
                      title="Открепить"
                      onClick={() => void onUnpin?.(m.id)}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = "hsl(40 70% 60% / 0.14)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "transparent";
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <line x1="2" y1="2" x2="22" y2="22" />
                        <line x1="12" y1="17" x2="12" y2="22" />
                        <path d="M5 17h14V5l-2 2-2-2-2 2-2-2-2 2-2-2-2 2z" />
                      </svg>
                    </button>
                  )}
                  {showPin && (
                    <button
                      type="button"
                      style={actionBtn}
                      aria-label="Закрепить"
                      title="Закрепить"
                      onClick={() => void onPin?.(m.id)}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = "var(--ec-surface-3)";
                        e.currentTarget.style.color = "var(--ec-warn)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "transparent";
                        e.currentTarget.style.color = "var(--ec-text-muted)";
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <line x1="12" y1="17" x2="12" y2="22" />
                        <path d="M5 17h14V5l-2 2-2-2-2 2-2-2-2 2-2-2-2 2z" />
                      </svg>
                    </button>
                  )}
                  {showDelete && (
                    <button
                      type="button"
                      style={{ ...actionBtn, color: "var(--ec-danger)" }}
                      aria-label="Удалить"
                      title="Удалить"
                      onClick={() => void handleDelete(m)}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = "var(--ec-danger-soft)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "transparent";
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6l-2 14a2 2 0 01-2 2H9a2 2 0 01-2-2L5 6" />
                        <path d="M10 11v6M14 11v6" />
                      </svg>
                    </button>
                  )}
                </div>
              )}
            </article>
          </Fragment>
        );
      })}
      {pendingBotTyping && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "0.45rem 0.65rem",
            margin: "var(--ec-space-2) 0 var(--ec-space-3)",
            background: "var(--ec-surface-2)",
            border: "1px solid var(--ec-border-subtle)",
            borderRadius: "var(--ec-radius-md)",
            fontSize: "var(--ec-text-sm)",
            maxWidth: "fit-content",
          }}
          role="status"
          aria-live="polite"
        >
          <span className="ec-typing" style={{ background: "transparent", border: 0, padding: 0 }}>
            <span className="ec-typing-dot" />
            <span className="ec-typing-dot" />
            <span className="ec-typing-dot" />
          </span>
          <span className="ec-shimmer-text">
            {pendingBotTyping.label} собирает ответ
          </span>
        </div>
      )}
      </div>
      {!isAtBottom && (
        <button
          type="button"
          className="ec-jump-latest"
          onClick={() => scrollToLatest("smooth")}
          aria-label="Перейти к последним сообщениям"
        >
          <span className="ec-jump-latest__dot" aria-hidden />
          {newMessagesCount > 0 ? `${newMessagesCount} новых ниже` : "К последним"}
        </button>
      )}
    </div>
  );
}
