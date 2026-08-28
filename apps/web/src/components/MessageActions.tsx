import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { EclipseUiIcon, type EclipseUiIconName } from "./icons/EclipseUiIcon";

type Action = {
  id: string;
  label: string;
  icon: EclipseUiIconName;
  run: () => unknown | Promise<unknown>;
  danger?: boolean;
};

/** Only the primary actions stay in the timeline. The portal cannot be clipped
 * by the message scroller; native buttons remain reachable on touch/keyboard. */
export function MessageActions({ onReply, onTask, hasTask, actions, onReact, onPickReaction }: {
  onReply?: () => void;
  onTask?: () => void;
  hasTask?: boolean;
  actions: Action[];
  onReact?: (emoji: string) => unknown | Promise<unknown>;
  onPickReaction?: (rect: DOMRect) => void;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  useLayoutEffect(() => {
    if (!open || !trigger.current || !menu.current) return;
    const rect = trigger.current.getBoundingClientRect();
    const height = Math.min(menu.current.scrollHeight, window.innerHeight - 24);
    const width = Math.min(252, window.innerWidth - 24);
    setPosition({
      left: Math.max(12, Math.min(rect.right - width, window.innerWidth - width - 12)),
      top: Math.max(12, rect.bottom + 8 + height <= window.innerHeight - 12
        ? rect.bottom + 8 : rect.top - height - 8),
    });
    menu.current.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!menu.current?.contains(event.target as Node) && !trigger.current?.contains(event.target as Node)) setOpen(false);
    };
    const dismiss = () => setOpen(false);
    const scroll = (event: Event) => { if (!menu.current?.contains(event.target as Node)) dismiss(); };
    document.addEventListener("pointerdown", outside);
    window.addEventListener("resize", dismiss);
    window.addEventListener("scroll", scroll, true);
    return () => {
      document.removeEventListener("pointerdown", outside);
      window.removeEventListener("resize", dismiss);
      window.removeEventListener("scroll", scroll, true);
    };
  }, [open]);

  const run = async (action: () => unknown | Promise<unknown>) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError("");
    setOpen(false);
    trigger.current?.focus();
    try {
      const result = await action();
      if (result === false) throw new Error("action-failed");
    } catch {
      setError("Не удалось выполнить действие. Попробуйте ещё раз.");
      setOpen(true);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  return <div className={"ec-message-actions ec-message-actions--quiet" + (open ? " is-open" : "")}>
    {onReply && <button type="button" className="ec-msg-action" aria-label="Ответить в треде" onClick={onReply}>
      <EclipseUiIcon name="reply" size={16} /><span>Ответить</span>
    </button>}
    {onTask && <button type="button" className="ec-msg-action ec-msg-action--task"
      aria-label={hasTask ? "Добавить связанный объект" : "Создать задачу из сообщения"} onClick={onTask}>
      <EclipseUiIcon name="task" size={16} /><span>{hasTask ? "Добавить" : "Задача"}</span>
    </button>}
    <button ref={trigger} type="button" className="ec-msg-action" aria-label="Ещё действия"
      aria-haspopup="menu" aria-controls={open ? id : undefined} aria-expanded={open}
      onClick={() => { setError(""); setOpen(value => !value); }}
      onKeyDown={event => { if (event.key === "ArrowDown") { event.preventDefault(); setOpen(true); } }}>
      <EclipseUiIcon name="more" size={18} /><span>Ещё</span>
    </button>
    {open && createPortal(<div id={id} ref={menu} role="menu" aria-label="Действия с сообщением"
      className="ec-message-menu" style={position} aria-busy={busy}
      onKeyDown={event => {
        const buttons = Array.from(menu.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? []);
        const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
        if (event.key === "Escape" || event.key === "Tab") {
          event.preventDefault(); event.stopPropagation(); setOpen(false); trigger.current?.focus();
        } else if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
          event.preventDefault();
          const next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1
            : (index + (event.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length;
          buttons[next]?.focus();
        }
      }}>
      {onReact && <div className="ec-message-menu__reactions" role="group" aria-label="Быстрая реакция">
        {["👍", "❤️", "😂", "🎉", "🔥", "👀"].map(emoji => <button key={emoji} type="button" role="menuitem"
          disabled={busy} aria-label={"Реакция " + emoji} onClick={() => void run(() => onReact(emoji))}>{emoji}</button>)}
      </div>}
      {onPickReaction && <button type="button" role="menuitem" disabled={busy} onClick={() => {
        const rect = trigger.current?.getBoundingClientRect();
        setOpen(false); if (rect) onPickReaction(rect);
      }}><EclipseUiIcon name="smile" size={18} />Все реакции</button>}
      {actions.map(action => <button key={action.id} type="button" role="menuitem" disabled={busy}
        className={action.danger ? "is-danger" : undefined} onClick={() => void run(action.run)}>
        <EclipseUiIcon name={action.icon} size={18} />{action.label}
      </button>)}
      {error && <p role="alert" className="ec-message-menu__error">{error}</p>}
    </div>, document.body)}
  </div>;
}
