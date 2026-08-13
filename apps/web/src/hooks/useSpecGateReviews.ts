import { useCallback, useEffect, useState } from "react";
import { apiJson, ApiError } from "../lib/api";

export type SpecGateReviewStatus = "PENDING" | "APPROVED" | "REJECTED";
export type SpecGateArtifactPayload = {
  schemaVersion: "eclipse.spec-gate.v1";
  id: string;
  status: "ready_for_review";
  createdAt: string;
  updatedAt: string;
  input: {
    projectName: string; repository: string; problem: string; userOutcome: string;
    inScope: string[]; outOfScope: string[]; constraints: string[]; acceptanceCriteria: string[];
    clarifications: Array<{ question: string; answer: string }>;
    rollbackPlan: string; evidencePaths: string[];
  };
  stages: Array<{ id: "constitution" | "specify" | "clarify" | "plan" | "tasks" | "implement"; command: string; status: "complete" | "blocked"; summary: string }>;
  tasks: Array<{ id: string; title: string; acceptanceCriterion: string; status: "pending" }>;
  verification: { evidencePaths: string[]; requiredChecks: ["typecheck", "tests", "build", "desktop-qa", "mobile-qa", "security-review"] };
  policy: { externalActions: false; toolsAllowed: false; sourceContentTrusted: false; generatedCodeExecuted: false; githubConnected: false; deployAllowed: false; paymentsAllowed: false; implementationAllowed: false };
  approval: null;
};

type SpecGatePerson = { id: string; displayName: string; avatar: string | null };
export type SpecGateReviewView = {
  id: string; sourceSpecId: string; schemaVersion: "eclipse.spec-gate.v1"; reviewStatus: SpecGateReviewStatus;
  reviewNote: string | null; reviewedAt: string | null; reviewedBy: SpecGatePerson | null; importedBy: SpecGatePerson | null;
  version: number; createdAt: string; updatedAt: string; artifact: SpecGateArtifactPayload;
};
type SpecGateReviewsResponse = { reviews: SpecGateReviewView[]; policy: { maxPendingReviewsPerOperator: number; importedApprovalReset: boolean; externalActionsEnabled: boolean } };
const message = (error: unknown, fallback: string) => error instanceof ApiError ? error.message : fallback;

export function useSpecGateReviews(serverId: string | null, enabled: boolean) {
  const [reviews, setReviews] = useState<SpecGateReviewView[]>([]);
  const [policy, setPolicy] = useState<SpecGateReviewsResponse["policy"] | null>(null);
  const [loading, setLoading] = useState(Boolean(serverId && enabled));
  const [importing, setImporting] = useState(false);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(async () => {
    if (!serverId || !enabled) { setLoading(false); return; }
    setLoading(true); setError(null);
    try { const response = await apiJson<SpecGateReviewsResponse>(`/api/servers/${encodeURIComponent(serverId)}/spec-gate-reviews`); setReviews(response.reviews); setPolicy(response.policy); }
    catch (cause) { setError(message(cause, "Не удалось загрузить Spec Gate Review Room")); }
    finally { setLoading(false); }
  }, [enabled, serverId]);
  useEffect(() => { void reload(); }, [reload]);
  const importArtifact = useCallback(async (rawArtifact: unknown): Promise<SpecGateReviewView | null> => {
    if (!serverId) return null;
    setImporting(true); setError(null);
    try {
      const sourceId = rawArtifact && typeof rawArtifact === "object" && "id" in rawArtifact && typeof rawArtifact.id === "string" ? rawArtifact.id : crypto.randomUUID();
      const response = await apiJson<{ review: SpecGateReviewView; idempotent: boolean }>(`/api/servers/${encodeURIComponent(serverId)}/spec-gate-reviews/import`, { method: "POST", headers: { "Idempotency-Key": `spec-gate:${sourceId}`.slice(0, 128) }, body: JSON.stringify({ artifact: rawArtifact }) });
      setReviews((current) => [response.review, ...current.filter((item) => item.id !== response.review.id)]); return response.review;
    } catch (cause) { setError(message(cause, "Не удалось импортировать eclipse.spec-gate.v1")); return null; }
    finally { setImporting(false); }
  }, [serverId]);
  const reviewArtifact = useCallback(async (reviewId: string, version: number, decision: "APPROVE" | "REJECT", checklist: { scopeConfirmed: boolean; risksConfirmed: boolean; rollbackConfirmed: boolean }, note: string): Promise<SpecGateReviewView | null> => {
    if (!serverId) return null;
    setReviewingId(reviewId); setError(null);
    try {
      const response = await apiJson<{ review: SpecGateReviewView }>(`/api/servers/${encodeURIComponent(serverId)}/spec-gate-reviews/${encodeURIComponent(reviewId)}`, { method: "PATCH", body: JSON.stringify({ version, decision, ...checklist, note: note.trim() || undefined }) });
      setReviews((current) => current.map((item) => item.id === response.review.id ? response.review : item)); return response.review;
    } catch (cause) { setError(message(cause, "Не удалось сохранить решение по спецификации")); return null; }
    finally { setReviewingId(null); }
  }, [serverId]);
  return { reviews, policy, loading, importing, reviewingId, error, clearError: () => setError(null), reload, importArtifact, reviewArtifact };
}