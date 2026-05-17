import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { Modal } from "./Modal";
import { apiJson, ApiError } from "../lib/api";

/**
 * VoiceMusicPicker (v0.72) — список audio-треков сервера для
 * запуска синхронного прослушивания в VOICE-канале.
 *
 * GET /api/servers/:id/audio-tracks → user выбирает item → onPick(attId)
 * вызывает music.start() из useChannelMusic. Сессия привязана к текущему
 * channelId (caller передаёт правильный из контекста VOICE-комнаты).
 */

export type AudioTrack = {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  url: string;
  createdAt: string;
  channelId: string;
  channelName: string;
};

type Props = {
  serverId: string;
  onClose: () => void;
  onPick: (attachmentId: string) => Promise<boolean> | boolean;
};

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const rowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "32px 1fr auto",
  alignItems: "center",
  gap: "var(--ec-space-3)",
  padding: "0.6rem 0.7rem",
  borderRadius: "var(--ec-radius-md)",
  background: "var(--ec-surface-2)",
  border: "1px solid var(--ec-border-subtle)",
  cursor: "pointer",
  textAlign: "left",
  width: "100%",
  transition: "background var(--ec-dur-fast) var(--ec-ease)",
};

export function VoiceMusicPicker({ serverId, onClose, onPick }: Props) {
  const [tracks, setTracks] = useState<AudioTrack[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const data = await apiJson<{ tracks: AudioTrack[] }>(
          `/api/servers/${encodeURIComponent(serverId)}/audio-tracks`,
        );
        setTracks(data.tracks);
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "Не удалось загрузить треки");
      }
    })();
  }, [serverId]);

  return (
    <Modal title="Запустить музыку в комнате" onClose={onClose} width={520}>
      <p style={{ margin: 0, color: "var(--ec-text-muted)", fontSize: "var(--ec-text-sm)" }}>
        Выберите трек из любого текст-канала пространства — всех в этой
        голосовой комнате включит синхронно.
      </p>
      {error && (
        <p style={{ margin: 0, color: "var(--ec-danger)", fontSize: "var(--ec-text-sm)" }}>
          {error}
        </p>
      )}
      {!tracks && !error && (
        <p style={{ color: "var(--ec-text-dim)", fontSize: "var(--ec-text-sm)" }}>
          Загружаем…
        </p>
      )}
      {tracks && tracks.length === 0 && (
        <p style={{ color: "var(--ec-text-dim)", fontSize: "var(--ec-text-sm)" }}>
          В этом пространстве пока нет аудио. Прикрепите файл в любой
          текст-канал — и он появится здесь.
        </p>
      )}
      {tracks && tracks.length > 0 && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--ec-space-2)",
            maxHeight: "60vh",
            overflow: "auto",
          }}
        >
          {tracks.map((t) => (
            <button
              key={t.id}
              type="button"
              style={rowStyle}
              disabled={busy}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "var(--ec-surface-3)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "var(--ec-surface-2)")
              }
              onClick={async () => {
                setBusy(true);
                const ok = await onPick(t.id);
                setBusy(false);
                if (ok) onClose();
              }}
            >
              <span
                aria-hidden
                style={{
                  width: 32,
                  height: 32,
                  display: "grid",
                  placeItems: "center",
                  borderRadius: "var(--ec-radius-full)",
                  background: "var(--ec-accent-soft)",
                  color: "var(--ec-accent)",
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M8 5v14l11-7z" />
                </svg>
              </span>
              <span style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                <span
                  style={{
                    fontSize: "var(--ec-text-sm)",
                    color: "var(--ec-text)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {t.filename}
                </span>
                <span
                  style={{
                    fontSize: "var(--ec-text-2xs)",
                    color: "var(--ec-text-dim)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  #{t.channelName} · {humanSize(t.size)}
                </span>
              </span>
              <span style={{ fontSize: "var(--ec-text-2xs)", color: "var(--ec-text-dim)" }}>
                {new Date(t.createdAt).toLocaleDateString("ru-RU", {
                  day: "numeric",
                  month: "short",
                })}
              </span>
            </button>
          ))}
        </div>
      )}
    </Modal>
  );
}
