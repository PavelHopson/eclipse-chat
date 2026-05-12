import { useEffect, useState } from "react";
import { apiJson } from "../lib/api";

type Health = { enabled: boolean; wsUrl: string | null };

/**
 * Singleton-style check `/api/voice/health` при mount.
 *
 * Возвращает enabled=true только если LiveKit env настроен на backend
 * (LIVEKIT_API_KEY / SECRET / WS_URL заданы). Frontend использует для
 * conditional rendering VoiceRoom vs VoicePlaceholder.
 *
 * Кешируется в module-level — один запрос на app lifetime.
 */
let cached: Health | null = null;
let pending: Promise<Health> | null = null;

async function fetchHealth(): Promise<Health> {
  if (cached) return cached;
  if (pending) return pending;
  pending = apiJson<Health>("/api/voice/health")
    .then((h) => {
      cached = h;
      return h;
    })
    .catch(() => {
      // Если route не существует (старая prod-версия) — graceful false
      cached = { enabled: false, wsUrl: null };
      return cached;
    })
    .finally(() => {
      pending = null;
    });
  return pending;
}

export function useVoiceHealth(): Health {
  const [health, setHealth] = useState<Health>(cached ?? { enabled: false, wsUrl: null });
  useEffect(() => {
    if (cached) {
      setHealth(cached);
      return;
    }
    let cancelled = false;
    void fetchHealth().then((h) => {
      if (!cancelled) setHealth(h);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return health;
}
