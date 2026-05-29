import { TwoFactorSetupModal } from "../../TwoFactorSetupModal";

type Props = {
  twoFaOn: boolean;
  show2FA: boolean;
  showPwd: boolean;
  curPwd: string;
  newPwd: string;
  confirmPwd: string;
  newPwdValid: boolean;
  pwdMatch: boolean;
  canChangePwd: boolean;
  pwdBusy: boolean;
  pwdError: string | null;
  pwdDone: boolean;
  onToggle2FA: () => void;
  onClose2FA: () => void;
  onTwoFactorChanged?: () => void;
  onTogglePwd: () => void;
  onCurPwd: (value: string) => void;
  onNewPwd: (value: string) => void;
  onConfirmPwd: (value: string) => void;
  onChangePwd: () => void;
};

export function AccountSecuritySection({
  twoFaOn,
  show2FA,
  showPwd,
  curPwd,
  newPwd,
  confirmPwd,
  newPwdValid,
  pwdMatch,
  canChangePwd,
  pwdBusy,
  pwdError,
  pwdDone,
  onToggle2FA,
  onClose2FA,
  onTwoFactorChanged,
  onTogglePwd,
  onCurPwd,
  onNewPwd,
  onConfirmPwd,
  onChangePwd,
}: Props) {
  return (
    <div className="ec-settings-section">
      <header className="ec-settings-section__hero ec-holo-edge">
        <span className="ec-settings-section__eyebrow">Учётная запись</span>
        <h2>Безопасность</h2>
        <p>Пароль и двухфакторная аутентификация.</p>
      </header>

      <section className={"ec-settings-card" + (twoFaOn ? " ec-settings-card--active" : "")}>
        <div className="ec-settings-icon" aria-hidden>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0110 0v4" />
          </svg>
        </div>
        <div className="ec-settings-card__body">
          <strong>Двухфакторная аутентификация</strong>
          <span className="ec-settings-muted">
            {twoFaOn
              ? "Включена — на каждый вход требуется код из приложения."
              : "Защити вход через TOTP-приложение. Без 2FA пароль — единственная защита."}
          </span>
        </div>
        <button
          type="button"
          onClick={onToggle2FA}
          className={twoFaOn ? "ec-btn ec-btn--ghost ec-btn--sm" : "ec-btn ec-btn--primary ec-btn--sm"}
        >
          {twoFaOn ? "Отключить" : "Включить"}
        </button>
      </section>

      <section className="ec-settings-card">
        <div className="ec-settings-icon" aria-hidden>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2.6 17.4A2 2 0 0 0 2 18.8V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.2a2 2 0 0 0 1.4-.6l.8-.8a6.5 6.5 0 1 0-4-4z" />
            <circle cx="16.5" cy="7.5" r="0.5" fill="currentColor" />
          </svg>
        </div>
        <div className="ec-settings-card__body">
          <strong>Пароль</strong>
          <span className="ec-settings-muted">
            Смена завершит все остальные сессии. Текущее устройство останется в системе.
          </span>
        </div>
        <button type="button" onClick={onTogglePwd} className="ec-btn ec-btn--ghost ec-btn--sm">
          {showPwd ? "Скрыть" : "Сменить"}
        </button>
      </section>

      {showPwd && (
        <section className="ec-settings-card ec-settings-card--stack ec-settings-card--sunken">
          <label>
            <span className="ec-field-label">Текущий пароль</span>
            <input className="ec-field" type="password" value={curPwd} onChange={(e) => onCurPwd(e.target.value)} autoComplete="current-password" />
          </label>
          <label>
            <span className="ec-field-label">Новый пароль</span>
            <input
              className="ec-field"
              type="password"
              value={newPwd}
              onChange={(e) => onNewPwd(e.target.value)}
              autoComplete="new-password"
              placeholder="Минимум 8, буквы и цифры"
            />
          </label>
          <label>
            <span className="ec-field-label">Повтори новый пароль</span>
            <input className="ec-field" type="password" value={confirmPwd} onChange={(e) => onConfirmPwd(e.target.value)} autoComplete="new-password" />
          </label>
          {newPwd.length > 0 && !newPwdValid && (
            <span className="ec-settings-muted">Пароль должен быть от 8 символов и содержать буквы и цифры.</span>
          )}
          {confirmPwd.length > 0 && !pwdMatch && <span className="ec-settings-error">Пароли не совпадают.</span>}
          {pwdError && <span className="ec-settings-error">{pwdError}</span>}
          {pwdDone && <span className="ec-settings-ok">✓ Пароль обновлён.</span>}
          <button type="button" onClick={onChangePwd} className="ec-btn ec-btn--primary ec-btn--sm" disabled={!canChangePwd}>
            {pwdBusy ? "Обновляем…" : "Обновить пароль"}
          </button>
        </section>
      )}

      {show2FA && (
        <TwoFactorSetupModal
          initialEnabled={twoFaOn}
          onClose={onClose2FA}
          onChanged={() => onTwoFactorChanged?.()}
        />
      )}
    </div>
  );
}
