import { useState } from "react";
import { Modal } from "./Modal";

type Props = {
  onClose: () => void;
  onJoin: (inviteCode: string) => Promise<{ alreadyMember: boolean } | null>;
};

const inputStyle = {
  padding: "0.6rem 0.7rem",
  borderRadius: 8,
  border: "1px solid #2a2a32",
  background: "#1a1a20",
  color: "#e8e8ed",
  fontSize: "0.95rem",
  fontFamily: "monospace",
};

export function JoinServerModal({ onClose, onJoin }: Props) {
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const submit = async () => {
    const trimmed = code.trim();
    if (!trimmed || submitting) {
      return;
    }
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await onJoin(trimmed);
      if (!result) {
        setError("Не удалось вступить по инвайту");
        return;
      }
      if (result.alreadyMember) {
        setSuccess("Вы уже состоите в этом сервере. Сервер выбран в списке.");
      }
      setTimeout(() => onClose(), result.alreadyMember ? 900 : 0);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title="Вступить в сервер"
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            style={{ padding: "0.5rem 0.9rem", background: "transparent", color: "#c8c8d0", border: "1px solid #2a2a32", borderRadius: 8 }}
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={!code.trim() || submitting}
            style={{
              padding: "0.5rem 1rem",
              background: "#3b5ccc",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              opacity: !code.trim() || submitting ? 0.5 : 1,
              cursor: !code.trim() || submitting ? "default" : "pointer",
              fontWeight: 600,
            }}
          >
            {submitting ? "Проверяю…" : "Вступить"}
          </button>
        </>
      }
    >
      <p style={{ margin: 0, opacity: 0.7, fontSize: "0.88rem" }}>
        Вставьте инвайт-код от владельца сервера. Это идентификатор вида
        <code style={{ background: "#1a1a20", padding: "2px 6px", borderRadius: 4, marginLeft: 6 }}>cmp1fu5ik0005l2mko3s3y46a</code>.
      </p>
      <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span style={{ fontSize: "0.85rem", opacity: 0.8 }}>Инвайт-код</span>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void submit();
            }
          }}
          placeholder="cmpxxxxxxxxxxxxxxxxxxxxx"
          autoFocus
          spellCheck={false}
          style={inputStyle}
        />
      </label>
      {error && <p style={{ margin: 0, color: "#f88", fontSize: "0.85rem" }}>{error}</p>}
      {success && <p style={{ margin: 0, color: "#7fe195", fontSize: "0.85rem" }}>{success}</p>}
    </Modal>
  );
}
