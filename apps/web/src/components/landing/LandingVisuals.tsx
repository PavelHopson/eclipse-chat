import type { ReactNode } from "react";
import { Reveal, SignalDot, revealDelay } from "./CinematicMotion";

type AuthMode = "login" | "register" | null;

type HeroOperationalStageProps = {
  authMode: AuthMode;
  authPanel: ReactNode;
  onOpenAuth: (mode: "login" | "register") => void;
  onCloseAuth: () => void;
};

/**
 * v1.3.2 slice C — hero stage больше не «UI mockup».
 *   Pavel brief (24.05.2026): «Stop treating it like a UI mockup.
 *   operational traces / execution continuity / active system surface /
 *   living infrastructure. Less perfect boxes / dashboard symmetry /
 *   clean UI showcase.»
 *
 *   Из stage убрано (по сравнению с прошлой Codex'овой версией):
 *     - field overlay (grid lines — «code-editor mockup» trope)
 *     - 3-row execution stream (feed/dashboard эстетика)
 *     - access-prompt CTA card (дублировал hero CTAs)
 *
 *   Stage = 4 разреженных fragment'а в asymmetric column space, без
 *   border box внешнего:
 *     - trace pulse сверху (offset вправо)
 *     - один primary execution fragment (offset слева, без bubble)
 *     - memory continuum traces (offset вправо, signal left rule)
 *     - mono process signature снизу (offset слева)
 *
 *   Auth-mode: stage заменяется access-layer'ом. Он не объясняет среду,
 *   а просто открывает допуск.
 */

/* v1.3.3 — compression pass. Pavel: «less explanation, more implication.
 * Already active, already alive.» Убраны trace.detail и fragment.actor
 * (explanation), memory traces сокращены до minimal evidence. */
const EXECUTION_TRACE = {
  origin: "EXEC / +0034ms",
  state: "ROUTE STABLE",
} as const;

const PRIMARY_FRAGMENT = {
  origin: "канал / release",
  body: "Решение зафиксировано.",
  time: "10:37",
} as const;

const MEMORY_TRACES = [
  "контекст удержан",
  "файл помнит решение",
  "смена входит без холода",
] as const;

const PROCESS_META = [
  { label: "Memory", value: "live" },
  { label: "Route", value: "stable" },
  { label: "Ingress", value: "142KB/s" },
] as const;

export function HeroOperationalStage({
  authMode,
  authPanel,
  onOpenAuth,
  onCloseAuth,
}: HeroOperationalStageProps) {
  if (authMode) {
    return (
      <div className="ec-hero-stage ec-hero-stage--auth" aria-label="Экран доступа">
        <Reveal className="ec-hero-stage__auth-head" variant="panel">
          <div>
            <span className="ec-hero-stage__auth-label">
              {authMode === "login" ? "точка доступа" : "запуск контура"}
            </span>
            <strong>
              {authMode === "login"
                ? "Вход в рабочий контур"
                : "Активация нового контура"}
            </strong>
          </div>
          <button
            type="button"
            className="ec-hero-stage__auth-close"
            onClick={onCloseAuth}
          >
            Обзор среды
          </button>
        </Reveal>
        <div className="ec-hero-stage__auth-body">{authPanel}</div>
      </div>
    );
  }

  return (
    <div className="ec-hero-stage" aria-label="Операционная сцена Eclipse Chat">
      <Reveal className="ec-hero-stage__trace" variant="fade">
        <span className="ec-hero-stage__trace-origin">{EXECUTION_TRACE.origin}</span>
        <span className="ec-hero-stage__trace-state">
          <SignalDot tone="active" />
          {EXECUTION_TRACE.state}
        </span>
      </Reveal>

      <Reveal className="ec-hero-stage__fragment" variant="panel" delay={120}>
        <header className="ec-hero-stage__fragment-meta">
          <span className="ec-hero-stage__fragment-origin">{PRIMARY_FRAGMENT.origin}</span>
          <span className="ec-hero-stage__fragment-time">{PRIMARY_FRAGMENT.time}</span>
        </header>
        <p className="ec-hero-stage__fragment-body">{PRIMARY_FRAGMENT.body}</p>
      </Reveal>

      <Reveal className="ec-hero-stage__memory" variant="panel" delay={200}>
        <span className="ec-hero-stage__memory-label">След остается</span>
        <ul className="ec-hero-stage__memory-list">
          {MEMORY_TRACES.map((trace, index) => (
            <li key={trace} style={revealDelay(index, 70)}>
              <span className="ec-hero-stage__memory-bar" aria-hidden />
              {trace}
            </li>
          ))}
        </ul>
      </Reveal>

      <Reveal className="ec-hero-stage__process" variant="fade" delay={280}>
        {PROCESS_META.map((meta, index) => (
          <span key={meta.label} className="ec-hero-stage__process-pair">
            <span className="ec-hero-stage__process-label">{meta.label}</span>
            <span className="ec-hero-stage__process-value">{meta.value}</span>
            {index < PROCESS_META.length - 1 && (
              <span className="ec-hero-stage__process-sep" aria-hidden>·</span>
            )}
          </span>
        ))}
      </Reveal>

      <div className="ec-hero-stage__mobile">
        <span className="ec-hero-stage__mobile-mono">
          {EXECUTION_TRACE.origin} · {EXECUTION_TRACE.state}
        </span>
        <button
          type="button"
          className="ec-hero-stage__mobile-cta"
          onClick={() => onOpenAuth("login")}
        >
          Открыть вход
        </button>
      </div>
    </div>
  );
}

