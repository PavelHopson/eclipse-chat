import { useMemo, useState } from "react";
import { ApiError } from "../../lib/api";
import type { FriendRequestInput, FriendRequestResponse } from "../../types/api";
import { Modal } from "../Modal";

type Mode = "email" | "displayName";

type Props = {
  onClose: () => void;
  onSend: (input: FriendRequestInput) => Promise<FriendRequestResponse>;
};

function successText(result: FriendRequestResponse): string {
  if (result.autoAccepted) return "Встречный запрос принят. Теперь вы друзья.";
  if (result.friendship.status === "ACCEPTED") return "Уже друзья.";
  if (result.alreadyPending) return "Запрос уже отправлен.";
  return "Запрос отправлен.";
}

function errorText(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 404) return "Пользователь не найден.";
    if (error.status === 403) return "Невозможно добавить: одна из сторон заблокирована.";
    if (error.status === 409) return "Найдено несколько пользователей с таким именем. Уточните email.";
    if (error.status === 429) return "Слишком много запросов. Попробуйте позже.";
    if (error.status === 400) return "Проверьте ввод: нужен email или точное имя.";
  }
  return "Не удалось отправить запрос.";
}

export function AddFriendDialog({ onClose, onSend }: Props) {
  const [mode, setMode] = useState<Mode>("email");
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const trimmed = value.trim();
  const canSubmit = useMemo(() => {
    if (busy) return false;
    if (mode === "email") return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
    return trimmed.length >= 2 && trimmed.length <= 64;
  }, [busy, mode, trimmed]);

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      const result = await onSend(
        mode === "email" ? { email: trimmed } : { displayName: trimmed },
      );
      setDone(successText(result));
      setValue("");
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Добавить друга"
      width={430}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="ec-btn" onClick={onClose} disabled={busy}>
            Закрыть
          </button>
          <button
            type="button"
            className="ec-btn ec-btn--primary"
            onClick={() => void submit()}
            disabled={!canSubmit}
          >
            {busy ? "Отправляем..." : "Отправить запрос"}
          </button>
        </>
      }
    >
      <div className="ec-friend-add-mode" role="radiogroup" aria-label="Как найти пользователя">
        <button
          type="button"
          role="radio"
          aria-checked={mode === "email"}
          className={mode === "email" ? "is-active" : ""}
          onClick={() => {
            setMode("email");
            setValue("");
            setError(null);
            setDone(null);
          }}
        >
          Email
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={mode === "displayName"}
          className={mode === "displayName" ? "is-active" : ""}
          onClick={() => {
            setMode("displayName");
            setValue("");
            setError(null);
            setDone(null);
          }}
        >
          Имя
        </button>
      </div>

      <div>
        <label className="ec-field-label">
          {mode === "email" ? "Email пользователя" : "Точное отображаемое имя"}
        </label>
        <input
          className="ec-field"
          type={mode === "email" ? "email" : "text"}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError(null);
            setDone(null);
          }}
          placeholder={mode === "email" ? "name@example.com" : "Например, Pavel"}
          maxLength={mode === "email" ? 254 : 64}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter") void submit();
          }}
        />
      </div>

      {error && <p className="ec-friend-form-error">{error}</p>}
      {done && <p className="ec-friend-form-success">{done}</p>}
    </Modal>
  );
}
