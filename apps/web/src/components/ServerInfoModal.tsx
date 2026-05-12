import { useState } from "react";
import type { CSSProperties } from "react";
import type { ServerRow } from "../hooks/useServers";
import { Modal } from "./Modal";

type Props = {
  server: ServerRow;
  onClose: () => void;
  onLeave: () => Promise<boolean>;
  onDelete: () => Promise<boolean>;
};

const codeBox: CSSProperties = {
  padding: "0.55rem 0.7rem",
  borderRadius: "var(--ec-radius-md)",
  border: "1px solid var(--ec-border-default)",
  background: "var(--ec-input-bg)",
  color: "var(--ec-text)",
  fontFamily: "var(--ec-font-mono)",
  fontSize: "var(--ec-text-sm)",
  wordBreak: "break-all",
};

const stat: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 2,
  padding: "var(--ec-space-2) var(--ec-space-3)",
  background: "var(--ec-surface-2)",
  border: "1px solid var(--ec-border-subtle)",
  borderRadius: "var(--ec-radius-md)",
};

const statLabel: CSSProperties = {
  fontSize: "var(--ec-text-2xs)",
  letterSpacing: "var(--ec-tracking-caps)",
  textTransform: "uppercase",
  color: "var(--ec-text-dim)",
  fontWeight: 600,
};

const statValue: CSSProperties = {
  fontSize: "var(--ec-text-md)",
  fontWeight: 600,
  color: "var(--ec-text-strong)",
  fontFeatureSettings: '"tnum"',
};

function buildInviteUrl(code: string): string {
  // ${origin}${BASE_URL}?invite=<code>. BASE_URL заканчивается /,
  // import.meta.env.BASE_URL=/eclipse-chat/ в prod → /eclipse-chat/?invite=...
  if (typeof window === "undefined") return `?invite=${code}`;
  return `${window.location.origin}${import.meta.env.BASE_URL}?invite=${encodeURIComponent(code)}`;
}

export function ServerInfoModal({ server, onClose, onLeave, onDelete }: Props) {
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isOwner = server.role === "OWNER";

  const inviteUrl = buildInviteUrl(server.inviteCode);

  const copyInviteCode = async () => {
    try {
      await navigator.clipboard.writeText(server.inviteCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 1500);
    } catch {
      setError("Не удалось скопировать (clipboard недоступен)");
    }
  };

  const copyInviteLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 1500);
    } catch {
      setError("Не удалось скопировать (clipboard недоступен)");
    }
  };

  const handleLeave = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const ok = await onLeave();
    if (ok) onClose();
    else setError("Не удалось покинуть сервер. Если вы владелец — сначала удалите сервер.");
    setBusy(false);
  };

  const handleDelete = async () => {
    if (busy) return;
    if (!window.confirm(`Удалить сервер «${server.name}»? Это удалит все каналы и сообщения.`)) {
      return;
    }
    setBusy(true);
    setError(null);
    const ok = await onDelete();
    if (ok) onClose();
    else setError("Не удалось удалить сервер");
    setBusy(false);
  };

  return (
    <Modal
      title={server.name}
      onClose={onClose}
      width={480}
      footer={
        <>
          <button type="button" onClick={onClose} className="ec-btn">
            Закрыть
          </button>
          {isOwner ? (
            <button type="button" onClick={() => void handleDelete()} disabled={busy} className="ec-btn ec-btn--danger">
              Удалить сервер
            </button>
          ) : (
            <button type="button" onClick={() => void handleLeave()} disabled={busy} className="ec-btn ec-btn--danger">
              Покинуть
            </button>
          )}
        </>
      }
    >
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "var(--ec-space-2)" }}>
        <div style={stat}>
          <span style={statLabel}>Роль</span>
          <span style={statValue}>{server.role}</span>
        </div>
        <div style={stat}>
          <span style={statLabel}>Каналов</span>
          <span style={statValue}>{server.channelCount}</span>
        </div>
        <div style={stat}>
          <span style={statLabel}>Участников</span>
          <span style={statValue}>{server.memberCount}</span>
        </div>
      </div>

      <div>
        <label className="ec-field-label">Инвайт-код</label>
        <div style={codeBox}>{server.inviteCode}</div>
        <div style={{ display: "flex", gap: "var(--ec-space-2)", marginTop: "var(--ec-space-2)" }}>
          <button
            type="button"
            onClick={() => void copyInviteCode()}
            className="ec-btn ec-btn--sm"
            style={{
              color: copiedCode ? "var(--ec-ok)" : undefined,
              borderColor: copiedCode ? "var(--ec-ok)" : undefined,
            }}
          >
            {copiedCode ? (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Код скопирован
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <rect x="9" y="9" width="13" height="13" rx="2" />
                  <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                </svg>
                Код
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => void copyInviteLink()}
            className="ec-btn ec-btn--sm ec-btn--primary"
            style={{
              background: copiedLink ? "var(--ec-ok)" : undefined,
              borderColor: copiedLink ? "var(--ec-ok)" : undefined,
            }}
            title={inviteUrl}
          >
            {copiedLink ? (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Ссылка скопирована
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
                  <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
                </svg>
                Ссылка-инвайт
              </>
            )}
          </button>
        </div>
      </div>

      <p style={{ margin: 0, fontSize: "var(--ec-text-xs)", color: "var(--ec-text-dim)" }}>
        Создан {new Date(server.createdAt).toLocaleDateString("ru-RU")}
      </p>

      {error && <p style={{ margin: 0, color: "var(--ec-danger)", fontSize: "var(--ec-text-sm)" }}>{error}</p>}
    </Modal>
  );
}
