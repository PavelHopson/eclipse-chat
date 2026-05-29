import { useCallback, useEffect, useState } from "react";
import { ApiError, api, apiJson } from "../lib/api";

export type AuthSessionDto = {
  id: string;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: string;
  lastSeenAt: string | null;
  expiresAt: string;
};

type SessionsResponse = {
  sessions: AuthSessionDto[];
};

export function useSessions(enabled: boolean) {
  const [sessions, setSessions] = useState<AuthSessionDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiJson<SessionsResponse>("/api/auth/sessions");
      setSessions(data.sessions);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Не удалось загрузить сессии");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (enabled) {
      void reload();
    }
  }, [enabled, reload]);

  const revoke = useCallback(
    async (sessionId: string): Promise<boolean> => {
      const previous = sessions;
      setSessions((current) => current.filter((session) => session.id !== sessionId));
      setError(null);
      try {
        const res = await api(`/api/auth/sessions/${encodeURIComponent(sessionId)}`, {
          method: "DELETE",
        });
        if (!res.ok) {
          throw new ApiError(`HTTP ${res.status}`, res.status, null);
        }
        try {
          await reload();
        } catch {
          /* reload сам выставит error; optimistic remove оставляем как правду DELETE */
        }
        return true;
      } catch (e) {
        setSessions(previous);
        setError(e instanceof ApiError ? e.message : "Не удалось завершить сессию");
        return false;
      }
    },
    [reload, sessions],
  );

  return { sessions, loading, error, reload, revoke };
}
