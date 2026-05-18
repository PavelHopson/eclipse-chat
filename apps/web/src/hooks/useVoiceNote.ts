import { useCallback, useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import { ApiError, apiJson } from "../lib/api";
import { SocketEvents } from "../lib/socket";

/**
 * v0.88 #23 phase 1a — Voice room shared notepad hook.
 *
 * Lifecycle:
 *   1. Fetch initial state via GET /api/channels/:id/voice-note.
 *   2. Subscribe на socket `voice-note:updated` для realtime updates.
 *   3. Local edits → debounced PATCH (800ms) → optimistic version bump.
 *   4. Conflict (409) → backend returns current state, локально мержим
 *      (phase 1a — last-writer-wins, фактически overwrite).
 *
 * Phase 1b (когда yjs npm cooperates) — заменим на Yjs CRDT.
 */

export type VoiceNoteState = {
  channelId: string;
  content: string;
  version: number;
  lastEditorUserId: string | null;
  lastEditor: { id: string; displayName: string; avatar: string | null } | null;
  updatedAt: string;
};

export type VoiceNoteStatus =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "saving" }
  | { kind: "saved"; at: number }
  | { kind: "conflict" }
  | { kind: "error"; message: string };

const DEBOUNCE_MS = 800;

export function useVoiceNote(channelId: string | null, socket: Socket | null) {
  const [note, setNote] = useState<VoiceNoteState | null>(null);
  const [draft, setDraft] = useState<string>("");
  const [status, setStatus] = useState<VoiceNoteStatus>({ kind: "idle" });
  /** Tracks whether local draft diverged from server. */
  const draftDirtyRef = useRef(false);
  const saveTimerRef = useRef<number | null>(null);

  // 1. Initial fetch.
  useEffect(() => {
    if (!channelId) {
      setNote(null);
      setDraft("");
      setStatus({ kind: "idle" });
      return;
    }
    let cancelled = false;
    setStatus({ kind: "loading" });
    void (async () => {
      try {
        const data = await apiJson<VoiceNoteState>(
          `/api/channels/${encodeURIComponent(channelId)}/voice-note`,
        );
        if (cancelled) return;
        setNote(data);
        setDraft(data.content);
        draftDirtyRef.current = false;
        setStatus({ kind: "idle" });
      } catch (e) {
        if (cancelled) return;
        setStatus({
          kind: "error",
          message: e instanceof ApiError ? e.message : "Не удалось загрузить заметку",
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [channelId]);

  // 2. Socket subscription.
  useEffect(() => {
    if (!channelId || !socket) return;
    const handler = (payload: {
      channelId: string;
      content: string;
      version: number;
      lastEditorUserId: string | null;
      lastEditorDisplayName: string | null;
      updatedAt: string;
    }) => {
      if (payload.channelId !== channelId) return;
      setNote((prev) => {
        if (prev && prev.version >= payload.version) {
          return prev; // our own bump уже отражён
        }
        return {
          channelId: payload.channelId,
          content: payload.content,
          version: payload.version,
          lastEditorUserId: payload.lastEditorUserId,
          lastEditor: payload.lastEditorUserId
            ? {
                id: payload.lastEditorUserId,
                displayName: payload.lastEditorDisplayName ?? "—",
                avatar: null,
              }
            : null,
          updatedAt: payload.updatedAt,
        };
      });
      // Если local draft не dirty — sync local UI к remote content.
      if (!draftDirtyRef.current) {
        setDraft(payload.content);
      }
    };
    socket.on(SocketEvents.VoiceNoteUpdated, handler);
    return () => {
      socket.off(SocketEvents.VoiceNoteUpdated, handler);
    };
  }, [channelId, socket]);

  // 3. Debounced save.
  const flush = useCallback(async () => {
    if (!channelId || !note) return;
    if (!draftDirtyRef.current) return;
    if (draft === note.content) {
      draftDirtyRef.current = false;
      return;
    }
    setStatus({ kind: "saving" });
    try {
      const updated = await apiJson<VoiceNoteState>(
        `/api/channels/${encodeURIComponent(channelId)}/voice-note`,
        {
          method: "PATCH",
          body: JSON.stringify({
            content: draft,
            baseVersion: note.version,
          }),
        },
      );
      setNote(updated);
      draftDirtyRef.current = false;
      setStatus({ kind: "saved", at: Date.now() });
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        // Conflict — merge phase 1a = принять remote + сохранить local поверх.
        // Phase 1b будет CRDT merge.
        const detail = e.detail as { current?: VoiceNoteState };
        if (detail?.current) {
          setNote(detail.current);
          // Retry с актуальной версией если local diverged.
          setStatus({ kind: "conflict" });
          window.setTimeout(() => {
            // Reset to remote — конфликт phase 1a = lose your changes.
            // Phase 1b: вместо этого CRDT merge.
            setDraft(detail.current!.content);
            draftDirtyRef.current = false;
            setStatus({ kind: "idle" });
          }, 2000);
        } else {
          setStatus({ kind: "error", message: e.message });
        }
      } else {
        setStatus({
          kind: "error",
          message: e instanceof Error ? e.message : "Не удалось сохранить",
        });
      }
    }
  }, [channelId, draft, note]);

  const setContent = useCallback((next: string) => {
    setDraft(next);
    draftDirtyRef.current = true;
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = window.setTimeout(() => {
      void flush();
    }, DEBOUNCE_MS);
  }, [flush]);

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

  // Save on unmount если есть pending changes.
  useEffect(() => {
    return () => {
      if (draftDirtyRef.current) {
        void flush();
      }
    };
  }, [flush]);

  return {
    note,
    draft,
    status,
    setContent,
    flush,
  };
}
