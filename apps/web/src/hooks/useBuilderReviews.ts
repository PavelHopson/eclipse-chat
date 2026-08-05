import { useCallback, useEffect, useState } from "react";
import { apiJson, ApiError } from "../lib/api";

export type BuilderReviewStatus = "PENDING" | "APPROVED" | "REJECTED";
export type BuilderProjectPayload = {
  schemaVersion: "builder.project.v1";
  id: string;
  status: "ready_for_review";
  createdAt: string;
  updatedAt: string;
  input: {
    name: string;
    audience: string;
    problem: string;
    primaryAction: string;
    template: "landing" | "dashboard" | "catalog";
    requirements: string[];
  };
  blueprint: {
    routes: Array<{ path: string; label: string; purpose: string }>;
    sections: Array<{ id: string; label: string; purpose: string }>;
    states: ["loading", "empty", "error", "success", "disabled", "no-access"];
    entities: string[];
    design: { density: "balanced"; accent: "#6BA3FF"; radius: "medium"; fontStack: "system" };
  };
  preview: {
    eyebrow: string;
    headline: string;
    supportingText: string;
    actionLabel: string;
    proofPoints: string[];
  };
  buildQueue: Array<{ id: string; title: string; outcome: string; status: "ready" | "blocked"; gate: string | null }>;
  policy: {
    externalActions: false;
    toolsAllowed: false;
    sourceContentTrusted: false;
    generatedCodeExecuted: false;
    githubConnected: false;
    deployAllowed: false;
    paymentsAllowed: false;
  };
  approval: null;
};

type BuilderPerson = { id: string; displayName: string; avatar: string | null };
export type BuilderReviewView = {
  id: string;
  sourceProjectId: string;
  schemaVersion: "builder.project.v1";
  reviewStatus: BuilderReviewStatus;
  reviewNote: string | null;
  reviewedAt: string | null;
  reviewedBy: BuilderPerson | null;
  importedBy: BuilderPerson | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  project: BuilderProjectPayload;
};

type BuilderReviewsResponse = {
  reviews: BuilderReviewView[];
  policy: { maxPendingReviewsPerOperator: number; importedApprovalReset: boolean; externalActionsEnabled: boolean };
};

function message(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

export function useBuilderReviews(serverId: string | null, enabled: boolean) {
  const [reviews, setReviews] = useState<BuilderReviewView[]>([]);
  const [policy, setPolicy] = useState<BuilderReviewsResponse["policy"] | null>(null);
  const [loading, setLoading] = useState(Boolean(serverId && enabled));
  const [importing, setImporting] = useState(false);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!serverId || !enabled) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const response = await apiJson<BuilderReviewsResponse>(`/api/servers/${encodeURIComponent(serverId)}/builder-reviews`);
      setReviews(response.reviews);
      setPolicy(response.policy);
    } catch (cause) {
      setError(message(cause, "Не удалось загрузить Builder Review Room"));
    } finally {
      setLoading(false);
    }
  }, [enabled, serverId]);

  useEffect(() => { void reload(); }, [reload]);

  const importProject = useCallback(async (rawProject: unknown): Promise<BuilderReviewView | null> => {
    if (!serverId) return null;
    setImporting(true);
    setError(null);
    try {
      const sourceId = rawProject && typeof rawProject === "object" && "id" in rawProject && typeof rawProject.id === "string"
        ? rawProject.id
        : crypto.randomUUID();
      const response = await apiJson<{ review: BuilderReviewView; idempotent: boolean }>(
        `/api/servers/${encodeURIComponent(serverId)}/builder-reviews/import`,
        {
          method: "POST",
          headers: { "Idempotency-Key": `builder:${sourceId}`.slice(0, 128) },
          body: JSON.stringify({ project: rawProject }),
        },
      );
      setReviews((current) => [response.review, ...current.filter((item) => item.id !== response.review.id)]);
      return response.review;
    } catch (cause) {
      setError(message(cause, "Не удалось импортировать builder.project.v1"));
      return null;
    } finally {
      setImporting(false);
    }
  }, [serverId]);

  const reviewProject = useCallback(async (
    reviewId: string,
    version: number,
    decision: "APPROVE" | "REJECT",
    checklist: { requirementsConfirmed: boolean; securityBoundaryConfirmed: boolean; previewReviewed: boolean },
    note: string,
  ): Promise<BuilderReviewView | null> => {
    if (!serverId) return null;
    setReviewingId(reviewId);
    setError(null);
    try {
      const response = await apiJson<{ review: BuilderReviewView }>(
        `/api/servers/${encodeURIComponent(serverId)}/builder-reviews/${encodeURIComponent(reviewId)}`,
        {
          method: "PATCH",
          body: JSON.stringify({ version, decision, ...checklist, note: note.trim() || undefined }),
        },
      );
      setReviews((current) => current.map((item) => item.id === response.review.id ? response.review : item));
      return response.review;
    } catch (cause) {
      setError(message(cause, "Не удалось сохранить решение по проекту"));
      return null;
    } finally {
      setReviewingId(null);
    }
  }, [serverId]);

  return {
    reviews,
    policy,
    loading,
    importing,
    reviewingId,
    error,
    clearError: () => setError(null),
    reload,
    importProject,
    reviewProject,
  };
}
