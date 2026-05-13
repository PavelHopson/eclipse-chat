import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import { Modal } from "./Modal";
import { ApiError, apiJson } from "../lib/api";

type Props = {
  /** Текущее состояние 2FA. */
  initialEnabled: boolean;
  onClose: () => void;
  /** Уведомить parent что 2FA flipped — он refresh'нет profile. */
  onChanged?: (enabled: boolean) => void;
};

type Step =
  | "intro" /* показываем enable button или disable form */
  | "qr" /* setup → отображаем QR + поле кода */
  | "recovery" /* enable success → recovery codes */
  | "disable" /* confirm with password */;

type SetupResponse = {
  secret: string;
  otpAuthUrl: string;
  qrDataUrl: string;
};

type EnableResponse = {
  ok: boolean;
  recoveryCodes: string[];
};

const card: CSSProperties = {
  background: "var(--ec-surface-2)",
  border: "1px solid var(--ec-border-default)",
  borderRadius: "var(--ec-radius-md)",
  padding: "var(--ec-space-4)",
  display: "flex",
  flexDirection: "column",
  gap: "var(--ec-space-3)",
};

const codeChip: CSSProperties = {
  fontFamily: "var(--ec-font-mono)",
  fontSize: "var(--ec-text-sm)",
  fontWeight: 600,
  padding: "0.4rem 0.6rem",
  background: "var(--ec-input-bg)",
  border: "1px solid var(--ec-border-default)",
  borderRadius: "var(--ec-radius-sm)",
  color: "var(--ec-text-strong)",
  letterSpacing: "0.05em",
  textAlign: "center",
};

const hint: CSSProperties = {
  fontSize: "var(--ec-text-2xs)",
  color: "var(--ec-text-dim)",
  lineHeight: 1.5,
  margin: 0,
};

const input: CSSProperties = {
  width: "100%",
  padding: "0.55rem 0.7rem",
  borderRadius: "var(--ec-radius-md)",
  border: "1px solid var(--ec-border-default)",
  background: "var(--ec-surface-1)",
  color: "var(--ec-text)",
  fontSize: "var(--ec-text-base)",
  fontFamily: "var(--ec-font-mono)",
  letterSpacing: "0.15em",
  textAlign: "center",
};

