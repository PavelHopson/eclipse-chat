import { useCallback, useEffect, useState } from "react";
import { apiJson, ApiError } from "../lib/api";

export type GrowthReviewStatus = "PENDING" | "APPROVED" | "REJECTED";
export type GrowthStepId = "research" | "strategy" | "draft" | "claims" | "final";

export type GrowthRunPayload = {
  schemaVersion: "growth.run.v1";
  id: string;
  status: "ready_for_approval";
  createdAt: string;
  updatedAt: string;
  input: {
    releaseName: string;
    releaseSummary: string;
    audience: string;
    channel: "telegram" | "linkedin" | "blog";
    sourceUrls: string[];
    evidenceNotes: string;
  };
  execution: {
    provider: string;
    model: string;
    maxRequests: 5;
    completedRequests: 5;
    cost: "provider-dependent";
  };
  policy: {
    externalActions: false;
    publishAllowed: false;
    toolsAllowed: false;
    sourceContentTrusted: false;
  };
  artifacts: Array<{
    step: GrowthStepId;
    role: string;
    content: string;
    createdAt: string;
  }>;
  approval: null;
};

type GrowthPerson = {
  id: string;
  displayName: string;
  avatar: string | null;
};

export type GrowthRunView = {
  id: string;
  sourceRunId: string;
  schemaVersion: "growth.run.v1";
  reviewStatus: GrowthReviewStatus;
  reviewNote: string | null;
  reviewedAt: string | null;
  reviewedBy: GrowthPerson | null;
  importedBy: GrowthPerson | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  run: GrowthRunPayload;
};

type GrowthRunsResponse = {
  runs: GrowthRunView[];
  policy: {
    maxPendingRunsPerOperator: number;
    executionEnabled: false;
    publicationEnabled: false;
  };
};

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

export function useGrowthRuns(serverId: string | null) {
  const [runs, setRuns] = useState<GrowthRunView[]>([]);
  const [policy, setPolicy] = useState<GrowthRunsResponse["policy"] | null>(null);
  const [loading, setLoading] = useState(Boolean(serverId));
  const [importing, setImporting] = useState(false);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!serverId) {
      setRuns([]);
      setPolicy(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await apiJson<GrowthRunsResponse>(
        `/api/servers/${encodeURIComponent(serverId)}/growth-runs`,
      );
      setRuns(response.runs);
      setPolicy(response.policy);
    } catch (cause) {
      setError(errorMessage(cause, "Не удалось загрузить Growth Command Room"));
    } finally {
      setLoading(false);
    }
  }, [serverId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const importRun = useCallback(async (rawRun: unknown): Promise<GrowthRunView | null> => {
    if (!serverId) return null;
    setImporting(true);
    setError(null);
    try {
      const sourceId =
        rawRun && typeof rawRun === "object" && "id" in rawRun && typeof rawRun.id === "string"
          ? rawRun.id
          : crypto.randomUUID();
      const idempotencyKey = `growth:${sourceId}`.slice(0, 128);
      const response = await apiJson<{ run: GrowthRunView; idempotent: boolean }>(
        `/api/servers/${encodeURIComponent(serverId)}/growth-runs/import`,
        {
          method: "POST",
          headers: { "Idempotency-Key": idempotencyKey },
          body: JSON.stringify({ run: rawRun }),
        },
      );
      setRuns((current) => [
        response.run,
        ...current.filter((item) => item.id !== response.run.id),
      ]);
      return response.run;
    } catch (cause) {
      setError(errorMessage(cause, "Не удалось импортировать growth.run.v1"));
      return null;
    } finally {
      setImporting(false);
    }
  }, [serverId]);

  const reviewRun = useCallback(async (
    runId: string,
    version: number,
    decision: "APPROVE" | "REJECT",
    note: string,
    humanConfirmed: boolean,
  ): Promise<GrowthRunView | null> => {
    if (!serverId) return null;
    setReviewingId(runId);
    setError(null);
    try {
      const response = await apiJson<{ run: GrowthRunView }>(
        `/api/servers/${encodeURIComponent(serverId)}/growth-runs/${encodeURIComponent(runId)}/review`,
        {
          method: "PATCH",
          body: JSON.stringify({
            version,
            decision,
            humanConfirmed,
            note: note.trim() || undefined,
          }),
        },
      );
      setRuns((current) => current.map((item) => item.id === response.run.id ? response.run : item));
      return response.run;
    } catch (cause) {
      setError(errorMessage(cause, "Не удалось сохранить решение"));
      return null;
    } finally {
      setReviewingId(null);
    }
  }, [serverId]);

  return {
    runs,
    policy,
    loading,
    importing,
    reviewingId,
    error,
    clearError: () => setError(null),
    reload,
    importRun,
    reviewRun,
  };
}
