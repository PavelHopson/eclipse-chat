import type { CSSProperties, ReactNode } from "react";
import { Avatar } from "../Avatar";
import {
  useProjectPassport,
  type ProjectPassportAction,
  type ProjectPassportData,
} from "../../hooks/useProjectPassport";
import { resolveAssetUrl } from "../../lib/assets";

type Props = {
  serverId: string;
  onOpenChannel: (channelId: string) => void;
  onOpenAction: (actionItemId: string, channelId: string) => void;
};

const HEALTH_LABELS: Record<ProjectPassportData["project"]["health"]["state"], string> = {
  BLOCKED: "Требует решения",
  AT_RISK: "Под наблюдением",
  ON_TRACK: "В рабочем ритме",
  QUIET: "Ожидает запуска",
};
const ROLE_LABELS: Record<string, string> = {
  OWNER: "Владелец",
  ADMIN: "Администратор",
  ARCHITECT: "Архитектор",
  OPERATOR: "Оператор",
};
const TYPE_LABELS: Record<ProjectPassportAction["type"], string> = {
  TASK: "Задача",
  DECISION: "Решение",
  FOLLOW_UP: "Контроль",
  RISK: "Риск",
  REQUIREMENT: "Требование",
};
const STATUS_LABELS: Record<ProjectPassportAction["status"], string> = {
  OPEN: "Открыто",
  IN_PROGRESS: "В работе",
  REVIEW: "На проверке",
  DONE: "Завершено",
};

function Icon({ name, size = 16 }: { name: "pulse" | "work" | "decision" | "room" | "repo" | "doc" | "people" | "refresh" | "arrow"; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  if (name === "pulse") return <svg {...common}><path d="M3 12h4l2.2-6 4.2 12 2.2-6H21" /></svg>;
  if (name === "work") return <svg {...common}><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M9 5V3h6v2M4 10h16" /></svg>;
  if (name === "decision") return <svg {...common}><path d="M12 3v18M12 7H7a3 3 0 0 0-3 3v1M12 12h5a3 3 0 0 1 3 3v1" /><path d="m2 9 2 2 2-2M18 14l2 2 2-2" /></svg>;
  if (name === "room") return <svg {...common}><path d="M5 5h14v11H9l-4 4V5Z" /></svg>;
  if (name === "repo") return <svg {...common}><path d="M4 4h12a2 2 0 0 1 2 2v14H6a2 2 0 0 1-2-2V4Z" /><path d="M8 8h6M8 12h6M6 20a2 2 0 0 1 2-2h10" /></svg>;
  if (name === "doc") return <svg {...common}><path d="M6 3h8l4 4v14H6V3Z" /><path d="M14 3v5h5M9 13h6M9 17h5" /></svg>;
  if (name === "people") return <svg {...common}><circle cx="9" cy="8" r="3" /><path d="M3 20v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6M17 14a5 5 0 0 1 4 4v2" /></svg>;
  if (name === "refresh") return <svg {...common}><path d="M20 7v5h-5M4 17v-5h5" /><path d="M6.1 8a7 7 0 0 1 11.7-2.2L20 8M4 16l2.2 2.2A7 7 0 0 0 17.9 16" /></svg>;
  return <svg {...common}><path d="M5 12h14M14 7l5 5-5 5" /></svg>;
}

function formatDate(value: string | null): string {
  if (!value) return "Нет активности";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Дата неизвестна";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function Section({
  icon,
  title,
  meta,
  children,
  className = "",
}: {
  icon: Parameters<typeof Icon>[0]["name"];
  title: string;
  meta?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`ec-project-passport__section ${className}`}>
      <header className="ec-project-passport__section-head">
        <span className="ec-project-passport__section-icon"><Icon name={icon} /></span>
        <div>
          <h3>{title}</h3>
          {meta && <p>{meta}</p>}
        </div>
      </header>
      {children}
    </section>
  );
}

function EmptyLine({ children }: { children: ReactNode }) {
  return <p className="ec-project-passport__empty">{children}</p>;
}

function ActionRow({
  action,
  onOpen,
}: {
  action: ProjectPassportAction;
  onOpen: () => void;
}) {
  const overdue = action.dueAt && new Date(action.dueAt) < new Date() && action.status !== "DONE";
  return (
    <button type="button" className="ec-project-passport__action" onClick={onOpen}>
      <span className={`ec-project-passport__signal ec-project-passport__signal--${action.priority.toLowerCase()}`} aria-hidden />
      <span className="ec-project-passport__action-copy">
        <strong>{action.title}</strong>
        <span>
          {TYPE_LABELS[action.type]} · #{action.channelName} · {STATUS_LABELS[action.status]}
          {overdue ? " · Просрочено" : ""}
        </span>
      </span>
      <Icon name="arrow" />
    </button>
  );
}

