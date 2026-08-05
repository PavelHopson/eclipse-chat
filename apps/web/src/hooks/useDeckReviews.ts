import { useCallback, useEffect, useState } from "react";
import { api, apiJson, ApiError } from "../lib/api";

export type DeckReviewStatus = "PENDING" | "APPROVED" | "REJECTED";
export type DeckJobPayload = {
  schemaVersion: "deck.job.v1";
  id: string;
  status: "ready_for_review";
  createdAt: string;
  updatedAt: string;
  input: {
    title: string;
    objective: string;
    audience: string;
    format: "project-recap" | "lesson" | "pitch";
    sourceText: string;
    evidenceUrls: string[];
  };
  slides: Array<{
    id: string;
    kind: "cover" | "content" | "evidence" | "summary";
    title: string;
    bullets: string[];
    speakerNotes: string;
    sourceRefs: string[];
  }>;
  policy: {
    externalActions: false;
    toolsAllowed: false;
    sourceContentTrusted: false;
    autoPublishAllowed: false;
    pptxRendered: false;
  };
  approval: null;
};

type DeckPerson = { id: string; displayName: string; avatar: string | null };
export type DeckReviewView = {
  id: string;
  sourceJobId: string;
  schemaVersion: "deck.job.v1";
  reviewStatus: DeckReviewStatus;
  reviewNote: string | null;
  reviewedAt: string | null;
  reviewedBy: DeckPerson | null;
  importedBy: DeckPerson | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  job: DeckJobPayload;
};

type DeckReviewsResponse = {
  reviews: DeckReviewView[];
  policy: { maxPendingReviewsPerOperator: number; pptxRenderingEnabled: boolean; renderRequiresApproval: boolean };
};

function message(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

export function useDeckReviews(serverId: string | null, enabled: boolean) {
  const [reviews, setReviews] = useState<DeckReviewView[]>([]);
  const [policy, setPolicy] = useState<DeckReviewsResponse["policy"] | null>(null);
  const [loading, setLoading] = useState(Boolean(serverId && enabled));
  const [importing, setImporting] = useState(false);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [renderingId, setRenderingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!serverId || !enabled) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await apiJson<DeckReviewsResponse>(`/api/servers/${encodeURIComponent(serverId)}/deck-reviews`);
      setReviews(response.reviews);
      setPolicy(response.policy);
    } catch (cause) {
      setError(message(cause, "Не удалось загрузить Deck Review Room"));
    } finally {
      setLoading(false);
    }
  }, [enabled, serverId]);

  useEffect(() => { void reload(); }, [reload]);

  const importJob = useCallback(async (rawJob: unknown): Promise<DeckReviewView | null> => {
    if (!serverId) return null;
    setImporting(true);
    setError(null);
    try {
      const sourceId = rawJob && typeof rawJob === "object" && "id" in rawJob && typeof rawJob.id === "string"
        ? rawJob.id
        : crypto.randomUUID();
      const response = await apiJson<{ review: DeckReviewView; idempotent: boolean }>(
        `/api/servers/${encodeURIComponent(serverId)}/deck-reviews/import`,
        {
          method: "POST",
          headers: { "Idempotency-Key": `deck:${sourceId}`.slice(0, 128) },
          body: JSON.stringify({ job: rawJob }),
        },
      );
      setReviews((current) => [response.review, ...current.filter((item) => item.id !== response.review.id)]);
      return response.review;
    } catch (cause) {
      setError(message(cause, "Не удалось импортировать deck.job.v1"));
      return null;
    } finally {
      setImporting(false);
    }
  }, [serverId]);

  const reviewJob = useCallback(async (
    reviewId: string,
    version: number,
    decision: "APPROVE" | "REJECT",
    checklist: { claimsVerified: boolean; rightsConfirmed: boolean; finalReviewComplete: boolean },
    note: string,
  ): Promise<DeckReviewView | null> => {
    if (!serverId) return null;
    setReviewingId(reviewId);
    setError(null);
    try {
      const response = await apiJson<{ review: DeckReviewView }>(
        `/api/servers/${encodeURIComponent(serverId)}/deck-reviews/${encodeURIComponent(reviewId)}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            version,
            decision,
            ...checklist,
            note: note.trim() || undefined,
          }),
        },
      );
      setReviews((current) => current.map((item) => item.id === response.review.id ? response.review : item));
      return response.review;
    } catch (cause) {
      setError(message(cause, "Не удалось сохранить решение по презентации"));
      return null;
    } finally {
      setReviewingId(null);
    }
  }, [serverId]);

  const renderJob = useCallback(async (reviewId: string, title: string): Promise<boolean> => {
    if (!serverId) return false;
    setRenderingId(reviewId);
    setError(null);
    try {
      const response = await api(
        `/api/servers/${encodeURIComponent(serverId)}/deck-reviews/${encodeURIComponent(reviewId)}/render`,
        { method: "POST" },
      );
      if (!response.ok) {
        const detail = await response.json().catch(() => null) as { error?: unknown } | null;
        throw new ApiError(typeof detail?.error === "string" ? detail.error : `HTTP ${response.status}`, response.status, detail);
      }
      const blob = await response.blob();
      if (blob.size === 0 || blob.size > 4 * 1024 * 1024) throw new Error("Сервер вернул некорректный PPTX");
      const safeTitle = title.normalize("NFKC").replace(/[<>:"/\\|?*\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80) || "Eclipse deck";
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${safeTitle}.pptx`;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 0);
      return true;
    } catch (cause) {
      setError(message(cause, "Не удалось создать PPTX"));
      return false;
    } finally {
      setRenderingId(null);
    }
  }, [serverId]);

  return {
    reviews,
    policy,
    loading,
    importing,
    reviewingId,
    renderingId,
    error,
    clearError: () => setError(null),
    reload,
    importJob,
    reviewJob,
    renderJob,
  };
}
