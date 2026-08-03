import { useCallback, useEffect, useState } from "react";
import { apiJson, ApiError } from "../lib/api";

export type ProjectPassportAction = {
  id: string;
  title: string;
  type: "TASK" | "DECISION" | "FOLLOW_UP" | "RISK" | "REQUIREMENT";
  status: "OPEN" | "IN_PROGRESS" | "REVIEW" | "DONE";
  priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  dueAt: string | null;
  updatedAt: string;
  channelId: string;
  channelName: string;
  sourceMessageId: string;
  approvalStatus: "NONE" | "PENDING" | "APPROVED" | "REJECTED";
  escalatedAt: string | null;
  assignee: {
    id: string;
    displayName: string;
    avatar: string | null;
  } | null;
};

export type ProjectPassportData = {
  generatedAt: string;
  project: {
    id: string;
    name: string;
    description: string | null;
    icon: string | null;
    banner: string | null;
    mode: "ENGINEERING" | "CLIENT";
    createdAt: string;
    health: {
      state: "BLOCKED" | "AT_RISK" | "ON_TRACK" | "QUIET";
      reason: string;
      overdueCount: number;
      activeRiskCount: number;
    };
  };
  counts: {
    rooms: number;
    openWork: number;
    decisions: number;
    activeRisks: number;
    repositories: number;
    documents: number;
  };
  responsibles: Array<{
    id: string;
    displayName: string;
    avatar: string | null;
    role: string;
  }>;
  repositories: Array<{
    integrationId: string;
    name: string;
    repository: string;
    sourceUrl: string;
    channelId: string;
    channelName: string;
    enabled: boolean;
    lastEventAt: string | null;
    eventCount: number;
  }>;
  deploys: Array<{
    messageId: string;
    channelId: string;
    channelName: string;
    repository: string;
    kind: "workflow" | "release" | "deployment";
    title: string;
    summary: string;
    status: "success" | "failure" | "pending" | "neutral";
    sourceUrl: string;
    ref: string | null;
    actor: string | null;
    occurredAt: string;
  }>;
  rooms: Array<{
    id: string;
    name: string;
    type: string;
    description: string | null;
    internal: boolean;
    activeWork: number;
    activeRisks: number;
    lastActivityAt: string | null;
  }>;
  decisions: ProjectPassportAction[];
  work: ProjectPassportAction[];
  risks: ProjectPassportAction[];
  documents: Array<{
    id: string;
    title: string;
    summary: string | null;
    sourceUrl: string | null;
    kind: string;
    visibility: "ROOM" | "WORKSPACE";
    tags: string[];
    channelId: string | null;
    channelName: string | null;
    sourceMessageId: string | null;
    actionItemId: string | null;
    reviewDue: boolean;
    updatedAt: string;
    owner: {
      id: string;
      displayName: string;
      avatar: string | null;
    } | null;
  }>;
  nextAction: {
    kind: "ACTION" | "DEPLOY" | "ROOM" | "NONE";
    label: string;
    actionItemId: string | null;
    channelId: string | null;
    sourceUrl: string | null;
  };
};

export function useProjectPassport(serverId: string) {
  const [data, setData] = useState<ProjectPassportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiJson<ProjectPassportData>(
        `/api/servers/${encodeURIComponent(serverId)}/project-passport`,
      );
      setData(result);
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : "Не удалось собрать паспорт проекта",
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
