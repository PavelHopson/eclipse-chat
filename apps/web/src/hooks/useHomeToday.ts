import { useCallback, useEffect, useState } from "react";
import { apiJson, ApiError } from "../lib/api";

/**
 * useHomeToday — операционная сводка «TODAY» поверх всех workspace'ов
 * пользователя. Тянет `GET /api/home/today` при открытии Home-экрана.
 */

export type HomeTask = {
  id: string;
  title: string;
  type: "TASK" | "DECISION" | "FOLLOW_UP";
  dueAt: string | null;
  overdue: boolean;
  serverId: string;
  serverName: string;
  channelId: string;
  channelName: string;
};

export type HomeIncident = {
  id: string;
  title: string;
  serverId: string;
  serverName: string;
  channelId: string | null;
  openedAt: string;
};

export type HomeVoice = {
  channelId: string;
  channelName: string;
  serverId: string;
  serverName: string;
  count: number;
};

/** v0.69: ActionItem ждёт моего approval (approver=me + status=PENDING). */
export type HomePendingApproval = {
  id: string;
  title: string;
  type: "TASK" | "DECISION" | "FOLLOW_UP";
  serverId: string;
  serverName: string;
  channelId: string;
  channelName: string;
  requestedAt: string;
  requestedBy: string;
};

/** v0.69: top-5 каналов с сообщениями за последний час (activity heat). */
export type HomeActiveRoom = {
  channelId: string;
  channelName: string;
  serverId: string;
  serverName: string;
  messageCount: number;
  authorCount: number;
};

export type HomeTodayData = {
  assignedTasks: HomeTask[];
  incidents: HomeIncident[];
  activeVoice: HomeVoice[];
  pendingApprovals: HomePendingApproval[];
  activeRooms: HomeActiveRoom[];
  counts: {
    tasks: number;
    overdue: number;
    incidents: number;
    activeVoice: number;
    approvals: number;
    activeRooms: number;
  };
};

export function useHomeToday(active: boolean) {
  const [data, setData] = useState<HomeTodayData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiJson<HomeTodayData>("/api/home/today");
      setData(res);
    } catch (e) {
      setError(
        e instanceof ApiError ? e.message : "Не удалось загрузить операционную сводку",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (active) void reload();
  }, [active, reload]);

  return { data, loading, error, reload };
}
