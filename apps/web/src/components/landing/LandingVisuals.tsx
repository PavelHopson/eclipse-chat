import type { ReactNode } from "react";
import { Reveal, revealDelay } from "./CinematicMotion";

type AuthMode = "login" | "register" | null;

type HeroOperationalStageProps = {
  authMode: AuthMode;
  authPanel: ReactNode;
  onOpenAuth: (mode: "login" | "register") => void;
  onCloseAuth: () => void;
};

/**
 * v1.3.4 — premium SaaS hero stage per Pavel reference HTML brief.
 * Full 3-col product UI console mockup matching reference visual.
 *
 * Class naming: `ec-hero-console*` (paired с landing.css).
 *
 *   - Rail (left, 180px): «Контур» label + 4 nav items (active row)
 *   - Main (center, 1fr): topline + 3 cards (system summary с progress,
 *     message from Мария с file, message from Иван с voice waveform)
 *   - Side (right, 190px): «Панель оператора» + dial + status list
 *
 *   Auth mode: rail сохраняется, main+side замeняются auth-dock'ом
 *   (grid-column: 2/-1).
 */

const RAIL_ITEMS = [
  { label: "Общий контур", active: true },
  { label: "Разработка", active: false },
  { label: "Поддержка", active: false },
  { label: "Клиентский портал", active: false },
] as const;

const STATUS_ITEMS = [
  { label: "AI Gateway", state: "Online" },
  { label: "База данных", state: "Online" },
  { label: "Файловое хранилище", state: "Online" },
] as const;

export function HeroOperationalStage({
  authMode,
  authPanel,
  onOpenAuth,
  onCloseAuth,
}: HeroOperationalStageProps) {
  return (
    <div
      className={`ec-hero-console${authMode ? " ec-hero-console--auth-open" : ""}`}
      aria-label="Операционная сцена Eclipse Chat"
    >
      <div className="ec-hero-console__surface">
        <aside className="ec-hero-console__rail" aria-label="Разделы">
          <span className="ec-hero-console__rail-label">Контур</span>
          <ul className="ec-hero-console__rail-list">
            {RAIL_ITEMS.map((item, index) => (
              <li
                key={item.label}
                className={item.active ? "is-active" : undefined}
                style={revealDelay(index, 60)}
              >
                <button type="button">{item.label}</button>
              </li>
            ))}
          </ul>
        </aside>

        {authMode ? (
          <section className="ec-hero-console__auth" aria-label="Экран доступа">
            <Reveal className="ec-hero-console__auth-head" variant="panel">
              <div>
                <span className="ec-hero-console__auth-label">
                  {authMode === "login" ? "Точка доступа" : "Активация контура"}
                </span>
                <strong>
                  {authMode === "login"
                    ? "Вход в рабочий контур"
                    : "Регистрация команды"}
                </strong>
              </div>
              <button
                type="button"
                className="ec-hero-console__auth-close"
                onClick={onCloseAuth}
              >
                Обзор среды
              </button>
            </Reveal>
            <div className="ec-hero-console__auth-body">{authPanel}</div>
          </section>
        ) : (
          <>
            <main className="ec-hero-console__main">
              <div className="ec-hero-console__topline">
                <span># Общий-контур</span>
                <span>24 участника · 10 online</span>
              </div>

              <Reveal className="ec-hero-console__card" variant="panel" delay={80}>
                <span className="ec-hero-console__card-label">Система · 10:34</span>
                <strong>Операционная сводка за сегодня</strong>
                <div className="ec-hero-console__progress">
                  <span className="ec-hero-console__progress-bar" />
                </div>
                <p className="ec-hero-console__card-body">Задачи выполнены 18 / 24</p>
              </Reveal>

              <Reveal
                className="ec-hero-console__card ec-hero-console__msg"
                variant="panel"
                delay={140}
              >
                <span className="ec-hero-console__avatar" aria-hidden />
                <div className="ec-hero-console__msg-content">
                  <strong>Мария · 10:27</strong>
                  <p>Подготовила обновление по проекту.</p>
                  <span className="ec-hero-console__file">▣ update_v2.pdf · 2.4MB</span>
                </div>
              </Reveal>

              <Reveal
                className="ec-hero-console__card ec-hero-console__msg"
                variant="panel"
                delay={200}
              >
                <span className="ec-hero-console__avatar" aria-hidden />
                <div className="ec-hero-console__msg-content">
                  <strong>Иван · 11:01</strong>
                  <p>Подключился к голосовому каналу.</p>
                  <span className="ec-hero-console__wave" aria-hidden>
                    {Array.from({ length: 9 }).map((_, i) => (
                      <i key={i} />
                    ))}
                  </span>
                </div>
              </Reveal>
            </main>

            <aside className="ec-hero-console__side" aria-label="Панель оператора">
              <span className="ec-hero-console__side-label">Панель оператора</span>
              <div className="ec-hero-console__dial" aria-hidden />
              <div className="ec-hero-console__status">
                Статус системы
                <br />
                <span className="ec-hero-console__status-online">Все системы активны</span>
                <br />
                <br />
                {STATUS_ITEMS.map((item, index) => (
                  <span key={item.label}>
                    {item.label} —{" "}
                    <span className="ec-hero-console__status-online">{item.state}</span>
                    {index < STATUS_ITEMS.length - 1 && <br />}
                  </span>
                ))}
              </div>
            </aside>
          </>
        )}
      </div>

      <div className="ec-hero-console__mobile" aria-hidden>
        <button
          type="button"
          className="ec-landing-btn ec-landing-btn--primary"
          onClick={() => onOpenAuth("login")}
        >
          Открыть вход
        </button>
      </div>
    </div>
  );
}

/**
 * MemoryConstellation — AI Memory visual diagram per reference brief.
 * Central core 108px с «AI» mono + 2 elliptical orbits + 6 floating nodes.
 */
export function MemoryConstellation() {
  const MEMORY_NODES = [
    { label: "Решения", className: "ec-memory-map__node--one" },
    { label: "Документы", className: "ec-memory-map__node--two" },
    { label: "Задачи", className: "ec-memory-map__node--three" },
    { label: "Обсуждения", className: "ec-memory-map__node--four" },
    { label: "Файлы", className: "ec-memory-map__node--five" },
    { label: "Участники", className: "ec-memory-map__node--six" },
  ] as const;
  return (
    <div className="ec-memory-map" aria-label="AI Memory — карта контекста">
      <div className="ec-memory-map__orbit ec-memory-map__orbit--two" aria-hidden />
      <div className="ec-memory-map__orbit ec-memory-map__orbit--one" aria-hidden />

      <Reveal className="ec-memory-map__core" variant="panel">
        <span className="ec-memory-map__core-shell" aria-hidden>AI</span>
        <strong>Memory</strong>
        <span className="ec-memory-map__core-meta">persistent context</span>
      </Reveal>

      {MEMORY_NODES.map((node, index) => (
        <Reveal
          key={node.label}
          className={`ec-memory-map__node ${node.className}`}
          variant="panel"
          delay={index * 80}
        >
          {node.label}
        </Reveal>
      ))}
    </div>
  );
}

/**
 * SecurityStackArt — security visual anchor per reference brief.
 * 3D rotated cube (rotateX 55deg / rotateZ 45deg) с nested rings.
 */
export function SecurityStackArt() {
  return (
    <div className="ec-security-stack" aria-label="Архитектура безопасности">
      <div className="ec-security-stack__cube" aria-hidden />
    </div>
  );
}
