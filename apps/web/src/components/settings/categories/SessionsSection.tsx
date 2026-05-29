import { useState } from "react";
import type { AuthSessionDto } from "../../../hooks/useSessions";

type Props = {
  sessions: AuthSessionDto[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onRevoke: (sessionId: string) => Promise<boolean>;
};

function deviceHint(userAgent: string | null): string {
  if (!userAgent) return "Неизвестное устройство";
  const ua = userAgent.toLowerCase();
  const browser =
    ua.includes("edg/") ? "Edge" :
    ua.includes("opr/") || ua.includes("opera") ? "Opera" :
    ua.includes("firefox/") ? "Firefox" :
    ua.includes("yabrowser/") ? "Yandex Browser" :
    ua.includes("chrome/") || ua.includes("crios/") ? "Chrome" :
    ua.includes("safari/") ? "Safari" :
    "Браузер";
  const os =
    ua.includes("windows") ? "Windows" :
    ua.includes("mac os") || ua.includes("macintosh") ? "macOS" :
    ua.includes("android") ? "Android" :
    ua.includes("iphone") || ua.includes("ipad") ? "iOS" :
    ua.includes("linux") ? "Linux" :
    "устройство";
  return `${browser} on ${os}`;
}

function relativeSeen(iso: string | null): { label: string; active: boolean } {
  if (!iso) return { label: "Нет активности", active: false };
  const timestamp = Date.parse(iso);
  if (Number.isNaN(timestamp)) return { label: "Нет активности", active: false };
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60000));
  if (minutes < 5) return { label: "Активна сейчас", active: true };
  if (minutes < 60) return { label: `${minutes} мин назад`, active: false };
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return { label: `${hours} ч назад`, active: false };
  const days = Math.floor(hours / 24);
  if (days < 30) return { label: `${days} дн назад`, active: false };
  return { label: new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium" }).format(new Date(timestamp)), active: false };
}

function SessionRow({ session, onRevoke }: { session: AuthSessionDto; onRevoke: (id: string) => Promise<boolean> }) {
  const [busy, setBusy] = useState(false);
  const seen = relativeSeen(session.lastSeenAt);

  const handleRevoke = async () => {
    if (busy) return;
    setBusy(true);
    const ok = await onRevoke(session.id);
    if (!ok) setBusy(false);
  };

  return (
    <article className="ec-session-row">
      <span className="ec-session-row__icon" aria-hidden>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="4" y="5" width="16" height="11" rx="2" />
          <path d="M8 20h8" />
          <path d="M12 16v4" />
        </svg>
      </span>
      <div className="ec-session-row__main">
        <strong>{deviceHint(session.userAgent)}</strong>
        <span className="ec-settings-muted">
          {session.ipAddress ? `IP ${session.ipAddress}` : "IP не сохранён"}
        </span>
      </div>
      <div className="ec-session-row__meta">
        <span className={"ec-session-row__status" + (seen.active ? " ec-session-row__status--active" : "")}>
          {seen.active && <span aria-hidden />}
          {seen.label}
        </span>
        <button
          type="button"
          className="ec-btn ec-btn--danger ec-btn--sm"
          disabled={busy}
          onClick={() => void handleRevoke()}
        >
          {busy ? "Завершаем..." : "Завершить"}
        </button>
      </div>
    </article>
  );
}

export function SessionsSection({ sessions, loading, error, onRetry, onRevoke }: Props) {
  return (
    <div className="ec-settings-section">
      <header className="ec-settings-section__hero ec-holo-edge">
        <span className="ec-settings-section__eyebrow">Учётная запись</span>
        <h2>Сессии и устройства</h2>
        <p>Здесь видны активные refresh-сессии вашего аккаунта.</p>
      </header>

      <section className="ec-settings-card ec-settings-card--stack">
        <div className="ec-settings-card__body">
          <strong>Активные сессии</strong>
          <span className="ec-settings-muted">
            Завершение сессии удалит refresh token. Текущий access JWT остаётся валидным до его 15min expiry.
          </span>
        </div>
        {loading && sessions.length === 0 && (
          <div className="ec-session-list" aria-busy="true">
            {[0, 1, 2].map((item) => (
              <div key={item} className="ec-session-row ec-session-row--skeleton" />
            ))}
          </div>
        )}
        {error && (
          <div className="ec-settings-empty">
            <span>Не удалось загрузить сессии.</span>
            <button type="button" className="ec-btn ec-btn--ghost ec-btn--sm" onClick={onRetry}>
              Повторить
            </button>
          </div>
        )}
        {!loading && !error && sessions.length === 0 && (
          <div className="ec-settings-empty">Активных сессий нет</div>
        )}
        {sessions.length > 0 && (
          <div className="ec-session-list">
            {sessions.map((session) => (
              <SessionRow key={session.id} session={session} onRevoke={onRevoke} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
