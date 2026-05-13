import { useCallback, useEffect, useState } from "react";
import { ApiError, apiJson, api } from "../lib/api";

/**
 * Bot row из GET /api/servers/:id/bots.
 * `apiKey` НЕ отдаётся бэком — только при create/regenerate (один раз).
 */
export type BotRow = {
  id: string;
  name: string;
  avatar: string | null;
  description: string | null;
  owner: { id: string; displayName: string };
  shadowUserId: string;
  /** Префикс API key для display ("ecb_AbCd…"). Не secret. */
  apiKeyPrefix: string;
  capabilities: string[];
  /** Outbound webhook URL для message.created events. Null = нет webhook. */
  webhookUrl: string | null;
  /** True если webhookSecret set (для display «secret configured» badge). */
  webhookSecretSet: boolean;
  /** Subscribed events: ["message.created"]. */
  webhookEvents: string[];
  createdAt: string;
  lastUsedAt: string | null;
};

/**
 * Plaintext API key возвращается ОДИН РАЗ — после create / regenerate.
 * Backend хранит только bcrypt hash.
 */
export type BotKeyReveal = {
  botId: string;
  apiKey: string;
};

type CreateBotInput = {
  name: string;
  description?: string | null;
};

/**
 * Управление ботами сервера. OWNER-only действия (create/regenerate/delete) —
 * бэкенд вернёт 403 для non-OWNER, frontend gates UI на уровне ServerSettingsModal.
 *
 * State pattern:
 *   - `bots`: список (refetch при reload или после мутации).
 *   - `revealed`: последний открытый plaintext API key (для one-time UI).
 *     Чистится через `dismissRevealedKey()` когда юзер закрыл модалку.
 */
export function useBots(serverId: string | null) {
  const [bots, setBots] = useState<BotRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<BotKeyReveal | null>(null);

  const reload = useCallback(async () => {
    if (!serverId) {
      setBots([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await apiJson<{ bots: BotRow[] }>(
        `/api/servers/${encodeURIComponent(serverId)}/bots`,
      );
      setBots(data.bots);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Не удалось загрузить ботов");
    } finally {
      setLoading(false);
    }
  }, [serverId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const createBot = useCallback(
    async (input: CreateBotInput): Promise<BotKeyReveal | null> => {
      if (!serverId) return null;
      setError(null);
      try {
        const data = await apiJson<{
          bot: {
            id: string;
            name: string;
            shadowUserId: string;
            apiKeyPrefix: string;
            createdAt: string;
          };
          apiKey: string;
        }>(`/api/servers/${encodeURIComponent(serverId)}/bots`, {
          method: "POST",
          body: JSON.stringify({
            name: input.name.trim(),
            description: input.description?.trim() || null,
          }),
        });
        await reload();
        const reveal: BotKeyReveal = { botId: data.bot.id, apiKey: data.apiKey };
        setRevealed(reveal);
        return reveal;
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "Не удалось создать бота");
        return null;
      }
    },
    [serverId, reload],
  );

  const regenerateKey = useCallback(
    async (botId: string): Promise<BotKeyReveal | null> => {
      if (!serverId) return null;
      setError(null);
      try {
        const data = await apiJson<{
          ok: boolean;
          apiKeyPrefix: string;
          apiKey: string;
        }>(
          `/api/servers/${encodeURIComponent(serverId)}/bots/${encodeURIComponent(botId)}/regenerate`,
          { method: "POST" },
        );
        await reload();
        const reveal: BotKeyReveal = { botId, apiKey: data.apiKey };
        setRevealed(reveal);
        return reveal;
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "Не удалось перегенерировать ключ");
        return null;
      }
    },
    [serverId, reload],
  );

  const updateBot = useCallback(
    async (
      botId: string,
      patch: {
        name?: string;
        description?: string | null;
        webhookUrl?: string | null;
        webhookSecret?: string | null;
      },
    ): Promise<boolean> => {
      if (!serverId) return false;
      setError(null);
      try {
        await apiJson(
          `/api/servers/${encodeURIComponent(serverId)}/bots/${encodeURIComponent(botId)}`,
          {
            method: "PATCH",
            body: JSON.stringify(patch),
          },
        );
        await reload();
        return true;
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "Не удалось обновить бота");
        return false;
      }
    },
    [serverId, reload],
  );

  const deleteBot = useCallback(
    async (botId: string): Promise<boolean> => {
      if (!serverId) return false;
      setError(null);
      try {
        const res = await api(
          `/api/servers/${encodeURIComponent(serverId)}/bots/${encodeURIComponent(botId)}`,
          { method: "DELETE" },
        );
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
        setBots((prev) => prev.filter((b) => b.id !== botId));
        return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Не удалось удалить бота");
        return false;
      }
    },
    [serverId],
  );

  const dismissRevealedKey = useCallback(() => {
    setRevealed(null);
  }, []);

  return {
    bots,
    loading,
    error,
    revealed,
    reload,
    createBot,
    updateBot,
    regenerateKey,
    deleteBot,
    dismissRevealedKey,
  };
}