/**
 * v1.3.2 slice C: MemoryConstellation остаётся как legacy slot если
 * parent передаёт visual через renderHeroStage (preview / dev mode).
 * Новый MemoryContinuumLayer не использует visual — он full-bleed
 * text-only continuity field.
 */
export function MemoryConstellation() {
  const MEMORY_NODES = [
    { label: "решения", className: "ec-memory-map__node--one" },
    { label: "задачи", className: "ec-memory-map__node--two" },
    { label: "файлы", className: "ec-memory-map__node--three" },
    { label: "обсуждения", className: "ec-memory-map__node--four" },
    { label: "участники", className: "ec-memory-map__node--five" },
    { label: "порталы", className: "ec-memory-map__node--six" },
  ] as const;
  return (
    <div className="ec-memory-map" aria-label="Слой памяти">
      <svg
        className="ec-memory-map__links"
        viewBox="0 0 980 360"
        preserveAspectRatio="none"
        aria-hidden
      >
        <path d="M40 186H940" />
        <path d="M118 124L420 186" />
        <path d="M228 268L420 186" />
        <path d="M560 186L786 114" />
        <path d="M558 186L846 262" />
        <path d="M420 186L560 186" />
      </svg>

      <Reveal className="ec-memory-map__spine" variant="panel">
        <span>memory / persistent</span>
        <strong>Система удерживает рабочее состояние целиком.</strong>
      </Reveal>

      {MEMORY_NODES.map((node, index) => (
        <Reveal
          key={node.label}
          className={`ec-memory-map__node ${node.className}`}
          variant="panel"
          delay={index * 80}
        >
          <SignalDot tone={index === 0 ? "active" : "signal"} />
          <span>{node.label}</span>
        </Reveal>
      ))}

      <Reveal className="ec-memory-map__anchor" variant="panel" delay={180}>
        <SignalDot tone="active" />
        <span>возврат без ресинхронизации</span>
      </Reveal>
    </div>
  );
}

/**
 * v1.3.2 slice C: SecurityStackArt не используется новым
 * SecurityAuthorityBlock (там dense numerical text-only). Pavel brief:
 * «infrastructure ownership, self-hosted sovereignty — NOT SaaS
 * security marketing». Lock-in-rack image — это SaaS-marketing trope.
 * Остаётся legacy slot.
 */
export function SecurityStackArt() {
  const SECURITY_LAYERS = [
    { label: "Контур приложений", status: "внутри среды" },
    { label: "Хранение и резерв", status: "под вашим слоем" },
    { label: "Каналы и доступ", status: "управляются локально" },
  ] as const;
  return (
    <div className="ec-security-stack" aria-label="Слой развёртывания">
      <div className="ec-security-stack__bay" aria-hidden>
        <div className="ec-security-stack__rack">
          <div className="ec-security-stack__unit ec-security-stack__unit--1" />
          <div className="ec-security-stack__unit ec-security-stack__unit--2" />
          <div className="ec-security-stack__unit ec-security-stack__unit--3" />
        </div>
      </div>

      <Reveal className="ec-security-stack__core" variant="panel">
        <span className="ec-security-stack__lock-shell">
          <svg viewBox="0 0 32 32" fill="none" aria-hidden>
            <rect x="8" y="14" width="16" height="10" rx="2" stroke="currentColor" strokeWidth="1.6" />
            <path d="M11 14v-2.5A5 5 0 0 1 16 6a5 5 0 0 1 5 5.5V14" stroke="currentColor" strokeWidth="1.6" />
          </svg>
        </span>
        <strong>Развертывание под вашим контролем</strong>
      </Reveal>

      <div className="ec-security-stack__manifest">
        {SECURITY_LAYERS.map((layer, index) => (
          <Reveal
            key={layer.label}
            className="ec-security-stack__manifest-row"
            variant="panel"
            delay={120 + index * 90}
          >
            <span>{layer.label}</span>
            <strong>{layer.status}</strong>
          </Reveal>
        ))}
      </div>
    </div>
  );
}
