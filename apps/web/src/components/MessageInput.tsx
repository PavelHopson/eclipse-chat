import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";

type Props = {
  channelName: string | null;
  disabled?: boolean;
  onSend: (content: string) => Promise<boolean>;
};

const wrap: CSSProperties = {
  padding: "var(--ec-space-3) var(--ec-space-5) var(--ec-space-4)",
  background: "var(--ec-bg)",
};

const composerBox: CSSProperties = {
  position: "relative",
  display: "grid",
  gridTemplateColumns: "auto 1fr auto",
  gap: "var(--ec-space-2)",
  alignItems: "end",
  padding: "var(--ec-space-2) var(--ec-space-3)",
  background: "var(--ec-input-bg)",
  border: "1px solid var(--ec-border-default)",
  borderRadius: "var(--ec-radius-lg)",
  transition: "border-color var(--ec-dur-fast) var(--ec-ease), box-shadow var(--ec-dur-fast) var(--ec-ease)",
};

const composerBoxFocused: CSSProperties = {
  borderColor: "var(--ec-accent)",
  boxShadow: "0 0 0 3px var(--ec-accent-soft)",
};

const textarea: CSSProperties = {
  display: "block",
  width: "100%",
  background: "transparent",
  border: 0,
  color: "var(--ec-text)",
  fontSize: "var(--ec-text-base)",
  lineHeight: "var(--ec-leading-normal)",
  fontFamily: "var(--ec-font-sans)",
  resize: "none",
  outline: "none",
  padding: "var(--ec-space-1) 0",
  maxHeight: 200,
  overflowY: "auto",
};

const attachBtn: CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: "var(--ec-radius-md)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "var(--ec-text-dim)",
  background: "transparent",
  border: 0,
  cursor: "not-allowed",
  transition: "color var(--ec-dur-fast) var(--ec-ease), background var(--ec-dur-fast) var(--ec-ease)",
};

const sendBtn: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "var(--ec-space-2)",
  padding: "0.55rem 0.9rem",
  background: "var(--ec-accent)",
  color: "var(--ec-accent-text)",
  border: "1px solid var(--ec-accent)",
  borderRadius: "var(--ec-radius-md)",
  fontSize: "var(--ec-text-sm)",
  fontWeight: 600,
  cursor: "pointer",
  transition: "background var(--ec-dur-fast) var(--ec-ease), opacity var(--ec-dur-fast) var(--ec-ease)",
};

const hintRow: CSSProperties = {
  marginTop: "var(--ec-space-1)",
  paddingLeft: "var(--ec-space-2)",
  fontSize: "var(--ec-text-2xs)",
  color: "var(--ec-text-dim)",
  display: "flex",
  alignItems: "center",
  gap: "var(--ec-space-2)",
  letterSpacing: "var(--ec-tracking-wide)",
};

const kbd: CSSProperties = {
  display: "inline-block",
  padding: "0 5px",
  background: "var(--ec-surface-2)",
  border: "1px solid var(--ec-border-subtle)",
  borderRadius: "var(--ec-radius-xs)",
  fontFamily: "var(--ec-font-mono)",
  fontSize: "0.62rem",
  color: "var(--ec-text-muted)",
  lineHeight: 1.6,
};

export function MessageInput({ channelName, disabled, onSend }: Props) {
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [focused, setFocused] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);

  // Autosize: height = scrollHeight, capped через max-height стилем.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [draft]);

  const submit = async () => {
    const trimmed = draft.trim();
    if (!trimmed || sending) return;
    setSending(true);
    try {
      const ok = await onSend(trimmed);
      if (ok) setDraft("");
    } finally {
      setSending(false);
      // вернуть фокус на textarea чтобы можно было продолжать печатать
      ref.current?.focus();
    }
  };

  const canSend = draft.trim().length > 0 && !disabled && !sending;
  const boxStyle = focused ? { ...composerBox, ...composerBoxFocused } : composerBox;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      style={wrap}
    >
      <div style={boxStyle}>
        <button
          type="button"
          disabled
          title="Загрузка файлов — скоро (v0.9)"
          style={attachBtn}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.49" />
          </svg>
        </button>
        <textarea
          ref={ref}
          rows={1}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void submit();
            }
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={channelName ? `Сообщение в #${channelName}` : "Сообщение"}
          disabled={disabled}
          style={textarea}
        />
        <button
          type="submit"
          disabled={!canSend}
          style={{ ...sendBtn, opacity: canSend ? 1 : 0.4, cursor: canSend ? "pointer" : "default" }}
          title="Отправить (Enter)"
        >
          {sending ? (
            "…"
          ) : (
            <>
              <span>Отправить</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </>
          )}
        </button>
      </div>
      <div style={hintRow}>
        <span><span style={kbd}>Enter</span> — отправить</span>
        <span style={{ color: "var(--ec-border-emphasis)" }}>·</span>
        <span><span style={kbd}>Shift+Enter</span> — новая строка</span>
      </div>
    </form>
  );
}
