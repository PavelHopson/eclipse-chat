import type { PushPreferences } from "../../../hooks/usePushPreferences";
import { NOTIFICATION_SOUND_THEMES } from "../../../lib/notificationSounds";
import type {
  NotificationSoundKind,
  NotificationSoundSettings,
  NotificationSoundTheme,
} from "../../../lib/notificationSounds";

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

type SoundState = {
  settings: NotificationSoundSettings;
  supported: boolean;
  update: (patch: Partial<NotificationSoundSettings>) => void;
  test: (kind?: NotificationSoundKind) => void;
};

type Props = {
  push: PushState;
  pushPrefs: PushPrefsState;
  sounds: SoundState;
  showPrefs: boolean;
  onTogglePrefs: () => void;
};

type SoundToggleKey = keyof Pick<NotificationSoundSettings, "message" | "dm" | "voice" | "tasks">;

const PREF_ITEMS: Array<{ key: keyof PushPreferences; label: string; hint: string }> = [
  { key: "mentions", label: "Упоминания @меня", hint: "В каналах сервера" },
  { key: "dms", label: "Личные сообщения", hint: "DM 1-to-1 + группы" },
  { key: "assignments", label: "Назначения задач", hint: "Меня указали ответственным" },
  { key: "approvals", label: "Запросы одобрения", hint: "Меня указали approver'ом" },
  { key: "escalations", label: "Эскалации", hint: "Мои задачи overdue 48h+" },
];

const SOUND_ITEMS: Array<{
  key: SoundToggleKey;
  label: string;
  hint: string;
  test: NotificationSoundKind;
}> = [
  {
    key: "message",
    label: "Сообщения и упоминания",
    hint: "Каналы вне фокуса и @упоминания",
    test: "mention",
  },
  {
    key: "dm",
    label: "Личные сообщения",
    hint: "DM и групповые лички",
    test: "dm",
  },
  {
    key: "voice",
    label: "Голосовые комнаты",
    hint: "Вход и выход участников",
    test: "voiceJoin",
  },
  {
    key: "tasks",
    label: "Задачи и эскалации",
    hint: "Просрочки и важные операционные события",
    test: "task",
  },
];

const SOUND_THEME_ITEMS = Object.entries(NOTIFICATION_SOUND_THEMES) as Array<
  [NotificationSoundTheme, (typeof NOTIFICATION_SOUND_THEMES)[NotificationSoundTheme]]
>;

export function NotificationsPushSection({
  push,
  pushPrefs,
  sounds,
  showPrefs,
  onTogglePrefs,
}: Props) {
  const updateSoundToggle = (key: SoundToggleKey, value: boolean) => {
    sounds.update({ [key]: value } as Partial<Pick<NotificationSoundSettings, SoundToggleKey>>);
  };

  return (
    <div className="ec-settings-section">
      <header className="ec-settings-section__hero ec-holo-edge">
        <span className="ec-settings-section__eyebrow">Уведомления</span>
        <h2>Уведомления и звук</h2>
        <p>Push, локальные сигналы, voice-входы и важные операционные события.</p>
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

      <section className={"ec-settings-card" + (sounds.settings.enabled ? " ec-settings-card--active" : "")}>
        <div className="ec-settings-icon" aria-hidden>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 10v4" />
            <path d="M6 7v10" />
            <path d="M10 4v16" />
            <path d="M14 8v8" />
            <path d="M18 6v12" />
            <path d="M22 11v2" />
          </svg>
        </div>
        <div className="ec-settings-card__body">
          <strong>Звуки в приложении</strong>
          <span className="ec-settings-muted">
            {sounds.supported
              ? sounds.settings.enabled
                ? "Включены — мягкие сигналы для сообщений, DM, задач и входа/выхода из voice."
                : "Отключены — приложение не будет проигрывать локальные сигналы."
              : "Этот браузер не поддерживает Web Audio, поэтому локальные звуки недоступны."}
          </span>
        </div>
        <div className="ec-settings-actions ec-settings-actions--column">
          <button
            type="button"
            className={sounds.settings.enabled ? "ec-btn ec-btn--ghost ec-btn--sm" : "ec-btn ec-btn--primary ec-btn--sm"}
            onClick={() => sounds.update({ enabled: !sounds.settings.enabled })}
            disabled={!sounds.supported}
          >
            {sounds.settings.enabled ? "Отключить" : "Включить"}
          </button>
          <button
            type="button"
            className="ec-btn ec-btn--ghost ec-btn--sm"
            onClick={() => sounds.test("dm")}
            disabled={!sounds.supported}
          >
            Проверить звук
          </button>
        </div>
      </section>

      {sounds.settings.enabled && sounds.supported && (
        <section className="ec-settings-card ec-settings-card--stack ec-settings-card--sunken">
          <span className="ec-settings-kicker">Пакет звуков</span>
          <div className="ec-settings-sound-themes" role="radiogroup" aria-label="Пакет звуков уведомлений">
            {SOUND_THEME_ITEMS.map(([theme, meta]) => (
              <button
                key={theme}
                type="button"
                role="radio"
                aria-checked={sounds.settings.theme === theme}
                className={
                  "ec-settings-sound-theme" +
                  (sounds.settings.theme === theme ? " is-active" : "")
                }
                onClick={() => {
                  sounds.update({ theme });
                  sounds.test("voiceJoin");
                }}
              >
                <span className="ec-settings-sound-theme__signal" aria-hidden />
                <span>
                  <strong>{meta.label}</strong>
                  <small>{meta.description}</small>
                </span>
              </button>
            ))}
          </div>

          <span className="ec-settings-kicker">Какие звуки проигрывать</span>
          {SOUND_ITEMS.map(({ key, label, hint, test }) => (
            <label key={key} className="ec-settings-toggle-row">
              <span>
                <strong>{label}</strong>
                <span className="ec-settings-muted">{hint}</span>
              </span>
              <span className="ec-settings-sound-actions">
                <button
                  type="button"
                  className="ec-btn ec-btn--ghost ec-btn--xs"
                  onClick={(event) => {
                    event.preventDefault();
                    sounds.test(test);
                  }}
                >
                  Тест
                </button>
                <input
                  type="checkbox"
                  checked={sounds.settings[key]}
                  onChange={(e) => updateSoundToggle(key, e.target.checked)}
                />
              </span>
            </label>
          ))}
          <label className="ec-settings-sound-volume">
            <span>
              <strong>Громкость</strong>
              <span className="ec-settings-muted">По умолчанию тихо, чтобы не мешать разговору</span>
            </span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={sounds.settings.volume}
              onChange={(e) => sounds.update({ volume: Number(e.target.value) })}
            />
            <strong>{Math.round(sounds.settings.volume * 100)}%</strong>
          </label>
        </section>
      )}

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
