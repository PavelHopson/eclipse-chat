import { useCallback, useEffect, useState } from "react";
import { ApiError, apiJson } from "../lib/api";

export type PersonalDigestImportance = "CRITICAL" | "HIGH" | "NORMAL";
export type PersonalDigestKind =
  | "INCIDENT"
  | "RISK"
  | "APPROVAL"
  | "DECISION"
  | "TASK"
  | "FOLLOW_UP"
  | "REQUIREMENT"
  | "MEMORY"
  | "ROOM_ACTIVITY";

export type PersonalDigestItem = {
  id: string;
  kind: PersonalDigestKind;
  importance: PersonalDigestImportance;
  title: string;
  detail: string | null;
  serverId: string;
  serverName: string;
  channelId: string | null;
  channelName: string | null;
  messageId: string | null;
  actionItemId: string | null;
  memoryEntryId: string | null;
  actionStatus: "OPEN" | "IN_PROGRESS" | "REVIEW" | "DONE" | null;
  assigneeUserId: string | null;
  createdAt: string;
};

export type PersonalDigestLiveCall = {
  serverId: string;
  serverName: string;
  channelId: string;
  channelName: string;
  participantCount: number;
  participantNames: string[];
  joined: boolean;
};

export type PersonalDigestChannel = {
  serverId: string;
  serverName: string;
  channelId: string;
  channelName: string;
  messages: number;
  tasks: number;
  decisions: number;
  followUps: number;
  risks: number;
  requirements: number;
  latestAt: string | null;
  latestMessageId: string | null;
  latestMessage: string | null;
};

export type PersonalDigest = {
  since: string;
  generatedAt: string;
  initialized: boolean;
  truncated: boolean;
  totals: {
    messages: number;
    tasks: number;
    decisions: number;
    followUps: number;
    risks: number;
    requirements: number;
    memory: number;
    incidents: number;
    approvals: number;
  };
  priorityItems: PersonalDigestItem[];
  channels: PersonalDigestChannel[];
  liveCalls: PersonalDigestLiveCall[];
};

export function usePersonalDigest(enabled: boolean) {
  const [data, setData] = useState<PersonalDigest | null>(null);
  const [loading, setLoading] = useState(false);
  const [acknowledging, setAcknowledging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async (quiet = false) => {
    if (!enabled) return;
    if (!quiet) setLoading(true);
    setError(null);
    try {
      setData(await apiJson<PersonalDigest>("/api/me/digest"));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не удалось загрузить сводку");
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    void reload();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void reload(true);
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [enabled, reload]);

  const acknowledge = useCallback(async () => {
    if (!data || acknowledging) return false;
    setAcknowledging(true);
    setError(null);
    try {
      await apiJson<{ acknowledgedAt: string }>("/api/me/digest/acknowledge", {
        method: "POST",
        body: JSON.stringify({ reviewedThrough: data.generatedAt }),
      });
      await reload();
      return true;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не удалось отметить сводку просмотренной");
      return false;
    } finally {
      setAcknowledging(false);
    }
  }, [acknowledging, data, reload]);

  return { data, loading, acknowledging, error, reload, acknowledge };
}
