import { useCallback, useEffect, useState } from "react";
import { apiJson } from "../lib/api";

/**
 * v1.5.14 — useServerAudioLibrary: загружает все audio attachments
 * сервера (для music playlist в shared room). Backend endpoint
 * `GET /api/servers/:id/audio-library` (member-only, limit 200,
 * sorted by createdAt desc).
 *
 * Хук кеширует список в state; refetch при serverId change. Реактивности
 * по новым upload'ам нет (новые треки появятся после reload или
 * следующей навигации) — для voice-room playlist это OK, не критично.
 */

export type ServerAudioTrack = {
  id: string;
  filename: string;
  mimeType: string;
  url: string;
  thumbnailUrl: string | null;
  size: number;
  waveformPeaks: number[] | null;
  createdAt: string;
  channel: { id: string; name: string };
  uploader: { id: string; displayName: string; avatar: string | null };
};

type LibraryResponse = { tracks: ServerAudioTrack[] };

export function useServerAudioLibrary(serverId: string | null) {
  const [tracks, setTracks] = useState<ServerAudioTrack[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!serverId) {
      setTracks([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await apiJson<LibraryResponse>(
        `/api/servers/${encodeURIComponent(serverId)}/audio-library`,
      );
      setTracks(data.tracks);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось загрузить аудиотеку");
    } finally {
      setLoading(false);
    }
  }, [serverId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { tracks, loading, error, reload };
}