export function TwoFactorSetupModal({
  initialEnabled,
  onClose,
  onChanged,
}: Props) {
  const [step, setStep] = useState<Step>(initialEnabled ? "disable" : "intro");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [setup, setSetup] = useState<SetupResponse | null>(null);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);

  const startSetup = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await apiJson<SetupResponse>("/api/auth/2fa/setup", {
        method: "POST",
      });
      setSetup(res);
      setStep("qr");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Не удалось начать установку");
    } finally {
      setBusy(false);
    }
  };

  const confirmEnable = async () => {
    if (!/^\d{6}$/.test(code)) {
      setError("Код должен быть 6 цифр");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await apiJson<EnableResponse>("/api/auth/2fa/enable", {
        method: "POST",
        body: JSON.stringify({ code }),
      });
      setRecoveryCodes(res.recoveryCodes);
      setStep("recovery");
      onChanged?.(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Не удалось включить");
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    if (!password) {
      setError("Введи пароль");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await apiJson("/api/auth/2fa/disable", {
        method: "POST",
        body: JSON.stringify({ password }),
      });
      onChanged?.(false);
      onClose();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Не удалось отключить");
    } finally {
      setBusy(false);
    }
  };

  // Auto-focus code input при появлении
  useEffect(() => {
    if (step === "qr") {
      setTimeout(() => {
        document.querySelector<HTMLInputElement>("#tfa-code-input")?.focus();
      }, 80);
    }
  }, [step]);

  return (
    <Modal title="Двухфакторная аутентификация" onClose={onClose} width={520}>
      {error && (
        <div
          style={{
            padding: "var(--ec-space-2) var(--ec-space-3)",
            background: "var(--ec-danger-soft)",
            color: "var(--ec-danger)",
            borderRadius: "var(--ec-radius-sm)",
            fontSize: "var(--ec-text-sm)",
          }}
        >
          {error}
        </div>
      )}

      {step === "intro" && (
        <div style={card}>
          <h3 style={{ margin: 0, fontSize: "var(--ec-text-lg)", color: "var(--ec-text-strong)" }}>
            Защита через TOTP
          </h3>
          <p style={hint}>
            Дополнительный 6-значный код из приложения-аутентификатора
            (Google Authenticator, Authy, 1Password, Bitwarden) на каждый вход.
            Если пароль украдут — без этого кода всё равно не зайдут.
          </p>
          <button
            type="button"
            onClick={() => void startSetup()}
            disabled={busy}
            className="ec-btn ec-btn--primary"
          >
            {busy ? "Готовим…" : "Включить 2FA"}
          </button>
        </div>
      )}

      {step === "qr" && setup && (
        <div style={card}>
          <h3 style={{ margin: 0, fontSize: "var(--ec-text-md)", color: "var(--ec-text-strong)" }}>
            Отсканируй QR в приложении
          </h3>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <img
              src={setup.qrDataUrl}
              alt="2FA QR"
              style={{
                width: 220,
                height: 220,
                borderRadius: "var(--ec-radius-md)",
                background: "#fff",
                padding: 8,
                border: "1px solid var(--ec-border-default)",
              }}
            />
          </div>
          <details
            style={{
              fontSize: "var(--ec-text-2xs)",
              color: "var(--ec-text-muted)",
            }}
          >
            <summary style={{ cursor: "pointer", marginBottom: 4 }}>
              Не сканируется? Ввести вручную
            </summary>
            <p style={{ margin: "6px 0", color: "var(--ec-text-dim)" }}>
              Тип: <b>TOTP</b>. Источник: <b>Eclipse Chat</b>. Период: <b>30 сек</b>.
            </p>
            <code
              style={{
                display: "block",
                padding: "0.4rem 0.6rem",
                background: "var(--ec-input-bg)",
                borderRadius: "var(--ec-radius-sm)",
                wordBreak: "break-all",
                fontFamily: "var(--ec-font-mono)",
              }}
            >
              {setup.secret}
            </code>
          </details>
          <label
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 4,
              marginTop: "var(--ec-space-2)",
            }}
          >
            <span style={{ fontSize: "var(--ec-text-2xs)", color: "var(--ec-text-muted)" }}>
              Введи 6-значный код из приложения:
            </span>
            <input
              id="tfa-code-input"
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="123456"
              style={input}
              autoComplete="one-time-code"
            />
          </label>
          <button
            type="button"
            onClick={() => void confirmEnable()}
            disabled={busy || code.length !== 6}
            className="ec-btn ec-btn--primary"
          >
            {busy ? "Проверяем…" : "Подтвердить"}
          </button>
        </div>
      )}

      {step === "recovery" && recoveryCodes && (
        <div style={card}>
          <h3 style={{ margin: 0, fontSize: "var(--ec-text-md)", color: "var(--ec-text-strong)" }}>
            ✓ 2FA включён. Запиши recovery-коды:
          </h3>
          <p style={hint}>
            Это твой резерв если потеряешь телефон. Каждый код одноразовый.
            Сохрани в менеджер паролей сейчас — больше не покажем.
          </p>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap: 8,
            }}
          >
            {recoveryCodes.map((c, i) => (
              <code key={i} style={codeChip}>
                {c}
              </code>
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard?.writeText(recoveryCodes.join("\n")).catch(() => undefined);
            }}
            className="ec-btn ec-btn--sm"
            style={{ alignSelf: "flex-start" }}
          >
            Скопировать все
          </button>
          <button
            type="button"
            onClick={onClose}
            className="ec-btn ec-btn--primary"
          >
            Я сохранил, готово
          </button>
        </div>
      )}

      {step === "disable" && (
        <div style={card}>
          <h3 style={{ margin: 0, fontSize: "var(--ec-text-md)", color: "var(--ec-text-strong)" }}>
            2FA включён
          </h3>
          <p style={hint}>
            Чтобы отключить — введи свой текущий пароль. После отключения secret
            и recovery-коды будут удалены.
          </p>
          <label
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 4,
            }}
          >
            <span style={{ fontSize: "var(--ec-text-2xs)", color: "var(--ec-text-muted)" }}>
              Пароль:
            </span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ ...input, fontFamily: "inherit", letterSpacing: 0, textAlign: "left" }}
              autoComplete="current-password"
            />
          </label>
          <div style={{ display: "flex", gap: "var(--ec-space-2)", justifyContent: "flex-end" }}>
            <button type="button" onClick={onClose} className="ec-btn">
              Отмена
            </button>
            <button
              type="button"
              onClick={() => void disable()}
              disabled={busy || !password}
              className="ec-btn ec-btn--danger"
            >
              {busy ? "Отключаем…" : "Отключить 2FA"}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
