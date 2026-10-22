import { useEffect, useMemo, useRef, useState } from "react";
import { ApiError, apiJson } from "../lib/api";
import { setTokenPair } from "../lib/storage";
import type { PublicUser } from "../hooks/useAuth";
import "../styles/qr-login.css";

type QrMode = "target" | "phone" | "pair";

type QrPayload = {
  attemptId?: string;
  challengeId?: string;
  id?: string;
  verifier?: string;
  secret?: string;
  qrDataUrl?: string;
  qrUrl?: string;
  expiresAt?: string | number;
};

type QrStatus = QrPayload & {
  status?: "PENDING" | "APPROVED" | "DENIED" | "EXPIRED" | "CONSUMED" | string;
  claimed?: boolean;
  claimedDevice?: string | null;
  accessToken?: string;
  token?: string;
  refreshToken?: string;
  user?: PublicUser;
};

type LoginResult = { success: boolean; needs2FA?: boolean; error?: string };

type Props = {
  mode: QrMode;
  onBack?: () => void;
  user?: PublicUser | null;
  onLogin?: (
    email: string,
    password: string,
    options?: { totpCode?: string; recoveryCode?: string },
  ) => Promise<LoginResult>;
};

// Keep polling well below the server's per-IP status limit, while allowing
// two devices behind the same home or office NAT to pair at once.
const POLL_MS = 2500;

function getAttemptId(data: QrPayload): string {
  return data.attemptId ?? data.challengeId ?? data.id ?? "";
}

function getSecret(data: QrPayload): string {
  return data.verifier ?? data.secret ?? "";
}

