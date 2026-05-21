import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";
import { fileToBase64 } from "../lib/fileToBase64";
import { computeWaveformPeaks } from "../lib/audioPeaks";
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
  /** Stable storage key for local drafts: channel:<id>, dm:<id>, thread:<id>. */
  draftKey?: string | null;
  /**
   * Client Mode: спрятать operator-фичи композера — slash-hint strip + не
   * парсить /task /decision /followup (клиенту не нужны task-creation
   * shortcut'ы). DM-композер тоже использует true (DM не имеет actions).
   */
  hideSlashCommands?: boolean;
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
  padding: "var(--ec-space-1) var(--ec-space-3)",
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
  width: 28,
  height: 28,
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
  padding: "0.4rem 0.7rem",
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

// Лимиты в синхроне с backend (apps/server/src/attachments.ts).
// Не-видео: 50 MB. Видео: 200 MB (4K phone clip без транскода).
const ATTACHMENT_MAX_BYTES = 50 * 1024 * 1024;
const ATTACHMENT_MAX_BYTES_VIDEO = 200 * 1024 * 1024;
const MAX_PER_MESSAGE = 10;
const ALLOWED_MIME = new Set([
  // Images
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
  // Documents
  "application/pdf",
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/json",
  // Office
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.oasis.opendocument.text",
  "application/vnd.oasis.opendocument.spreadsheet",
  "application/vnd.oasis.opendocument.presentation",
  // Archives
  "application/zip",
  "application/x-rar-compressed",
  "application/vnd.rar",
  "application/x-7z-compressed",
  "application/x-tar",
  "application/gzip",
  "application/x-bzip2",
  // Video
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-matroska",
  "video/x-msvideo",
  // Audio
  "audio/mpeg",
  "audio/wav",
  "audio/x-wav",
  "audio/ogg",
  "audio/webm",
  "audio/mp4",
  "audio/aac",
]);

function clientSizeLimit(mime: string): number {
  return mime.startsWith("video/") ? ATTACHMENT_MAX_BYTES_VIDEO : ATTACHMENT_MAX_BYTES;
}

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

function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function pickVoiceMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "";
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/ogg",
  ];
  return candidates.find((mime) => MediaRecorder.isTypeSupported(mime)) ?? "";
}

function extensionFromAudioMime(mime: string): string {
  if (mime.includes("ogg")) return "ogg";
  if (mime.includes("mpeg")) return "mp3";
  if (mime.includes("wav")) return "wav";
  return "webm";
}

function normalizeAudioMime(mime: string): string {
  return mime.split(";")[0] || "audio/webm";
}

function voiceFilename(mime: string): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `voice-message-${stamp}.${extensionFromAudioMime(mime)}`;
}

const DRAFT_STORAGE_PREFIX = "eclipse-chat:draft:v1:";

function getDraftStorageKey(draftKey: string | null | undefined): string | null {
  return draftKey ? `${DRAFT_STORAGE_PREFIX}${draftKey}` : null;
}

function loadDraft(draftKey: string | null | undefined): string {
  const storageKey = getDraftStorageKey(draftKey);
  if (!storageKey || typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(storageKey) ?? "";
  } catch {
    return "";
  }
}

