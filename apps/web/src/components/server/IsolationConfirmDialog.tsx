import { useState } from "react";
import { Modal } from "../Modal";

/**
 * v1.5.55 Discord-parity D3 — Confirm modal для server isolation toggle.
 *
 * Два режима по `mode`:
 *   - "lock": показывает reason input + предупреждение «новые joins
 *     блокируются»; на submit → POST /api/servers/:id/lock через
 *     `useServers.updateServerLock(serverId, true, reason)`.
 *   - "unlock": подтверждение «снять изоляцию»; submit → DELETE.
 *
 * Permission UI gate в caller (ServerActionsMenu): trigger показывается
 * только OWNER/ADMIN. Backend re-validates 403.
 */
type Props = {
  mode: "lock" | "unlock";
  serverName: string;
  onSubmit: (reason?: string | null) => Promise<boolean>;
  onClose: () => void;
};

export function IsolationConfirmDialog({ mode, serverName, onSubmit, onClose }: Props) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const ok = await onSubmit(mode === "lock" ? reason.trim() || null : null);
    if (ok) {
      onClose();
    } else {
      setError(
        mode === "lock"
          ? "Не удалось закрыть сервер. Повторите."
          : "Не удалось снять изоляцию. Повторите.",
      );
      setBusy(false);
    }
  };

  const isLock = mode === "lock";

  return (
    <Modal
      title={isLock ? "Изоляция сервера" : "Снять изоляцию"}
      width={440}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="ec-btn" onClick={onClose} disabled={busy}>
            Отмена
          </button>
          <button
            type="button"
            className={"ec-btn " + (isLock ? "ec-btn--danger" : "ec-btn--primary")}
            onClick={() => void handleSubmit()}
            disabled={busy}
          >
            {busy
              ? "Применяем…"
              : isLock
              ? "Закрыть сервер"
              : "Снять изоляцию"}
          </button>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--ec-space-3)" }}>
        {isLock ? (
          <>
            <p style={{ margin: 0, color: "var(--ec-text-strong)" }}>
              <strong>«{serverName}»</strong> будет закрыт для новых пользователей.
            </p>
            <p style={{ margin: 0, color: "var(--ec-text-muted)", fontSize: "var(--ec-text-sm)" }}>
              Существующие участники продолжат работать; только POST <code>/join/:code</code>
              {" "}будет возвращать 403. Снять изоляцию можно из того же меню.
            </p>
            <label>
              <span className="ec-field-label">Причина (опционально)</span>
              <input
                className="ec-field"
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={500}
                placeholder="Например: подозрение на рейд"
                disabled={busy}
                autoFocus
              />
            </label>
          </>
        ) : (
          <p style={{ margin: 0, color: "var(--ec-text-strong)" }}>
            Открыть <strong>«{serverName}»</strong> для новых пользователей? Joins по
            invite-коду снова заработают.
          </p>
        )}
        {error && (
          <p
            style={{
              margin: 0,
              color: "var(--ec-text-danger, #f87171)",
              fontSize: "var(--ec-text-sm)",
            }}
          >
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}