function LoadingPassport() {
  return (
    <div className="ec-project-passport ec-project-passport--loading" aria-live="polite" aria-busy="true">
      <span className="ec-project-passport__sr-only">Собираем паспорт проекта</span>
      <div className="ec-project-passport__skeleton ec-project-passport__skeleton--hero" />
      <div className="ec-project-passport__skeleton-grid">
        <div className="ec-project-passport__skeleton" />
        <div className="ec-project-passport__skeleton" />
      </div>
    </div>
  );
}

export function ProjectPassportView({ serverId, onOpenChannel, onOpenAction }: Props) {
  const { data, loading, error, reload } = useProjectPassport(serverId);

  if (loading && !data) return <LoadingPassport />;
  if (error && !data) {
    return (
      <div className="ec-project-passport__error" role="alert">
        <span className="ec-project-passport__section-icon"><Icon name="pulse" /></span>
        <div>
          <strong>Паспорт проекта временно недоступен</strong>
          <p>{error}</p>
        </div>
        <button type="button" className="ec-btn ec-btn--primary" onClick={() => void reload()}>
          Повторить загрузку
        </button>
      </div>
    );
  }
  if (!data) return null;

  const bannerUrl = resolveAssetUrl(data.project.banner);
  const heroStyle = bannerUrl
    ? ({ "--ec-passport-banner": `url("${bannerUrl.replace(/"/g, "%22")}")` } as CSSProperties)
    : undefined;
  const currentWork = [...data.risks, ...data.work].slice(0, 6);

  const primaryAction = data.nextAction.kind === "DEPLOY" && data.nextAction.sourceUrl ? (
    <a className="ec-btn ec-btn--primary ec-project-passport__primary" href={data.nextAction.sourceUrl} target="_blank" rel="noreferrer">
      {data.nextAction.label}<Icon name="arrow" />
    </a>
  ) : (
    <button
      type="button"
      className="ec-btn ec-btn--primary ec-project-passport__primary"
      disabled={data.nextAction.kind === "NONE"}
      onClick={() => {
        if (data.nextAction.kind === "ACTION" && data.nextAction.actionItemId && data.nextAction.channelId) {
          onOpenAction(data.nextAction.actionItemId, data.nextAction.channelId);
        } else if (data.nextAction.kind === "ROOM" && data.nextAction.channelId) {
          onOpenChannel(data.nextAction.channelId);
        }
      }}
    >
      {data.nextAction.label}<Icon name="arrow" />
    </button>
  );

  return (
    <div className="ec-project-passport">
      <header className="ec-project-passport__hero" style={heroStyle}>
        <div className="ec-project-passport__hero-signal">
          <span className={`ec-project-passport__health-dot ec-project-passport__health-dot--${data.project.health.state.toLowerCase()}`} aria-hidden />
          <span>{HEALTH_LABELS[data.project.health.state]}</span>
        </div>
        <div className="ec-project-passport__hero-main">
          <div>
            <span className="ec-project-passport__eyebrow">Project Passport</span>
            <h2>{data.project.name}</h2>
            <p>{data.project.description ?? data.project.health.reason}</p>
          </div>
          {primaryAction}
        </div>
        <div className="ec-project-passport__metrics" aria-label="Сводка проекта">
          <span><strong>{data.counts.openWork}</strong> в работе</span>
          <span><strong>{data.counts.activeRisks}</strong> рисков</span>
          <span><strong>{data.counts.decisions}</strong> решений</span>
          <span><strong>{data.counts.repositories}</strong> репозиториев</span>
          <button type="button" className="ec-project-passport__refresh" onClick={() => void reload()} disabled={loading} aria-label="Обновить паспорт проекта" title="Обновить данные">
            <Icon name="refresh" />
          </button>
        </div>
      </header>

      {error && <div className="ec-project-passport__stale" role="status">Показаны последние данные. Обновление не удалось.</div>}

      <div className="ec-project-passport__layout">
        <div className="ec-project-passport__main-column">
          <Section icon="pulse" title="Сейчас" meta={data.project.health.reason}>
            <div className="ec-project-passport__list">
              {currentWork.length > 0 ? currentWork.map((action) => (
                <ActionRow key={action.id} action={action} onOpen={() => onOpenAction(action.id, action.channelId)} />
              )) : <EmptyLine>Нет активных задач и рисков. Паспорт обновится, когда команда зафиксирует работу из сообщения.</EmptyLine>}
            </div>
          </Section>

          <Section icon="decision" title="Решения" meta="Последние зафиксированные договорённости">
            <div className="ec-project-passport__timeline">
              {data.decisions.length > 0 ? data.decisions.slice(0, 5).map((decision) => (
                <button key={decision.id} type="button" onClick={() => onOpenAction(decision.id, decision.channelId)}>
                  <span aria-hidden />
                  <strong>{decision.title}</strong>
                  <small>#{decision.channelName} · {formatDate(decision.updatedAt)}</small>
                </button>
              )) : <EmptyLine>Решений пока нет. Превратите ключевое сообщение в «Решение», чтобы оно не потерялось.</EmptyLine>}
            </div>
          </Section>

          <Section icon="room" title="Рабочие комнаты" meta="Контекст, активность и открытая работа">
            <div className="ec-project-passport__rooms">
              {data.rooms.length > 0 ? data.rooms.slice(0, 8).map((room) => (
                <button key={room.id} type="button" onClick={() => onOpenChannel(room.id)}>
                  <span className="ec-project-passport__room-mark"><Icon name="room" /></span>
                  <span className="ec-project-passport__room-copy">
                    <strong>#{room.name}</strong>
                    <small>{room.description ?? formatDate(room.lastActivityAt)}</small>
                  </span>
                  <span className="ec-project-passport__room-stats">
                    {room.activeRisks > 0 && <b>{room.activeRisks} риск.</b>}
                    <span>{room.activeWork} в работе</span>
                  </span>
                </button>
              )) : <EmptyLine>Доступных рабочих комнат пока нет.</EmptyLine>}
            </div>
          </Section>
        </div>

        <aside className="ec-project-passport__side-column">
          <Section icon="people" title="Ответственные">
            <div className="ec-project-passport__people">
              {data.responsibles.length > 0 ? data.responsibles.map((person) => (
                <div key={person.id}>
                  <Avatar url={person.avatar} name={person.displayName} size={30} />
                  <span><strong>{person.displayName}</strong><small>{ROLE_LABELS[person.role] ?? person.role}</small></span>
                </div>
              )) : <EmptyLine>Ответственные не назначены.</EmptyLine>}
            </div>
          </Section>

          <Section icon="repo" title="Репозитории" meta="Проверенные GitHub integrations">
            <div className="ec-project-passport__sources">
              {data.repositories.length > 0 ? data.repositories.map((repository) => (
                <a key={repository.integrationId} href={repository.sourceUrl} target="_blank" rel="noreferrer">
                  <span className={`ec-project-passport__source-state ${repository.enabled ? "is-active" : ""}`} aria-hidden />
                  <span><strong>{repository.repository}</strong><small>#{repository.channelName} · {repository.eventCount} событий</small></span>
                  <Icon name="arrow" />
                </a>
              )) : <EmptyLine>GitHub ещё не связан с доступными комнатами.</EmptyLine>}
            </div>
          </Section>

          <Section icon="pulse" title="Deploy signal" meta="Последние workflow, release и deployment">
            <div className="ec-project-passport__deploys">
              {data.deploys.length > 0 ? data.deploys.slice(0, 5).map((deploy) => (
                <a key={deploy.messageId} href={deploy.sourceUrl} target="_blank" rel="noreferrer">
                  <span className={`ec-project-passport__deploy-status ec-project-passport__deploy-status--${deploy.status}`} aria-hidden />
                  <span><strong>{deploy.title}</strong><small>{deploy.repository} · {formatDate(deploy.occurredAt)}</small></span>
                </a>
              )) : <EmptyLine>Deploy-событий пока нет.</EmptyLine>}
            </div>
          </Section>

          <Section icon="doc" title="Документы" meta="Ссылки и curated memory проекта">
            <div className="ec-project-passport__documents">
              {data.documents.length > 0 ? data.documents.slice(0, 6).map((document) => {
                const body = <><span><strong>{document.title}</strong><small>{document.channelName ? `#${document.channelName}` : "Всё пространство"}{document.reviewDue ? " · Нужна проверка" : ""}</small></span><Icon name="arrow" /></>;
                return document.sourceUrl ? (
                  <a key={document.id} href={document.sourceUrl} target="_blank" rel="noreferrer">{body}</a>
                ) : (
                  <button key={document.id} type="button" disabled={!document.channelId} onClick={() => document.channelId && onOpenChannel(document.channelId)}>{body}</button>
                );
              }) : <EmptyLine>Добавьте ссылку в память комнаты с тегом docs или runbook.</EmptyLine>}
            </div>
          </Section>
        </aside>
      </div>
    </div>
  );
}