function saveDraft(draftKey: string | null | undefined, value: string) {
  const storageKey = getDraftStorageKey(draftKey);
  if (!storageKey || typeof window === "undefined") return;
  try {
    if (value.trim().length === 0) {
      window.localStorage.removeItem(storageKey);
    } else {
      window.localStorage.setItem(storageKey, value);
    }
  } catch {
    // Storage can be unavailable in private modes; composer should still work.
  }
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
  draftKey = null,
  hideSlashCommands = false,
}: Props) {
  const [draft, setDraft] = useState(() => loadDraft(draftKey));
  const [sending, setSending] = useState(false);
  const [focused, setFocused] = useState(false);
  const [pending, setPending] = useState<Pending[]>([]);
  const [attachError, setAttachError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const draftRef = useRef(draft);
  const draftKeyRef = useRef<string | null>(draftKey);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const recordingCancelledRef = useRef(false);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingMs, setRecordingMs] = useState(0);
  // Autocomplete state — @ mentions + : emoji shortcodes
  const [trigger, setTrigger] = useState<AutocompleteTrigger | null>(null);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);

  const setDraftValue = (value: string) => {
    draftRef.current = value;
    setDraft(value);
  };

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
    setDraftValue(next);
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

  useEffect(() => {
    const currentKey = draftKey ?? null;
    if (draftKeyRef.current === currentKey) return;

    if (isTypingRef.current) {
      isTypingRef.current = false;
      onTypingStop?.();
    }
    if (stopTimerRef.current) {
      clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      recordingCancelledRef.current = true;
      mediaRecorderRef.current.stop();
    }
    saveDraft(draftKeyRef.current, draftRef.current);
    draftKeyRef.current = currentKey;
    setDraftValue(loadDraft(currentKey));
    setPending([]);
    setAttachError(null);
    setTrigger(null);
  }, [draftKey]);

  useEffect(() => {
    const timer = window.setTimeout(() => saveDraft(draftKey, draft), 250);
    return () => window.clearTimeout(timer);
  }, [draftKey, draft]);

  useEffect(() => {
    return () => saveDraft(draftKeyRef.current, draftRef.current);
  }, []);

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
    setDraftValue(value);
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
      const limit = clientSizeLimit(f.type);
      if (f.size > limit) {
        err = `«${f.name}» больше ${(limit / 1024 / 1024).toFixed(0)} МБ`;
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

  const cleanupRecordingTimer = () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  };

  const cleanupRecordingStream = () => {
    recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
    recordingStreamRef.current = null;
  };

  const stopVoiceRecording = (save: boolean) => {
    recordingCancelledRef.current = !save;
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
      return;
    }
    cleanupRecordingTimer();
    cleanupRecordingStream();
    setIsRecording(false);
    setRecordingMs(0);
  };

  const startVoiceRecording = async () => {
    if (disabled || sending || pending.length >= MAX_PER_MESSAGE || hideAttachments) return;
    if (isRecording) {
      stopVoiceRecording(true);
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setAttachError("Браузер не поддерживает запись голосовых сообщений.");
      return;
    }

    try {
      setAttachError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      const preferredMime = pickVoiceMimeType();
      const recorder = preferredMime
        ? new MediaRecorder(stream, { mimeType: preferredMime })
        : new MediaRecorder(stream);

      recordingChunksRef.current = [];
      recordingCancelledRef.current = false;
      recordingStreamRef.current = stream;
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) recordingChunksRef.current.push(event.data);
      };

      recorder.onerror = () => {
        setAttachError("Запись голоса прервалась. Попробуй ещё раз.");
        stopVoiceRecording(false);
      };

      recorder.onstop = () => {
        const chunks = recordingChunksRef.current;
        const mimeType = normalizeAudioMime(recorder.mimeType || preferredMime || "audio/webm");
        if (!recordingCancelledRef.current && chunks.length > 0) {
          const blob = new Blob(chunks, { type: mimeType });
          const file = new File([blob], voiceFilename(mimeType), { type: mimeType });
          addFiles([file]);
        }
        mediaRecorderRef.current = null;
        recordingChunksRef.current = [];
        cleanupRecordingTimer();
        cleanupRecordingStream();
        setIsRecording(false);
        setRecordingMs(0);
      };

      recorder.start(250);
      const startedAt = Date.now();
      setIsRecording(true);
      setRecordingMs(0);
      cleanupRecordingTimer();
      recordingTimerRef.current = setInterval(() => {
        setRecordingMs(Date.now() - startedAt);
      }, 250);
    } catch {
      cleanupRecordingTimer();
      cleanupRecordingStream();
      setIsRecording(false);
      setRecordingMs(0);
      setAttachError("Не удалось получить доступ к микрофону.");
    }
  };

  useEffect(() => {
    return () => {
      recordingCancelledRef.current = true;
      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state !== "inactive") {
        recorder.ondataavailable = null;
        recorder.onerror = null;
        recorder.onstop = null;
        recorder.stop();
      }
      mediaRecorderRef.current = null;
      recordingChunksRef.current = [];
      cleanupRecordingTimer();
      cleanupRecordingStream();
    };
    // Recorder cleanup must run only on unmount; callbacks use refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async () => {
    const trimmed = draft.trim();
    if ((!trimmed && pending.length === 0) || sending || isRecording) return;
    setSending(true);
    setAttachError(null);
    try {
      // Конвертируем все File в base64 параллельно + для audio дополнительно
      // считаем waveform peaks (Telegram-style viz). computeWaveformPeaks
      // failure-safe возвращает null — backend fallback на linear progress.
      const uploads: AttachmentUpload[] = await Promise.all(
        pending.map(async (p) => {
          const isAudio = p.file.type.startsWith("audio/");
          const [dataBase64, waveformPeaks] = await Promise.all([
            fileToBase64(p.file),
            isAudio ? computeWaveformPeaks(p.file).catch(() => null) : Promise.resolve(null),
          ]);
          return {
            filename: p.file.name,
            mimeType: p.file.type,
            dataBase64,
            waveformPeaks,
          };
        }),
      );
      // Operator slash-command: `/task ...` → отправляем title + actionItem.
      // В Client Mode парсинг отключён — клиенту не нужны task-shortcut'ы.
      const slash = hideSlashCommands ? null : parseSlashCommand(trimmed);
      const ok = slash
        ? await onSend(slash.title, uploads, { type: slash.type })
        : await onSend(trimmed, uploads);
      if (ok) {
        setDraftValue("");
        saveDraft(draftKeyRef.current, "");
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

  const canSend = (draft.trim().length > 0 || pending.length > 0) && !disabled && !sending && !isRecording;
  const baseBoxStyle = focused ? { ...composerBox, ...composerBoxFocused } : composerBox;
  const boxStyle: CSSProperties = {
    ...baseBoxStyle,
    gridTemplateColumns: hideAttachments
      ? "minmax(0, 1fr) auto"
      : "auto auto minmax(0, 1fr) auto",
  };

  // Slash-command hint: показываем когда юзер набрал «/» + (опц.) часть
  // команды, но ещё не дошёл до пробела. @/:-popover имеет приоритет.
  // В Client Mode hint скрыт (hideSlashCommands).
  const slashQuery = hideSlashCommands
    ? null
    : /^\s*\/([a-zA-Zа-яёА-ЯЁ]*)$/.exec(draft);
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
      {isRecording && (
        <div className="ec-voice-recorder-bar" role="status" aria-live="polite">
          <span className="ec-voice-recorder-bar__pulse" aria-hidden />
          <span className="ec-voice-recorder-bar__label">Запись голоса</span>
          <span className="ec-voice-recorder-bar__time">{formatDuration(recordingMs)}</span>
          <button
            type="button"
            className="ec-btn ec-btn--ghost ec-btn--sm"
            onClick={() => stopVoiceRecording(false)}
          >
            Отмена
          </button>
          <button
            type="button"
            className="ec-btn ec-btn--primary ec-btn--sm"
            onClick={() => stopVoiceRecording(true)}
          >
            Готово
          </button>
        </div>
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
                setDraftValue(`/${c.cmd} `);
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
      {/* v1.1.1 Eclipse_OS secure-channel status strip над composer'ом. */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "0 0 6px",
          fontSize: "0.6rem",
          color: "var(--ec-text-dim)",
          fontFamily: "var(--ec-font-mono, ui-monospace, monospace)",
          letterSpacing: "0.06em",
        }}
      >
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            padding: "0.16rem 0.5rem",
            borderRadius: "var(--ec-radius-sm)",
            background: "color-mix(in srgb, var(--ec-accent) 12%, transparent)",
            border: "1px solid var(--ec-border-accent)",
            color: "var(--ec-accent)",
            fontWeight: 700,
          }}
        >
          {">_"} ЗАЩИЩЁННЫЙ_КАНАЛ
        </span>
        <span style={{ textTransform: "uppercase", display: "inline-flex", alignItems: "center" }}>
          {focused ? "ВВОД ПОТОКА" : "ОЖИДАНИЕ СИГНАЛА"}
          <span className="ec-composer-scan-dots" aria-hidden>
            <span /><span /><span />
          </span>
        </span>
      </div>
      <div className="ec-composer-box" style={boxStyle}>
        {!hideAttachments && (
          <>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,video/*,audio/*,application/pdf,text/plain,text/markdown,text/csv,application/json,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.oasis.opendocument.text,application/vnd.oasis.opendocument.spreadsheet,application/vnd.oasis.opendocument.presentation,application/zip,application/x-rar-compressed,application/vnd.rar,application/x-7z-compressed,application/x-tar,application/gzip,application/x-bzip2,.docx,.xlsx,.pptx,.odt,.ods,.odp,.csv,.zip,.rar,.7z,.tar,.gz,.bz2,.mkv,.avi"
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
            e.target.value = "";
          }}
          style={{ display: "none" }}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || pending.length >= MAX_PER_MESSAGE || isRecording}
          className="ec-composer-icon-btn ec-rotate-hover"
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
            <button
              type="button"
              onClick={() => (isRecording ? stopVoiceRecording(true) : void startVoiceRecording())}
              disabled={disabled || sending || pending.length >= MAX_PER_MESSAGE}
              className={isRecording ? "ec-composer-icon-btn ec-composer-icon-btn--recording" : "ec-composer-icon-btn"}
              title={isRecording ? "Завершить запись" : "Записать голосовое"}
              aria-label={isRecording ? "Завершить запись голосового" : "Записать голосовое сообщение"}
              style={iconBtn}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = isRecording ? "var(--ec-danger-soft)" : "var(--ec-surface-3)";
                e.currentTarget.style.color = isRecording ? "var(--ec-danger)" : "var(--ec-text)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.color = "var(--ec-text-muted)";
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
                <path d="M19 10v2a7 7 0 01-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
            </button>
          </>
        )}
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
            placeholder ?? (channelName ? `Передача сигнала в #${channelName}…` : "Открыт защищённый канал…")
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
          title="ПЕРЕДАТЬ (Enter)"
        >
          {sending ? (
            "…"
          ) : (
            <>
              <span className="ec-composer-send-label" style={{ letterSpacing: "0.08em" }}>ПЕРЕДАТЬ</span>
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
        <span className="ec-composer-hint--md" style={{ color: "var(--ec-border-emphasis)" }}>·</span>
        <span className="ec-composer-hint--md"><span style={kbd}>Shift+Enter</span> — новая строка</span>
        {!hideAttachments && (
          <>
            <span className="ec-composer-hint--lg" style={{ color: "var(--ec-border-emphasis)" }}>·</span>
            <span className="ec-composer-hint--lg">drop файлы</span>
          </>
        )}
        <span className="ec-composer-hint--lg" style={{ color: "var(--ec-border-emphasis)" }}>·</span>
        <span className="ec-composer-hint--lg">
          <span style={kbd}>@</span> участник · <span style={kbd}>:</span>emoji
        </span>
        {!hideSlashCommands && (
          <>
            <span style={{ color: "var(--ec-border-emphasis)" }}>·</span>
            <span>
              <span style={kbd}>/task</span> задача
            </span>
          </>
        )}
        {/* v1.1.1 E2E encryption indicator — sticks вправо. */}
        <span
          style={{
            marginLeft: "auto",
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            fontSize: "0.58rem",
            fontFamily: "var(--ec-font-mono, ui-monospace, monospace)",
            letterSpacing: "0.06em",
            color: "var(--ec-accent)",
            textTransform: "uppercase",
          }}
          title="End-to-end encryption активно"
        >
          <span
            aria-hidden
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "var(--ec-accent)",
              boxShadow: "0 0 6px var(--ec-accent)",
            }}
          />
          ШИФРОВАНИЕ
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
