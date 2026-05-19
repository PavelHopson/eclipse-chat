/**
 * v1.1.7 — useTelemetry: polls /api/health каждые 10s для real-time
 * mem/cpu pills в topbar (СЕТЬ/ПАМ/ЦП).
 *
 * Backend (apps/server/src/index.ts /api/health) возвращает:
 *   { mem: { percent }, cpu: { percent, cores, load1m }, pg: { active } }
 *
 * Hook возвращает last snapshot + status (ok/warn/risk) для color
 * coding pills. При network failure pills остаются на last-known
 * values (graceful), либо null если ни одного успешного fetch'а.
 */

import { useEffect, useRef, useState } from "react";
import { apiPath } from "../lib/api";

export type TelemetryStatus = "ok" | "warn" | "risk";

export type TelemetrySnapshot = {
  memPercent: number | null;
  cpuPercent: number | null;
  pgActive: number | null;
  fetchedAt: number;
  /** Был ли последний fetch успешным. */
  online: boolean;
};

const POLL_INTERVAL_MS = 10_000;

/** 0–69 → ok, 70–89 → warn, 90+ → risk. */
function statusFor(percent: number | null): TelemetryStatus {
  if (percent == null) return "ok";
  if (percent >= 90) return "risk";
  if (percent >= 70) return "warn";
  return "ok";
}

export function useTelemetry() {
  const [snap, setSnap] = useState<TelemetrySnapshot>({
    memPercent: null,
    cpuPercent: null,
    pgActive: null,
    fetchedAt: 0,
    online: false,
  });
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    let cancelled = false;

    const fetchOnce = async () => {
      try {
        const res = await fetch(apiPath("api/health"), { cache: "no-store" });
        if (!res.ok) throw new Error(`status ${res.status}`);
        const data = await res.json();
        if (cancelled || !mountedRef.current) return;
        setSnap({
          memPercent: typeof data?.mem?.percent === "number" ? data.mem.percent : null,
          cpuPercent: typeof data?.cpu?.percent === "number" ? data.cpu.percent : null,
          pgActive: typeof data?.pg?.active === "number" ? data.pg.active : null,
          fetchedAt: Date.now(),
          online: true,
        });
      } catch {
        if (cancelled || !mountedRef.current) return;
        setSnap((prev) => ({ ...prev, online: false, fetchedAt: Date.now() }));
      }
    };

    void fetchOnce();
    const id = window.setInterval(fetchOnce, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      mountedRef.current = false;
      window.clearInterval(id);
    };
  }, []);

  return {
    ...snap,
    memStatus: statusFor(snap.memPercent),
    cpuStatus: statusFor(snap.cpuPercent),
  };
}
