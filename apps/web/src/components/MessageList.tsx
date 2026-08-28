import { Fragment, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from "react";
import { VoiceChatContext } from "./VoiceRoomContext";
import { Attachments } from "./Attachments";
import { MessageActionChip } from "./MessageActionChip";
import { MessageActions } from "./MessageActions";
import { EclipseUiIcon } from "./icons/EclipseUiIcon";
import { incomingAfter, isDirectMention, replyLabel } from "../lib/conversationNavigation";
import { Avatar } from "./Avatar";
import { EmojiPicker } from "./EmojiPicker";
import { RichContent } from "./RichContent";
import { GitHubEventCard } from "./GitHubEventCard";
import { LinkEmbedCard } from "./LinkEmbedCard";
import { YouTubeEmbedCard } from "./YouTubeEmbedCard";
import { EmptyState } from "./EmptyState";
import { EmptyChannelIcon } from "./EmptyIcons";
import { useConfirm } from "./ConfirmDialog";
import { extractFirstUrl } from "../lib/linkExtract";
import { parseYouTubeUrl } from "../lib/youtubeEmbed";
import { gameIcon } from "../lib/gameIcons";
import { useMessageEditHistory } from "../hooks/useMessageEditHistory";
import type { ActionItemStatus, MessageRow } from "../hooks/useMessages";
import type { MemberRole } from "../hooks/useMembers";
import { hasPermission } from "../lib/memberRoles";
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
  unreadSince?: string | null;
  activeThreadId?: string | null;
  currentUserId?: string;
  /** Открыть профиль автора по клику на avatar/name. */
  onOpenUserProfile?: (userId: string) => void;
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
  onCreateAction?: (message: MessageRow) => void;
  onOpenAction?: (actionId: string) => void;
  onToggleActionStatus?: (actionId: string, nextStatus: ActionItemStatus) => Promise<boolean>;
  /** Открыть Thread panel для этого root message. Скрывает кнопку если не задано. */
  onOpenThread?: (messageId: string) => void;
  /** Open an explicit preview before saving this message to channel memory. */
  onSaveToMemory?: (message: MessageRow) => void;
  /** Deep-link target loaded through `useMessages.loadAroundMessage`. */
  focusMessageId?: string | null;
  onFocusHandled?: () => void;
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


function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
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
  unreadSince,
  activeThreadId,
  currentUserId,
  onOpenUserProfile,
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
  onOpenAction,
  onToggleActionStatus,
  onOpenThread,
  onSaveToMemory,
  focusMessageId = null,
  onFocusHandled,
  onPlayShared,
  isDm = false,
  channelTopSubtitle = null,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const voiceChat = useContext(VoiceChatContext);
  const visibleRef = useRef(voiceChat.visible);
  visibleRef.current = voiceChat.visible;
  const savedScroll = useRef(0);
  useLayoutEffect(() => {
    if (!voiceChat.visible || !containerRef.current) return;
    containerRef.current.scrollTop = savedScroll.current;
  }, [voiceChat.visible]);
  const confirm = useConfirm();
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
  const [updatedThreads, setUpdatedThreads] = useState<string[]>([]);
  const threadCounts = useRef(new Map<string, number>());
  const seededUnread = useRef(false);
  const atBottomRef = useRef(true);
  const listKeyRef = useRef<string | null>(listKey ?? null);
  const tailIdRef = useRef<string | null>(null);
  const messageCountRef = useRef(0);
  const pinBurstTimerRef = useRef<number | null>(null);
  const focusTimerRef = useRef<number | null>(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);

  const clearNewMessageMarker = useCallback(() => {
    setUnreadAnchorId(null);
    setNewMessagesCount(0);
  }, []);

  const syncBottomState = useCallback(() => {
    if (!visibleRef.current) return false;
    const el = containerRef.current;
    if (el) savedScroll.current = el.scrollTop;
    const next = !el || isNearBottom(el);
    if (atBottomRef.current !== next) {
      atBottomRef.current = next;
      setIsAtBottom(next);
    }
    return next;
  }, []);

  const scrollToLatest = useCallback(
    (behavior: ScrollBehavior = "smooth") => {
      if (!visibleRef.current) return;
      const el = containerRef.current;
      if (!el) return;
      el.scrollTo({ top: el.scrollHeight, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : behavior });
      savedScroll.current = Math.max(0, el.scrollHeight - el.clientHeight);
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
    savedScroll.current = 0;
    tailIdRef.current = null;
    messageCountRef.current = 0;
    atBottomRef.current = true;
    setIsAtBottom(true);
    clearNewMessageMarker();
    threadCounts.current.clear();
    seededUnread.current = false;
    setUpdatedThreads([]);
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
    if (visibleRef.current && (atBottomRef.current || isOwnMessage || tail.pending)) {
      requestAnimationFrame(() => scrollToLatest(isOwnMessage ? "smooth" : "auto"));
      return;
    }

    const incoming = incomingAfter(messages, previousTailId, currentUserId);
    if (incoming.length) {
      atBottomRef.current = false;
      setIsAtBottom(false);
      setUnreadAnchorId((current) => current ?? incoming[0].id);
      setNewMessagesCount((count) => count + incoming.length);
    }
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
    const changed: string[] = [];
    for (const message of messages) {
      const previous = threadCounts.current.get(message.id);
      const count = message.threadReplyCount ?? 0;
      if (previous !== undefined && count > previous && message.id !== activeThreadId) changed.push(message.id);
      threadCounts.current.set(message.id, count);
    }
    if (changed.length) setUpdatedThreads(current => [...new Set([...current, ...changed])]);
    if (activeThreadId) setUpdatedThreads(current => current.includes(activeThreadId) ? current.filter(id => id !== activeThreadId) : current);
  }, [messages, activeThreadId]);

  const jumpTo = (id: string) => {
    const target = Array.from(containerRef.current?.querySelectorAll<HTMLElement>("[data-message-id]") ?? [])
      .find(element => element.dataset.messageId === id);
    target?.scrollIntoView({ block: "start", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    setHighlightedMessageId(id);
    if (focusTimerRef.current) clearTimeout(focusTimerRef.current);
    focusTimerRef.current = window.setTimeout(() => setHighlightedMessageId(null), 2400);
  };
  const openThread = (id: string) => {
    setUpdatedThreads(current => current.filter(value => value !== id));
    onOpenThread?.(id);
  };
  const unreadStart = unreadAnchorId ? messages.findIndex(message => message.id === unreadAnchorId) : -1;
  const mentions = unreadStart < 0 ? [] : messages.slice(unreadStart).filter(message =>
    !message.deletedAt && message.user.id !== currentUserId && isDirectMention(message.content, currentUserName));

  useEffect(() => {
    voiceChat.reportUnread?.({ total: newMessagesCount, mentions: mentions.length });
  }, [newMessagesCount, mentions.length, voiceChat.reportUnread]);

  useEffect(() => {
    if (seededUnread.current || !unreadSince || !messages.length) return;
    const incoming = messages.filter(message => !message.deletedAt && message.user.id !== currentUserId && new Date(message.createdAt).getTime() > new Date(unreadSince).getTime());
    if (!incoming.length) { seededUnread.current = true; return; }
    const frame = requestAnimationFrame(() => {
      seededUnread.current = true;
      setUnreadAnchorId(incoming[0].id);
      setNewMessagesCount(incoming.length);
    });
    return () => cancelAnimationFrame(frame);
  }, [unreadSince, messages, currentUserId]);

  useEffect(() => {
    return () => {
      if (pinBurstTimerRef.current !== null) {
        window.clearTimeout(pinBurstTimerRef.current);
      }
      if (focusTimerRef.current !== null) {
        window.clearTimeout(focusTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!focusMessageId || !containerRef.current) return;
    const target = Array.from(
      containerRef.current.querySelectorAll<HTMLElement>("[data-message-id]"),
    ).find((element) => element.dataset.messageId === focusMessageId);
    if (!target) return;

    target.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" });
    setHighlightedMessageId(focusMessageId);
    onFocusHandled?.();
    if (focusTimerRef.current !== null) window.clearTimeout(focusTimerRef.current);
    focusTimerRef.current = window.setTimeout(() => {
      setHighlightedMessageId(null);
      focusTimerRef.current = null;
    }, 2400);
  }, [focusMessageId, messages, onFocusHandled]);

  const handleCopy = async (m: MessageRow) => {
    try {
      await navigator.clipboard.writeText(m.content);
      setCopiedId(m.id);
      setTimeout(() => setCopiedId((cur) => (cur === m.id ? null : cur)), 1400);
      return true;
    } catch {
      return false;
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
    const ok = await confirm({
      title: "Удалить сообщение?",
      message: "Сообщение будет удалено у всех в этом чате.",
      confirmLabel: "Удалить",
      danger: true,
    });
    if (!ok) return;
    return await onDelete(m.id);
  };

  const handlePin = async (m: MessageRow) => {
    if (!onPin) return;
    const ok = await onPin(m.id);
    if (!ok) return false;
    if (pinBurstTimerRef.current !== null) {
      window.clearTimeout(pinBurstTimerRef.current);
    }
    setPinBurstId(m.id);
    pinBurstTimerRef.current = window.setTimeout(() => {
      setPinBurstId((current) => (current === m.id ? null : current));
      pinBurstTimerRef.current = null;
    }, 820);
    return true;
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
  const visibleMessages = messages.filter((message) => message.deletedAt == null);
  const isShortThread = visibleMessages.length <= 6;

  return (
    <div className="ec-message-list-shell">
      {(newMessagesCount > 0 || updatedThreads.length > 0) && <nav className="ec-attention-nav" aria-label="Новое в переписке">
        {unreadAnchorId && <button type="button" onClick={() => jumpTo(unreadAnchorId)}>Непрочитанное <span>{newMessagesCount}</span></button>}
        {mentions.length > 0 && <button type="button" className="is-mention" onClick={() => jumpTo(mentions[0].id)}>Вас упомянули <span>{mentions.length}</span></button>}
        {updatedThreads.length > 0 && onOpenThread && <button type="button" onClick={() => openThread(updatedThreads[0])}>Новые ответы <span>{updatedThreads.length}</span></button>}
      </nav>}
      <div
        ref={containerRef}
        className={`ec-message-list${isShortThread ? " ec-message-list--short" : ""}`}
        onScroll={handleScroll}
        aria-label={
          channelName
            ? `Сообщения канала ${channelName}${channelTopSubtitle ? `, ${channelTopSubtitle}` : ""}`
            : "Сообщения"
        }
      >
      {isShortThread && (
        <>
          <span className="ec-message-short-spacer" aria-hidden />
          <img
            className="ec-message-list__eclipse"
            src={`${import.meta.env.BASE_URL}brand-mark.svg`}
            alt=""
            aria-hidden
          />
        </>
      )}
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
      {visibleMessages.map((m, i, arr) => {
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
        const canCreateActions =
          showActions &&
          Boolean(
            onCreateAction &&
              currentRole &&
              hasPermission(currentRole, "TASK_CREATE") &&
              m.actionItems.length < 5,
          );
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
              data-message-id={m.id}
              className={
                "ec-message-row ec-anim-message-enter" +
                rowClass +
                (m.user.isBot ? " ec-message-row--ai" : "") +
                (isMine ? " ec-message-row--mine" : "") +
                (!isMine && isDirectMention(m.content, currentUserName) ? " ec-message-row--mentioned" : "") +
                (highlightedMessageId === m.id ? " ec-message-row--source-focus" : "")
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
                  <button
                    type="button"
                    className="ec-msg-avatar-button"
                    onClick={() => onOpenUserProfile?.(m.user.id)}
                    disabled={!onOpenUserProfile}
                    aria-label={`Открыть профиль ${m.user.displayName}`}
                  >
                    <span
                      className={
                        "ec-msg-avatar-wrap" +
                        (m.user.isBot ? " ec-avatar-halo ec-avatar-halo--ai" : "")
                      }
                    >
                      <Avatar url={m.user.avatar} name={m.user.displayName} size={36} />
                    </span>
                  </button>
                )}
              </div>
              <div className="ec-message-content">
                {(!grouped || newDay || isPinned) && (
                  <header className="ec-message-meta">
                    <button
                      type="button"
                      className="ec-msg-author"
                      title={m.user.displayName}
                      onClick={() => onOpenUserProfile?.(m.user.id)}
                      disabled={!onOpenUserProfile}
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
                    {m.externalEvent?.source === "github" && m.externalEvent.verified ? (
                      <GitHubEventCard event={m.externalEvent} />
                    ) : m.content ? (
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
                    ) : null}
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
                          (r.mine ? " ec-msg-reaction--mine" : "")
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
                    className={"ec-msg-pill ec-thread-link" + (updatedThreads.includes(m.id) ? " is-unread" : "")}
                    onClick={() => openThread(m.id)}
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
                    <EclipseUiIcon name="reply" size={14} />
                    {replyLabel(m.threadReplyCount ?? 0)}{updatedThreads.includes(m.id) ? " · новые" : ""}
                  </button>
                )}
                {!isDeleted && !isEditing && m.actionItems.length > 0 && (
                  <div className="ec-message-tasks">
                    {m.actionItems.map(action => <MessageActionChip key={action.id}
                      action={action} onOpen={onOpenAction} onToggle={onToggleActionStatus} />)}
                  </div>
                )}
              </div>
              {showActions && <MessageActions
                onReply={onOpenThread ? () => openThread(m.id) : undefined}
                onTask={canCreateActions ? () => onCreateAction?.(m) : undefined}
                hasTask={m.actionItems.some(item => item.type === "TASK")}
                onReact={onToggleReaction ? emoji => onToggleReaction(m.id, emoji) : undefined}
                onPickReaction={onToggleReaction ? rect => setPickerFor({ messageId: m.id, rect }) : undefined}
                actions={[
                  { id: "copy", label: isCopied ? "Скопировано" : "Копировать", icon: "copy-id", run: () => handleCopy(m) },
                  ...(onSaveToMemory && m.content.trim() ? [{ id: "memory", label: "Сохранить в память", icon: "memory" as const, run: () => onSaveToMemory(m) }] : []),
                  ...(showEdit ? [{ id: "edit", label: "Редактировать", icon: "edit" as const, run: () => beginEdit(m) }] : []),
                  ...(showUnpin ? [{ id: "unpin", label: "Открепить", icon: "pin" as const, run: () => onUnpin?.(m.id) }] : []),
                  ...(showPin ? [{ id: "pin", label: pinBurstId === m.id ? "Закреплено" : "Закрепить", icon: "pin" as const, run: () => handlePin(m) }] : []),
                  ...(showDelete ? [{ id: "delete", label: "Удалить сообщение", icon: "delete" as const, danger: true, run: () => handleDelete(m) }] : []),
                ]}
              />}

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
