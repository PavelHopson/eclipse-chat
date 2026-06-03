import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { Attachments } from "./Attachments";
import { Avatar } from "./Avatar";
import { EmojiPicker } from "./EmojiPicker";
import { RichContent } from "./RichContent";
import { LinkEmbedCard } from "./LinkEmbedCard";
import { YouTubeEmbedCard } from "./YouTubeEmbedCard";
import { EmptyState } from "./EmptyState";
import { EmptyChannelIcon } from "./EmptyIcons";
import { extractFirstUrl } from "../lib/linkExtract";
import { parseYouTubeUrl } from "../lib/youtubeEmbed";
import { gameIcon } from "../lib/gameIcons";
import { useMessageEditHistory } from "../hooks/useMessageEditHistory";
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
  /** v1.2.14 — Ephemeral реплай от slash-команды (/help). Видим только
   *  отправителю; auto-clear через 15с или dismiss-кнопкой. */
  ephemeralBanner?: string | null;
  onDismissEphemeralBanner?: () => void;
  /** Display names известных members активного сервера — для @mention detection. */
  mentionNames?: string[];
  /** v1.2.22 — custom-emoji map активного сервера (shortcode → URL). */
  customEmojis?: Record<string, string>;
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
  /** v1.5.25 — DM context. Переключает useMessageEditHistory на
   *  /api/dm/messages/:id/edits endpoint (participant-only check). */
  isDm?: boolean;
  /**
   * v1.5.35 — server banner image для scroll-to-top hero над первым
   * сообщением. Когда set + channelName present — рендерим cinematic
   * cover-фоновую полосу с «Начало канала #X в [serverName]» overlay.
   * Без banner'а — subtle text-only label с тем же текстом.
   */
  channelTopBanner?: string | null;
  /** v1.5.35 — server name для подписи «#channel в {server}». */
  channelTopSubtitle?: string | null;
};

// v1.1.92 slice 3: inline-style консоли MessageList вынесены в классы
// .ec-message-list* / .ec-message-row* / .ec-msg-* (components.css).
// JS-hover убран — состояния через CSS.

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
      bg: "var(--ec-status-warn-soft)",
      fg: "var(--ec-status-warn)",
      border: "color-mix(in srgb, var(--ec-status-warn) 32%, transparent)",
    };
  }
  if (type === "FOLLOW_UP") {
    return {
      bg: "var(--ec-accent-2-soft)",
      fg: "var(--ec-accent-2)",
      border: "color-mix(in srgb, var(--ec-accent-2) 28%, transparent)",
    };
  }
  return {
    bg: "var(--ec-accent-soft)",
    fg: "var(--ec-accent)",
    border: "var(--ec-border-accent)",
  };
}

function formatTime(iso: string): string {
  return iso.slice(11, 16);
}

