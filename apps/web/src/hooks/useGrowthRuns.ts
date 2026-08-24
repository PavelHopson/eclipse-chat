import { useCallback, useEffect, useState } from "react";
import { apiJson, ApiError } from "../lib/api";

export type GrowthReviewStatus = "PENDING" | "APPROVED" | "REJECTED";
export type GrowthStepId = "research" | "strategy" | "draft" | "claims" | "final";

export type GrowthRunPayload = {
  schemaVersion: "growth.run.v1";
  id: string;
  status: "draft" | "in_progress" | "ready_for_approval";
  createdAt: string;
  updatedAt: string;
  input: {
    releaseName: string;
    releaseSummary: string;
    audience: string;
    channel: "telegram" | "linkedin" | "blog";
    sourceUrls: string[];
    evidenceNotes: string;
    evidenceCards?: Array<{
      id: string;
      claim: string;
      state: "verified" | "hypothesis" | "planned" | "unknown" | "rejected";
      sourceUrl: string | null;
      evidenceBoundary: string;
    }>;
  };
  execution: {
    provider: string;
    model: string;
    maxRequests: 5;
    completedRequests: number;
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
  origin: "chat" | "import";
  executionState: "IDLE" | "RUNNING" | "CANCELLING";
  activeStep: GrowthStepId | null;
  run: GrowthRunPayload;
};

export type GrowthRunInput = GrowthRunPayload["input"];

type GrowthRunsResponse = {
  runs: GrowthRunView[];
  policy: {
    maxPendingRunsPerOperator: number;
    executionEnabled: boolean;
    publicationEnabled: false;
    maxRequestsPerRun: 5;
    budget: {
      day: string;
      limit: number;
      used: number;
      remaining: number;
    };
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
  const [creating, setCreating] = useState(false);
  const [executingId, setExecutingId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
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

  const createRun = useCallback(async (input: GrowthRunInput): Promise<GrowthRunView | null> => {
    if (!serverId) return null;
    setCreating(true);
    setError(null);
    try {
      const response = await apiJson<{ run: GrowthRunView; idempotent: boolean }>(
        `/api/servers/${encodeURIComponent(serverId)}/growth-runs`,
        {
          method: "POST",
          headers: { "Idempotency-Key": `growth-create:${crypto.randomUUID()}` },
          body: JSON.stringify({ input }),
        },
      );
      setRuns((current) => [response.run, ...current.filter((item) => item.id !== response.run.id)]);
      return response.run;
    } catch (cause) {
      setError(errorMessage(cause, "Не удалось создать Growth-материал"));
      return null;
    } finally {
      setCreating(false);
    }
  }, [serverId]);

  const executeNext = useCallback(async (
    runId: string,
    version: number,
  ): Promise<GrowthRunView | null> => {
    if (!serverId) return null;
    setExecutingId(runId);
    setError(null);
    try {
      const response = await apiJson<{
        run: GrowthRunView;
        budget?: GrowthRunsResponse["policy"]["budget"];
        idempotent: boolean;
      }>(`/api/servers/${encodeURIComponent(serverId)}/growth-runs/${encodeURIComponent(runId)}/steps`, {
        method: "POST",
        headers: { "Idempotency-Key": `growth-step:${runId}:${version}` },
        body: JSON.stringify({ version }),
      });
      setRuns((current) => current.map((item) => item.id === response.run.id ? response.run : item));
      if (response.budget) setPolicy((current) => current ? { ...current, budget: response.budget! } : current);
      return response.run;
    } catch (cause) {
      const message = errorMessage(cause, "Не удалось выполнить следующий Growth-шаг");
      await reload();
      setError(message);
      return null;
    } finally {
      setExecutingId(null);
    }
  }, [reload, serverId]);

  const cancelStep = useCallback(async (runId: string): Promise<boolean> => {
    if (!serverId) return false;
    setCancellingId(runId);
    setError(null);
    try {
      await apiJson<{ cancelled: true }>(
        `/api/servers/${encodeURIComponent(serverId)}/growth-runs/${encodeURIComponent(runId)}/cancel`,
        { method: "POST" },
      );
      return true;
    } catch (cause) {
      setError(errorMessage(cause, "Не удалось остановить Growth-шаг"));
      return false;
    } finally {
      setCancellingId(null);
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
    creating,
    executingId,
    cancellingId,
    reviewingId,
    error,
    clearError: () => setError(null),
    reload,
    importRun,
    createRun,
    executeNext,
    cancelStep,
    reviewRun,
  };
}
