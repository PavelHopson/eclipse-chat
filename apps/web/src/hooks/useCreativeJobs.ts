import { useCallback, useEffect, useState } from "react";
import { api, apiJson, ApiError } from "../lib/api";

export type CreativeProviderMode = "preview" | "higgsfield";
export type CreativeJobStatus = "awaiting_quote" | "awaiting_approval" | "approved" | "ready" | "rejected" | "failed";

export type CreativeJobInput = {
  title: string;
  objective: string;
  mediaType: "image" | "video";
  aspectRatio: "1:1" | "4:5" | "9:16" | "16:9";
  durationSeconds: number | null;
  outputCount: number;
  styleNotes: string;
  avoid?: string;
  sourceUrls: string[];
  providerMode: CreativeProviderMode;
};

export type CreativeJobPayload = {
  schemaVersion: "creative.job.v1";
  id: string;
  status: CreativeJobStatus;
  createdAt: string;
  updatedAt: string;
  input: CreativeJobInput;
  quote:
    | { state: "quoted"; credits: number; source: "eclipse-preview" | "higgsfield"; statement: string }
    | { state: "required"; credits: null; source: "higgsfield"; statement: string };
  approval: null | {
    decision: "approved" | "rejected";
    decidedAt: string;
    note: string | null;
    rightsConfirmed: boolean;
    briefConfirmed: boolean;
    costConfirmed: boolean;
  };
  execution: null | {
    provider: "eclipse-preview" | "higgsfield";
    requestId: string;
    chargedCredits: number;
    outputCount: number;
    completedAt: string;
  };
  artifact: null | { kind: "brief-package"; filename: string; contentType: "application/json" };
  policy: {
    externalActions: false;
    autoPublish: false;
    requiresHumanApproval: true;
    sourceContentTrusted: false;
  };
};

export type CreativeJobView = {
  id: string;
  sourceJobId: string;
  schemaVersion: "creative.job.v1";
  status: CreativeJobStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
  job: CreativeJobPayload;
};

type CreativeJobsResponse = {
  jobs: CreativeJobView[];
  policy: {
    maxPendingJobsPerOperator: number;
    previewEnabled: true;
    higgsfield: {
      configured: boolean;
      mcpUrl: string;
      creditsAlwaysCharged: true;
      reason: string;
    };
    localSend: { automaticSelectionAllowed: false };
  };
};

function message(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

function filenameFromHeader(header: string | null, fallback: string): string {
  const match = header?.match(/filename="([a-z0-9._-]+)"/i);
  return match?.[1] ?? fallback;
}

export function useCreativeJobs(serverId: string | null) {
  const [jobs, setJobs] = useState<CreativeJobView[]>([]);
  const [policy, setPolicy] = useState<CreativeJobsResponse["policy"] | null>(null);
  const [loading, setLoading] = useState(Boolean(serverId));
  const [creating, setCreating] = useState(false);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [executingId, setExecutingId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!serverId) {
      setJobs([]);
      setPolicy(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await apiJson<CreativeJobsResponse>(`api/servers/${encodeURIComponent(serverId)}/creative-jobs`);
      setJobs(response.jobs);
      setPolicy(response.policy);
    } catch (cause) {
      setError(message(cause, "Не удалось загрузить Creative Studio"));
    } finally {
      setLoading(false);
    }
  }, [serverId]);

  useEffect(() => { void reload(); }, [reload]);

  const createJob = useCallback(async (input: CreativeJobInput) => {
    if (!serverId) return null;
    setCreating(true);
    setError(null);
    try {
      const response = await apiJson<{ job: CreativeJobView }>(`api/servers/${encodeURIComponent(serverId)}/creative-jobs`, {
        method: "POST",
        headers: { "Idempotency-Key": `creative-create:${crypto.randomUUID()}` },
        body: JSON.stringify({ input }),
      });
      setJobs((current) => [response.job, ...current.filter((item) => item.id !== response.job.id)]);
      return response.job;
    } catch (cause) {
      setError(message(cause, "Не удалось создать Creative-задание"));
      return null;
    } finally {
      setCreating(false);
    }
  }, [serverId]);

  const reviewJob = useCallback(async (jobId: string, version: number, body: {
    decision: "APPROVE" | "REJECT";
    humanConfirmed?: boolean;
    rightsConfirmed?: boolean;
    costConfirmed?: boolean;
    note?: string;
  }) => {
    if (!serverId) return null;
    setReviewingId(jobId);
    setError(null);
    try {
      const response = await apiJson<{ job: CreativeJobView }>(
        `api/servers/${encodeURIComponent(serverId)}/creative-jobs/${encodeURIComponent(jobId)}/review`,
        { method: "PATCH", body: JSON.stringify({ version, ...body }) },
      );
      setJobs((current) => current.map((item) => item.id === response.job.id ? response.job : item));
      return response.job;
    } catch (cause) {
      setError(message(cause, "Не удалось сохранить решение"));
      return null;
    } finally {
      setReviewingId(null);
    }
  }, [serverId]);

  const executeJob = useCallback(async (jobId: string, version: number) => {
    if (!serverId) return null;
    setExecutingId(jobId);
    setError(null);
    try {
      const response = await apiJson<{ job: CreativeJobView }>(
        `api/servers/${encodeURIComponent(serverId)}/creative-jobs/${encodeURIComponent(jobId)}/execute`,
        {
          method: "POST",
          headers: { "Idempotency-Key": `creative-execute:${jobId}:${version}` },
          body: JSON.stringify({ version }),
        },
      );
      setJobs((current) => current.map((item) => item.id === response.job.id ? response.job : item));
      return response.job;
    } catch (cause) {
      setError(message(cause, "Не удалось выполнить Creative-задание"));
      return null;
    } finally {
      setExecutingId(null);
    }
  }, [serverId]);

  const downloadArtifact = useCallback(async (job: CreativeJobView) => {
    if (!serverId || !job.job.artifact) return false;
    setDownloadingId(job.id);
    setError(null);
    try {
      const response = await api(`api/servers/${encodeURIComponent(serverId)}/creative-jobs/${encodeURIComponent(job.id)}/artifact`);
      if (!response.ok) throw new ApiError("Не удалось скачать Creative-пакет", response.status, null);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filenameFromHeader(response.headers.get("Content-Disposition"), job.job.artifact.filename);
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 0);
      return true;
    } catch (cause) {
      setError(message(cause, "Не удалось скачать Creative-пакет"));
      return false;
    } finally {
      setDownloadingId(null);
    }
  }, [serverId]);

  return {
    jobs,
    policy,
    loading,
    creating,
    reviewingId,
    executingId,
    downloadingId,
    error,
    clearError: () => setError(null),
    reload,
    createJob,
    reviewJob,
    executeJob,
    downloadArtifact,
  };
}
