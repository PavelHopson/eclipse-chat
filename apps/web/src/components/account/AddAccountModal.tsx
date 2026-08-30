import { useState } from "react";
import { Modal } from "../Modal";
import { EclipseUiIcon } from "../icons/EclipseUiIcon";

type LoginResult = { success: boolean; needs2FA?: boolean };

type Props = {
  onClose: () => void;
  onLogin: (
    email: string,
    password: string,
    options?: { totpCode?: string; recoveryCode?: string },
  ) => Promise<LoginResult>;
};

export function AddAccountModal({ onClose, onLogin }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [needs2FA, setNeeds2FA] = useState(false);
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const submit = async () => {
    if (busy) return;
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password || (needs2FA && !/^\d{6}$/.test(totpCode))) return;
    setBusy(true);
    setLocalError(null);
    const result = await onLogin(
      normalizedEmail,
      password,
      needs2FA ? { totpCode } : undefined,
    );
    setBusy(false);
    if (result.success) {
      onClose();
      return;
    }
    if (result.needs2FA) {
      setNeeds2FA(true);
      setLocalError("Подтверди вход шестизначным кодом");
      return;
    }
    setLocalError("Не удалось добавить аккаунт. Проверь данные и повтори.");
  };

  return (
    <Modal title="Добавить аккаунт" width={500} onClose={onClose}>
      <form
        className="ec-account-add"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <header>
          <span className="ec-account-add__symbol" aria-hidden>
            <EclipseUiIcon name="profile" size={22} />
          </span>
          <div>
            <strong>{needs2FA ? "Подтверждение входа" : "Ещё один профиль"}</strong>
            <p>Текущий аккаунт останется сохранён. Переключение не завершает сессии на других устройствах.</p>
          </div>
        </header>
        <label>
          <span className="ec-field-label">Email</span>
          <input
            className="ec-field"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="username"
            disabled={busy || needs2FA}
            autoFocus
          />
        </label>
        <label>
          <span className="ec-field-label">Пароль</span>
          <input
            className="ec-field"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            disabled={busy || needs2FA}
          />
        </label>
        {needs2FA && (
          <label>
            <span className="ec-field-label">Код 2FA</span>
            <input
              className="ec-field ec-settings-mono"
              type="text"
              inputMode="numeric"
              value={totpCode}
              onChange={(event) => setTotpCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
              autoComplete="one-time-code"
              maxLength={6}
              autoFocus
            />
          </label>
        )}
        {localError && <p className="ec-settings-error" role="alert">{localError}</p>}
        <footer>
          <button type="button" className="ec-btn" onClick={onClose} disabled={busy}>Отмена</button>
          <button
            type="submit"
            className="ec-btn ec-btn--primary"
            disabled={busy || !email.trim() || !password || (needs2FA && totpCode.length !== 6)}
          >
            {busy ? "Проверяем…" : needs2FA ? "Подтвердить" : "Добавить аккаунт"}
          </button>
        </footer>
      </form>
    </Modal>
  );
}
