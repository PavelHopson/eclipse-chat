import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
import { ComposerEmojiPicker } from "./ComposerEmojiPicker";

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

/**
 * Backend slash-commands из v1.2.14 (`apps/server/src/lib/slashCommands.ts`).
 * Frontend их не парсит — отправляет как обычный текст, backend transform'ит
 * (для `/me /shrug /tableflip /unflip`) или возвращает ephemeral (для `/help`).
 * Здесь только для autocomplete listing в slash-hint strip. `noArg=true` →
 * на выбор не добавляем trailing space (можно сразу Enter'ом отправить).
 */
const BACKEND_COMMANDS: {
  cmd: string;
  label: string;
  desc: string;
  noArg?: boolean;
}[] = [
  { cmd: "me", label: "/me", desc: "IRC-стиль: «имя <действие>»" },
  { cmd: "shrug", label: "/shrug", desc: "добавить ¯\\_(ツ)_/¯", noArg: true },
  { cmd: "tableflip", label: "/tableflip", desc: "(╯°□°)╯︵ ┻━┻", noArg: true },
  { cmd: "unflip", label: "/unflip", desc: "┬─┬ノ( º_ºノ)", noArg: true },
  { cmd: "help", label: "/help", desc: "список команд (видно только тебе)", noArg: true },
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
  /** v1.2.23 — custom-emoji map активного сервера. Расширяет `:` autocomplete. */
  customEmojis?: Record<string, string>;
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
  /**
   * v1.5.32 — pre-fill content из Web Share Target API. Когда non-null И
   * текущий draft пустой → заменяем draft на prefillContent + вызываем
   * `onPrefillConsumed` чтобы caller мог сбросить share state. Если draft
   * не пустой — НЕ переписываем (защита user's work).
   */
  prefillContent?: string | null;
  /**
   * Колбэк после успешного prefill — caller вызывает useShareTarget.consume().
   */
  onPrefillConsumed?: () => void;
  /**
   * v1.5.37 — pre-attach files из Web Share Target Level 2 (POST/files).
   * Когда non-null + non-empty → автоматически добавляются как pending
   * attachments через тот же addFiles путь что и file picker / drop. После
   * успешного attach вызывается `onPrefillFilesConsumed`.
   */
  prefillFiles?: File[] | null;
  onPrefillFilesConsumed?: () => void;
};

