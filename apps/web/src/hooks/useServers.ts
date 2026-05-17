import { useCallback, useEffect, useState } from "react";
import { ApiError, api, apiJson } from "../lib/api";
import { fileToBase64 } from "../lib/fileToBase64";

export type ServerRow = {
  id: string;
  name: string;
  icon: string | null;
  /** v0.10.1: banner image 1500×500. URL relative to BASE_URL. */
  banner: string | null;
  /** v0.10.1: HSL string "200 80% 60%" без `hsl()` wrapper. Frontend инжектит. */
  brandColor: string | null;
  /** v0.10.1: markdown описание сервера (до 1000 символов). */
  description: string | null;
  /** v0.10.1: приветственное сообщение для новых members (до 500 символов). */
  welcomeMessage: string | null;
  /**
   * v0.27: режим сервера. ENGINEERING (default) — полный operator-инструментарий
   * (Status Board / Execution-таб / slash-hints / bot badges). CLIENT — портал
   * для клиента: скрыты developer-chrome элементы, focus на approvals/files/
   * summaries. Codex-vision #3.
   */
  mode: "ENGINEERING" | "CLIENT";
  inviteCode: string;
  ownerId: string;
  createdAt: string;
  memberCount: number;
  channelCount: number;
  role: string;
};

type CreateServerInput = { name: string; icon?: string | null };

type JoinResult = {
  server: { id: string; name: string; icon: string | null; ownerId: string };
  member: { id: string; role: string };
  alreadyMember: boolean;
};

/**
 * v0.64: server-side enforced limits. backend возвращает их в /api/servers
 * чтобы UI не хардкодил константы. maxOwnedServers — сколько пространств
 * можно создать (быть OWNER); ownedCount — derived из servers list.
 */
export type ServerLimits = {
  maxOwnedServers: number;
};

const DEFAULT_LIMITS: ServerLimits = { maxOwnedServers: 2 };

/**
 * Список серверов текущего user'а + активный сервер.
 *
 * Активный сервер хранится в state, по умолчанию = первый из списка
 * (обычно Default Server). После create/join — становится активным.
 */