// v1.5.3 — full datetime for timestamp tooltip (title= attribute).
// Example: "25 мая 2026, 21:34".
function formatFullDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
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
  ephemeralBanner,
  onDismissEphemeralBanner,
  mentionNames = [],
  customEmojis,
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
  isDm = false,
  channelTopSubtitle = null,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [pinBurstId, setPinBurstId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  // v1.5.24 — какое сообщение сейчас раскрыло «История правок» accordion.
  const [editHistoryId, setEditHistoryId] = useState<string | null>(null);
  const editHistory = useMessageEditHistory(editHistoryId, editHistoryId !== null, isDm);
  const [editDraft, setEditDraft] = useState("");
  const [pickerFor, setPickerFor] = useState<{ messageId: string; rect: DOMRect } | null>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [unreadAnchorId, setUnreadAnchorId] = useState<string | null>(null);
  const [newMessagesCount, setNewMessagesCount] = useState(0);
  const atBottomRef = useRef(true);
  const listKeyRef = useRef<string | null>(listKey ?? null);
  const tailIdRef = useRef<string | null>(null);
  const messageCountRef = useRef(0);
  const pinBurstTimerRef = useRef<number | null>(null);

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

  useEffect(() => {
    return () => {
      if (pinBurstTimerRef.current !== null) {
        window.clearTimeout(pinBurstTimerRef.current);
      }
    };
  }, []);

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

  const handlePin = async (m: MessageRow) => {
    if (!onPin) return;
    if (pinBurstTimerRef.current !== null) {
      window.clearTimeout(pinBurstTimerRef.current);
    }
    setPinBurstId(m.id);
    pinBurstTimerRef.current = window.setTimeout(() => {
      setPinBurstId((current) => (current === m.id ? null : current));
      pinBurstTimerRef.current = null;
    }, 820);
    await onPin(m.id);
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
        style={{ paddingTop: "var(--ec-space-6)" }}
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
        style={{ justifyContent: "center" }}
      >
        <EmptyState
          icon={<EmptyChannelIcon />}
          title={
            channelName ? (
              <>
                Начните разговор в{" "}
                <span style={{ color: "var(--ec-accent)" }}>#{channelName}</span>
              </>
            ) : (
              "Сообщений пока нет"
            )
          }
          hint={emptyHint ?? "Будьте первым — напишите что-нибудь ниже."}
        />
      </div>
    );
  }

  const canMod = canModerate(currentRole);

  // v1.5.35 — channel-top hero. Render если channelName present:
  // - С banner: cinematic cover-фон + overlay (читается на любом изображении).
  // - Без banner: subtle text-only label.
  // Hero сидит первым в scroll-контейнере, появляется при scroll-to-top.
  // Clean redesign: full-bleed cinematic banner (с overlaid текстом и
  // выцветшим server-баннером за заголовком) убран — channel-top теперь
  // чистый компактный text-only header (base .ec-msg-channel-top, 84px).
  const channelTopHero = channelName ? (
    <header className="ec-msg-channel-top">
      <div className="ec-msg-channel-top__content">
        <h2 className="ec-msg-channel-top__title">
          Начало канала #{channelName}
        </h2>
        {channelTopSubtitle && (
          <p className="ec-msg-channel-top__sub">в {channelTopSubtitle}</p>
        )}
      </div>
    </header>
  ) : null;

  return (
    <div className="ec-message-list-shell">
      <div ref={containerRef} className="ec-message-list" onScroll={handleScroll}>
      {channelTopHero}
      {pickerFor && onToggleReaction && (
        <EmojiPicker
          anchorRect={pickerFor.rect}
          customEmojis={customEmojis}
          onPick={(emoji) => {
            void onToggleReaction(pickerFor.messageId, emoji);
          }}
          onClose={() => setPickerFor(null)}
        />
      )}
      {messages.filter((m) => m.deletedAt == null).map((m, i, arr) => {
        const prev = i > 0 ? arr[i - 1] : null;
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

        const rowClass = isPinned
          ? " ec-message-row--pinned"
          : grouped && !newDay
          ? " ec-message-row--grouped"
          : "";

        return (
          <Fragment key={m.id}>
            {newDay && (
              <div className="ec-msg-day" role="separator">
                <span className="ec-msg-day__line" aria-hidden />
                <span className="ec-msg-day__label">{formatDay(m.createdAt)}</span>
                <span className="ec-msg-day__line" aria-hidden />
              </div>
            )}
            {unreadAnchorId === m.id && (
              <div className="ec-unread-divider" role="separator" aria-label="Новые сообщения">
                <span>Новые сообщения</span>
              </div>
            )}
            <article
              className={
                "ec-message-row ec-anim-message-enter" +
                rowClass +
                (m.user.isBot ? " ec-message-row--ai" : "") +
                (isMine ? " ec-message-row--mine" : "")
              }
              style={{
                opacity: m.pending ? 0.6 : 1,
                /* v0.39: stagger cascade на первые 12 messages при mount.
                   Socket-arrival messages в established channel'е получают
                   0ms delay = instant fade-up. */
                animationDelay: i < 12 ? `${i * 25}ms` : "0ms",
              }}
            >
              <div style={{ display: "flex", justifyContent: "center" }}>
                {grouped && !newDay && !isPinned ? (
                  <span
                    className="ec-msg-sticky-time"
                    title={formatFullDateTime(m.createdAt)}
                  >
                    {formatTime(m.createdAt)}
                  </span>
                ) : (
                  <span
                    className={
                      "ec-msg-avatar-wrap" +
                      (m.user.isBot ? " ec-avatar-halo ec-avatar-halo--ai" : "")
                    }
                  >
                    <Avatar url={m.user.avatar} name={m.user.displayName} size={36} />
                  </span>
                )}
              </div>
              <div className="ec-message-content">
                {(!grouped || newDay || isPinned) && (
                  <header style={{ display: "flex", alignItems: "baseline", gap: "var(--ec-space-2)", marginBottom: 2 }}>
                    <button
                      type="button"
                      className="ec-msg-author"
                      title={m.user.displayName}
                    >
                      {m.user.displayName}
                    </button>
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
                      title={formatFullDateTime(m.createdAt)}
                      className="ec-msg-time"
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
                      <span className="ec-msg-failed-tag">
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
                  <div className="ec-msg-edit">
                    <textarea
                      value={editDraft}
                      onChange={(e) => setEditDraft(e.target.value)}
                      autoFocus
                      className="ec-msg-edit__textarea"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          void commitEdit(m);
                        } else if (e.key === "Escape") {
                          cancelEdit();
                        }
                      }}
                    />
                    <div className="ec-msg-edit__row">
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
                          customEmojis={customEmojis}
                        />
                        {m.editedAt && (
                          <button
                            type="button"
                            className="ec-msg-edited"
                            title={`Изменено ${new Date(m.editedAt).toLocaleString("ru-RU")} · клик — история правок`}
                            onClick={() =>
                              setEditHistoryId((cur) => (cur === m.id ? null : m.id))
                            }
                            aria-expanded={editHistoryId === m.id}
                          >
                            (изменено)
                          </button>
                        )}
                      </p>
                    )}
                    {/* v1.5.24 — История правок: lazy-loaded accordion под
                        сообщением. Click «(изменено)» toggles open. */}
                    {editHistoryId === m.id && (
                      <div className="ec-msg-edit-history">
                        <div className="ec-msg-edit-history__label">
                          История правок
                          {editHistory.loading && (
                            <span className="ec-msg-edit-history__loading">
                              загрузка…
                            </span>
                          )}
                        </div>
                        {editHistory.error && (
                          <div className="ec-msg-edit-history__error">
                            {editHistory.error}
                          </div>
                        )}
                        {!editHistory.loading &&
                          !editHistory.error &&
                          editHistory.edits.length === 0 && (
                            <div className="ec-msg-edit-history__empty">
                              Снимков прошлых версий нет
                              <span className="ec-msg-edit-history__hint">
                                (это первое редактирование после развёртывания
                                history-фичи; следующие правки сохранятся)
                              </span>
                            </div>
                          )}
                        {editHistory.edits.map((edit) => (
                          <div
                            key={edit.id}
                            className="ec-msg-edit-history__entry"
                          >
                            <time
                              className="ec-msg-edit-history__time"
                              dateTime={edit.editedAt}
                            >
                              {new Date(edit.editedAt).toLocaleString("ru-RU", {
                                day: "numeric",
                                month: "short",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </time>
                            <pre className="ec-msg-edit-history__content">
                              {edit.previousContent}
                            </pre>
                          </div>
                        ))}
                      </div>
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
                      if (!url) return null;
                      return parseYouTubeUrl(url) ? (
                        <YouTubeEmbedCard url={url} />
                      ) : (
                        <LinkEmbedCard url={url} />
                      );
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
                        className={
                          "ec-anim-reaction-pop ec-msg-reaction" +
                          (r.mine ? " ec-msg-reaction--mine ec-anim-reaction-mine" : "")
                        }
                        onClick={() => void onToggleReaction?.(m.id, r.emoji)}
                        title={r.mine ? "Снять реакцию" : "Поддержать"}
                      >
                        {(() => {
                          const sc = /^:([a-z0-9_-]{2,30}):$/.exec(r.emoji);
                          const url = sc && customEmojis ? customEmojis[sc[1]] : null;
                          if (url) {
                            return (
                              <img
                                src={url}
                                alt={r.emoji}
                                aria-hidden
                                width={18}
                                height={18}
                                loading="lazy"
                                style={{ objectFit: "contain" }}
                              />
                            );
                          }
                          return (
                            <span aria-hidden style={{ fontSize: "0.95rem" }}>
                              {r.emoji}
                            </span>
                          );
                        })()}
                        {/* v1.5.3 — key={r.count} перезапускает count-bump
                            анимацию при каждом изменении счётчика. */}
                        <span
                          key={r.count}
                          className="ec-msg-reaction-count ec-anim-count-bump"
                        >
                          {r.count}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                {!isDeleted && !isEditing && (m.threadReplyCount ?? 0) > 0 && onOpenThread && (
                  <button
                    type="button"
                    className="ec-msg-pill"
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
                          className="ec-msg-pill"
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
                <div className="ec-message-actions">
                  {/* v1.5.22 — quick reactions: 6 popular emoji prepended
                      перед actions toolbar. Click — toggleReaction immediately,
                      без opening picker. Existing user reactions get accent
                      state. Slack/Linear-style. */}
                  {onToggleReaction && (
                    <>
                      {(["👍", "❤️", "😂", "🎉", "🔥", "👀"] as const).map((emoji) => {
                        const mine = m.reactions.some(
                          (r) => r.emoji === emoji && r.mine,
                        );
                        return (
                          <button
                            key={emoji}
                            type="button"
                            className={
                              "ec-msg-action ec-msg-quick-react" +
                              (mine ? " ec-msg-quick-react--mine" : "")
                            }
                            aria-label={`Реакция ${emoji}`}
                            title={mine ? "Снять реакцию" : `Поставить ${emoji}`}
                            onClick={() => void onToggleReaction(m.id, emoji)}
                          >
                            <span aria-hidden style={{ fontSize: 14, lineHeight: 1 }}>
                              {emoji}
                            </span>
                          </button>
                        );
                      })}
                      <span className="ec-msg-action-sep" aria-hidden />
                    </>
                  )}
                  {onOpenThread && (
                    <button
                      type="button"
                      className="ec-msg-action ec-msg-action--accent"
                      aria-label="Открыть тред"
                      title="Ответить в треде"
                      onClick={() => onOpenThread(m.id)}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
                      </svg>
                    </button>
                  )}
                  {onToggleReaction && (
                    <button
                      type="button"
                      className="ec-msg-action"
                      aria-label="Добавить реакцию"
                      title="Реакция"
                      onClick={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        setPickerFor({ messageId: m.id, rect });
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
                    className="ec-msg-action"
                    aria-label="Копировать"
                    title={isCopied ? "Скопировано" : "Копировать"}
                    onClick={() => void handleCopy(m)}
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
                      className="ec-msg-action"
                      aria-label="Редактировать"
                      title="Редактировать"
                      onClick={() => beginEdit(m)}
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
                      className="ec-msg-action ec-msg-action--accent"
                      aria-label="Сделать задачей"
                      title="Сделать задачей"
                      onClick={() => void onCreateAction?.(m.id, "TASK")}
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
                      className="ec-msg-action ec-msg-action--accent"
                      aria-label="Зафиксировать решение"
                      title="Зафиксировать решение"
                      onClick={() => void onCreateAction?.(m.id, "DECISION")}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d="M12 2l7 4v6c0 5-3.8 8.7-7 10-3.2-1.3-7-5-7-10V6l7-4z" />
                      </svg>
                    </button>
                  )}
                  {canCreateActions && !existingTypes.has("FOLLOW_UP") && (
                    <button
                      type="button"
                      className="ec-msg-action ec-msg-action--accent"
                      aria-label="Поставить follow-up"
                      title="Поставить follow-up"
                      onClick={() => void onCreateAction?.(m.id, "FOLLOW_UP")}
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
                      className="ec-msg-action ec-msg-action--warn"
                      aria-label="Открепить"
                      title="Открепить"
                      onClick={() => void onUnpin?.(m.id)}
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
                      className={`ec-msg-action ec-msg-action--warn ec-msg-action--pin${pinBurstId === m.id ? " is-bursting" : ""}`}
                      aria-label="Закрепить"
                      title="Закрепить"
                      onClick={() => void handlePin(m)}
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
                      className="ec-msg-action ec-msg-action--danger"
                      aria-label="Удалить"
                      title="Удалить"
                      onClick={() => void handleDelete(m)}
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
          className="ec-bot-thinking"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "0.5rem 0.8rem 0.5rem 0.55rem",
            margin: "var(--ec-space-2) 0 var(--ec-space-3)",
            background: "var(--ec-surface-2)",
            border: "1px solid hsl(252 70% 70% / 0.32)",
            borderRadius: "var(--ec-radius-md)",
            fontSize: "var(--ec-text-sm)",
            maxWidth: "fit-content",
          }}
          role="status"
          aria-live="polite"
        >
          {/* v1.1.25: thinking_orb game-иконка крутится пока AI генерирует. */}
          <img
            className="ec-thinking-orb"
            src={gameIcon("thinking_orb")}
            alt=""
            width={30}
            height={30}
            draggable={false}
          />
          <span className="ec-shimmer-text">
            {pendingBotTyping.label} собирает ответ
          </span>
        </div>
      )}
      {ephemeralBanner && (
        <div
          className="ec-ephemeral-banner"
          role="status"
          aria-live="polite"
        >
          <div className="ec-ephemeral-banner__label">только вы видите</div>
          <pre className="ec-ephemeral-banner__content">{ephemeralBanner}</pre>
          {onDismissEphemeralBanner && (
            <button
              type="button"
              className="ec-ephemeral-banner__dismiss ec-icon-btn"
              onClick={onDismissEphemeralBanner}
              aria-label="Скрыть"
              title="Скрыть"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
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
