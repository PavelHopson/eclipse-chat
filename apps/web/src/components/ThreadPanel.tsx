import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Attachments } from "./Attachments";
import { Avatar } from "./Avatar";
import { MessageInput } from "./MessageInput";
import { RichContent } from "./RichContent";
import { ConversationState } from "./ConversationState";
import { EclipseUiIcon } from "./icons/EclipseUiIcon";
import { PanelResizeHandle } from "./PanelResizeHandle";
import { useThread } from "../hooks/useThread";
import { useIsMobile } from "../hooks/useMediaQuery";
import { replyLabel } from "../lib/conversationNavigation";
import type { Socket } from "socket.io-client";
import type { PublicUser } from "../hooks/useAuth";

type Props = {
  rootId: string; socket: Socket | null; currentUser: PublicUser;
  currentUserName: string; currentUserAvatar: string | null;
  mentionNames?: string[]; customEmojis?: Record<string, string>;
  onClose: () => void; onJumpToSource?: (channelId: string, messageId: string) => void;
  sendDisabled?: boolean; width?: number; onResize?: (width: number) => void;
};
function time(iso: string) {
  return new Date(iso).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

export function ThreadPanel({ rootId, socket, currentUser, currentUserName, currentUserAvatar,
  mentionNames, customEmojis, onClose, onJumpToSource, sendDisabled = false, width = 400, onResize }: Props) {
  const { data, loading, error, reload, sendReply } = useThread(rootId, socket);
  const overlay = useIsMobile();
  const panelRef = useRef<HTMLElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const nearBottom = useRef(true);
  const tailRef = useRef<string | null>(null);
  const [newCount, setNewCount] = useState(0);
  const [expanded, setExpanded] = useState(true);
  const replies = data?.replies.filter(reply => !reply.deletedAt) ?? [];
  const lastId = replies.at(-1)?.id;

  useEffect(() => {
    tailRef.current = null; nearBottom.current = true; setNewCount(0); setExpanded(true);
  }, [rootId]);
  useEffect(() => {
    if (!lastId || lastId === tailRef.current) return;
    const follow = !tailRef.current || nearBottom.current || replies.at(-1)?.user.id === currentUser.id;
    tailRef.current = lastId;
    if (follow) {
      const frame = requestAnimationFrame(() => {
        const el = scrollRef.current;
        if (el) el.scrollTop = el.scrollHeight;
        setNewCount(0);
      });
      return () => cancelAnimationFrame(frame);
    }
    setNewCount(value => value + 1);
  }, [lastId, currentUser.id]);

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panelRef.current?.focus();
    return () => { if (previous?.isConnected) previous.focus({ preventScroll: true }); };
  }, [rootId, overlay]);

  const panel = <aside ref={panelRef} tabIndex={-1}
    className={"ec-thread-panel ec-discussion" + (overlay ? " ec-discussion--overlay" : "")}
    role={overlay ? "dialog" : "region"} aria-modal={overlay || undefined} aria-label="Обсуждение сообщения"
    onKeyDown={event => {
      if (event.defaultPrevented) return;
      // Nested picker/menu owns Escape while open.
      if (event.key === "Escape" && !panelRef.current?.querySelector('[role="menu"], [role="listbox"]')) {
        event.stopPropagation(); closeRef.current();
      }
      if (event.key !== "Tab" || !overlay) return;
      const items = Array.from(panelRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]') ?? [])
        .filter(item => item.getClientRects().length > 0);
      const first = items[0], last = items.at(-1);
      if (!first) { event.preventDefault(); return; }
      if (event.shiftKey && (document.activeElement === first || document.activeElement === panelRef.current)) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }}>
    {!overlay && onResize && <PanelResizeHandle width={width} onResize={onResize} />}
    <header className="ec-discussion__header">
      <EclipseUiIcon name="reply" size={19} />
      <div><strong>Обсуждение</strong><small>{data ? replyLabel(replies.length) : "Ответы к сообщению"}</small></div>
      <button type="button" className="ec-icon-btn" onClick={onClose} aria-label={overlay ? "Вернуться в переписку" : "Закрыть обсуждение"}><EclipseUiIcon name="close" size={19} /></button>
    </header>
    {data && <section className="ec-discussion__source">
      <button type="button" className="ec-discussion__source-toggle" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>
        <span>Исходное сообщение · {data.root.user.displayName}</span><EclipseUiIcon name="chevron" size={15} />
      </button>
      {expanded && <div className="ec-discussion__source-body">
        {data.root.deletedAt ? <p>Исходное сообщение удалено.</p> : <>
          <RichContent content={data.root.content} mentionNames={mentionNames} currentUserName={currentUserName} customEmojis={customEmojis} />
          {data.root.attachments.length > 0 && <Attachments attachments={data.root.attachments} />}
        </>}
      </div>}
      {onJumpToSource && <button type="button" className="ec-discussion__source-link"
        onClick={() => onJumpToSource(data.channelId, data.root.id)}>Показать в переписке <EclipseUiIcon name="arrow" size={14} /></button>}
    </section>}
    <div className="ec-discussion__scroll" ref={scrollRef} onScroll={() => {
      const el = scrollRef.current;
      nearBottom.current = !el || el.scrollHeight - el.scrollTop - el.clientHeight < 80;
      if (nearBottom.current) setNewCount(0);
    }}>
      {loading && !data && <ConversationState kind="loading" title="Открываем обсуждение…" />}
      {error && <ConversationState kind="error" title="Обсуждение недоступно" detail={error} onRetry={reload} />}
      {data && !error && replies.length === 0 && <ConversationState kind="empty" title="Здесь пока нет ответов" detail="Продолжите разговор — ответ останется рядом с исходным сообщением." />}
      {replies.map(reply => <article key={reply.id} className={"ec-discussion__reply" + (reply.pending ? " is-pending" : "")}>
        <Avatar url={reply.user.avatar} name={reply.user.displayName} size={30} />
        <div className="ec-discussion__reply-body">
          <header><strong>{reply.user.displayName}</strong>{reply.user.isBot && <span className="ec-discussion__agent">AI</span>}
            <time dateTime={reply.createdAt}>{time(reply.createdAt)}</time></header>
          <RichContent content={reply.content} mentionNames={mentionNames} currentUserName={currentUserName} customEmojis={customEmojis} />
          {reply.attachments.length > 0 && <Attachments attachments={reply.attachments} />}
          {reply.pending && <small role="status">Отправляется…</small>}
        </div>
      </article>)}
    </div>
    {newCount > 0 && <button type="button" className="ec-discussion__new" onClick={() => {
      const el = scrollRef.current; if (el) el.scrollTop = el.scrollHeight;
      nearBottom.current = true; setNewCount(0);
    }}>Новые ответы · {newCount} <EclipseUiIcon name="chevron" size={15} /></button>}
    <MessageInput channelName={null} placeholder="Ответить в обсуждении" draftKey={"thread:" + rootId}
      disabled={!data || Boolean(data.root.deletedAt)} sendDisabled={sendDisabled} hideSlashCommands
      mentionNames={mentionNames} customEmojis={customEmojis}
      onSend={(content, attachments) => sendReply(content, { id: currentUser.id, displayName: currentUserName, avatar: currentUserAvatar }, attachments)} />
  </aside>;
  return overlay ? createPortal(<div className="ec-discussion-backdrop ec-workspace-v2" data-visual-profile="operational" onClick={event => { if (event.target === event.currentTarget) onClose(); }}>{panel}</div>, document.body) : panel;
}
