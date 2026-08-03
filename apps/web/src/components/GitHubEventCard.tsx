import type { GitHubExternalEvent } from "../lib/socket";

type Props = { event: GitHubExternalEvent };

const KIND_LABEL: Record<GitHubExternalEvent["kind"], string> = {
  ping: "Подключение",
  push: "Commit",
  pull_request: "Pull request",
  issue: "Issue",
  workflow: "CI",
  release: "Release",
  deployment: "Deploy",
};

const STATUS_LABEL: Record<GitHubExternalEvent["status"], string> = {
  success: "Успешно",
  failure: "Требует внимания",
  pending: "В процессе",
  neutral: "Завершено",
};

export function GitHubEventCard({ event }: Props) {
  if (event.source !== "github" || event.verified !== true) return null;

  return (
    <article className={`ec-github-event ec-github-event--${event.status}`}>
      <div className="ec-github-event__rail" aria-hidden="true" />
      <div className="ec-github-event__body">
        <header className="ec-github-event__header">
          <span className="ec-github-event__source">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path fill="currentColor" d="M12 .7a11.5 11.5 0 0 0-3.64 22.4c.58.1.79-.25.79-.56v-2.23c-3.23.7-3.91-1.37-3.91-1.37-.53-1.34-1.29-1.7-1.29-1.7-1.05-.72.08-.71.08-.71 1.16.08 1.78 1.2 1.78 1.2 1.04 1.77 2.72 1.26 3.38.96.1-.75.4-1.26.74-1.55-2.58-.29-5.29-1.29-5.29-5.68 0-1.25.45-2.28 1.19-3.08-.12-.3-.52-1.47.11-3.04 0 0 .97-.31 3.16 1.18a10.9 10.9 0 0 1 5.76 0c2.2-1.49 3.16-1.18 3.16-1.18.63 1.57.23 2.74.11 3.04.74.8 1.19 1.83 1.19 3.08 0 4.4-2.72 5.38-5.3 5.67.42.36.79 1.07.79 2.16v3.2c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .7Z" />
            </svg>
            GitHub · подтверждено
          </span>
          <span className={`ec-github-event__status ec-github-event__status--${event.status}`}>
            {STATUS_LABEL[event.status]}
          </span>
        </header>

        <div className="ec-github-event__meta">
          <span>{KIND_LABEL[event.kind]}</span>
          <span>{event.repository}</span>
          {event.ref && <code>{event.ref}</code>}
        </div>
        <h4>{event.title}</h4>
        <p>{event.summary}</p>

        {event.details.length > 0 && (
          <dl className="ec-github-event__details">
            {event.details.map((detail) => (
              <div key={`${detail.label}:${detail.value}`}>
                <dt>{detail.label}</dt>
                <dd>{detail.value}</dd>
              </div>
            ))}
          </dl>
        )}

        <footer>
          <span>{event.actor ? `Инициатор: ${event.actor}` : "Событие GitHub"}</span>
          <a href={event.sourceUrl} target="_blank" rel="noreferrer noopener">
            Открыть источник
            <span aria-hidden="true"> ↗</span>
          </a>
        </footer>
      </div>
    </article>
  );
}
