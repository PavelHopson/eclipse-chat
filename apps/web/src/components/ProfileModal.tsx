import type { CSSProperties } from "react";
import { useRef, useState } from "react";
import { Avatar } from "./Avatar";
import { Modal } from "./Modal";
import type { Profile } from "../hooks/useProfile";

type Props = {
  profile: Profile;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (data: { displayName?: string; bio?: string | null }) => Promise<boolean>;
  onUploadAvatar: (file: File) => Promise<boolean>;
  onDeleteAvatar: () => Promise<boolean>;
};

const fieldBase: CSSProperties = {
  width: "100%",
  padding: "0.6rem 0.7rem",
  borderRadius: 8,
  border: "1px solid #2a2a32",
  background: "#1a1a20",
  color: "#e8e8ed",
  fontSize: "0.95rem",
  fontFamily: "inherit",
};

const labelStyle: CSSProperties = {
  display: "block",
  fontSize: "0.8rem",
  opacity: 0.7,
  marginBottom: 4,
};

const counterStyle: CSSProperties = {
  fontSize: "0.72rem",
  opacity: 0.5,
  textAlign: "right",
  marginTop: 4,
};

const buttonBase: CSSProperties = {
  padding: "0.55rem 0.9rem",
  borderRadius: 8,
  border: "1px solid #2a2a32",
  cursor: "pointer",
  fontSize: "0.85rem",
  background: "#1a1a20",
  color: "#c8c8d0",
};

const buttonPrimary: CSSProperties = {
  ...buttonBase,
  background: "#3b5ccc",
  color: "#fff",
  border: "1px solid #3b5ccc",
  fontWeight: 600,
};

const buttonDanger: CSSProperties = {
  ...buttonBase,
  color: "#f88",
  borderColor: "#3a1f24",
};

export function ProfileModal({
  profile,
  busy,
  error,
  onClose,
  onSave,
  onUploadAvatar,
  onDeleteAvatar,
}: Props) {
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [bio, setBio] = useState(profile.bio ?? "");
  const fileRef = useRef<HTMLInputElement>(null);

  const trimmedName = displayName.trim();
  const trimmedBio = bio.trim();
  const nameChanged = trimmedName !== profile.displayName.trim();
  const bioChanged = trimmedBio !== (profile.bio ?? "").trim();
  const canSave =
    !busy &&
    trimmedName.length >= 1 &&
    trimmedName.length <= 64 &&
    trimmedBio.length <= 280 &&
    (nameChanged || bioChanged);

  const handleSave = async () => {
    const data: { displayName?: string; bio?: string | null } = {};
    if (nameChanged) data.displayName = trimmedName;
    if (bioChanged) data.bio = trimmedBio === "" ? null : trimmedBio;
    if (Object.keys(data).length === 0) return;
    const ok = await onSave(data);
    if (ok) onClose();
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) {
      void onUploadAvatar(file);
    }
  };

  return (
    <Modal
      title="Профиль"
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} style={buttonBase} disabled={busy}>
            Отмена
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            style={{ ...buttonPrimary, opacity: canSave ? 1 : 0.55, cursor: canSave ? "pointer" : "default" }}
            disabled={!canSave}
          >
            {busy ? "Сохраняем…" : "Сохранить"}
          </button>
        </>
      }
    >
      <section style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <Avatar url={profile.avatar} name={profile.displayName} size={72} />
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            style={{ display: "none" }}
            onChange={handleFile}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            style={buttonBase}
            disabled={busy}
          >
            {profile.avatar ? "Заменить" : "Загрузить аватар"}
          </button>
          {profile.avatar && (
            <button
              type="button"
              onClick={() => void onDeleteAvatar()}
              style={buttonDanger}
              disabled={busy}
            >
              Удалить
            </button>
          )}
          <span style={{ fontSize: "0.72rem", opacity: 0.5 }}>JPEG/PNG/WebP · до 5 МБ</span>
        </div>
      </section>

      <label style={{ display: "block" }}>
        <span style={labelStyle}>Имя</span>
        <input
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          maxLength={64}
          required
          style={fieldBase}
        />
        <div style={counterStyle}>{trimmedName.length}/64</div>
      </label>

      <label style={{ display: "block" }}>
        <span style={labelStyle}>О себе</span>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          maxLength={280}
          rows={3}
          placeholder="Коротко о себе…"
          style={{ ...fieldBase, resize: "vertical", minHeight: 70 }}
        />
        <div style={counterStyle}>{trimmedBio.length}/280</div>
      </label>

      <div style={{ fontSize: "0.72rem", opacity: 0.5 }}>
        Email: {profile.email}
      </div>

      {error && (
        <p style={{ margin: 0, color: "#f88", fontSize: "0.85rem" }}>{error}</p>
      )}
    </Modal>
  );
}
