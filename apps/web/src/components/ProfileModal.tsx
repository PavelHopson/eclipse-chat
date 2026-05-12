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

const avatarSection: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "var(--ec-space-4)",
  padding: "var(--ec-space-3)",
  background: "var(--ec-surface-2)",
  border: "1px solid var(--ec-border-subtle)",
  borderRadius: "var(--ec-radius-md)",
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
      width={460}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className="ec-btn" disabled={busy}>
            Отмена
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            className="ec-btn ec-btn--primary"
            disabled={!canSave}
          >
            {busy ? "Сохраняем…" : "Сохранить"}
          </button>
        </>
      }
    >
      <section style={avatarSection}>
        <Avatar url={profile.avatar} name={profile.displayName} size={72} />
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--ec-space-2)", flex: 1 }}>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            style={{ display: "none" }}
            onChange={handleFile}
          />
          <div style={{ display: "flex", gap: "var(--ec-space-2)" }}>
            <button type="button" onClick={() => fileRef.current?.click()} className="ec-btn ec-btn--sm" disabled={busy}>
              {profile.avatar ? "Заменить" : "Загрузить"}
            </button>
            {profile.avatar && (
              <button
                type="button"
                onClick={() => void onDeleteAvatar()}
                className="ec-btn ec-btn--sm ec-btn--danger"
                disabled={busy}
              >
                Удалить
              </button>
            )}
          </div>
          <span style={{ fontSize: "var(--ec-text-2xs)", color: "var(--ec-text-dim)" }}>
            JPEG / PNG / WebP · до 5 МБ · обрежется до 256×256
          </span>
        </div>
      </section>

      <div>
        <label className="ec-field-label">Имя</label>
        <input
          className="ec-field"
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          maxLength={64}
          required
        />
        <span className="ec-field-counter">{trimmedName.length}/64</span>
      </div>

      <div>
        <label className="ec-field-label">О себе</label>
        <textarea
          className="ec-field ec-field--textarea"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          maxLength={280}
          rows={3}
          placeholder="Коротко о себе…"
        />
        <span className="ec-field-counter">{trimmedBio.length}/280</span>
      </div>

      <div style={{ fontSize: "var(--ec-text-xs)", color: "var(--ec-text-dim)" }}>
        Email: <span style={{ fontFamily: "var(--ec-font-mono)" }}>{profile.email}</span>
      </div>

      {error && (
        <p style={{ margin: 0, color: "var(--ec-danger)", fontSize: "var(--ec-text-sm)" }}>{error}</p>
      )}
    </Modal>
  );
}
