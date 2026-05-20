import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";
import type { VoiceParticipant } from "../hooks/useVoice";

type RawStat = {
  identity: string;
  bitrate: number | null; // bytesReceived cumulative
  packetsLost: number | null;
  jitter: number | null; // ms
  roundTripMs: number | null;
};

type DisplayStat = {
  identity: string;
  name: string;
  pingMs: number | null;
  packetsLost: number | null;
  bitrateKbps: number | null;
  jitterMs: number | null;
};

type Props = {
  participants: VoiceParticipant[];
  getRemoteStats: () => Promise<RawStat[]>;
  onClose: () => void;
};

const wrap: CSSProperties = {
  position: "absolute",
  bottom: 80,
  right: 16,
  background: "hsl(200 8% 8% / 0.92)",
  backdropFilter: "saturate(180%) blur(12px)",
  WebkitBackdropFilter: "saturate(180%) blur(12px)",
  borderRadius: "var(--ec-radius-md)",
  boxShadow: "var(--ec-shadow-modal)",
  padding: "var(--ec-space-3)",
  minWidth: 320,
  maxWidth: 420,
  fontSize: "var(--ec-text-2xs)",
  zIndex: 50,
};

const headerRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: "var(--ec-space-2)",
  paddingBottom: "var(--ec-space-2)",
  borderBottom: "1px solid var(--ec-border-subtle)",
};

const grid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1.4fr 0.7fr 0.7fr 0.7fr 0.7fr",
  gap: "0.3rem 0.6rem",
  fontFamily: "var(--ec-font-mono)",
};

const colHead: CSSProperties = {
  color: "var(--ec-text-dim)",
  fontSize: "0.55rem",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  fontFamily: "var(--ec-font-sans, system-ui)",
  fontWeight: 600,
};

function fmtPing(rtt: number | null) {
  if (rtt == null) return "—";
  return `${Math.round(rtt)}`;
}

function pingColor(rtt: number | null): string {
  if (rtt == null) return "var(--ec-text-dim)";
  if (rtt < 80) return "var(--ec-presence-online)";
  if (rtt < 200) return "var(--ec-warn)";
  return "var(--ec-danger)";
}

function fmtKbps(kbps: number | null) {
  if (kbps == null) return "—";
  if (kbps < 0.5) return "0";
  return kbps.toFixed(kbps < 10 ? 1 : 0);
}

export function VoiceStatsOverlay({ participants, getRemoteStats, onClose }: Props) {
  const [stats, setStats] = useState<DisplayStat[]>([]);
  const prevRef = useRef<Map<string, { bytes: number; t: number }>>(new Map());

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const raw = await getRemoteStats();
        if (cancelled) return;
        const now = performance.now();
        const display: DisplayStat[] = raw.map((s) => {
          const p = participants.find((pp) => pp.identity === s.identity);
          const prev = prevRef.current.get(s.identity);
          let bitrateKbps: number | null = null;
          if (s.bitrate != null && prev) {
            const dtSec = (now - prev.t) / 1000;
            const dBytes = s.bitrate - prev.bytes;
            if (dtSec > 0 && dBytes >= 0) {
              bitrateKbps = (dBytes * 8) / 1000 / dtSec;
            }
          }
          if (s.bitrate != null) {
            prevRef.current.set(s.identity, { bytes: s.bitrate, t: now });
          }
          return {
            identity: s.identity,
            name: p?.name ?? s.identity,
            pingMs: s.roundTripMs,
            packetsLost: s.packetsLost,
            bitrateKbps,
            jitterMs: s.jitter,
          };
        });
        setStats(display);
      } catch {
        /* silently — может быть нет subscribed tracks ещё */
      }
    };
    void tick();
    const id = window.setInterval(() => void tick(), 1000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [participants, getRemoteStats]);

  return (
    <div style={wrap} role="dialog" aria-label="Сетевая диагностика голоса">
      <div style={headerRow}>
        <strong style={{ color: "var(--ec-text-strong)", fontSize: "var(--ec-text-sm)" }}>
          Сетевая диагностика
        </strong>
        <button
          type="button"
          onClick={onClose}
          aria-label="Закрыть диагностику"
          className="ec-btn ec-btn--ghost ec-btn--sm"
          style={{ padding: "0.15rem 0.45rem", minWidth: 0, fontSize: "0.6rem" }}
        >
          ✕
        </button>
      </div>
      {stats.length === 0 ? (
        <div style={{ color: "var(--ec-text-dim)", padding: "var(--ec-space-3) 0", textAlign: "center" }}>
          Нет remote tracks. Дождись когда подключится собеседник.
        </div>
      ) : (
        <div style={grid}>
          <span style={colHead}>Участник</span>
          <span style={colHead}>Ping</span>
          <span style={colHead}>Loss</span>
          <span style={colHead}>kbps</span>
          <span style={colHead}>Jitter</span>
          {stats.map((s) => (
            <div key={s.identity} style={{ display: "contents" }}>
              <span
                style={{
                  color: "var(--ec-text)",
                  fontFamily: "var(--ec-font-sans, system-ui)",
                  fontWeight: 500,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
                title={s.name}
              >
                {s.name}
              </span>
              <span style={{ color: pingColor(s.pingMs) }}>
                {fmtPing(s.pingMs)}<span style={{ color: "var(--ec-text-dim)" }}> ms</span>
              </span>
              <span style={{ color: s.packetsLost && s.packetsLost > 5 ? "var(--ec-danger)" : "var(--ec-text)" }}>
                {s.packetsLost ?? "—"}
              </span>
              <span style={{ color: "var(--ec-text)" }}>
                {fmtKbps(s.bitrateKbps)}
              </span>
              <span style={{ color: "var(--ec-text)" }}>
                {s.jitterMs != null ? `${s.jitterMs.toFixed(1)}` : "—"}
              </span>
            </div>
          ))}
        </div>
      )}
      <div
        style={{
          marginTop: "var(--ec-space-2)",
          paddingTop: "var(--ec-space-2)",
          borderTop: "1px solid var(--ec-border-subtle)",
          color: "var(--ec-text-dim)",
          fontSize: "0.6rem",
          display: "flex",
          justifyContent: "space-between",
        }}
      >
        <span>Обновляется каждую секунду</span>
        <kbd style={{ fontFamily: "var(--ec-font-mono)", color: "var(--ec-text-muted)" }}>Ctrl+Shift+`</kbd>
      </div>
    </div>
  );
}
