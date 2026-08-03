import { useMemo, useState, type FormEvent } from "react";
import type { PublicUser } from "../hooks/useAuth";
import { apiJson } from "../lib/api";
import "../styles/identity.css";

type LoginResult = { success: boolean; needs2FA?: boolean };

type Props = {
  authError: string | null;
  onLogin: (
    email: string,
    password: string,
    options?: { totpCode?: string },
  ) => Promise<LoginResult>;
  user: PublicUser | null;
};

type AuthorizationRequest = {
  clientId: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  redirectUri: string;
  responseType: string;
  state: string;
};

function readAuthorizationRequest(): AuthorizationRequest | null {
  const params = new URLSearchParams(window.location.search);
  const request = {
    clientId: params.get("client_id") || "",
    codeChallenge: params.get("code_challenge") || "",
    codeChallengeMethod: params.get("code_challenge_method") || "",
    redirectUri: params.get("redirect_uri") || "",
    responseType: params.get("response_type") || "",
    state: params.get("state") || "",
  };
  if (
    request.clientId !== "eclipse-dnd-forge" ||
    request.responseType !== "code" ||
    request.codeChallengeMethod !== "S256" ||
    !/^[A-Za-z0-9_-]{43}$/.test(request.codeChallenge) ||
    !/^[A-Za-z0-9_-]{32,256}$/.test(request.state)
  ) {
    return null;
  }
  try {
    const redirect = new URL(request.redirectUri);
    if (redirect.hash || redirect.username || redirect.password) return null;
  } catch {
    return null;
  }
  return request;
}

export function EcosystemAuthorizePage({ authError, onLogin, user }: Props) {
  const request = useMemo(readAuthorizationRequest, []);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [needs2FA, setNeeds2FA] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function login(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const result = await onLogin(email, password, totpCode ? { totpCode } : undefined);
    setBusy(false);
    if (result.needs2FA) setNeeds2FA(true);
  }

  async function approve() {
    if (!request || busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await apiJson<{ redirectTo: string }>("api/ecosystem/authorize", {
        method: "POST",
        body: JSON.stringify(request),
      });
      window.location.assign(result.redirectTo);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось подключить DnD Forge");
      setBusy(false);
    }
  }

  if (!request) {
    return (
      <main className="ec-identity-shell">
        <section className="ec-identity-card" role="alert">
          <p className="ec-kicker">ECLIPSE IDENTITY</p>
          <h1>Ссылка подключения повреждена</h1>
          <p className="ec-identity-card__lead">Вернитесь в DnD Forge и начните вход ещё раз.</p>
          <button className="ec-btn ec-btn--secondary" type="button" onClick={() => window.history.back()}>
            Вернуться назад
          </button>
        </section>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="ec-identity-shell">
        <form className="ec-identity-card" onSubmit={(event) => void login(event)}>
          <p className="ec-kicker">ECLIPSE DND FORGE</p>
          <h1>Войдите через Eclipse Chat</h1>
          <p className="ec-identity-card__lead">
            Chat подтвердит вашу личность. Пароль и токены не передаются в DnD Forge.
          </p>
          <label className="ec-field">
            <span>Email</span>
            <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" required />
          </label>
          <label className="ec-field">
            <span>Пароль</span>
            <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="current-password" required />
          </label>
          {needs2FA && (
            <label className="ec-field">
              <span>Код 2FA</span>
              <input value={totpCode} onChange={(event) => setTotpCode(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" required />
            </label>
          )}
          {(authError || error) && <p className="ec-form-error" role="alert">{error || authError}</p>}
          <button className="ec-btn ec-btn--primary ec-identity-card__primary" type="submit" disabled={busy}>
            {busy ? "Проверяю…" : needs2FA ? "Подтвердить код" : "Войти и продолжить"}
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="ec-identity-shell">
      <section className="ec-identity-card">
        <p className="ec-kicker">ECLIPSE IDENTITY</p>
        <h1>Подключить DnD Forge?</h1>
        <p className="ec-identity-card__lead">
          Вы вошли как <strong className="ec-identity-card__user">{user.displayName}</strong>.
          DnD Forge получит только ваш внутренний ID и имя — без email, пароля и истории Chat.
        </p>
        {(error || authError) && <p className="ec-form-error" role="alert">{error || authError}</p>}
        <div className="ec-identity-card__actions">
          <button className="ec-btn ec-btn--primary" type="button" onClick={() => void approve()} disabled={busy}>
            {busy ? "Подключаю…" : "Подключить DnD Forge"}
          </button>
          <button className="ec-btn ec-btn--secondary" type="button" onClick={() => window.history.back()} disabled={busy}>
            Отмена
          </button>
        </div>
      </section>
    </main>
  );
}
