import { useCallback, useEffect, useState } from "react";
import { ApiError, apiJson } from "../lib/api";

export type BotActionApproval = {
  id: string;
  botId: string;
  botName: string;
  sourceChannelId: string | null;
  sourceChannelName: string | null;
  tool: "update_table_row";
  status: "PENDING";
  preview: {
    kind: "update_table_row";
    tableName: string;
    rowId: string;
    updates: Array<{ fieldName: string; value: string }>;
    totalUpdates: number;
  };
  createdAt: string;
  expiresAt: string;
};

export function useBotApprovals(serverId: string | null, enabled: boolean) {
  const [approvals, setApprovals] = useState<BotActionApproval[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const reload = useCallback(async (quiet = false) => {
    if (!serverId || !enabled) {
      setApprovals([]);
      return;
    }
    if (!quiet) setLoading(true);
    setError(null);
    try {
      const data = await apiJson<{ approvals: BotActionApproval[] }>(
        `/api/servers/${encodeURIComponent(serverId)}/bot-approvals`,
      );
      setApprovals(data.approvals);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Не удалось загрузить очередь решений");
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [enabled, serverId]);

  useEffect(() => {
    void reload();
    if (!enabled || !serverId) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void reload(true);
    }, 15_000);
    return () => window.clearInterval(timer);
  }, [enabled, reload, serverId]);

  const decide = useCallback(async (
    approvalId: string,
    decision: "approve" | "reject",
  ): Promise<boolean> => {
    if (!serverId || !enabled || busyId) return false;
    setBusyId(approvalId);
    setError(null);
    try {
      const result = await apiJson<{ ok: boolean; error?: string }>(
        `/api/servers/${encodeURIComponent(serverId)}/bot-approvals/${encodeURIComponent(approvalId)}/${decision}`,
        { method: "POST" },
      );
      if (!result.ok) {
        setError(result.error ?? "Действие не удалось выполнить");
      }
      await reload(true);
      return result.ok;
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Не удалось обработать решение");
      await reload(true);
      return false;
    } finally {
      setBusyId(null);
    }
  }, [busyId, enabled, reload, serverId]);

  return {
    approvals,
    loading,
    error,
    busyId,
    reload,
    approve: (approvalId: string) => decide(approvalId, "approve"),
    reject: (approvalId: string) => decide(approvalId, "reject"),
  };
}
