import { useCallback, useEffect, useMemo, useState } from "react";
import { ApiError, apiJson } from "../lib/api";
import type { ServerRow } from "./useServers";
import type { BotActionApproval } from "./useBotApprovals";
import type { PersonalDigest, PersonalDigestItem } from "./usePersonalDigest";

export type CommandInboxApproval = BotActionApproval & {
  serverId: string;
  serverName: string;
};

export function isActionableDigestItem(
  item: PersonalDigestItem,
  currentUserId: string,
): boolean {
  if (item.kind === "ROOM_ACTIVITY" || item.kind === "APPROVAL") return true;
  if (item.kind === "INCIDENT" || item.kind === "RISK") return true;
  if (
    item.actionItemId &&
    item.actionStatus === "REVIEW" &&
    (item.assigneeUserId === null || item.assigneeUserId === currentUserId)
  ) return true;
  return Boolean(
    item.actionItemId &&
      item.actionStatus === "OPEN" &&
      item.assigneeUserId === null &&
      (item.kind === "TASK" || item.kind === "FOLLOW_UP"),
  );
}

export function useCommandInbox(
  servers: ServerRow[],
  enabled: boolean,
  digest: PersonalDigest | null,
  currentUserId: string,
  refreshDigest: () => Promise<void>,
) {
  const ownerServers = useMemo(
    () => servers.filter((server) => server.role === "OWNER"),
    [servers],
  );
  const [approvals, setApprovals] = useState<CommandInboxApproval[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [approvalBusyId, setApprovalBusyId] = useState<string | null>(null);
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const reloadApprovals = useCallback(async (quiet = false) => {
    if (!enabled || ownerServers.length === 0) {
      setApprovals([]);
      return;
    }
    if (!quiet) setLoading(true);
    setError(null);
    try {
      const settled = await Promise.allSettled(
        ownerServers.map(async (server) => {
          const data = await apiJson<{ approvals: BotActionApproval[] }>(
            `/api/servers/${encodeURIComponent(server.id)}/bot-approvals`,
          );
          return data.approvals.map((approval) => ({
            ...approval,
            serverId: server.id,
            serverName: server.name,
          }));
        }),
      );
      const available = settled.flatMap((result) =>
        result.status === "fulfilled" ? result.value : [],
      );
      setApprovals(available.sort((a, b) => a.createdAt.localeCompare(b.createdAt)));
      if (settled.some((result) => result.status === "rejected")) {
        setError("Часть очереди временно недоступна. Доступные решения уже показаны.");
      }
    } catch {
      setError("Не удалось загрузить очередь решений");
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [enabled, ownerServers]);

  useEffect(() => {
    void reloadApprovals();
    if (!enabled) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void reloadApprovals(true);
    }, 15_000);
    return () => window.clearInterval(timer);
  }, [enabled, reloadApprovals]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 4_000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const decideApproval = useCallback(async (
    approval: CommandInboxApproval,
    decision: "approve" | "reject",
  ): Promise<boolean> => {
    if (approvalBusyId) return false;
    setApprovalBusyId(approval.id);
    setError(null);
    try {
      const result = await apiJson<{ ok: boolean; error?: string }>(
        `/api/servers/${encodeURIComponent(approval.serverId)}/bot-approvals/${encodeURIComponent(approval.id)}/${decision}`,
        { method: "POST" },
      );
      if (!result.ok) {
        setError(result.error ?? "Решение не удалось сохранить");
        return false;
      }
      setApprovals((current) => current.filter((item) => item.id !== approval.id));
      setNotice(decision === "approve" ? "Изменение разрешено" : "Изменение отклонено");
      return true;
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Решение не удалось сохранить");
      await reloadApprovals(true);
      return false;
    } finally {
      setApprovalBusyId(null);
    }
  }, [approvalBusyId, reloadApprovals]);

  const claimAction = useCallback(async (actionItemId: string): Promise<boolean> => {
    if (actionBusyId) return false;
    setActionBusyId(actionItemId);
    setError(null);
    try {
      await apiJson(`/api/actions/${encodeURIComponent(actionItemId)}/claim`, {
        method: "POST",
      });
      setNotice("Задача назначена вам и переведена в работу");
      await refreshDigest();
      return true;
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 409) {
        setError("Задачу уже взял другой участник. Очередь обновлена.");
        await refreshDigest();
      } else {
        setError(cause instanceof ApiError ? cause.message : "Не удалось взять задачу");
      }
      return false;
    } finally {
      setActionBusyId(null);
    }
  }, [actionBusyId, refreshDigest]);

  const digestCount = digest?.priorityItems.filter((item) =>
    isActionableDigestItem(item, currentUserId),
  ).length ?? 0;
  const count = digestCount + (digest?.liveCalls.length ?? 0) + approvals.length;

  return {
    approvals,
    count,
    loading,
    error,
    notice,
    approvalBusyId,
    actionBusyId,
    reloadApprovals,
    approve: (approval: CommandInboxApproval) => decideApproval(approval, "approve"),
    reject: (approval: CommandInboxApproval) => decideApproval(approval, "reject"),
    claimAction,
  };
}