// v1.1.92 slice 3: inline-style консоли композера вынесены в классы
// .ec-composer* / .ec-slash-hint* / .ec-kbd (components.css).
// JS-hover убран — состояния через CSS.

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
  customEmojis,
  hideAttachments = false,
  placeholder,
  draftKey = null,
  hideSlashCommands = false,
  prefillContent = null,
  onPrefillConsumed,
  prefillFiles = null,
  onPrefillFilesConsumed,
}: Props) {
  const [draft, setDraft] = useState(() => loadDraft(draftKey));
  const [sending, setSending] = useState(false);
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
  // Emoji picker popover (открывается кнопкой в композере).
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [emojiAnchor, setEmojiAnchor] = useState<DOMRect | null>(null);
  const emojiButtonRef = useRef<HTMLButtonElement>(null);

  const insertEmoji = (emoji: string) => {
    const el = textareaRef.current;
    if (!el) {
      setDraftValue(draft + emoji);
      return;
    }
    const caret = el.selectionStart ?? draft.length;
    const before = draft.slice(0, caret);
    const after = draft.slice(caret);
    setDraftValue(before + emoji + after);
    queueMicrotask(() => {
      el.focus();
      const next = before.length + emoji.length;
      el.setSelectionRange(next, next);
    });
  };

  const toggleEmojiPicker = () => {
    if (emojiOpen) {
      setEmojiOpen(false);
      return;
    }
    if (emojiButtonRef.current) {
      setEmojiAnchor(emojiButtonRef.current.getBoundingClientRect());
    }
    setEmojiOpen(true);
  };

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

  // v1.5.37 — Web Share Target prefill files (Level 2 POST). Когда от
  // useShareTarget пришли files (image/video/audio/pdf/txt из share intent),
  // добавляем их через тот же addFiles путь что file picker/drop — это
  // даёт unified валидацию (MIME / size limit) + previews. Reuse не означает
  // overwrite: addFiles прибавляется к pending.
  useEffect(() => {
    if (!prefillFiles || prefillFiles.length === 0) return;
    if (hideAttachments) {
      // Composer без attachments — share files игнорируем, но consume чтобы
      // не зависнуть на каждом re-render.
      onPrefillFilesConsumed?.();
      return;
    }
    addFiles(prefillFiles);
    onPrefillFilesConsumed?.();
    // addFiles стабилен (defined в component), hideAttachments-prop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillFiles]);

  // v1.5.32 — Web Share Target prefill. Когда от useShareTarget пришло
  // content (user share'нул из system menu) И composer пустой — заполняем
  // draft + consume. Не переписываем существующий draft (защита user's work).
  useEffect(() => {
    if (!prefillContent) return;
    if (draftRef.current.trim().length > 0) {
      // Уже есть текст — пропускаем prefill, но всё равно consume чтобы
      // повторно не триггерить на каждом re-render.
      onPrefillConsumed?.();
      return;
    }
    setDraftValue(prefillContent);
    onPrefillConsumed?.();
    // Фокус композера для немедленного редактирования.
    queueMicrotask(() => {
      textareaRef.current?.focus();
      const el = textareaRef.current;
      if (el) el.setSelectionRange(el.value.length, el.value.length);
    });
  // setDraftValue/textareaRef стабильны — depending только от prefillContent.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillContent]);

  useEffect(() => {
    return () => saveDraft(draftKeyRef.current, draftRef.current);
  }, []);

  // v1.5.4 — слушаем глобальный «ec-ai-trigger» (topbar AI agent button).
  // Фокусим textarea + если пусто — префиксим «@ai » для quick start.
  useEffect(() => {
    const handler = () => {
      const el = textareaRef.current;
      if (!el || el.disabled) return;
      const empty = el.value.trim().length === 0;
      if (empty) {
        setDraftValue("@ai ");
        queueMicrotask(() => {
          el.focus();
          el.setSelectionRange(el.value.length, el.value.length);
        });
      } else {
        el.focus();
      }
    };
    window.addEventListener("ec-ai-trigger", handler);
    return () => window.removeEventListener("ec-ai-trigger", handler);
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
  // Grid-колонки композера зависят от hideAttachments — единственное
  // динамическое значение; фокус-состояние коробки — CSS :focus-within.
  const boxGridColumns = hideAttachments
    ? "auto minmax(0, 1fr) auto"
    : "auto auto auto minmax(0, 1fr) auto";

  // Slash-command hint: показываем когда юзер набрал «/» + (опц.) часть
  // команды, но ещё не дошёл до пробела. @/:-popover имеет приоритет.
  // В Client Mode operator-команды скрыты (hideSlashCommands), но
  // backend-команды (/me /shrug ...) остаются — они работают везде.
  const slashQuery = /^\s*\/([a-zA-Zа-яёА-ЯЁ]*)$/.exec(draft);
  const slashPrefix = slashQuery?.[1].toLowerCase() ?? "";
  const operatorMatches =
    slashQuery && !trigger && !hideSlashCommands
      ? SLASH_COMMANDS.filter((c) => c.cmd.startsWith(slashPrefix))
      : [];
  const backendMatches =
    slashQuery && !trigger
      ? BACKEND_COMMANDS.filter((c) => c.cmd.startsWith(slashPrefix))
      : [];
  const hasSlashMatches = operatorMatches.length + backendMatches.length > 0;

  // Drag-drop поддержка — composer-level (узкий drop на сам composer).
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

  // v1.5.15 — window-level drag detection: full-screen overlay portal,
  // когда файл тащится над любой частью окна (не только composer'а).
  // Drop в overlay → addFiles в pending attachments composer'а.
  const [windowDragOver, setWindowDragOver] = useState(false);
  useEffect(() => {
    if (disabled || hideAttachments) return;
    // dataTransfer.types contains 'Files' для real file drag — это
    // отличие от text/html drag (внутри-страничный drag), который
    // overlay показывать не нужно.
    const isFileDrag = (e: DragEvent) => {
      const types = e.dataTransfer?.types;
      if (!types) return false;
      for (let i = 0; i < types.length; i++) {
        if (types[i] === "Files") return true;
      }
      return false;
    };
    // Counter-based detection — dragenter/leave fires per inner element
    // (известный browser bug); считаем nesting depth.
    let dragCounter = 0;
    const onWinDragEnter = (e: DragEvent) => {
      if (!isFileDrag(e)) return;
      dragCounter++;
      if (dragCounter === 1) setWindowDragOver(true);
    };
    const onWinDragLeave = (e: DragEvent) => {
      if (!isFileDrag(e)) return;
      dragCounter = Math.max(0, dragCounter - 1);
      if (dragCounter === 0) setWindowDragOver(false);
    };
    const onWinDragOver = (e: DragEvent) => {
      // preventDefault на dragover — иначе drop event не сработает
      // (default browser action — open file).
      if (isFileDrag(e)) e.preventDefault();
    };
    const onWinDrop = (e: DragEvent) => {
      if (!isFileDrag(e)) return;
      e.preventDefault();
      dragCounter = 0;
      setWindowDragOver(false);
      const files = e.dataTransfer?.files;
      if (files && files.length > 0) addFiles(files);
    };
    window.addEventListener("dragenter", onWinDragEnter);
    window.addEventListener("dragleave", onWinDragLeave);
    window.addEventListener("dragover", onWinDragOver);
    window.addEventListener("drop", onWinDrop);
    return () => {
      window.removeEventListener("dragenter", onWinDragEnter);
      window.removeEventListener("dragleave", onWinDragLeave);
      window.removeEventListener("dragover", onWinDragOver);
      window.removeEventListener("drop", onWinDrop);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled, hideAttachments]);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={"ec-composer ec-composer-safe" + (dragOver ? " is-drag" : "")}
    >
      {/* v1.5.15 — full-screen dropzone overlay (portal). Виден когда
          файл тащится над окном; drop → addFiles в pending. Composer
          drag handlers тоже работают (узкий drop на самом composer'е). */}
      {windowDragOver &&
        createPortal(
          <div className="ec-drag-overlay" aria-hidden>
            <div className="ec-drag-overlay__card">
              <div className="ec-drag-overlay__icon">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
              </div>
              <h3 className="ec-drag-overlay__title">Бросьте файлы</h3>
              <p className="ec-drag-overlay__hint">
                Любое количество — будут вложены к следующему сообщению
              </p>
            </div>
          </div>,
          document.body,
        )}
      {pending.length > 0 && (
        <div className="ec-composer-previews">
          {pending.map((p) => (
            <div key={p.id} className="ec-composer-preview ec-anim-fade">
              {p.previewUrl ? (
                <img src={p.previewUrl} alt="" className="ec-composer-preview__thumb" />
              ) : (
                <span className="ec-composer-preview__file" aria-hidden>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                </span>
              )}
              <span className="ec-composer-preview__name" title={p.file.name}>
                {p.file.name}
              </span>
              <span className="ec-composer-preview__size">
                {humanSize(p.file.size)}
              </span>
              <button
                type="button"
                onClick={() => removePending(p.id)}
                aria-label="Убрать"
                title="Убрать"
                className="ec-composer-preview__remove"
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
      {hasSlashMatches && (
        <div className="ec-slash-hint">
          {operatorMatches.map((c) => (
            <button
              key={`op-${c.cmd}`}
              type="button"
              className="ec-slash-hint__item"
              onMouseDown={(e) => {
                // mousedown (не click) — чтобы успеть до blur textarea
                e.preventDefault();
                setDraftValue(`/${c.cmd} `);
                queueMicrotask(() => textareaRef.current?.focus());
              }}
            >
              <strong className="ec-slash-hint__cmd">{c.label}</strong>
              <span className="ec-slash-hint__desc">{c.desc}</span>
            </button>
          ))}
          {backendMatches.map((c) => (
            <button
              key={`bk-${c.cmd}`}
              type="button"
              className="ec-slash-hint__item"
              onMouseDown={(e) => {
                e.preventDefault();
                // noArg → без trailing space, можно сразу Enter.
                setDraftValue(c.noArg ? `/${c.cmd}` : `/${c.cmd} `);
                queueMicrotask(() => textareaRef.current?.focus());
              }}
            >
              <strong className="ec-slash-hint__cmd">{c.label}</strong>
              <span className="ec-slash-hint__desc">{c.desc}</span>
            </button>
          ))}
        </div>
      )}
      {/* Clean redesign: декоративный operator-strip («>_ Защищённый канал» +
          фейковое «в эфире» + scan-dots) убран — sci-fi-театр + ложный
          security-claim. Композер ниже самодостаточен. */}
      <div className="ec-composer-box" style={{ gridTemplateColumns: boxGridColumns }}>
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
        <button
          ref={emojiButtonRef}
          type="button"
          onClick={toggleEmojiPicker}
          disabled={disabled || isRecording}
          className="ec-composer-icon-btn"
          title="Эмодзи"
          aria-label="Выбрать эмодзи"
          aria-expanded={emojiOpen}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <circle cx="12" cy="12" r="10" />
            <path d="M8 14s1.5 2 4 2 4-2 4-2" />
            <line x1="9" y1="9" x2="9.01" y2="9" />
            <line x1="15" y1="9" x2="15.01" y2="9" />
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
          onBlur={() => {
            // Dismiss popover с задержкой — чтобы успел сработать onClick по item
            setTimeout(() => setTrigger(null), 120);
          }}
          placeholder={
            placeholder ?? (channelName ? `Сообщение в #${channelName}…` : "Канал открыт…")
          }
          disabled={disabled}
          className="ec-composer-textarea"
        />
        <button
          type="submit"
          disabled={!canSend}
          className="ec-composer-send"
          style={{ opacity: canSend ? 1 : 0.4, cursor: canSend ? "pointer" : "default" }}
          title="Отправить (Enter)"
        >
          {sending ? (
            "…"
          ) : (
            <>
              <span className="ec-composer-send-label" style={{ letterSpacing: "0.06em" }}>Отправить</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </>
          )}
        </button>
      </div>
      <div className="ec-composer-hints">
        <span><span className="ec-kbd">Enter</span> — отправить</span>
        <span className="ec-composer-hint--md ec-composer-hints__sep">·</span>
        <span className="ec-composer-hint--md"><span className="ec-kbd">Shift+Enter</span> — новая строка</span>
        {!hideAttachments && (
          <>
            <span className="ec-composer-hint--lg ec-composer-hints__sep">·</span>
            <span className="ec-composer-hint--lg">drop файлы</span>
          </>
        )}
        <span className="ec-composer-hint--lg" style={{ color: "var(--ec-border-emphasis)" }}>·</span>
        <span className="ec-composer-hint--lg">
          <span className="ec-kbd">@</span> участник · <span className="ec-kbd">:</span>emoji
        </span>
        {!hideSlashCommands && (
          <>
            <span className="ec-composer-hints__sep">·</span>
            <span>
              <span className="ec-kbd">/task</span> задача
            </span>
          </>
        )}
        {/* v1.1.90 TLS-транспорт индикатор — честная метка транспорта
            (HTTPS/WSS), НЕ сквозное (E2E) шифрование. */}
        <span
          className="ec-composer-tls"
          title="Соединение защищено TLS — сквозного (E2E) шифрования нет"
        >
          <span className="ec-composer-tls__dot" aria-hidden />
          TLS
        </span>
      </div>
      {trigger && (
        <AutocompletePopover
          trigger={trigger}
          members={mentionNames}
          customEmojis={customEmojis}
          anchorRect={anchorRect}
          onSelect={applyAutocomplete}
          onDismiss={() => setTrigger(null)}
        />
      )}
      {emojiOpen && (
        <ComposerEmojiPicker
          onPick={insertEmoji}
          onClose={() => setEmojiOpen(false)}
          anchorRect={emojiAnchor}
        />
      )}
    </form>
  );
}
