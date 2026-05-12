import { useState } from "react";
import { Modal } from "./Modal";

type Props = {
  onClose: () => void;
  onCreate: (name: string) => Promise<boolean>;
};

export function CreateServerModal({ onClose, onCreate }: Props) {
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!name.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const ok = await onCreate(name.trim());
      if (ok) onClose();
      else setError("Не удалось создать сервер");
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
          <button type="button" onClick={onClose} className="ec-btn">
            Отмена
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={!name.trim() || submitting}
            className="ec-btn ec-btn--primary"
          >
            {submitting ? "Создаю…" : "Создать"}
          </button>
        </>
      }
    >
      <p style={{ margin: 0, color: "var(--ec-text-muted)", fontSize: "var(--ec-text-sm)" }}>
        Вы автоматически становитесь владельцем сервера. Других участников можно пригласить
        по инвайт-коду из деталей сервера.
      </p>
      <div>
        <label className="ec-field-label">Название</label>
        <input
          className="ec-field"
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
        />
      </div>
      {error && <p style={{ margin: 0, color: "var(--ec-danger)", fontSize: "var(--ec-text-sm)" }}>{error}</p>}
    </Modal>
  );
}
