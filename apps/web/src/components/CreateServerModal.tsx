import { useState } from "react";
import { Modal } from "./Modal";

type Props = {
  onClose: () => void;
  onCreate: (name: string) => Promise<boolean>;
};

const inputStyle = {
  padding: "0.6rem 0.7rem",
  borderRadius: 8,
  border: "1px solid #2a2a32",
  background: "#1a1a20",
  color: "#e8e8ed",
  fontSize: "0.95rem",
};

export function CreateServerModal({ onClose, onCreate }: Props) {
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!name.trim() || submitting) {
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const ok = await onCreate(name.trim());
      if (ok) {
        onClose();
      } else {
        setError("Не удалось создать сервер");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title="Создать сервер"
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
            disabled={!name.trim() || submitting}
            style={{
              padding: "0.5rem 1rem",
              background: "#3b5ccc",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              opacity: !name.trim() || submitting ? 0.5 : 1,
              cursor: !name.trim() || submitting ? "default" : "pointer",
              fontWeight: 600,
            }}
          >
            {submitting ? "Создаю…" : "Создать"}
          </button>
        </>
      }
    >
      <p style={{ margin: 0, opacity: 0.7, fontSize: "0.88rem" }}>
        Вы автоматически становитесь владельцем сервера. Можно пригласить
        других участников по инвайт-коду из деталей сервера.
      </p>
      <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span style={{ fontSize: "0.85rem", opacity: 0.8 }}>Название</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void submit();
            }
          }}
          placeholder="Например — Команда"
          maxLength={80}
          autoFocus
          style={inputStyle}
        />
      </label>
      {error && <p style={{ margin: 0, color: "#f88", fontSize: "0.85rem" }}>{error}</p>}
    </Modal>
  );
}
