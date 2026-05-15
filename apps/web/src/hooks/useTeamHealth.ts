import { useCallback, useEffect, useState } from "react";
import { apiJson, ApiError } from "../lib/api";

/**
 * useTeamHealth — server-wide aggregate ActionItem'ов для «Здоровье команды».
 *
 * Fetch при смене сервера. НЕТ live-обновлений (aggregate считается на лету
 * за один query, перерасчёт по requestу — Reload-кнопкой в UI). Это calm
 * dashboard, не real-time monitor — данные обновляются явно.
 */

export type OverloadedMember = {
  userId: string;
  displayName: string;
  avatar: string | null;
  openCount: number;
};

export type TeamHealthData = {
  serverId: string;
  generatedAt: string;
  windowDays: number;
  counts: {
    openTotal: number;
    overdueTotal: number;
    unassignedTotal: number;
    resolvedInWindow: number;
  };
  /** Среднее время разрешения в днях (с 1 dp). Null если < 3 closures за окно. */
  avgResolutionDays: number | null;
  /** Top-3 members по числу assigned-open (excludes тех у кого 0). */
  topOverloaded: OverloadedMember[];
  /** Members с >= 3 assigned-open. Subset/superset topOverloaded. */
  blockedMembers: OverloadedMember[];
};

export function useTeamHealth(serverId: string | null) {
  const [data, setData] = useState<TeamHealthData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!serverId) {
      setData(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await apiJson<TeamHealthData>(
        `/api/servers/${encodeURIComponent(serverId)}/analytics/team-health`,
      );
      setData(result);
    } catch (e) {
      setError(
        e instanceof ApiError
          ? e.message
          : "Не удалось загрузить здоровье команды",
      );
    } finally {
      setLoading(false);
    }
  }, [serverId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, loading, error, reload };
}
