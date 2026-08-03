import type { CSSProperties } from "react";
import type {
  PersonalDigest,
  PersonalDigestChannel,
  PersonalDigestItem,
  PersonalDigestKind,
} from "../hooks/usePersonalDigest";

type Props = {
  data: PersonalDigest | null;
  loading: boolean;
  acknowledging: boolean;
  error: string | null;
  onReload: () => void;
  onAcknowledge: () => void;
  onOpenItem: (item: PersonalDigestItem) => void;
  onOpenChannel: (channel: PersonalDigestChannel) => void;
};

const KIND_LABEL: Record<PersonalDigestKind, string> = {
  INCIDENT: "Инцидент",
  RISK: "Риск",
  APPROVAL: "Нужно решение",
  DECISION: "Решение",
  TASK: "Задача",
  FOLLOW_UP: "Контроль",
  REQUIREMENT: "Требование",
  MEMORY: "Память",
  ROOM_ACTIVITY: "Новые сообщения",
};

function hasActivity(data: PersonalDigest | null): boolean {
  if (!data) return false;
  return Object.values(data.totals).some((value) => value > 0);
}

function relativeWindow(iso: string): string {
  const milliseconds = Math.max(0, Date.now() - new Date(iso).getTime());
  const hours = Math.floor(milliseconds / 3_600_000);
  if (hours < 1) return "за последний час";
  if (hours < 24) return `за последние ${hours} ч`;
  const days = Math.max(1, Math.floor(hours / 24));
  return days === 1 ? "за последние сутки" : `за последние ${days} дн.`;
}

