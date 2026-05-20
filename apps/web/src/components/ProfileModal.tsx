import type { CSSProperties } from "react";
import { useRef, useState } from "react";
import { Avatar } from "./Avatar";
import { Modal } from "./Modal";
import { TwoFactorSetupModal } from "./TwoFactorSetupModal";
import type { Profile } from "../hooks/useProfile";
import { usePushNotifications } from "../hooks/usePushNotifications";
import {
  usePushPreferences,
  type PushPreferences,
} from "../hooks/usePushPreferences";

type Props = {
  profile: Profile;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (data: { displayName?: string; bio?: string | null }) => Promise<boolean>;
  onUploadAvatar: (file: File) => Promise<boolean>;
  onDeleteAvatar: () => Promise<boolean>;
  /** Уведомить parent: 2FA flipped — он refresh'нет /me. */
  onTwoFactorChanged?: () => void;
};

const avatarSection: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "var(--ec-space-4)",
  padding: "var(--ec-space-3)",
  background: "var(--ec-surface-2)",
  border: "1px solid var(--ec-border-subtle)",
  borderRadius: "var(--ec-radius-md)",
};

export function ProfileModal({
  profile,
  busy,
  error,
  onClose,
  onSave,
  onUploadAvatar,
  onDeleteAvatar,
  onTwoFactorChanged,
}: Props) {
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [bio, setBio] = useState(profile.bio ?? "");
  const [show2FA, setShow2FA] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const twoFaOn = (profile as Profile & { twoFactorEnabled?: boolean }).twoFactorEnabled === true;
  // v0.84 #27 phase 3: push notifications state.
  const push = usePushNotifications();
  // v0.85 #27 phase 4: per-event-type toggles. Fetch только когда push enabled.
  const pushPrefs = usePushPreferences(push.enabled);
  const [showPrefs, setShowPrefs] = useState(false);

  const trimmedName = displayName.trim();
  const trimmedBio = bio.trim();
  const nameChanged = trimmedName !== profile.displayName.trim();
  const bioChanged = trimmedBio !== (profile.bio ?? "").trim();
  const canSave =
    !busy &&
    trimmedName.length >= 1 &&
    trimmedName.length <= 64 &&
    trimmedBio.length <= 280 &&
    (nameChanged || bioChanged);

  const handleSave = async () => {
    const data: { displayName?: string; bio?: string | null } = {};
    if (nameChanged) data.displayName = trimmedName;
    if (bioChanged) data.bio = trimmedBio === "" ? null : trimmedBio;
    if (Object.keys(data).length === 0) return;
    const ok = await onSave(data);
    if (ok) onClose();
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) {
      void onUploadAvatar(file);
    }
  };

  return (
    <Modal
      title="Профиль"
      width={460}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className="ec-btn" disabled={busy}>
            Отмена
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            className="ec-btn ec-btn--primary"
            disabled={!canSave}
          >
            {busy ? "Сохраняем…" : "Сохранить"}
          </button>
        </>
      }
    >
      <section style={avatarSection}>
        <Avatar url={profile.avatar} name={profile.displayName} size={72} />
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--ec-space-2)", flex: 1 }}>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            style={{ display: "none" }}
            onChange={handleFile}
          />
          <div style={{ display: "flex", gap: "var(--ec-space-2)" }}>
            <button type="button" onClick={() => fileRef.current?.click()} className="ec-btn ec-btn--sm" disabled={busy}>
              {profile.avatar ? "Заменить" : "Загрузить"}
            </button>
            {profile.avatar && (
              <button
                type="button"
                onClick={() => void onDeleteAvatar()}
                className="ec-btn ec-btn--sm ec-btn--danger"
                disabled={busy}
              >
                Удалить
              </button>
            )}
          </div>
          <span style={{ fontSize: "var(--ec-text-2xs)", color: "var(--ec-text-dim)" }}>
            JPEG / PNG / WebP / HEIC · до 20 МБ · обрежется до 512×512
          </span>
        </div>
      </section>

      {/* 2FA section */}
      <section
        style={{
          ...avatarSection,
          background: twoFaOn ? "var(--ec-accent-soft)" : "var(--ec-surface-2)",
          borderColor: twoFaOn ? "var(--ec-accent)" : "var(--ec-border-subtle)",
        }}
      >
        <div
          aria-hidden
          style={{
            width: 48,
            height: 48,
            borderRadius: "var(--ec-radius-md)",
            display: "grid",
            placeItems: "center",
            background: twoFaOn ? "var(--ec-accent)" : "var(--ec-surface-3)",
            color: twoFaOn ? "var(--ec-accent-text)" : "var(--ec-text-muted)",
          }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0110 0v4" />
          </svg>
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
          <strong style={{ color: "var(--ec-text-strong)", fontSize: "var(--ec-text-sm)" }}>
            Двухфакторная аутентификация
          </strong>
          <span style={{ fontSize: "var(--ec-text-2xs)", color: "var(--ec-text-muted)", lineHeight: 1.4 }}>
            {twoFaOn
              ? "Включена — на каждый вход требуется код из приложения."
              : "Защити вход через TOTP-приложение. Без 2FA пароль — единственная защита."}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setShow2FA(true)}
          className={twoFaOn ? "ec-btn ec-btn--ghost ec-btn--sm" : "ec-btn ec-btn--primary ec-btn--sm"}
        >
          {twoFaOn ? "Отключить" : "Включить"}
        </button>
      </section>

      <div>
        <label className="ec-field-label">Имя</label>
        <input
          className="ec-field"
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          maxLength={64}
          required
        />
        <span className="ec-field-counter">{trimmedName.length}/64</span>
      </div>

      <div>
        <label className="ec-field-label">О себе</label>
        <textarea
          className="ec-field ec-field--textarea"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          maxLength={280}
          rows={3}
          placeholder="Коротко о себе…"
        />
        <span className="ec-field-counter">{trimmedBio.length}/280</span>
      </div>

      <div style={{ fontSize: "var(--ec-text-xs)", color: "var(--ec-text-dim)" }}>
        Email: <span style={{ fontFamily: "var(--ec-font-mono)" }}>{profile.email}</span>
      </div>

      {error && (
        <p style={{ margin: 0, color: "var(--ec-danger)", fontSize: "var(--ec-text-sm)" }}>{error}</p>
      )}

      {/* v0.84 #27 phase 3: Push notifications section */}
      <section
        style={{
          ...avatarSection,
          background: push.enabled ? "var(--ec-accent-soft)" : "var(--ec-surface-2)",
          borderColor: push.enabled ? "var(--ec-accent)" : "var(--ec-border-subtle)",
        }}
      >
        <div
          aria-hidden
          style={{
            width: 48,
            height: 48,
            borderRadius: "var(--ec-radius-md)",
            display: "grid",
            placeItems: "center",
            background: push.enabled ? "var(--ec-accent)" : "var(--ec-surface-3)",
            color: push.enabled ? "var(--ec-accent-text)" : "var(--ec-text-muted)",
          }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
          <strong style={{ color: "var(--ec-text-strong)", fontSize: "var(--ec-text-sm)" }}>
            Push-уведомления
          </strong>
          <span style={{ fontSize: "var(--ec-text-2xs)", color: "var(--ec-text-muted)", lineHeight: 1.4 }}>
            {push.capability === "unsupported"
              ? push.error ?? "Браузер не поддерживает push, либо сервер не настроен."
              : push.capability === "denied"
                ? "Разрешение отклонено в браузере. Открой настройки сайта чтобы изменить."
                : push.enabled
                  ? "Включены — на это устройство приходят DM, назначения задач, одобрения и эскалации."
                  : "Получай уведомления о DM, задачах и эскалациях даже когда вкладка закрыта."}
          </span>
          {push.error && push.capability !== "unsupported" && push.capability !== "denied" && (
            <span style={{ fontSize: "var(--ec-text-2xs)", color: "var(--ec-danger)", lineHeight: 1.4 }}>
              {push.error}
            </span>
          )}
        </div>
        {push.capability === "ready" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <button
              type="button"
              onClick={() => void (push.enabled ? push.disable() : push.enable())}
              className={
                push.enabled
                  ? "ec-btn ec-btn--ghost ec-btn--sm"
                  : "ec-btn ec-btn--primary ec-btn--sm"
              }
              disabled={push.busy}
            >
              {push.busy ? "…" : push.enabled ? "Отключить" : "Включить"}
            </button>
            {push.enabled && (
              <>
                <button
                  type="button"
                  onClick={() => void push.sendTest()}
                  className="ec-btn ec-btn--ghost ec-btn--sm"
                  disabled={push.busy}
                  title="Отправить тестовое уведомление"
                >
                  Тест
                </button>
                <button
                  type="button"
                  onClick={() => setShowPrefs((s) => !s)}
                  className="ec-btn ec-btn--ghost ec-btn--sm"
                  title="Управление типами уведомлений"
                >
                  {showPrefs ? "Скрыть" : "Настроить"}
                </button>
              </>
            )}
          </div>
        )}
      </section>

      {/* v0.85 #27 phase 4: per-event-type toggles. Disclosure под push section. */}
      {push.enabled && showPrefs && (
        <section
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--ec-space-2)",
            padding: "var(--ec-space-3) var(--ec-space-4)",
            background: "hsl(208 16% 10% / 0.5)",
            border: "1px solid var(--ec-border-subtle)",
            borderRadius: "var(--ec-radius-md)",
          }}
        >
          <span
            style={{
              fontSize: "var(--ec-text-2xs)",
              fontWeight: 700,
              letterSpacing: "var(--ec-tracking-caps)",
              textTransform: "uppercase",
              color: "var(--ec-text-dim)",
              marginBottom: 2,
            }}
          >
            Какие события присылать
          </span>
          {(
            [
              { key: "mentions", label: "Упоминания @меня", hint: "В каналах сервера" },
              { key: "dms", label: "Личные сообщения", hint: "DM 1-to-1 + группы" },
              { key: "assignments", label: "Назначения задач", hint: "Меня указали ответственным" },
              { key: "approvals", label: "Запросы одобрения", hint: "Меня указали approver'ом" },
              { key: "escalations", label: "Эскалации", hint: "Мои задачи overdue 48h+" },
            ] as Array<{ key: keyof PushPreferences; label: string; hint: string }>
          ).map(({ key, label, hint }) => (
            <label
              key={key}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr auto",
                alignItems: "center",
                gap: "var(--ec-space-3)",
                cursor: "pointer",
                padding: "0.35rem 0",
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                <span style={{ fontSize: "var(--ec-text-sm)", color: "var(--ec-text)" }}>
                  {label}
                </span>
                <span style={{ fontSize: "var(--ec-text-2xs)", color: "var(--ec-text-dim)" }}>
                  {hint}
                </span>
              </div>
              <input
                type="checkbox"
                checked={pushPrefs.prefs[key]}
                onChange={(e) => void pushPrefs.toggle(key, e.target.checked)}
                disabled={pushPrefs.loading}
                style={{ accentColor: "var(--ec-accent)", width: 18, height: 18 }}
              />
            </label>
          ))}
          {pushPrefs.error && (
            <span
              style={{
                fontSize: "var(--ec-text-2xs)",
                color: "var(--ec-danger)",
              }}
            >
              {pushPrefs.error}
            </span>
          )}
        </section>
      )}

      {show2FA && (
        <TwoFactorSetupModal
          initialEnabled={twoFaOn}
          onClose={() => setShow2FA(false)}
          onChanged={() => onTwoFactorChanged?.()}
        />
      )}
    </Modal>
  );
}
