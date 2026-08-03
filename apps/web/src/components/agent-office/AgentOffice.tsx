import { useMemo, useState } from "react";
import {
  growthPilotFixture,
  type RunStatus,
} from "./agentOfficeFixture";

type EventRow = {
  id: string;
  label: string;
  detail: string;
  tone: "neutral" | "active" | "success" | "danger";
};

const statusLabels: Record<RunStatus, string> = {
  PLANNED: "План готов",
  RUNNING: "Demo выполняется",
  PAUSED: "На паузе",
  COMPLETED: "Artifact готов",
  CANCELLED: "Остановлено",
};

function AgentOfficeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="5" r="2.25" />
      <circle cx="5" cy="17" r="2.25" />
      <circle cx="19" cy="17" r="2.25" />
      <path d="M12 7.25v4.25M10.25 12.5 6.6 15M13.75 12.5 17.4 15" />
    </svg>
  );
}

export function AgentOffice() {
  const fixture = growthPilotFixture;
  const [status, setStatus] = useState<RunStatus>("PLANNED");
  const [activeStep, setActiveStep] = useState(0);
  const [events, setEvents] = useState<EventRow[]>([
    {
      id: "event:plan",
      label: "Plan reviewed",
      detail: "4 роли · 4 шага · 0 внешних действий",
      tone: "neutral",
    },
  ]);
  const [refocusOpen, setRefocusOpen] = useState(false);
  const [operatorNote, setOperatorNote] = useState(
    "Сохранять только claims, подтверждённые публичным источником.",
  );

  const progress = useMemo(() => {
    if (status === "COMPLETED") return 100;
    if (status === "PLANNED" || status === "CANCELLED") return 0;
    return Math.round((activeStep / fixture.steps.length) * 100);
  }, [activeStep, fixture.steps.length, status]);

  const appendEvent = (event: EventRow) => {
    setEvents((current) => [...current, event]);
  };

  const startDemo = () => {
    setStatus("RUNNING");
    appendEvent({
      id: "event:start",
      label: "Fixture started",
      detail: "Локальная UI-симуляция. AI, сеть и budget не используются.",
      tone: "active",
    });
  };

  const advanceDemo = () => {
    const step = fixture.steps[activeStep];
    if (!step) return;
    appendEvent({
      id: `event:${step.id}`,
      label: step.title,
      detail: step.result,
      tone: "success",
    });
    const nextStep = activeStep + 1;
    setActiveStep(nextStep);
    if (nextStep === fixture.steps.length) {
      setStatus("COMPLETED");
      appendEvent({
        id: "event:artifact",
        label: "Artifact prepared",
        detail: "Growth pilot brief доступен только для внутреннего review.",
        tone: "success",
      });
    }
  };

  const pauseDemo = () => {
    setStatus("PAUSED");
    appendEvent({
      id: `event:pause:${events.length}`,
      label: "Paused by operator",
      detail: "Состояние сохранено; следующий шаг не выполняется.",
      tone: "neutral",
    });
  };

  const resumeDemo = () => {
    setStatus("RUNNING");
    appendEvent({
      id: `event:resume:${events.length}`,
      label: "Resumed by operator",
      detail: "Demo продолжено с текущего шага.",
      tone: "active",
    });
  };

  const stopDemo = () => {
    setStatus("CANCELLED");
    appendEvent({
      id: `event:stop:${events.length}`,
      label: "Stopped by operator",
      detail: "Незавершённый fixture-run остановлен без внешних последствий.",
      tone: "danger",
    });
  };

  const applyRefocus = () => {
    const note = operatorNote.trim();
    if (!note) return;
    appendEvent({
      id: `event:refocus:${events.length}`,
      label: "Operator refocus",
      detail: note,
      tone: "active",
    });
    setRefocusOpen(false);
  };

  const resetDemo = () => {
    setStatus("PLANNED");
    setActiveStep(0);
    setRefocusOpen(false);
    setEvents([
      {
        id: "event:plan",
        label: "Plan reviewed",
        detail: "4 роли · 4 шага · 0 внешних действий",
        tone: "neutral",
      },
    ]);
  };

  return (
    <main className="ec-agent-office" aria-labelledby="agent-office-title">
      <header className="ec-agent-office__header">
        <div className="ec-agent-office__identity">
          <span className="ec-agent-office__mark"><AgentOfficeIcon /></span>
          <div>
            <p className="ec-agent-office__eyebrow">Eclipse Forge OS</p>
            <h1 id="agent-office-title">Agent Office</h1>
            <p>Наблюдаемая работа AI-команды с plan review, budget и ручным контролем.</p>
          </div>
        </div>
        <div className="ec-agent-office__run-meta">
          <span className="ec-agent-office__contract">{fixture.contractVersion}</span>
          <span className="ec-agent-office__status" data-status={status}>{statusLabels[status]}</span>
        </div>
      </header>

      <section className="ec-agent-office__fixture-note" aria-label="Ограничения демо">
        <strong>Fixture demo</strong>
        <span>Никаких model calls, OAuth, публикаций, платежей или production-действий.</span>
      </section>

      <div className="ec-agent-office__workspace">
        <section className="ec-agent-office__primary" aria-label="Текущий запуск">
          <div className="ec-agent-office__objective">
            <div>
              <p className="ec-agent-office__section-label">Objective</p>
              <h2>{fixture.objective}</h2>
            </div>
            <div className="ec-agent-office__progress" aria-label={`Прогресс ${progress}%`}>
              <span>{progress}%</span>
              <div><i style={{ width: `${progress}%` }} /></div>
            </div>
          </div>

          <dl className="ec-agent-office__guardrails">
            <div><dt>Источники</dt><dd>{fixture.policy.sourceBoundary}</dd></div>
            <div><dt>Personal data</dt><dd>{fixture.policy.personalData}</dd></div>
            <div><dt>Connected apps</dt><dd>{fixture.policy.connectedApps}</dd></div>
            <div><dt>Budget cap</dt><dd>${fixture.budget.maxCostUsd} · {fixture.budget.maxDurationMinutes} min · {fixture.budget.maxExternalActions} actions</dd></div>
          </dl>

          <div className="ec-agent-office__team-head">
            <div>
              <p className="ec-agent-office__section-label">Team</p>
              <h2>Growth Research Cell</h2>
            </div>
            <span>{fixture.agents.length} agents</span>
          </div>

          <div className="ec-agent-office__agents">
            {fixture.agents.map((agent, index) => {
              const isDone = activeStep > index || status === "COMPLETED";
              const isActive = activeStep === index && (status === "RUNNING" || status === "PAUSED");
              const agentState = isDone ? "done" : isActive ? status === "PAUSED" ? "paused" : "working" : "queued";
              return (
                <article className="ec-agent-office__agent" key={agent.id} data-state={agentState}>
                  <span className="ec-agent-office__agent-index">{String(index + 1).padStart(2, "0")}</span>
                  <div>
                    <h3>{agent.name}</h3>
                    <p>{agent.role}</p>
                  </div>
                  <span className="ec-agent-office__agent-state">
                    {agentState === "done" ? "Done" : agentState === "working" ? "Working" : agentState === "paused" ? "Paused" : "Queued"}
                  </span>
                </article>
              );
            })}
          </div>

          <section className="ec-agent-office__activity" aria-labelledby="agent-activity-title">
            <div className="ec-agent-office__team-head">
              <div>
                <p className="ec-agent-office__section-label">Audit stream</p>
                <h2 id="agent-activity-title">Что произошло</h2>
              </div>
              <span aria-live="polite">{events.length} events</span>
            </div>
            <ol>
              {events.map((event) => (
                <li key={event.id} data-tone={event.tone}>
                  <span aria-hidden />
                  <div><strong>{event.label}</strong><p>{event.detail}</p></div>
                </li>
              ))}
            </ol>
          </section>
        </section>

        <aside className="ec-agent-office__side" aria-label="Run controls">
          <section>
            <p className="ec-agent-office__section-label">Operator controls</p>
            <h2>Run control</h2>
            <p className="ec-agent-office__side-copy">Каждый переход выполняется вручную. Автозапуск и auto-approval отключены.</p>

            <div className="ec-agent-office__controls">
              {status === "PLANNED" && <button type="button" className="is-primary" onClick={startDemo}>Запустить fixture demo</button>}
              {status === "RUNNING" && (
                <>
                  <button type="button" className="is-primary" onClick={advanceDemo}>Завершить текущий demo-шаг</button>
                  <button type="button" onClick={pauseDemo}>Пауза</button>
                  <button type="button" onClick={() => setRefocusOpen((value) => !value)}>Скорректировать</button>
                  <button type="button" className="is-danger" onClick={stopDemo}>Остановить</button>
                </>
              )}
              {status === "PAUSED" && (
                <>
                  <button type="button" className="is-primary" onClick={resumeDemo}>Продолжить</button>
                  <button type="button" onClick={() => setRefocusOpen((value) => !value)}>Скорректировать</button>
                  <button type="button" className="is-danger" onClick={stopDemo}>Остановить</button>
                </>
              )}
              {(status === "COMPLETED" || status === "CANCELLED") && <button type="button" onClick={resetDemo}>Сбросить demo</button>}
            </div>

            {refocusOpen && (
              <div className="ec-agent-office__refocus">
                <label htmlFor="agent-office-refocus">Инструкция оператору</label>
                <textarea id="agent-office-refocus" value={operatorNote} maxLength={500} onChange={(event) => setOperatorNote(event.target.value)} />
                <div>
                  <button type="button" onClick={() => setRefocusOpen(false)}>Отмена</button>
                  <button type="button" className="is-primary" disabled={!operatorNote.trim()} onClick={applyRefocus}>Применить</button>
                </div>
              </div>
            )}
          </section>

          <section>
            <p className="ec-agent-office__section-label">Success criteria</p>
            <ul className="ec-agent-office__criteria">
              {fixture.successCriteria.map((criterion) => <li key={criterion}>{criterion}</li>)}
            </ul>
          </section>

          <section className="ec-agent-office__artifact" data-ready={status === "COMPLETED"}>
            <p className="ec-agent-office__section-label">Artifact</p>
            <h2>Growth pilot brief</h2>
            <p>{status === "COMPLETED" ? "Готов к внутреннему review. Внешняя публикация недоступна." : "Появится после завершения четырёх demo-шагов."}</p>
            <button type="button" disabled={status !== "COMPLETED"}>Открыть review</button>
          </section>
        </aside>
      </div>
    </main>
  );
}
