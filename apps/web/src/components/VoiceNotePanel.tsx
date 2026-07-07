import type { Socket } from "socket.io-client";
import { useVoiceNote } from "../hooks/useVoiceNote";

type Props = {
  channelId: string;
  socket: Socket | null;
};

function statusLabel(s: ReturnType<typeof useVoiceNote>["status"]): string {
  switch (s.kind) {
    case "idle":
      return "";
    case "loading":
      return "загружаю...";
    case "saving":
      return "сохраняю...";
    case "saved":
      return "сохранено";
    case "conflict":
      return "конфликт: обновлено с другого устройства";
    case "error":
      return s.message;
  }
}

export function VoiceNotePanel({ channelId, socket }: Props) {
  const { note, draft, status, setContent } = useVoiceNote(channelId, socket);

  return (
    <div className="ec-voice-note">
      <div className="ec-voice-note__header">
        <div className="ec-voice-note__title">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <path d="M14 2v6h6" />
            <path d="M9 13h6" />
            <path d="M9 17h6" />
          </svg>
          Рабочая заметка
        </div>
        <span className="ec-voice-note__meta">
          {note?.lastEditor
            ? `обновил: ${note.lastEditor.displayName}`
            : note
              ? "пусто"
              : ""}
          {status.kind !== "idle" && (
            <>
              {" / "}
              <span
                className={
                  status.kind === "error" || status.kind === "conflict"
                    ? "ec-voice-note__status ec-voice-note__status--warn"
                    : status.kind === "saved"
                      ? "ec-voice-note__status ec-voice-note__status--saved"
                      : "ec-voice-note__status"
                }
              >
                {statusLabel(status)}
              </span>
            </>
          )}
        </span>
      </div>
      {status.kind === "conflict" && (
        <div className="ec-voice-note__conflict">
          Кто-то другой сохранил заметку одновременно с тобой. Сейчас действует
          правило последнего сохранения. Перечитай содержимое и продолжай.
        </div>
      )}
      <textarea
        className="ec-voice-note__textarea"
        value={draft}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Решения, ссылки, вопросы, action items. Видно участникам комнаты."
        spellCheck={false}
        autoCorrect="off"
        autoCapitalize="off"
      />
    </div>
  );
}
