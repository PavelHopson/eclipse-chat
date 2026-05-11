import { useState } from "react";
import type { ServerRow } from "../hooks/useServers";
import { Modal } from "./Modal";

type Props = {
  server: ServerRow;
  onClose: () => void;
  onLeave: () => Promise<boolean>;
  onDelete: () => Promise<boolean>;
};

const codeBox = {
  padding: "0.6rem 0.7rem",
  borderRadius: 8,
  border: "1px solid #2a2a32",
  background: "#1a1a20",
  color: "#e8e8ed",
  fontFamily: "monospace",
  fontSize: "0.88rem",
  wordBreak: "break-all" as const,
};

const dangerBtn = {
  padding: "0.5rem 0.9rem",
  background: "transparent",
  color: "#f88",
  border: "1px solid #5a2a32",
  borderRadius: 8,
  cursor: "pointer",
};

const stat = {
  display: "flex",
  flexDirection: "column" as const,
  gap: 2,
};

export function ServerInfoModal({ server, onClose, onLeave, onDelete }: Props) {
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isOwner = server.role === "OWNER";

  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(server.inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("Не удалось скопировать (clipboard недоступен)");
    }
  };

  const handleLeave = async () => {
    if (busy) {
      return;
    }
    setBusy(true);
    setError(null);
    const ok = await onLeave();
    if (ok) {
      onClose();
    } else {
      setError("Не удалось покинуть сервер. Если вы владелец — сначала удалите сервер.");
    }
    setBusy(false);
  };

  const handleDelete = async () => {
    if (busy) {
      return;
    }
    if (!window.confirm(`Удалить сервер «${server.name}»? Это удалит все каналы и сообщения.`)) {
      return;
    }
    setBusy(true);
    setError(null);
    const ok = await onDelete();
    if (ok) {
      onClose();
    } else {
      setError("Не удалось удалить сервер");
    }
    setBusy(false);
  };

  return (
    <Modal
      title={server.name}
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            style={{ padding: "0.5rem 0.9rem", background: "transparent", color: "#c8c8d0", border: "1px solid #2a2a32", borderRadius: 8 }}
          >
            Закрыть
          </button>
          {isOwner ? (
            <button type="button" onClick={() => void handleDelete()} disabled={busy} style={dangerBtn}>
              Удалить сервер
            </button>
          ) : (
            <button type="button" onClick={() => void handleLeave()} disabled={busy} style={dangerBtn}>
              Покинуть
            </button>
          )}
        </>
      }
    >
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        <div style={stat}>
          <span style={{ fontSize: "0.72rem", opacity: 0.5, textTransform: "uppercase" }}>Роль</span>
          <span style={{ fontSize: "0.95rem", fontWeight: 600 }}>{server.role}</span>
        </div>
        <div style={stat}>
          <span style={{ fontSize: "0.72rem", opacity: 0.5, textTransform: "uppercase" }}>Каналов</span>
          <span style={{ fontSize: "0.95rem", fontWeight: 600 }}>{server.channelCount}</span>
        </div>
        <div style={stat}>
          <span style={{ fontSize: "0.72rem", opacity: 0.5, textTransform: "uppercase" }}>Участников</span>
          <span style={{ fontSize: "0.95rem", fontWeight: 600 }}>{server.memberCount}</span>
        </div>
      </div>

      <div>
        <p style={{ margin: "0 0 6px", fontSize: "0.85rem", opacity: 0.8 }}>Инвайт-код для приглашения:</p>
        <div style={codeBox}>{server.inviteCode}</div>
        <button
          type="button"
          onClick={() => void copyInvite()}
          style={{
            marginTop: 6,
            padding: "0.4rem 0.7rem",
            background: copied ? "#13391d" : "#2a2a3a",
            color: copied ? "#7fe195" : "#e8e8ed",
            border: "1px solid #2a2a32",
            borderRadius: 6,
            cursor: "pointer",
            fontSize: "0.85rem",
          }}
        >
          {copied ? "Скопировано" : "Скопировать"}
        </button>
      </div>

      <p style={{ margin: 0, fontSize: "0.75rem", opacity: 0.5 }}>
        Создан {new Date(server.createdAt).toLocaleDateString()}
      </p>

      {error && <p style={{ margin: 0, color: "#f88", fontSize: "0.85rem" }}>{error}</p>}
    </Modal>
  );
}
