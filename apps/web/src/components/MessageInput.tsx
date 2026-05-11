import type { CSSProperties } from "react";
import { useState } from "react";

type Props = {
  channelName: string | null;
  disabled?: boolean;
  onSend: (content: string) => Promise<boolean>;
};

const wrap: CSSProperties = {
  padding: "12px 18px 16px",
  borderTop: "1px solid #1c1c22",
  background: "#13131a",
};

const inputStyle: CSSProperties = {
  flex: 1,
  padding: "0.6rem 0.75rem",
  borderRadius: 8,
  border: "1px solid #2a2a32",
  background: "#1a1a20",
  color: "#e8e8ed",
  fontSize: "0.92rem",
};

export function MessageInput({ channelName, disabled, onSend }: Props) {
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  const submit = async () => {
    const trimmed = draft.trim();
    if (!trimmed || sending) {
      return;
    }
    setSending(true);
    try {
      const ok = await onSend(trimmed);
      if (ok) {
        setDraft("");
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      style={wrap}
    >
      <div style={{ display: "flex", gap: 8 }}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void submit();
            }
          }}
          placeholder={channelName ? `Сообщение в #${channelName}…` : "Сообщение…"}
          disabled={disabled}
          style={inputStyle}
        />
        <button
          type="submit"
          disabled={disabled || sending || !draft.trim()}
          style={{
            padding: "0.6rem 1rem",
            background: "#3b5ccc",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            cursor: draft.trim() && !disabled && !sending ? "pointer" : "default",
            opacity: draft.trim() && !disabled && !sending ? 1 : 0.5,
            fontWeight: 600,
          }}
        >
          Отправить
        </button>
      </div>
    </form>
  );
}
