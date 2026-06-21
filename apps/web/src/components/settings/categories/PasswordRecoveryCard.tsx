import { useState } from "react";
import { apiJson, ApiError } from "../../../lib/api";

/**
 * PasswordRecoveryCard (v1.6.68) — генерация одноразовых кодов восстановления
 * ПАРОЛЯ (self-serve «забыли пароль» без email/SMTP). Самодостаточный: свой
 * state + вызов /api/auth/password-recovery/generate (требует re-confirm
 * пароля — коды обходят пароль). Коды показываются ОДИН раз.
 */
const codeBox: React.CSSProperties = {
  fontFamily: "var(--ec-font-mono, ui-monospace, monospace)",
  fontSize: "var(--ec-text-sm)",
  letterSpacing: "0.08em",
  padding: "5px 9px",
  background: "var(--ec-surface-2)",
  border: "1px solid var(--ec-border-subtle)",
  borderRadius: "var(--ec-radius-sm)",
  color: "var(--ec-text-strong)",
  textAlign: "center",
};

export function PasswordRecoveryCard() {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [copied, setCopied] = useState(false);

  const generate = async () => {
    if (busy || !password) return;
    setBusy(true);
    setError(null);
    try {
      const res = await apiJson<{ ok: boolean; recoveryCodes: string[] }>(
        "/api/auth/password-recovery/generate",
        { method: "POST", body: JSON.stringify({ password }) },
      );
      setCodes(res.recoveryCodes);
      setPassword("");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Не удалось создать коды");
    } finally {
      setBusy(false);
    }
  };

  const copyAll = () => {
    if (!codes) return;
    void navigator.clipboard
      ?.writeText(codes.join("\n"))
      .then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => undefined);
  };

  return (
    <section className="ec-settings-card ec-settings-card--stack">
      <div className="ec-settings-card__row">
        <div className="ec-settings-icon" aria-hidden>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="7.5" cy="15.5" r="4.5" />
            <path d="M10.5 12.5 21 2m-4 0 4 4m-7 3 3 3" />
          </svg>
        </div>
        <div className="ec-settings-card__body">
          <strong>Коды восстановления пароля</strong>
          <span className="ec-settings-muted">
            Одноразовые коды на случай, если забудешь пароль. На входе нажми
            «Забыли пароль?», введи код — задашь новый пароль. Email не нужен.
          </span>
        </div>
        {!open && !codes && (
          <button type="button" className="ec-btn ec-btn--ghost ec-btn--sm" onClick={() => setOpen(true)}>
            Сгенерировать
          </button>
        )}
      </div>

      {open && !codes && (
        <>
          <label>
            <span className="ec-field-label">Подтверди текущим паролем</span>
            <input
              className="ec-field"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              placeholder="Текущий пароль"
            />
          </label>
          {error && <span className="ec-settings-error">{error}</span>}
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="ec-btn ec-btn--primary ec-btn--sm" onClick={generate} disabled={busy || !password}>
              {busy ? "Создаём…" : "Создать коды"}
            </button>
            <button type="button" className="ec-btn ec-btn--ghost ec-btn--sm" onClick={() => { setOpen(false); setError(null); setPassword(""); }}>
              Отмена
            </button>
          </div>
        </>
      )}

      {codes && (
        <>
          <span className="ec-settings-ok">✓ 10 кодов готовы. Сохрани их — показываются ОДИН раз. Старые коды (если были) больше не действуют.</span>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, margin: "2px 0" }}>
            {codes.map((c) => (
              <code key={c} style={codeBox}>{c}</code>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="ec-btn ec-btn--ghost ec-btn--sm" onClick={copyAll}>
              {copied ? "Скопировано ✓" : "Скопировать все"}
            </button>
            <button type="button" className="ec-btn ec-btn--ghost ec-btn--sm" onClick={() => { setCodes(null); setOpen(false); }}>
              Готово
            </button>
          </div>
        </>
      )}
    </section>
  );
}
