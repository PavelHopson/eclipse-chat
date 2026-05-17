import { useCallback, useEffect, useState } from "react";
import type { Socket } from "socket.io-client";
import { apiJson } from "../lib/api";
import {
  SocketEvents,
  type ActionItemPayload,
  type ActionItemCommentAddedPayload,
  type ActionItemCommentDeletedPayload,
  type ActionItemPriority,
  type ActionItemStatus,
} from "../lib/socket";

/**
 * useActionItem — fetch + live-sync для single ActionItem detail (v0.54
 * drawer). Subscribes на action:item:updated / comment:added / comment:deleted
 * чтобы отражать чужие изменения в реальном времени.
 */

export type ActionItemActivityType =
  | "CREATED"
  | "STATUS_CHANGED"
  | "ASSIGNEE_CHANGED"
  | "DUE_CHANGED"
  | "PRIORITY_CHANGED"
  | "TITLE_CHANGED"
  | "DESCRIPTION_CHANGED"
  | "COMMENT_ADDED"
  | "COMMENT_DELETED"
  | "APPROVAL_REQUESTED"
  | "APPROVAL_APPROVED"
  | "APPROVAL_REJECTED"
  | "DEPENDENCY_ADDED"
  | "DEPENDENCY_REMOVED";

export type ActionItemComment = {
  id: string;
  content: string;
  createdAt: string;
  editedAt: string | null;
  user: { id: string; displayName: string; avatar: string | null };
};

export type ActionItemActivity = {
  id: string;
  type: ActionItemActivityType;
  payload: string | null;
  createdAt: string;
  user: { id: string; displayName: string; avatar: string | null } | null;
};

export type ActionItemDetail = ActionItemPayload & {
  comments: ActionItemComment[];
  activities: ActionItemActivity[];
};

type ApiResponse = { action: ActionItemDetail };

type UpdatePayload = Partial<{
  status: ActionItemStatus;
  title: string;
  description: string | null;
  priority: ActionItemPriority;
  assigneeUserId: string | null;
  dueAt: string | null;
}>;

