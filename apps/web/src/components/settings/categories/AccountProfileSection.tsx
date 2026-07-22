import type { ChangeEvent, RefObject } from "react";
import { Avatar } from "../../Avatar";
import type { Profile } from "../../../hooks/useProfile";
import { resolveAssetUrl } from "../../../lib/assets";

type Props = {
  profile: Profile;
  busy: boolean;
  error: string | null;
  displayName: string;
  bio: string;
  trimmedName: string;
  trimmedBio: string;
  canSave: boolean;
  avatarFileRef: RefObject<HTMLInputElement | null>;
  bannerFileRef: RefObject<HTMLInputElement | null>;
  galleryFileRef: RefObject<HTMLInputElement | null>;
  onChangeDisplayName: (value: string) => void;
  onChangeBio: (value: string) => void;
  onSave: () => void;
  onAvatarFile: (event: ChangeEvent<HTMLInputElement>) => void;
  onBannerFile: (event: ChangeEvent<HTMLInputElement>) => void;
  onGalleryFile: (event: ChangeEvent<HTMLInputElement>) => void;
  onDeleteAvatar: () => void;
  onDeleteBanner: () => void;
  onDeleteProfileImage: (imageId: string) => void;
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
  avatarFileRef,
  bannerFileRef,
  galleryFileRef,
  onChangeDisplayName,
  onChangeBio,
  onSave,
  onAvatarFile,
  onBannerFile,
  onGalleryFile,
  onDeleteAvatar,
  onDeleteBanner,
  onDeleteProfileImage,
}: Props) {
  return (
    <div className="ec-settings-section">
      <header className="ec-settings-section__hero ec-holo-edge">
        <span className="ec-settings-section__eyebrow">Учётная запись</span>
        <h2>Профиль</h2>
        <p>Так тебя видит команда: обложка, аватар, статус и фотографии.</p>
      </header>

      <section className="ec-settings-profile-preview" aria-label="Предпросмотр профиля">
        <div className="ec-settings-profile-preview__cover">
          {profile.profileBanner ? (
            <img src={resolveAssetUrl(profile.profileBanner) ?? ""} alt="" />
          ) : (
            <span aria-hidden />
          )}
        </div>
        <div className="ec-settings-profile-preview__identity">
          <Avatar url={profile.avatar} name={displayName || profile.displayName} size={84} />
          <div>
            <strong>{displayName.trim() || profile.displayName}</strong>
            <span>{bio.trim() || "Короткое описание появится здесь"}</span>
          </div>
          <small>Так профиль видит команда</small>
        </div>
      </section>

      <section className="ec-settings-card ec-settings-card--profile-media">
        <div className="ec-settings-media-control">
          <div>
            <strong>Аватар</strong>
            <span className="ec-settings-muted">Квадратное фото · до 20 МБ</span>
          </div>
          <input
            ref={avatarFileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif,.heic,.heif"
            hidden
            onChange={onAvatarFile}
          />
          <div className="ec-settings-actions">
            <button type="button" onClick={() => avatarFileRef.current?.click()} className="ec-btn ec-btn--sm" disabled={busy}>
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
        </div>

        <div className="ec-settings-media-control">
          <div>
            <strong>Обложка</strong>
            <span className="ec-settings-muted">Широкое изображение · обрежется до 1600×600</span>
          </div>
          <input
            ref={bannerFileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif,.heic,.heif"
            hidden
            onChange={onBannerFile}
          />
          <div className="ec-settings-actions">
            <button type="button" onClick={() => bannerFileRef.current?.click()} className="ec-btn ec-btn--sm" disabled={busy}>
              {profile.profileBanner ? "Заменить" : "Добавить"}
            </button>
            {profile.profileBanner && (
              <button type="button" onClick={onDeleteBanner} className="ec-btn ec-btn--sm ec-btn--danger" disabled={busy}>
                Удалить
              </button>
            )}
          </div>
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

      <section className="ec-settings-card ec-settings-card--stack">
        <div className="ec-settings-gallery-heading">
          <div>
            <strong>Фотографии профиля</strong>
            <span className="ec-settings-muted">До 8 изображений, которые увидят участники твоих пространств.</span>
          </div>
          <input
            ref={galleryFileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif,.heic,.heif"
            hidden
            onChange={onGalleryFile}
          />
          <button
            type="button"
            className="ec-btn ec-btn--sm"
            onClick={() => galleryFileRef.current?.click()}
            disabled={busy || profile.profileImages.length >= 8}
          >
            {profile.profileImages.length >= 8 ? "Галерея заполнена" : "Добавить фото"}
          </button>
        </div>
        {profile.profileImages.length > 0 ? (
          <div className="ec-settings-gallery-grid">
            {profile.profileImages.map((image) => (
              <figure key={image.id}>
                <img src={resolveAssetUrl(image.url) ?? ""} alt="Фото профиля" loading="lazy" />
                <button
                  type="button"
                  onClick={() => onDeleteProfileImage(image.id)}
                  disabled={busy}
                  aria-label="Удалить фотографию из профиля"
                >
                  Удалить
                </button>
              </figure>
            ))}
          </div>
        ) : (
          <button
            type="button"
            className="ec-settings-gallery-empty"
            onClick={() => galleryFileRef.current?.click()}
            disabled={busy}
          >
            <strong>Добавь первое фото</strong>
            <span>Профиль станет живее, а команда быстрее узнает тебя.</span>
          </button>
        )}
      </section>
    </div>
  );
}
