import { useCallback, useEffect, useState } from "react";
import { ApiError, apiJson } from "../lib/api";
import type { MemberRole } from "./useMembers";

/**
 * v0.83 #24 phase 1: client portal data fetch.
 *
 * Endpoint возвращает aggregate progress/approvals/files/recentActivity
 * для CLIENT-mode workspace'а. На ENGINEERING сервере — 404 (handled
 * как graceful empty в UI). 403 — текущий user не имеет права на portal.
 */

export type PortalActionItem = {
  id: string;
  title: string;
  type: "TASK" | "DECISION" | "FOLLOW_UP";
  status: "OPEN" | "IN_PROGRESS" | "REVIEW" | "DONE";
  priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  dueAt: string | null;
  channelId: string;
  channelName: string;
  assignee: {
    id: string;
    displayName: string;
    avatar: string | null;
  } | null;
  updatedAt: string;
};

export type PortalApproval = {
  id: string;
  title: string;
  type: "TASK" | "DECISION" | "FOLLOW_UP";
  approvalStatus: "PENDING" | "APPROVED" | "REJECTED";
  approvalNote: string | null;
  approvedAt: string | null;
  approver: { id: string; displayName: string; avatar: string | null } | null;
  requestedBy: {
    id: string;
    displayName: string;
    avatar: string | null;
  } | null;
  channelId: string;
  channelName: string;
  updatedAt: string;
};

export type PortalFile = {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  url: string;
  thumbnailUrl: string | null;
  createdAt: string;
  channelId: string;
  channelName: string;
  uploadedBy: {
    id: string;
    displayName: string;
    avatar: string | null;
  } | null;
};

export type PortalActivity = {
  kind: "task-done" | "approved" | "rejected";
  actionItemId: string;
  title: string;
  timestamp: string;
  channelName: string;
  actor: string | null;
};

export type ClientPortalData = {
  server: {
    id: string;
    name: string;
    brandColor: string | null;
    description: string | null;
    welcomeMessage: string | null;
    mode: "CLIENT";
  };
  viewer: {
    role: MemberRole;
    isPreview: boolean;
  };
  generatedAt: string;
  progress: {
    counts: { open: number; inProgress: number; review: number; done: number };
    items: PortalActionItem[];
  };
  approvals: {
    pending: PortalApproval[];
    recent: PortalApproval[];
  };
  files: PortalFile[];
  recentActivity: PortalActivity[];
};

export type PortalError =
  | { kind: "not-found" }
  | { kind: "forbidden"; message: string }
  | { kind: "network"; message: string }
  | null;

export function useClientPortal(serverId: string | null) {
  const [data, setData] = useState<ClientPortalData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<PortalError>(null);

  const reload = useCallback(async () => {
    if (!serverId) {
      setData(null);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await apiJson<ClientPortalData>(
        `/api/servers/${encodeURIComponent(serverId)}/client-portal`,
      );
      setData(result);
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.status === 404) {
          setError({ kind: "not-found" });
        } else if (e.status === 403) {
          setError({ kind: "forbidden", message: e.message });
        } else {
          setError({ kind: "network", message: e.message });
        }
      } else {
        setError({
          kind: "network",
          message: e instanceof Error ? e.message : "Не удалось загрузить портал",
        });
      }
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [serverId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, loading, error, reload };
}
