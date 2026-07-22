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
    <div className="ec-settings-section ec-settings-section--profile">
      <header className="ec-settings-section__hero ec-settings-profile-hero ec-holo-edge">
        <div>
          <span className="ec-settings-section__eyebrow">Учётная запись</span>
          <h2>Профиль</h2>
          <p>Твоя карточка в сообщениях, комнатах и списке участников.</p>
        </div>
        <span className="ec-settings-profile-visibility">
          <i aria-hidden /> Видно команде
        </span>
      </header>

      <section className="ec-settings-profile-preview" aria-label="Предпросмотр профиля" aria-busy={busy}>
        <div className="ec-settings-profile-preview__cover">
          {profile.profileBanner ? (
            <img src={resolveAssetUrl(profile.profileBanner) ?? ""} alt="" />
          ) : (
            <span aria-hidden />
          )}
          <div className="ec-settings-profile-preview__cover-actions">
            <button
              type="button"
              onClick={() => bannerFileRef.current?.click()}
              className="ec-btn ec-btn--sm ec-settings-profile-media-button"
              disabled={busy}
            >
              {profile.profileBanner ? "Изменить обложку" : "Добавить обложку"}
            </button>
            {profile.profileBanner && (
              <button
                type="button"
                onClick={onDeleteBanner}
                className="ec-btn ec-btn--sm ec-btn--danger ec-settings-profile-media-button"
                disabled={busy}
              >
                Удалить
              </button>
            )}
          </div>
        </div>
        <div className="ec-settings-profile-preview__identity">
          <div className="ec-settings-profile-preview__avatar">
            <Avatar url={profile.avatar} name={displayName || profile.displayName} size={88} />
            <button
              type="button"
              onClick={() => avatarFileRef.current?.click()}
              className="ec-settings-profile-preview__avatar-edit"
              aria-label={profile.avatar ? "Изменить аватар" : "Добавить аватар"}
              disabled={busy}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" />
              </svg>
            </button>
          </div>
          <div className="ec-settings-profile-preview__copy">
            <strong>{displayName.trim() || profile.displayName}</strong>
            <span>{bio.trim() || "Короткое описание появится здесь"}</span>
          </div>
          <div className="ec-settings-profile-preview__avatar-actions">
            <button
              type="button"
              onClick={() => avatarFileRef.current?.click()}
              className="ec-btn ec-btn--sm"
              disabled={busy}
            >
              {profile.avatar ? "Заменить фото" : "Добавить фото"}
            </button>
            {profile.avatar && (
              <button type="button" onClick={onDeleteAvatar} className="ec-btn ec-btn--sm ec-btn--danger" disabled={busy}>
                Удалить
              </button>
            )}
          </div>
        </div>
        <input
          ref={avatarFileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif,.heic,.heif"
          hidden
          onChange={onAvatarFile}
        />
        <input
          ref={bannerFileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif,.heic,.heif"
          hidden
          onChange={onBannerFile}
        />
      </section>

      <section className="ec-settings-card ec-settings-card--stack ec-settings-profile-details">
        <div className="ec-settings-profile-card-heading">
          <div>
            <strong>Основная информация</strong>
            <span className="ec-settings-muted">Имя и описание видны участникам общих пространств.</span>
          </div>
          <span className="ec-settings-profile-card-heading__hint">До 280 символов</span>
        </div>
        <div className="ec-settings-profile-fields">
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
              placeholder="Например: продуктовый дизайнер · строю понятные системы"
            />
            <span className="ec-field-counter">{trimmedBio.length}/280</span>
          </label>
        </div>
        {error && <p className="ec-settings-error">{error}</p>}
        <div className="ec-settings-profile-footer">
          <div className="ec-settings-profile-account">
            <span>Аккаунт</span>
            <strong className="ec-settings-mono">{profile.email}</strong>
          </div>
          <button
            type="button"
            onClick={onSave}
            className="ec-btn ec-btn--primary"
            disabled={!canSave}
          >
            {busy ? "Сохраняем…" : "Сохранить профиль"}
          </button>
        </div>
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