function parseQrParams(): { attemptId: string; secret: string; code: string } {
  if (typeof window === "undefined") return { attemptId: "", secret: "", code: "" };
  const hash = window.location.hash.replace(/^#qr-login\??/i, "");
  const params = new URLSearchParams(hash);
  return {
    attemptId: params.get("attemptId") ?? params.get("challenge") ?? params.get("id") ?? "",
    secret: params.get("verifier") ?? params.get("secret") ?? "",
    code: params.get("code") ?? "",
  };
}

function expiryLabel(expiresAt: string | number | undefined): string {
  if (!expiresAt) return "Обычно действует около двух минут";
  const value = typeof expiresAt === "number" ? expiresAt : Date.parse(expiresAt);
  if (!Number.isFinite(value)) return "Обычно действует около двух минут";
  const seconds = Math.max(0, Math.ceil((value - Date.now()) / 1000));
  return seconds > 0 ? `Истекает через ${seconds} с` : "Код истёк";
}

export function QrLoginPanel({ mode, onBack, user, onLogin }: Props) {
  const [payload, setPayload] = useState<QrPayload | null>(null);
  const [status, setStatus] = useState<QrStatus | null>(null);
  const [busy, setBusy] = useState(mode === "target" ? true : false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totp, setTotp] = useState("");
  const [needs2FA, setNeeds2FA] = useState(false);
  const [phoneFlow, setPhoneFlow] = useState<"checking" | "reverse" | "forward">(
    mode === "phone" ? "checking" : "forward",
  );
  const pollRef = useRef<number | null>(null);
  const startedModeRef = useRef<QrMode | null>(null);
  const phoneParams = useMemo(parseQrParams, []);

  const attemptId = getAttemptId(payload ?? phoneParams);
  const verifier = getSecret(payload ?? phoneParams);
  const phoneCode = phoneParams.code;
  const expiresAt = payload?.expiresAt ?? status?.expiresAt;
  const expired = Boolean(
    expiresAt && Number.isFinite(typeof expiresAt === "number" ? expiresAt : Date.parse(expiresAt)) &&
      (typeof expiresAt === "number" ? expiresAt : Date.parse(expiresAt)) <= now,
  );

  const clearPolling = () => {
    if (pollRef.current !== null) window.clearInterval(pollRef.current);
    pollRef.current = null;
  };

  useEffect(() => () => clearPolling(), []);

  useEffect(() => {
    if (mode !== "phone" || !phoneCode) return;
    let cancelled = false;
    void (async () => {
      try {
        await apiJson("api/auth/qr/claim", {
          method: "POST",
          body: JSON.stringify({ code: phoneCode }),
        });
        if (!cancelled) setPhoneFlow("reverse");
      } catch (cause) {
        // A target-device QR has no bound account and uses the normal
        // authenticated-phone approval flow instead.
        if (!cancelled && cause instanceof ApiError && cause.status === 404) {
          setPhoneFlow("forward");
        } else if (!cancelled) {
          setError(cause instanceof Error ? cause.message : "QR-сессия недоступна");
          setPhoneFlow("forward");
        }
      }
    })();
    return () => { cancelled = true; };
  }, [mode, phoneCode]);

  const start = async () => {
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      const data = await apiJson<QrPayload>("api/auth/qr/start", {
        method: "POST",
        body: JSON.stringify({ mode }),
      });
      if (!getAttemptId(data) || !getSecret(data)) throw new Error("Сервер вернул неполный QR-код");
      setPayload(data);
      setNow(Date.now());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось создать QR-код");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (mode === "target" || mode === "pair") {
      // React StrictMode replays effects in development. Do not create two
      // live challenges for one visible QR panel.
      if (startedModeRef.current !== mode) {
        startedModeRef.current = mode;
        void start();
      }
    }
    return () => clearPolling();
    // Start only when panel is mounted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const poll = async () => {
    if (mode === "phone" && phoneFlow === "reverse") {
      if (!phoneCode) return;
      try {
        const data = await apiJson<QrStatus>("api/auth/qr/phone-status", {
          method: "POST",
          body: JSON.stringify({ code: phoneCode }),
        });
        setStatus(data);
        setNow(Date.now());
        if (["DENIED", "EXPIRED", "CONSUMED"].includes(data.status ?? "")) clearPolling();
        if (data.status === "APPROVED") {
          const exchanged = await apiJson<QrStatus>("api/auth/qr/exchange-code", {
            method: "POST",
            body: JSON.stringify({ code: phoneCode }),
          });
          const accessToken = exchanged.accessToken ?? exchanged.token;
          if (!accessToken || !exchanged.refreshToken) throw new Error("Сервер не вернул сессию");
          setTokenPair(accessToken, exchanged.refreshToken);
          clearPolling();
          window.location.replace(`${window.location.pathname}${window.location.search}`);
        }
      } catch (cause) {
        clearPolling();
        setError(cause instanceof Error ? cause.message : "Не удалось проверить QR-сессию");
      }
      return;
    }
    if (!attemptId || !verifier || expired) return;
    try {
      const data = await apiJson<QrStatus>("api/auth/qr/status", {
        method: "POST",
        body: JSON.stringify({ attemptId, verifier }),
      });
      setStatus(data);
      setNow(Date.now());
      if (["DENIED", "EXPIRED", "CONSUMED"].includes(data.status ?? "")) clearPolling();
      if (data.status === "APPROVED" && mode === "target") {
        const exchanged = await apiJson<QrStatus>("api/auth/qr/exchange", {
          method: "POST",
          body: JSON.stringify({ attemptId, verifier }),
        });
        const accessToken = exchanged.accessToken ?? exchanged.token;
        if (!accessToken || !exchanged.refreshToken) throw new Error("Сервер не вернул сессию");
        setTokenPair(accessToken, exchanged.refreshToken);
        clearPolling();
        window.location.replace(`${window.location.pathname}${window.location.search}`);
      }
    } catch (cause) {
      clearPolling();
      setError(cause instanceof Error ? cause.message : "Не удалось проверить QR-сессию");
    }
  };

  useEffect(() => {
    if (
      mode === "phone"
        ? phoneFlow !== "reverse" || !phoneCode
        : !attemptId || !verifier || !payload || expired
    ) return;
    void poll();
    pollRef.current = window.setInterval(() => void poll(), POLL_MS);
    return () => clearPolling();
    // Poll identity is represented by the immutable challenge pair.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attemptId, verifier, mode, payload, expired, phoneFlow, phoneCode]);

  useEffect(() => {
    if (!expiresAt) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [expiresAt]);

  const loginPhone = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!onLogin || busy) return;
    setBusy(true);
    setError(null);
    const result = await onLogin(email.trim(), password, needs2FA ? { totpCode: totp.trim() } : undefined);
    setBusy(false);
    if (result.needs2FA) {
      setNeeds2FA(true);
      return;
    }
    if (!result.success) setError(result.error ?? "Не удалось войти");
  };

  const approve = async () => {
    if ((!phoneCode && (!attemptId || !verifier)) || busy) return;
    setBusy(true);
    setError(null);
    try {
      await apiJson("api/auth/qr/approve", {
        method: "POST",
        body: JSON.stringify(phoneCode ? { code: phoneCode } : { attemptId, verifier }),
      });
      setStatus({ status: "APPROVED" });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось подтвердить вход");
    } finally {
      setBusy(false);
    }
  };

  const approveTarget = async () => {
    if (!attemptId || !verifier || busy) return;
    setBusy(true);
    setError(null);
    try {
      await apiJson("api/auth/qr/approve-target", {
        method: "POST",
        body: JSON.stringify({ attemptId, verifier }),
      });
      setStatus((current) => ({ ...(current ?? {}), status: "APPROVED", claimed: true }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось подтвердить телефон");
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    if (!attemptId || !verifier || busy) {
      onBack?.();
      return;
    }
    setBusy(true);
    try {
      await apiJson("api/auth/qr/cancel", {
        method: "POST",
        body: JSON.stringify({ attemptId, verifier }),
      });
    } catch {
      // The short-lived challenge will expire server-side if the request races a close.
    } finally {
      clearPolling();
      setBusy(false);
      onBack?.();
    }
  };

  const title = mode === "phone" ? "Подтвердить вход" : mode === "pair" ? "Подключить телефон" : "Войти по QR-коду";

  if (mode === "phone" && !user && phoneFlow === "forward") {
    return (
      <main className="ec-qr-shell">
        <section className="ec-qr-card" aria-labelledby="qr-phone-title">
          <span className="ec-qr-eyebrow">ECLIPSE · ПОДКЛЮЧЕНИЕ УСТРОЙСТВА</span>
          <h1 id="qr-phone-title">Сначала войдите в аккаунт</h1>
          <p>После входа подтвердите подключение этого устройства. Пароль не попадёт в QR-код.</p>
          <form onSubmit={(event) => void loginPhone(event)} className="ec-qr-form">
            <label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required /></label>
            <label>Пароль<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required /></label>
            {needs2FA && <label>Код 2FA<input inputMode="numeric" value={totp} onChange={(event) => setTotp(event.target.value)} autoComplete="one-time-code" required /></label>}
            {error && <p className="ec-qr-error" role="alert">{error}</p>}
            <button className="ec-btn ec-btn--primary" type="submit" disabled={busy}>{busy ? "Проверяем…" : "Войти и продолжить"}</button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="ec-qr-shell">
      <section className="ec-qr-card" aria-labelledby="qr-title">
        <span className="ec-qr-eyebrow">ECLIPSE · ЗАЩИЩЁННОЕ УСТРОЙСТВО</span>
        <h1 id="qr-title">{title}</h1>
        <p>
          {mode === "phone"
            ? "Проверьте, что это ваш аккаунт, и разрешите вход на устройстве, где был показан код."
            : "Отсканируйте код камерой телефона. Подтверждение выполняется в аккаунте, без передачи пароля или токенов."}
        </p>

        {mode === "phone" ? (
          <>
            <div className="ec-qr-device-note">
              {phoneFlow === "checking"
                ? "Проверяем QR-сессию…"
                : status?.status === "APPROVED"
                  ? "Вход разрешён"
                  : "Ожидаем подтверждение на основном устройстве"}
            </div>
            {phoneFlow === "forward" && (
              <button className="ec-btn ec-btn--primary" type="button" onClick={() => void approve()} disabled={busy || expired || status?.status === "APPROVED"}>
                {status?.status === "APPROVED" ? "Вход разрешён" : busy ? "Подтверждаем…" : "Разрешить вход"}
              </button>
            )}
          </>
        ) : payload?.qrDataUrl ? (
          <img className="ec-qr-image" src={payload.qrDataUrl} alt="QR-код для входа в Eclipse Chat" />
        ) : payload?.qrUrl ? (
          <a className="ec-qr-link" href={payload.qrUrl} target="_blank" rel="noreferrer">Открыть безопасную ссылку на телефоне</a>
        ) : busy ? (
          <div className="ec-qr-placeholder" aria-live="polite">Создаём одноразовый код…</div>
        ) : null}

        {payload && <p className="ec-qr-expiry">{expiryLabel(expiresAt)}</p>}
        {status?.status === "APPROVED" && mode === "pair" && <p className="ec-qr-success" role="status">Телефон подтверждён. Его можно использовать для входа в Eclipse.</p>}
        {mode === "pair" && status?.claimed && status.status === "PENDING" && (
          <div className="ec-qr-claim-confirmation">
            <p className="ec-qr-device-note">
              Запрос пришёл с устройства: <strong>{status.claimedDevice || "данные устройства недоступны"}</strong>.
              Проверьте, что это ваш телефон, прежде чем продолжить.
            </p>
            <button className="ec-btn ec-btn--primary" type="button" onClick={() => void approveTarget()} disabled={busy || expired}>
              {busy ? "Подтверждаем…" : "Разрешить вход на телефоне"}
            </button>
          </div>
        )}
        {status?.status === "DENIED" && <p className="ec-qr-error" role="alert">Подключение отклонено.</p>}
        {expired && <p className="ec-qr-error" role="alert">Код истёк. Создайте новый.</p>}
        {error && <p className="ec-qr-error" role="alert">{error}</p>}

        <div className="ec-qr-actions">
          {(expired || error || !payload) && mode !== "phone" && <button className="ec-btn ec-btn--secondary" type="button" onClick={() => void start()} disabled={busy}>Создать новый код</button>}
          {onBack && <button className="ec-btn ec-btn--ghost" type="button" onClick={() => void cancel()} disabled={busy}>Назад</button>}
        </div>
      </section>
    </main>
  );
}

