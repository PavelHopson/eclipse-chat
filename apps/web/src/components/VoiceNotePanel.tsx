import type { CSSProperties } from "react";
import type { Socket } from "socket.io-client";
import { useVoiceNote } from "../hooks/useVoiceNote";

/**
 * v0.88 #23 phase 1a — Voice room shared notepad.
 *
 * Простой shared markdown textarea для voice-room collaboration. Phase 1a
 * — last-writer-wins без CRDT. Phase 1b — Yjs binding (yjs npm install
 * не прошёл в этом слайсе).
 *
 * UI:
 *   - Header с last-editor label + saved-status indicator
 *   - Textarea (autosize, monospace)
 *   - Conflict warning при collision
 */

type Props = {
  channelId: string;
  socket: Socket | null;
};

const wrap: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  minWidth: 0,
  minHeight: 0,
  flex: 1,
  background: "var(--ec-surface-1)",
  border: "1px solid var(--ec-border-subtle)",
  borderRadius: "var(--ec-radius-lg)",
  padding: "var(--ec-space-3)",
  gap: "var(--ec-space-2)",
};

const headerStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "var(--ec-space-2)",
  fontSize: "var(--ec-text-2xs)",
};

const titleStyle: CSSProperties = {
  fontSize: "var(--ec-text-2xs)",
  fontWeight: 800,
  letterSpacing: "var(--ec-tracking-caps)",
  textTransform: "uppercase",
  color: "var(--ec-text-dim)",
  display: "flex",
  alignItems: "center",
  gap: 6,
};

const muted: CSSProperties = {
  color: "var(--ec-text-muted)",
};

const textareaStyle: CSSProperties = {
  flex: 1,
  minHeight: 200,
  width: "100%",
  resize: "vertical",
  background: "var(--ec-surface-2)",
  border: "1px solid var(--ec-border-subtle)",
  borderRadius: "var(--ec-radius-md)",
  padding: "var(--ec-space-3)",
  color: "var(--ec-text)",
  fontFamily: "var(--ec-font-mono, ui-monospace, SFMono-Regular, monospace)",
  fontSize: "var(--ec-text-sm)",
  lineHeight: 1.55,
  outline: "none",
};

const conflictBanner: CSSProperties = {
  padding: "0.4rem 0.6rem",
  background: "hsl(36 70% 18%)",
  color: "hsl(36 80% 80%)",
  borderRadius: "var(--ec-radius-sm)",
  fontSize: "var(--ec-text-2xs)",
};

function statusLabel(s: ReturnType<typeof useVoiceNote>["status"]): string {
  switch (s.kind) {
    case "idle":
      return "";
    case "loading":
      return "загружаю…";
    case "saving":
      return "сохраняю…";
    case "saved":
      return "сохранено";
    case "conflict":
      return "конфликт — обновлено с другого устройства";
    case "error":
      return s.message;
  }
}

export function VoiceNotePanel({ channelId, socket }: Props) {
  const { note, draft, status, setContent } = useVoiceNote(channelId, socket);

  return (
    <div style={wrap}>
      <div style={headerStyle}>
        <div style={titleStyle}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <path d="M14 2v6h6" />
            <path d="M9 13h6" />
            <path d="M9 17h6" />
          </svg>
          Заметка комнаты
        </div>
        <span style={muted}>
          {note?.lastEditor
            ? `последний раз: ${note.lastEditor.displayName}`
            : note
              ? "пусто"
              : ""}
          {status.kind !== "idle" && (
            <>
              {" · "}
              <span
                style={
                  status.kind === "error" || status.kind === "conflict"
                    ? { color: "var(--ec-warn)" }
                    : status.kind === "saved"
                      ? { color: "var(--ec-accent)" }
                      : undefined
                }
              >
                {statusLabel(status)}
              </span>
            </>
          )}
        </span>
      </div>
      {status.kind === "conflict" && (
        <div style={conflictBanner}>
          Кто-то другой сохранил заметку одновременно с тобой. Phase 1a — последний
          сохранивший побеждает. Перечитай содержимое и продолжай.
        </div>
      )}
      <textarea
        style={textareaStyle}
        value={draft}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Заметки разговора, решения, action items… Markdown поддерживается. Видна всем участникам комнаты."
        spellCheck={false}
        autoCorrect="off"
        autoCapitalize="off"
      />
    </div>
  );
}
