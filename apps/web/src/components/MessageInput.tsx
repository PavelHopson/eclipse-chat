import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";
import { fileToBase64 } from "../lib/fileToBase64";
import type { AttachmentUpload } from "../hooks/useMessages";
import type { ActionItemType } from "../lib/socket";
import {
  AutocompletePopover,
  detectTrigger,
  type AutocompleteItem,
  type AutocompleteTrigger,
} from "./AutocompletePopover";

/**
 * Operator slash-commands — `/task` `/decision` `/followup` в композере.
 * `/task Купить домен` → отправляет сообщение «Купить домен» + создаёт из
 * него ActionItem типа TASK (backend делает это атомарно в одном POST).
 */
const SLASH_COMMANDS: {
  cmd: string;
  aliases: string[];
  type: ActionItemType;
  label: string;
  desc: string;
}[] = [
  { cmd: "task", aliases: ["task", "t"], type: "TASK", label: "/task", desc: "создать задачу из текста" },
  { cmd: "decision", aliases: ["decision", "dec", "d"], type: "DECISION", label: "/decision", desc: "зафиксировать решение" },
  { cmd: "followup", aliases: ["followup", "fu", "f"], type: "FOLLOW_UP", label: "/followup", desc: "поставить follow-up" },
];

function parseSlashCommand(
  text: string,
): { type: ActionItemType; title: string } | null {
  const m = text.match(/^\/([a-zA-Z]+)\s+([\s\S]+)$/);
  if (!m) return null;
  const cmd = m[1].toLowerCase();
  const title = m[2].trim();
  if (!title) return null;
  const found = SLASH_COMMANDS.find((c) => c.aliases.includes(cmd));
  return found ? { type: found.type, title } : null;
}

type Props = {
  channelName: string | null;
  disabled?: boolean;
  onSend: (
    content: string,
    attachments: AttachmentUpload[],
    actionItem?: { type: ActionItemType },
  ) => Promise<boolean>;
  onTypingStart?: () => void;
  onTypingStop?: () => void;
  /** Display names known members активного сервера — для @-autocomplete. */
  mentionNames?: string[];
  /** Hide attachments — для thread reply composer, где attachments yet not supported. */
  hideAttachments?: boolean;
  /** Custom placeholder. */
  placeholder?: string;
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

const iconBtn: CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: "var(--ec-radius-md)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "var(--ec-text-muted)",
  background: "transparent",
  border: 0,
  cursor: "pointer",
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

const slashHintStrip: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 2,
  marginBottom: "var(--ec-space-2)",
  padding: 4,
  background: "var(--ec-surface-2)",
  border: "1px solid var(--ec-border-default)",
  borderRadius: "var(--ec-radius-md)",
};

const slashHintItem: CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  gap: "var(--ec-space-2)",
  padding: "0.35rem 0.55rem",
  background: "transparent",
  border: 0,
  borderRadius: "var(--ec-radius-sm)",
  cursor: "pointer",
  textAlign: "left",
  width: "100%",
  transition: "background var(--ec-dur-fast) var(--ec-ease)",
};

const previewRow: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "var(--ec-space-2)",
  marginBottom: "var(--ec-space-2)",
};

const previewChip: CSSProperties = {
  position: "relative",
  display: "flex",
  alignItems: "center",
  gap: 6,
  padding: "4px 28px 4px 4px",
  background: "var(--ec-surface-2)",
  border: "1px solid var(--ec-border-subtle)",
  borderRadius: "var(--ec-radius-md)",
  fontSize: "var(--ec-text-xs)",
  color: "var(--ec-text-muted)",
  maxWidth: 180,
};

const previewThumb: CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: "var(--ec-radius-sm)",
  objectFit: "cover",
  flexShrink: 0,
};

const previewRemove: CSSProperties = {
  position: "absolute",
  top: 2,
  right: 2,
  width: 18,
  height: 18,
  display: "grid",
  placeItems: "center",
  borderRadius: "var(--ec-radius-full)",
  background: "var(--ec-surface-3)",
  border: 0,
  color: "var(--ec-text-muted)",
  cursor: "pointer",
};

