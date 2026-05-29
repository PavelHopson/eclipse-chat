import { useEffect, useRef, useState } from "react";
import { Modal } from "./Modal";

type Props = {
  open: boolean;
  title: string;
  submitLabel: string;
  initialName?: string;
  onClose: () => void;
  onSubmit: (name: string) => Promise<boolean | unknown>;
};

export function CategoryCreateModal({
  open,
  title,
  submitLabel,
  initialName = "",
  onClose,
  onSubmit,
}: Props) {
  const [name, setName] = useState(initialName);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setName(initialName);
    setError(null);
    const t = window.setTimeout(() => inputRef.current?.focus(), 80);
    return () => window.clearTimeout(t);
  }, [open, initialName]);

  if (!open) return null;

  const trimmed = name.trim();
  const valid = trimmed.length >= 1 && trimmed.length <= 80;

  const handleSubmit = async () => {
    if (!valid || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await onSubmit(trimmed);
      if (result === false || result === null) {
        setError("Не удалось сохранить категорию");
        return;
      }
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось сохранить категорию");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title={title}
      onClose={onClose}
      width={420}
      footer={
        <>
          <button type="button" onClick={onClose} className="ec-btn ec-btn--ghost">
            Отмена
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={!valid || submitting}
            className="ec-btn ec-btn--primary"
          >
            {submitting ? "Сохраняем..." : submitLabel}
          </button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void handleSubmit();
        }}
      >
        <label className="ec-field-label" htmlFor="ec-category-name">
          Название категории
        </label>
        <input
          id="ec-category-name"
          ref={inputRef}
          className="ec-field"
          value={name}
          maxLength={80}
          onChange={(e) => setName(e.target.value)}
          placeholder="Например: ПРОЕКТЫ"
          aria-invalid={!valid && trimmed.length > 0}
        />
        <span className="ec-field-counter">{trimmed.length}/80</span>
        {error && <p className="ec-channel-category__error">{error}</p>}
      </form>
    </Modal>
  );
}
