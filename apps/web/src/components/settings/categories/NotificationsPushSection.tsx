import type { PushPreferences } from "../../../hooks/usePushPreferences";

type PushState = {
  enabled: boolean;
  busy: boolean;
  error: string | null;
  capability: "loading" | "unsupported" | "denied" | "ready";
  enable: () => Promise<boolean>;
  disable: () => Promise<boolean>;
  sendTest: () => Promise<boolean>;
};

type PushPrefsState = {
  prefs: PushPreferences;
  loading: boolean;
  error: string | null;
  toggle: (key: keyof PushPreferences, value: boolean) => Promise<void>;
};

type Props = {
  push: PushState;
  pushPrefs: PushPrefsState;
  showPrefs: boolean;
  onTogglePrefs: () => void;
};

const PREF_ITEMS: Array<{ key: keyof PushPreferences; label: string; hint: string }> = [
  { key: "mentions", label: "Упоминания @меня", hint: "В каналах сервера" },
  { key: "dms", label: "Личные сообщения", hint: "DM 1-to-1 + группы" },
  { key: "assignments", label: "Назначения задач", hint: "Меня указали ответственным" },
  { key: "approvals", label: "Запросы одобрения", hint: "Меня указали approver'ом" },
  { key: "escalations", label: "Эскалации", hint: "Мои задачи overdue 48h+" },
];

export function NotificationsPushSection({ push, pushPrefs, showPrefs, onTogglePrefs }: Props) {
  return (
    <div className="ec-settings-section">
      <header className="ec-settings-section__hero ec-holo-edge">
        <span className="ec-settings-section__eyebrow">Уведомления</span>
        <h2>Push-уведомления</h2>
        <p>Устройство, тестовый push и типы событий.</p>
      </header>

      <section className={"ec-settings-card" + (push.enabled ? " ec-settings-card--active" : "")}>
        <div className="ec-settings-icon" aria-hidden>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
        </div>
        <div className="ec-settings-card__body">
          <strong>Push-уведомления</strong>
          <span className="ec-settings-muted">
            {push.capability === "unsupported"
              ? push.error ?? "Браузер не поддерживает push, либо сервер не настроен."
              : push.capability === "denied"
              ? "Разрешение отклонено в браузере. Открой настройки сайта, чтобы изменить."
              : push.enabled
              ? "Включены — на это устройство приходят DM, назначения задач, одобрения и эскалации."
              : "Получай уведомления о DM, задачах и эскалациях даже когда вкладка закрыта."}
          </span>
          {push.error && push.capability !== "unsupported" && push.capability !== "denied" && (
            <span className="ec-settings-error">{push.error}</span>
          )}
        </div>
        {push.capability === "ready" && (
          <div className="ec-settings-actions ec-settings-actions--column">
            <button
              type="button"
              onClick={() => void (push.enabled ? push.disable() : push.enable())}
              className={push.enabled ? "ec-btn ec-btn--ghost ec-btn--sm" : "ec-btn ec-btn--primary ec-btn--sm"}
              disabled={push.busy}
            >
              {push.busy ? "…" : push.enabled ? "Отключить" : "Включить"}
            </button>
            {push.enabled && (
              <>
                <button type="button" onClick={() => void push.sendTest()} className="ec-btn ec-btn--ghost ec-btn--sm" disabled={push.busy}>
                  Тест
                </button>
                <button type="button" onClick={onTogglePrefs} className="ec-btn ec-btn--ghost ec-btn--sm">
                  {showPrefs ? "Скрыть" : "Настроить"}
                </button>
              </>
            )}
          </div>
        )}
      </section>

      {push.enabled && showPrefs && (
        <section className="ec-settings-card ec-settings-card--stack ec-settings-card--sunken">
          <span className="ec-settings-kicker">Какие события присылать</span>
          {PREF_ITEMS.map(({ key, label, hint }) => (
            <label key={key} className="ec-settings-toggle-row">
              <span>
                <strong>{label}</strong>
                <span className="ec-settings-muted">{hint}</span>
              </span>
              <input
                type="checkbox"
                checked={pushPrefs.prefs[key]}
                onChange={(e) => void pushPrefs.toggle(key, e.target.checked)}
                disabled={pushPrefs.loading}
              />
            </label>
          ))}
          {pushPrefs.error && <span className="ec-settings-error">{pushPrefs.error}</span>}
        </section>
      )}
    </div>
  );
}