// Лимиты в синхроне с backend (apps/server/src/attachments.ts) — v0.9.2 bumped.
const ATTACHMENT_MAX_BYTES = 50 * 1024 * 1024;
const MAX_PER_MESSAGE = 10;
const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
  "image/heic",
  "image/heif",
  "image/bmp",
  "image/tiff",
  "image/svg+xml",
  "application/pdf",
  "text/plain",
  "text/markdown",
  "application/json",
  "application/zip",
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "audio/mpeg",
  "audio/wav",
  "audio/ogg",
  "audio/webm",
]);

type Pending = {
  id: string;
  file: File;
  /** data: URI для image preview. Null для non-image. */
  previewUrl: string | null;
};

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function MessageInput({
  channelName,
  disabled,
  onSend,
  onTypingStart,
  onTypingStop,
  mentionNames = [],
  hideAttachments = false,
  placeholder,
}: Props) {
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [focused, setFocused] = useState(false);
  const [pending, setPending] = useState<Pending[]>([]);
  const [attachError, setAttachError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Autocomplete state — @ mentions + : emoji shortcodes
  const [trigger, setTrigger] = useState<AutocompleteTrigger | null>(null);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);

  const refreshTrigger = () => {
    const el = textareaRef.current;
    if (!el || el.disabled) {
      setTrigger(null);
      return;
    }
    const caret = el.selectionStart ?? 0;
    const next = detectTrigger(el.value, caret);
    setTrigger(next);
    if (next) {
      setAnchorRect(el.getBoundingClientRect());
    }
  };

  const applyAutocomplete = (item: AutocompleteItem) => {
    if (!trigger) return;
    const el = textareaRef.current;
    if (!el) return;
    const caret = el.selectionStart ?? draft.length;
    // Replace text [startIdx..caret] (includes trigger char `@` или `:` + word)
    const before = draft.slice(0, trigger.startIdx);
    const after = draft.slice(caret);
    const next = before + item.insertText + after;
    setDraft(next);
    setTrigger(null);
    // Reposition caret после insert
    queueMicrotask(() => {
      el.focus();
      const newCaret = before.length + item.insertText.length;
      el.setSelectionRange(newCaret, newCaret);
    });
  };

  /**
   * Typing emit: первый keystroke → typing:start, последующие — refresh
   * stop-timer (3 секунды после последнего keystroke). Если sendMessage
   * вызвался — emit stop сразу + сброс таймера.
   */
  const isTypingRef = useRef(false);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleStop = () => {
    if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
    stopTimerRef.current = setTimeout(() => {
      if (isTypingRef.current) {
        isTypingRef.current = false;
        onTypingStop?.();
      }
      stopTimerRef.current = null;
    }, 3_000);
  };

  const handleDraftChange = (value: string) => {
    setDraft(value);
    // Refresh trigger после React-update применит value (next tick)
    queueMicrotask(refreshTrigger);
    if (value.trim().length === 0) {
      // Очистили — сразу stop
      if (isTypingRef.current) {
        isTypingRef.current = false;
        onTypingStop?.();
      }
      if (stopTimerRef.current) {
        clearTimeout(stopTimerRef.current);
        stopTimerRef.current = null;
      }
      return;
    }
    if (!isTypingRef.current) {
      isTypingRef.current = true;
      onTypingStart?.();
    }
    scheduleStop();
  };

  // Cleanup на unmount / channel change
  useEffect(() => {
    return () => {
      if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
      if (isTypingRef.current) {
        isTypingRef.current = false;
        onTypingStop?.();
      }
    };
    // onTypingStop как dep вызвал бы лишний emit — игнорируем
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Autosize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [draft]);

  // Cleanup object-URLs on unmount или при unpending
  useEffect(() => {
    return () => {
      for (const p of pending) {
        if (p.previewUrl && p.previewUrl.startsWith("blob:")) {
          URL.revokeObjectURL(p.previewUrl);
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addFiles = (filesList: FileList | File[]) => {
    setAttachError(null);
    const files = Array.from(filesList);
    const newOnes: Pending[] = [];
    let err: string | null = null;
    for (const f of files) {
      // Allow files без явного MIME — браузер часто не знает HEIC, MOV.
      // Backend сам разруливает через sharp/magic bytes.
      const acceptable =
        ALLOWED_MIME.has(f.type) ||
        f.type === "" ||
        f.type === "application/octet-stream" ||
        f.type.startsWith("image/") ||
        f.type.startsWith("video/") ||
        f.type.startsWith("audio/");
      if (!acceptable) {
        err = `Не поддерживается: ${f.type || f.name}`;
        continue;
      }
      if (f.size > ATTACHMENT_MAX_BYTES) {
        err = `«${f.name}» больше ${(ATTACHMENT_MAX_BYTES / 1024 / 1024).toFixed(0)} МБ`;
        continue;
      }
      const isImage = f.type.startsWith("image/");
      newOnes.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        file: f,
        previewUrl: isImage ? URL.createObjectURL(f) : null,
      });
    }
    setPending((prev) => {
      const next = [...prev, ...newOnes];
      if (next.length > MAX_PER_MESSAGE) {
        err = `Максимум ${MAX_PER_MESSAGE} файлов на сообщение`;
        return next.slice(0, MAX_PER_MESSAGE);
      }
      return next;
    });
    if (err) setAttachError(err);
  };

  const removePending = (id: string) => {
    setPending((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target?.previewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((p) => p.id !== id);
    });
  };

  const submit = async () => {
    const trimmed = draft.trim();
    if ((!trimmed && pending.length === 0) || sending) return;
    setSending(true);
    setAttachError(null);
    try {
      // Конвертируем все File в base64 параллельно
      const uploads: AttachmentUpload[] = await Promise.all(
        pending.map(async (p) => ({
          filename: p.file.name,
          mimeType: p.file.type,
          dataBase64: await fileToBase64(p.file),
        })),
      );
      // Operator slash-command: `/task ...` → отправляем title + actionItem.
      const slash = parseSlashCommand(trimmed);
      const ok = slash
        ? await onSend(slash.title, uploads, { type: slash.type })
        : await onSend(trimmed, uploads);
      if (ok) {
        setDraft("");
        for (const p of pending) {
          if (p.previewUrl?.startsWith("blob:")) URL.revokeObjectURL(p.previewUrl);
        }
        setPending([]);
        // Sent → typing stop сразу
        if (isTypingRef.current) {
          isTypingRef.current = false;
          onTypingStop?.();
        }
        if (stopTimerRef.current) {
          clearTimeout(stopTimerRef.current);
          stopTimerRef.current = null;
        }
      }
    } finally {
      setSending(false);
      textareaRef.current?.focus();
    }
  };

  const canSend = (draft.trim().length > 0 || pending.length > 0) && !disabled && !sending;
  const boxStyle = focused ? { ...composerBox, ...composerBoxFocused } : composerBox;

  // Slash-command hint: показываем когда юзер набрал «/» + (опц.) часть
  // команды, но ещё не дошёл до пробела. @/:-popover имеет приоритет.
  const slashQuery = /^\s*\/([a-zA-Zа-яёА-ЯЁ]*)$/.exec(draft);
  const slashMatches =
    slashQuery && !trigger
      ? SLASH_COMMANDS.filter((c) => c.cmd.startsWith(slashQuery[1].toLowerCase()))
      : [];

  // Drag-drop поддержка
  const [dragOver, setDragOver] = useState(false);
  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };
  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      style={{
        ...wrap,
        ...(dragOver ? { background: "var(--ec-accent-soft)" } : {}),
      }}
      className="ec-composer ec-composer-safe"
    >
      {pending.length > 0 && (
        <div style={previewRow}>
          {pending.map((p) => (
            <div key={p.id} style={previewChip} className="ec-anim-fade">
              {p.previewUrl ? (
                <img src={p.previewUrl} alt="" style={previewThumb} />
              ) : (
                <span
                  aria-hidden
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: "var(--ec-radius-sm)",
                    background: "var(--ec-surface-3)",
                    display: "grid",
                    placeItems: "center",
                    flexShrink: 0,
                    color: "var(--ec-text-muted)",
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                </span>
              )}
              <span
                style={{
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  flex: 1,
                  minWidth: 0,
                }}
                title={p.file.name}
              >
                {p.file.name}
              </span>
              <span style={{ fontSize: "0.65rem", color: "var(--ec-text-dim)" }}>
                {humanSize(p.file.size)}
              </span>
              <button
                type="button"
                onClick={() => removePending(p.id)}
                aria-label="Убрать"
                title="Убрать"
                style={previewRemove}
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
      {attachError && (
        <p style={{ margin: "0 0 var(--ec-space-2)", color: "var(--ec-danger)", fontSize: "var(--ec-text-xs)" }}>
          {attachError}
        </p>
      )}
      {slashMatches.length > 0 && (
        <div style={slashHintStrip}>
          {slashMatches.map((c) => (
            <button
              key={c.cmd}
              type="button"
              style={slashHintItem}
              onMouseDown={(e) => {
                // mousedown (не click) — чтобы успеть до blur textarea
                e.preventDefault();
                setDraft(`/${c.cmd} `);
                queueMicrotask(() => textareaRef.current?.focus());
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "var(--ec-surface-3)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
              }}
            >
              <strong
                style={{
                  fontFamily: "var(--ec-font-mono)",
                  fontSize: "var(--ec-text-xs)",
                  color: "var(--ec-accent)",
                }}
              >
                {c.label}
              </strong>
              <span style={{ fontSize: "var(--ec-text-2xs)", color: "var(--ec-text-muted)" }}>
                {c.desc}
              </span>
            </button>
          ))}
        </div>
      )}
      <div className="ec-composer-box" style={boxStyle}>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp,image/gif,application/pdf,text/plain"
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
            e.target.value = "";
          }}
          style={{ display: "none" }}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || pending.length >= MAX_PER_MESSAGE}
          className="ec-composer-icon-btn"
          title="Прикрепить файлы"
          aria-label="Прикрепить файлы"
          style={iconBtn}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "var(--ec-surface-3)";
            e.currentTarget.style.color = "var(--ec-text)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.color = "var(--ec-text-muted)";
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.49" />
          </svg>
        </button>
        <textarea
          ref={textareaRef}
          rows={1}
          value={draft}
          onChange={(e) => handleDraftChange(e.target.value)}
          onKeyDown={(e) => {
            // Если popover активен — Enter/Tab/Arrow keys обрабатывает он (capture).
            // Здесь только Enter без trigger = submit.
            if (e.key === "Enter" && !e.shiftKey && !trigger) {
              e.preventDefault();
              void submit();
            }
          }}
          onClick={refreshTrigger}
          onKeyUp={(e) => {
            // Arrow keys / Home / End — caret position может измениться
            if (
              e.key === "ArrowLeft" ||
              e.key === "ArrowRight" ||
              e.key === "Home" ||
              e.key === "End"
            ) {
              refreshTrigger();
            }
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            // Dismiss popover с задержкой — чтобы успел сработать onClick по item
            setTimeout(() => setTrigger(null), 120);
          }}
          placeholder={
            placeholder ?? (channelName ? `Сообщение в #${channelName}` : "Сообщение")
          }
          disabled={disabled}
          className="ec-composer-textarea"
          style={textarea}
        />
        <button
          type="submit"
          disabled={!canSend}
          className="ec-composer-send"
          style={{ ...sendBtn, opacity: canSend ? 1 : 0.4, cursor: canSend ? "pointer" : "default" }}
          title="Отправить (Enter)"
        >
          {sending ? (
            "…"
          ) : (
            <>
              <span className="ec-composer-send-label">Отправить</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </>
          )}
        </button>
      </div>
      <div className="ec-composer-hints" style={hintRow}>
        <span><span style={kbd}>Enter</span> — отправить</span>
        <span style={{ color: "var(--ec-border-emphasis)" }}>·</span>
        <span><span style={kbd}>Shift+Enter</span> — новая строка</span>
        {!hideAttachments && (
          <>
            <span style={{ color: "var(--ec-border-emphasis)" }}>·</span>
            <span>drop файлы</span>
          </>
        )}
        <span style={{ color: "var(--ec-border-emphasis)" }}>·</span>
        <span>
          <span style={kbd}>@</span> участник · <span style={kbd}>:</span>emoji
        </span>
        <span style={{ color: "var(--ec-border-emphasis)" }}>·</span>
        <span>
          <span style={kbd}>/task</span> задача
        </span>
      </div>
      {trigger && (
        <AutocompletePopover
          trigger={trigger}
          members={mentionNames}
          anchorRect={anchorRect}
          onSelect={applyAutocomplete}
          onDismiss={() => setTrigger(null)}
        />
      )}
    </form>
  );
}
