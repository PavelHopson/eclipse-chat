import { useEffect, useRef, useState } from "react";
import { apiJson } from "../lib/api";

export type OfficeEventType =
  | "task.created"
  | "task.started"
  | "task.progressed"
  | "task.cancelled"
  | "task.completed"
  | "task.failed"
  | "approval.requested"
  | "approval.resolved"
  | "agent.state.changed"
  | "deliverable.ready";

export type OfficeEvent = {
  schemaVersion: "office.event.v1";
  id: string;
  workspaceId: string;
  sequence: number;
  occurredAt: string;
  type: OfficeEventType;
  subject: { kind: "task" | "run" | "approval" | "agent" | "deliverable"; id: string };
  summary: string;
  metadata: Record<string, string | number | boolean | null>;
};

type OfficeEventResponse = {
  schemaVersion: "office.event.v1";
  source: "office-core-runtime";
  events: OfficeEvent[];
  cursor: number;
};

export function useOfficeEvents(serverId: string | null) {
  const [events, setEvents] = useState<OfficeEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const cursorRef = useRef(0);

  useEffect(() => {
    cursorRef.current = 0;
    setEvents([]);
    setConnected(false);
    if (!serverId) return;

    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const poll = async () => {
      try {
        const response = await apiJson<OfficeEventResponse>(
          `/api/servers/${encodeURIComponent(serverId)}/office/events?after=${cursorRef.current}&limit=50`,
        );
        if (disposed) return;
        const busRestarted = response.cursor < cursorRef.current;
        if (busRestarted) setEvents([]);
        cursorRef.current = response.cursor;
        if (response.events.length > 0) {
          setEvents((current) => {
            const next = [...current, ...response.events];
            return [...new Map(next.map((event) => [event.id, event])).values()].slice(-50);
          });
        }
        setConnected(true);
      } catch {
        if (!disposed) setConnected(false);
      } finally {
        if (!disposed) timer = setTimeout(poll, 5_000);
      }
    };
    void poll();
    return () => {
      disposed = true;
      if (timer) clearTimeout(timer);
    };
  }, [serverId]);

  return { events, connected };
}