function relativeTime(iso: string): string {
  const milliseconds = Math.max(0, Date.now() - new Date(iso).getTime());
  const minutes = Math.floor(milliseconds / 60_000);
  if (minutes < 1) return "сейчас";
  if (minutes < 60) return `${minutes} мин`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ч`;
  return `${Math.floor(hours / 24)} дн.`;
}

function DigestGlyph({ kind }: { kind: PersonalDigestKind }) {
  if (kind === "INCIDENT" || kind === "RISK") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden>
        <path d="M12 3 2.8 20h18.4L12 3Z" />
        <path d="M12 9v5M12 17.5h.01" />
      </svg>
    );
  }
  if (kind === "APPROVAL" || kind === "DECISION") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden>
        <path d="M5 12.5 9.2 17 19 7" />
      </svg>
    );
  }
  if (kind === "TASK" || kind === "FOLLOW_UP" || kind === "REQUIREMENT") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden>
        <rect x="4" y="4" width="16" height="16" rx="3" />
        <path d="M8 12.5 10.5 15 16 9" />
      </svg>
    );
  }
  if (kind === "MEMORY") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden>
        <path d="M8 6.5A3.5 3.5 0 0 1 14.3 4a3.6 3.6 0 0 1 3.2 5.2A3.5 3.5 0 0 1 16 16H8a4 4 0 0 1 0-8c0-.5 0-1 .1-1.5Z" />
        <path d="M9 12h6M12 9v6" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M20 15a2 2 0 0 1-2 2H8l-4 3V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9Z" />
    </svg>
  );
}

function Stat({ value, label, tone }: { value: number; label: string; tone?: string }) {
  return (
    <div className="ec-personal-digest__stat" style={tone ? { "--digest-tone": tone } as CSSProperties : undefined}>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

export function CommandDigestView({
  data,
  loading,
  acknowledging,
  error,
  onReload,
  onAcknowledge,
  onOpenItem,
  onOpenChannel,
}: Props) {
  const active = hasActivity(data);

  return (
    <main className="ec-personal-digest" aria-labelledby="personal-digest-title">
      <header className="ec-personal-digest__hero">
        <div>
          <span className="ec-personal-digest__eyebrow">Command brief</span>
          <h1 id="personal-digest-title">Пока тебя не было</h1>
          <p>
            {data ? relativeWindow(data.since) : "Важное из доступных пространств"}
            {data?.truncated ? " · показаны последние 30 дней" : ""}
          </p>
        </div>
        <div className="ec-personal-digest__hero-actions">
          <button type="button" className="ec-btn ec-btn--sm" onClick={onReload} disabled={loading}>
            {loading ? "Обновляю…" : "Обновить сводку"}
          </button>
          {active && (
            <button
              type="button"
              className="ec-btn ec-btn--primary ec-btn--sm"
              onClick={onAcknowledge}
              disabled={acknowledging}
            >
              {acknowledging ? "Сохраняю…" : "Отметить события просмотренными"}
            </button>
          )}
        </div>
      </header>

      {error && (
        <div className="ec-personal-digest__error" role="alert">
          <span>{error}</span>
          <button type="button" onClick={onReload}>Повторить</button>
        </div>
      )}

      {loading && !data ? (
        <div className="ec-personal-digest__loading" aria-live="polite">
          <span className="ec-personal-digest__loading-orbit" aria-hidden />
          <strong>Собираю только доступные тебе события…</strong>
        </div>
      ) : !data || !active ? (
        <section className="ec-personal-digest__empty">
          <span className="ec-personal-digest__empty-signal" aria-hidden />
          <div>
            <h2>Всё просмотрено</h2>
            <p>Новых решений, рисков, требований и сообщений пока нет. Сводка обновится, когда появится важное.</p>
          </div>
          <button type="button" className="ec-btn ec-btn--primary ec-btn--sm" onClick={onReload}>
            Проверить сейчас
          </button>
        </section>
      ) : (
        <>
          <section className="ec-personal-digest__stats" aria-label="Итоги сводки">
            <Stat value={data.totals.approvals} label="ждут решения" tone="var(--ec-status-risk)" />
            <Stat value={data.totals.risks + data.totals.incidents} label="рисков и инцидентов" tone="var(--ec-status-warn)" />
            <Stat value={data.totals.tasks} label="задач изменилось" tone="var(--ec-status-exec)" />
            <Stat value={data.totals.requirements} label="требований изменилось" tone="var(--ec-accent)" />
            <Stat value={data.totals.messages} label="новых сообщений" />
          </section>

          <div className="ec-personal-digest__grid">
            <section className="ec-personal-digest__section" aria-labelledby="digest-priority-title">
              <div className="ec-personal-digest__section-head">
                <div>
                  <span>Сначала это</span>
                  <h2 id="digest-priority-title">Приоритетная очередь</h2>
                </div>
                <span>{data.priorityItems.length}</span>
              </div>
              <div className="ec-personal-digest__items">
                {data.priorityItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`ec-personal-digest__item is-${item.importance.toLowerCase()}`}
                    onClick={() => onOpenItem(item)}
                  >
                    <span className="ec-personal-digest__item-glyph"><DigestGlyph kind={item.kind} /></span>
                    <span className="ec-personal-digest__item-copy">
                      <span className="ec-personal-digest__item-meta">
                        <span>{KIND_LABEL[item.kind]}</span>
                        <span>{item.serverName}{item.channelName ? ` / #${item.channelName}` : ""}</span>
                      </span>
                      <strong>{item.title}</strong>
                      {item.detail && <small>{item.detail}</small>}
                    </span>
                    <span className="ec-personal-digest__item-end">
                      <time dateTime={item.createdAt}>{relativeTime(item.createdAt)}</time>
                      <span aria-hidden>→</span>
                    </span>
                  </button>
                ))}
              </div>
            </section>

            <aside className="ec-personal-digest__section" aria-labelledby="digest-rooms-title">
              <div className="ec-personal-digest__section-head">
                <div>
                  <span>Где движение</span>
                  <h2 id="digest-rooms-title">Активные комнаты</h2>
                </div>
                <span>{data.channels.length}</span>
              </div>
              <div className="ec-personal-digest__rooms">
                {data.channels.map((channel) => (
                  <button key={channel.channelId} type="button" onClick={() => onOpenChannel(channel)}>
                    <span className="ec-personal-digest__room-signal" aria-hidden />
                    <span>
                      <strong>#{channel.channelName}</strong>
                      <small>{channel.serverName}</small>
                    </span>
                    <span className="ec-personal-digest__room-counts">
                      {channel.messages > 0 && <b>{channel.messages} сообщ.</b>}
                      {channel.tasks + channel.decisions + channel.followUps + channel.risks + channel.requirements > 0 && (
                        <b>{channel.tasks + channel.decisions + channel.followUps + channel.risks + channel.requirements} дел</b>
                      )}
                    </span>
                  </button>
                ))}
              </div>
            </aside>
          </div>
        </>
      )}
    </main>
  );
}
