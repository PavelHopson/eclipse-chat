import type { ChangeEvent, RefObject } from "react";
import { Avatar } from "../../Avatar";
import type { Profile } from "../../../hooks/useProfile";

type Props = {
  profile: Profile;
  busy: boolean;
  error: string | null;
  displayName: string;
  bio: string;
  trimmedName: string;
  trimmedBio: string;
  canSave: boolean;
  fileRef: RefObject<HTMLInputElement | null>;
  onChangeDisplayName: (value: string) => void;
  onChangeBio: (value: string) => void;
  onSave: () => void;
  onFile: (event: ChangeEvent<HTMLInputElement>) => void;
  onDeleteAvatar: () => void;
};

export function AccountProfileSection({
  profile,
  busy,
  error,
  displayName,
  bio,
  trimmedName,
  trimmedBio,
  canSave,
  fileRef,
  onChangeDisplayName,
  onChangeBio,
  onSave,
  onFile,
  onDeleteAvatar,
}: Props) {
  return (
    <div className="ec-settings-section">
      <header className="ec-settings-section__hero ec-holo-edge">
        <span className="ec-settings-section__eyebrow">Учётная запись</span>
        <h2>Профиль</h2>
        <p>Аватар, имя и короткое описание, которые видит команда.</p>
      </header>

      <section className="ec-settings-card ec-settings-card--avatar">
        <Avatar url={profile.avatar} name={profile.displayName} size={72} />
        <div className="ec-settings-card__body">
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            hidden
            onChange={onFile}
          />
          <div className="ec-settings-actions">
            <button type="button" onClick={() => fileRef.current?.click()} className="ec-btn ec-btn--sm" disabled={busy}>
              {profile.avatar ? "Заменить" : "Загрузить"}
            </button>
            {profile.avatar && (
              <button
                type="button"
                onClick={onDeleteAvatar}
                className="ec-btn ec-btn--sm ec-btn--danger"
                disabled={busy}
              >
                Удалить
              </button>
            )}
          </div>
          <span className="ec-settings-muted">JPEG / PNG / WebP / HEIC · до 20 МБ · обрежется до 512×512</span>
        </div>
      </section>

      <section className="ec-settings-card ec-settings-card--stack">
        <label>
          <span className="ec-field-label">Имя</span>
          <input
            className="ec-field"
            type="text"
            value={displayName}
            onChange={(e) => onChangeDisplayName(e.target.value)}
            maxLength={64}
            required
          />
          <span className="ec-field-counter">{trimmedName.length}/64</span>
        </label>
        <label>
          <span className="ec-field-label">О себе</span>
          <textarea
            className="ec-field ec-field--textarea"
            value={bio}
            onChange={(e) => onChangeBio(e.target.value)}
            maxLength={280}
            rows={3}
            placeholder="Коротко о себе…"
          />
          <span className="ec-field-counter">{trimmedBio.length}/280</span>
        </label>
        <div className="ec-settings-muted">
          Email: <span className="ec-settings-mono">{profile.email}</span>
        </div>
        {error && <p className="ec-settings-error">{error}</p>}
        <button
          type="button"
          onClick={onSave}
          className="ec-btn ec-btn--primary"
          disabled={!canSave}
        >
          {busy ? "Сохраняем…" : "Сохранить"}
        </button>
      </section>
    </div>
  );
}