export function useServers(isReady: boolean) {
  const [servers, setServers] = useState<ServerRow[]>([]);
  const [activeServerId, setActiveServerId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [limits, setLimits] = useState<ServerLimits>(DEFAULT_LIMITS);

  const reload = useCallback(async () => {
    if (!isReady) {
      return;
    }
    setLoading(true);
    try {
      const data = await apiJson<{ servers: ServerRow[]; limits?: ServerLimits }>(
        "/api/servers",
      );
      setServers(data.servers);
      if (data.limits) setLimits(data.limits);
      setActiveServerId((cur) => cur ?? data.servers[0]?.id ?? null);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Не удалось загрузить серверы");
    } finally {
      setLoading(false);
    }
  }, [isReady]);

  useEffect(() => {
    void reload();
  }, [reload]);

  /**
   * Auto-join по URL `?invite=<code>`. Срабатывает после первой загрузки
   * списка серверов. Если user уже member — backend вернёт alreadyMember
   * и просто переключит активный сервер. После handling — стираем
   * `invite=` из URL чтобы reload не повторял.
   */
  useEffect(() => {
    if (!isReady || loading) return;
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const inviteCode = params.get("invite");
    if (!inviteCode) return;
    // strip ?invite= из URL до запроса, чтобы избежать loop'а
    params.delete("invite");
    const newSearch = params.toString();
    window.history.replaceState(
      {},
      "",
      `${window.location.pathname}${newSearch ? "?" + newSearch : ""}${window.location.hash}`,
    );
    void (async () => {
      setError(null);
      try {
        const data = await apiJson<JoinResult>(`/api/servers/join/${encodeURIComponent(inviteCode)}`, {
          method: "POST",
        });
        await reload();
        setActiveServerId(data.server.id);
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "Не удалось вступить по инвайт-ссылке");
      }
    })();
  }, [isReady, loading, reload]);

  const createServer = useCallback(
    async (input: CreateServerInput): Promise<ServerRow | null> => {
      setError(null);
      try {
        const data = await apiJson<{ server: ServerRow }>("/api/servers", {
          method: "POST",
          body: JSON.stringify(input),
        });
        const created = { ...data.server, memberCount: 1, channelCount: 0 };
        setServers((prev) => [...prev, created]);
        setActiveServerId(created.id);
        return created;
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "Не удалось создать сервер");
        return null;
      }
    },
    [],
  );

  const joinByInvite = useCallback(
    async (inviteCode: string): Promise<JoinResult | null> => {
      setError(null);
      try {
        const data = await apiJson<JoinResult>(`/api/servers/join/${encodeURIComponent(inviteCode)}`, {
          method: "POST",
        });
        // Перезагрузить список с актуальными counts вместо ручной мутации
        await reload();
        setActiveServerId(data.server.id);
        return data;
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "Не удалось вступить по инвайту");
        return null;
      }
    },
    [reload],
  );

  const leaveServer = useCallback(
    async (serverId: string): Promise<boolean> => {
      setError(null);
      try {
        await apiJson(`/api/servers/${encodeURIComponent(serverId)}/leave`, { method: "DELETE" });
        setServers((prev) => prev.filter((s) => s.id !== serverId));
        setActiveServerId((cur) => (cur === serverId ? null : cur));
        return true;
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "Не удалось покинуть сервер");
        return false;
      }
    },
    [],
  );

  const deleteServer = useCallback(
    async (serverId: string): Promise<boolean> => {
      setError(null);
      try {
        await apiJson(`/api/servers/${encodeURIComponent(serverId)}`, { method: "DELETE" });
        setServers((prev) => prev.filter((s) => s.id !== serverId));
        setActiveServerId((cur) => (cur === serverId ? null : cur));
        return true;
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "Не удалось удалить сервер");
        return false;
      }
    },
    [],
  );

  const uploadServerIcon = useCallback(
    async (serverId: string, file: File): Promise<boolean> => {
      setError(null);
      try {
        const isImage =
          /^image\//.test(file.type) ||
          file.type === "" ||
          file.type === "application/octet-stream";
        if (!isImage) {
          setError(`Файл ${file.type} — не изображение`);
          return false;
        }
        if (file.size > 20 * 1024 * 1024) {
          setError(
            `Файл ${(file.size / 1024 / 1024).toFixed(1)} MB слишком большой. Максимум 20 MB.`,
          );
          return false;
        }
        const dataBase64 = await fileToBase64(file);
        const contentType = file.type || "image/heic";
        const res = await apiJson<{ icon: string }>(
          `/api/servers/${encodeURIComponent(serverId)}/icon`,
          {
            method: "POST",
            body: JSON.stringify({ contentType, dataBase64 }),
          },
        );
        setServers((prev) =>
          prev.map((s) => (s.id === serverId ? { ...s, icon: res.icon } : s)),
        );
        return true;
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "Не удалось загрузить иконку");
        return false;
      }
    },
    [],
  );

  // ===== v0.10.1 Server Identity =====

  const uploadServerBanner = useCallback(
    async (serverId: string, file: File): Promise<boolean> => {
      setError(null);
      try {
        const isImage =
          /^image\//.test(file.type) ||
          file.type === "" ||
          file.type === "application/octet-stream";
        if (!isImage) {
          setError(`Файл ${file.type} — не изображение`);
          return false;
        }
        if (file.size > 25 * 1024 * 1024) {
          setError(
            `Файл ${(file.size / 1024 / 1024).toFixed(1)} MB слишком большой. Максимум 25 MB.`,
          );
          return false;
        }
        const dataBase64 = await fileToBase64(file);
        const contentType = file.type || "image/heic";
        const res = await apiJson<{ banner: string }>(
          `/api/servers/${encodeURIComponent(serverId)}/banner`,
          {
            method: "POST",
            body: JSON.stringify({ contentType, dataBase64 }),
          },
        );
        setServers((prev) =>
          prev.map((s) => (s.id === serverId ? { ...s, banner: res.banner } : s)),
        );
        return true;
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "Не удалось загрузить баннер");
        return false;
      }
    },
    [],
  );

  const deleteServerBanner = useCallback(async (serverId: string): Promise<boolean> => {
    setError(null);
    try {
      const res = await api(`/api/servers/${encodeURIComponent(serverId)}/banner`, {
        method: "DELETE",
      });
      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try {
          const body = (await res.json()) as { error?: string };
          if (body?.error) msg = body.error;
        } catch {
          /* */
        }
        setError(msg);
        return false;
      }
      setServers((prev) =>
        prev.map((s) => (s.id === serverId ? { ...s, banner: null } : s)),
      );
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось удалить баннер");
      return false;
    }
  }, []);

  const updateServerIdentity = useCallback(
    async (
      serverId: string,
      patch: {
        name?: string;
        brandColor?: string | null;
        description?: string | null;
        welcomeMessage?: string | null;
        mode?: "ENGINEERING" | "CLIENT";
      },
    ): Promise<boolean> => {
      setError(null);
      try {
        const res = await apiJson<{
          identity: {
            name: string;
            brandColor: string | null;
            description: string | null;
            welcomeMessage: string | null;
            mode: "ENGINEERING" | "CLIENT";
          };
        }>(`/api/servers/${encodeURIComponent(serverId)}/identity`, {
          method: "PATCH",
          body: JSON.stringify(patch),
        });
        setServers((prev) =>
          prev.map((s) =>
            s.id === serverId
              ? {
                  ...s,
                  name: res.identity.name,
                  brandColor: res.identity.brandColor,
                  description: res.identity.description,
                  welcomeMessage: res.identity.welcomeMessage,
                  mode: res.identity.mode,
                }
              : s,
          ),
        );
        return true;
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "Не удалось сохранить оформление");
        return false;
      }
    },
    [],
  );

  const deleteServerIcon = useCallback(async (serverId: string): Promise<boolean> => {
    setError(null);
    try {
      const res = await api(`/api/servers/${encodeURIComponent(serverId)}/icon`, {
        method: "DELETE",
      });
      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try {
          const body = (await res.json()) as { error?: string };
          if (body?.error) msg = body.error;
        } catch {
          /* */
        }
        setError(msg);
        return false;
      }
      setServers((prev) => prev.map((s) => (s.id === serverId ? { ...s, icon: null } : s)));
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось удалить иконку");
      return false;
    }
  }, []);

  const activeServer = servers.find((s) => s.id === activeServerId) ?? null;
  const ownedCount = servers.filter((s) => s.role === "OWNER").length;
  const canCreateServer = ownedCount < limits.maxOwnedServers;

  return {
    servers,
    activeServer,
    activeServerId,
    setActiveServerId,
    error,
    loading,
    reload,
    createServer,
    joinByInvite,
    leaveServer,
    deleteServer,
    uploadServerIcon,
    deleteServerIcon,
    uploadServerBanner,
    deleteServerBanner,
    updateServerIdentity,
    /** v0.64: server-enforced limits (max OWNER memberships per account). */
    limits,
    ownedCount,
    canCreateServer,
  };
}
