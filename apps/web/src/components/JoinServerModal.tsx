import { useState } from "react";
import { Modal } from "./Modal";

type Props = {
  onClose: () => void;
  onJoin: (inviteCode: string) => Promise<{ alreadyMember: boolean } | null>;
};

export function JoinServerModal({ onClose, onJoin }: Props) {
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const submit = async () => {
    const trimmed = code.trim();
    if (!trimmed || submitting) return;
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
        setSuccess("Вы уже состоите в этом пространстве. Оно выбрано в списке.");
      }
      setTimeout(() => onClose(), result.alreadyMember ? 900 : 0);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title="Вступить в пространство"
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className="ec-btn">
            Отмена
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={!code.trim() || submitting}
            className="ec-btn ec-btn--primary"
          >
            {submitting ? "Проверяю…" : "Вступить"}
          </button>
        </>
      }
    >
      <p style={{ margin: 0, color: "var(--ec-text-muted)", fontSize: "var(--ec-text-sm)" }}>
        Вставьте инвайт-код от владельца пространства. Это идентификатор вида <code>cmp1fu5ik0005l2mko3s3y46a</code>.
      </p>
      <div>
        <label className="ec-field-label">Инвайт-код</label>
        <input
          className="ec-field"
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
          style={{ fontFamily: "var(--ec-font-mono)", fontSize: "var(--ec-text-sm)" }}
        />
      </div>
      {error && <p style={{ margin: 0, color: "var(--ec-danger)", fontSize: "var(--ec-text-sm)" }}>{error}</p>}
      {success && <p style={{ margin: 0, color: "var(--ec-ok)", fontSize: "var(--ec-text-sm)" }}>{success}</p>}
    </Modal>
  );
}