export function useActionItem(id: string | null, socket: Socket | null) {
  const [detail, setDetail] = useState<ActionItemDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!id) {
      setDetail(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await apiJson<ApiResponse>(`/api/actions/${encodeURIComponent(id)}`);
      setDetail(data.action);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось загрузить детали");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void reload();
  }, [reload]);

  // Live-sync с socket-events.
  useEffect(() => {
    if (!socket || !id) return;
    const onUpdated = (p: ActionItemPayload) => {
      if (p.id !== id) return;
      setDetail((prev) => (prev ? { ...prev, ...p } : prev));
    };
    const onCommentAdded = (p: ActionItemCommentAddedPayload) => {
      if (p.actionItemId !== id) return;
      setDetail((prev) => {
        if (!prev) return prev;
        // Avoid dup (мог уже быть добавлен через locally-emitted optimistic).
        if (prev.comments.some((c) => c.id === p.id)) return prev;
        return {
          ...prev,
          comments: [
            ...prev.comments,
            {
              id: p.id,
              content: p.content,
              createdAt: p.createdAt,
              editedAt: p.editedAt,
              user: p.user,
            },
          ],
        };
      });
    };
    const onCommentDeleted = (p: ActionItemCommentDeletedPayload) => {
      if (p.actionItemId !== id) return;
      setDetail((prev) =>
        prev
          ? { ...prev, comments: prev.comments.filter((c) => c.id !== p.commentId) }
          : prev,
      );
    };
    socket.on(SocketEvents.ActionItemUpdated, onUpdated);
    socket.on(SocketEvents.ActionItemCommentAdded, onCommentAdded);
    socket.on(SocketEvents.ActionItemCommentDeleted, onCommentDeleted);
    return () => {
      socket.off(SocketEvents.ActionItemUpdated, onUpdated);
      socket.off(SocketEvents.ActionItemCommentAdded, onCommentAdded);
      socket.off(SocketEvents.ActionItemCommentDeleted, onCommentDeleted);
    };
  }, [socket, id]);

  const update = useCallback(
    async (patch: UpdatePayload): Promise<boolean> => {
      if (!id) return false;
      try {
        const result = await apiJson<{ action: ActionItemPayload }>(
          `/api/actions/${encodeURIComponent(id)}`,
          {
            method: "PATCH",
            body: JSON.stringify(patch),
            headers: { "Content-Type": "application/json" },
          },
        );
        setDetail((prev) => (prev ? { ...prev, ...result.action } : prev));
        // Activity feed обновится через emit'ы action:item:updated +
        // следующий reload (reload() явно после inline-save мы не делаем —
        // эмит из server-route обновит state).
        return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Не удалось обновить");
        return false;
      }
    },
    [id],
  );

  const addComment = useCallback(
    async (content: string): Promise<boolean> => {
      if (!id) return false;
      const trimmed = content.trim();
      if (!trimmed) return false;
      try {
        const data = await apiJson<{ comment: ActionItemCommentAddedPayload }>(
          `/api/actions/${encodeURIComponent(id)}/comments`,
          {
            method: "POST",
            body: JSON.stringify({ content: trimmed }),
            headers: { "Content-Type": "application/json" },
          },
        );
        setDetail((prev) => {
          if (!prev) return prev;
          if (prev.comments.some((c) => c.id === data.comment.id)) return prev;
          return {
            ...prev,
            comments: [
              ...prev.comments,
              {
                id: data.comment.id,
                content: data.comment.content,
                createdAt: data.comment.createdAt,
                editedAt: data.comment.editedAt,
                user: data.comment.user,
              },
            ],
          };
        });
        return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Не удалось добавить комментарий");
        return false;
      }
    },
    [id],
  );

  const removeComment = useCallback(
    async (commentId: string): Promise<boolean> => {
      if (!id) return false;
      try {
        await apiJson(`/api/actions/${encodeURIComponent(id)}/comments/${encodeURIComponent(commentId)}`, {
          method: "DELETE",
        });
        setDetail((prev) =>
          prev
            ? { ...prev, comments: prev.comments.filter((c) => c.id !== commentId) }
            : prev,
        );
        return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Не удалось удалить комментарий");
        return false;
      }
    },
    [id],
  );

  const requestApproval = useCallback(
    async (approverUserId: string, note?: string): Promise<boolean> => {
      if (!id) return false;
      try {
        const result = await apiJson<{ action: ActionItemPayload }>(
          `/api/actions/${encodeURIComponent(id)}/approval`,
          {
            method: "POST",
            body: JSON.stringify({ approverUserId, note }),
            headers: { "Content-Type": "application/json" },
          },
        );
        setDetail((prev) => (prev ? { ...prev, ...result.action } : prev));
        // Activity log обновится через emit'ы action:item:updated +
        // reload через socket. Inline reload не нужен — activity feed
        // обновится lazily при следующем open drawer'а.
        return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Не удалось запросить одобрение");
        return false;
      }
    },
    [id],
  );

  const decideApproval = useCallback(
    async (decision: "APPROVED" | "REJECTED", note?: string): Promise<boolean> => {
      if (!id) return false;
      try {
        const result = await apiJson<{ action: ActionItemPayload }>(
          `/api/actions/${encodeURIComponent(id)}/approval/decision`,
          {
            method: "POST",
            body: JSON.stringify({ decision, note }),
            headers: { "Content-Type": "application/json" },
          },
        );
        setDetail((prev) => (prev ? { ...prev, ...result.action } : prev));
        return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Не удалось обработать одобрение");
        return false;
      }
    },
    [id],
  );

  /**
   * v0.73 #20 phase 2: add dependency (blocker). Backend проверяет цикл +
   * same-server + self-loop. Возвращает обновлённую detail-форму
   * текущей задачи (с новой зависимостью в `dependencies[]`).
   * Ошибки: 409 "Adding this dependency would create a cycle",
   * 409 "Dependency already exists", 400 same-server / self.
   */
  const addDependency = useCallback(
    async (
      blockerId: string,
    ): Promise<{ ok: true } | { ok: false; error: string }> => {
      if (!id) return { ok: false, error: "no-id" };
      try {
        const result = await apiJson<{ action: ActionItemPayload | null }>(
          `/api/actions/${encodeURIComponent(id)}/dependencies`,
          {
            method: "POST",
            body: JSON.stringify({ dependsOnActionItemId: blockerId }),
            headers: { "Content-Type": "application/json" },
          },
        );
        if (result.action) {
          setDetail((prev) => (prev ? { ...prev, ...result.action! } : prev));
        }
        return { ok: true };
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Не удалось добавить зависимость";
        setError(msg);
        return { ok: false, error: msg };
      }
    },
    [id],
  );

  const removeDependency = useCallback(
    async (blockerId: string): Promise<boolean> => {
      if (!id) return false;
      try {
        await apiJson(
          `/api/actions/${encodeURIComponent(id)}/dependencies/${encodeURIComponent(blockerId)}`,
          { method: "DELETE" },
        );
        // Локально вычистим — server-emit обновит остальные клиенты.
        setDetail((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            dependencies: prev.dependencies.filter((d) => d.id !== blockerId),
            blockedByOpen: prev.dependencies
              .filter((d) => d.id !== blockerId)
              .filter((d) => d.status !== "DONE").length,
          };
        });
        return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Не удалось удалить зависимость");
        return false;
      }
    },
    [id],
  );

  /**
   * v0.73 #20 phase 4: regenerate AI summary. Кэшируется в БД, повторный
   * вызов перезаписывает (нет ratelimit на frontend; backend сам через AI
   * провайдер тротлит). Возвращает summary text или error.
   */
  const generateAiSummary = useCallback(
    async (): Promise<{ ok: true; summary: string } | { ok: false; error: string }> => {
      if (!id) return { ok: false, error: "no-id" };
      try {
        const result = await apiJson<{ summary: string; updatedAt: string }>(
          `/api/actions/${encodeURIComponent(id)}/ai-summary`,
          { method: "POST" },
        );
        setDetail((prev) =>
          prev
            ? {
                ...prev,
                aiSummary: result.summary,
                aiSummaryUpdatedAt: result.updatedAt,
              }
            : prev,
        );
        return { ok: true, summary: result.summary };
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Не удалось сгенерировать сводку";
        return { ok: false, error: msg };
      }
    },
    [id],
  );

  return {
    detail,
    loading,
    error,
    reload,
    update,
    addComment,
    removeComment,
    requestApproval,
    decideApproval,
    addDependency,
    removeDependency,
    generateAiSummary,
  };
}
