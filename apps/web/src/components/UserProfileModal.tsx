import { useEffect, useMemo, useState } from "react";
import { useUserProfile } from "../hooks/useUserProfile";
import { ROLE_LABELS_RU } from "../lib/memberRoles";
import { resolveAssetUrl } from "../lib/assets";
import { Avatar } from "./Avatar";
import { Modal } from "./Modal";

type Props = {
  userId: string;
  serverId: string | null;
  onClose: () => void;
  onMessage: (userId: string) => void;
  onEditSelf: () => void;
};

type MediaItem = {
  id: string;
  url: string;
  label: string;
};

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(value));
}

function presenceLabel(online: boolean, status: string): string {
  if (!online) return "Не в сети";
  if (status === "DND") return "Не беспокоить";
  if (status === "IDLE") return "Отошёл";
  return "В сети";
}

export function UserProfileModal({
  userId,
  serverId,
  onClose,
  onMessage,
  onEditSelf,
}: Props) {
  const { profile, loading, error, reload } = useUserProfile(userId, serverId);
  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);

  const media = useMemo<MediaItem[]>(() => {
    if (!profile) return [];
    const items: MediaItem[] = [];
    const seen = new Set<string>();
    const add = (id: string, url: string | null, label: string) => {
      if (!url || seen.has(url)) return;
      seen.add(url);
      items.push({ id, url, label });
    };
    add("avatar", profile.avatar, "Аватар");
    add("banner", profile.profileBanner, "Обложка");
    for (const image of profile.profileImages) add(image.id, image.url, "Фото профиля");
    return items;
  }, [profile]);
  const selectedIndex = selectedMedia
    ? media.findIndex((item) => item.id === selectedMedia.id)
    : -1;

  useEffect(() => {
    setSelectedMedia(null);
  }, [userId]);

  useEffect(() => {
    if (!selectedMedia) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setSelectedMedia(null);
      }
      if (event.key === "ArrowLeft" && media.length > 1) {
        event.preventDefault();
        const nextIndex = (selectedIndex - 1 + media.length) % media.length;
        setSelectedMedia(media[nextIndex]);
      }
      if (event.key === "ArrowRight" && media.length > 1) {
        event.preventDefault();
        const nextIndex = (selectedIndex + 1) % media.length;
        setSelectedMedia(media[nextIndex]);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [media, selectedIndex, selectedMedia]);

  return (
    <>
      <Modal title="Профиль" onClose={onClose} width={760} closeOnEscape={!selectedMedia}>
        {loading && !profile ? (
          <div className="ec-user-profile-skeleton" aria-label="Загрузка профиля">
            <div className="ec-user-profile-skeleton__banner" />
            <div className="ec-user-profile-skeleton__identity" />
            <div className="ec-user-profile-skeleton__line" />
            <div className="ec-user-profile-skeleton__line ec-user-profile-skeleton__line--short" />
          </div>
        ) : error || !profile ? (
          <div className="ec-user-profile-error" role="alert">
            <strong>Профиль не открылся</strong>
            <span>{error ?? "Пользователь недоступен"}</span>
            <button type="button" className="ec-btn ec-btn--primary" onClick={() => void reload()}>
              Повторить загрузку
            </button>
          </div>
        ) : (
          <article className="ec-user-profile">
            <div className="ec-user-profile__cover">
              {profile.profileBanner ? (
                <button
                  type="button"
                  className="ec-user-profile__cover-image"
                  onClick={() => {
                    const banner = media.find((item) => item.id === "banner");
                    if (banner) setSelectedMedia(banner);
                  }}
                  aria-label="Открыть обложку"
                >
                  <img src={resolveAssetUrl(profile.profileBanner) ?? ""} alt="" />
                </button>
              ) : (
                <div className="ec-user-profile__cover-fallback" aria-hidden>
                  <span />
                </div>
              )}
              <button
                type="button"
                className="ec-user-profile__avatar"
                onClick={() => {
                  const avatar = media.find((item) => item.id === "avatar");
                  if (avatar) setSelectedMedia(avatar);
                }}
                aria-label={profile.avatar ? "Открыть аватар" : "Аватар не загружен"}
                disabled={!profile.avatar}
              >
                <Avatar url={profile.avatar} name={profile.displayName} size={104} />
              </button>
            </div>

            <div className="ec-user-profile__content">
              <header className="ec-user-profile__identity">
                <div className="ec-user-profile__title">
                  <h3>{profile.displayName}</h3>
                  <span className={"ec-user-profile__presence" + (profile.online ? " is-online" : "")}>
                    <i aria-hidden />
                    {presenceLabel(profile.online, profile.status)}
                  </span>
                </div>
                <div className="ec-user-profile__actions">
                  {profile.isSelf ? (
                    <button type="button" className="ec-btn ec-btn--primary" onClick={onEditSelf}>
                      Настроить профиль
                    </button>
                  ) : profile.canMessage ? (
                    <button
                      type="button"
                      className="ec-btn ec-btn--primary"
                      onClick={() => onMessage(profile.id)}
                    >
                      Написать сообщение
                    </button>
                  ) : null}
                </div>
              </header>

              {(profile.activityEmoji || profile.activityText) && (
                <div className="ec-user-profile__activity">
                  {profile.activityEmoji && <span aria-hidden>{profile.activityEmoji}</span>}
                  <span>{profile.activityText || "Статус"}</span>
                </div>
              )}

              <section className="ec-user-profile__section">
                <span className="ec-user-profile__section-label">О себе</span>
                <p>{profile.bio || "Пользователь пока ничего о себе не рассказал."}</p>
              </section>

              <dl className="ec-user-profile__facts">
                {profile.serverContext && (
                  <div>
                    <dt>Роль в пространстве</dt>
                    <dd>{ROLE_LABELS_RU[profile.serverContext.role]}</dd>
                  </div>
                )}
                {profile.serverContext && (
                  <div>
                    <dt>В пространстве с</dt>
                    <dd>{formatDate(profile.serverContext.joinedAt)}</dd>
                  </div>
                )}
                <div>
                  <dt>В Eclipse Chat с</dt>
                  <dd>{formatDate(profile.createdAt)}</dd>
                </div>
              </dl>

              <section className="ec-user-profile__section ec-user-profile__media-section">
                <div className="ec-user-profile__section-heading">
                  <span className="ec-user-profile__section-label">Изображения</span>
                  <span>{media.length}</span>
                </div>
                {media.length > 0 ? (
                  <div className="ec-user-profile__media-grid">
                    {media.map((item) => (
                      <button
                        type="button"
                        key={item.id}
                        onClick={() => setSelectedMedia(item)}
                        aria-label={`Открыть: ${item.label}`}
                      >
                        <img src={resolveAssetUrl(item.url) ?? ""} alt="" loading="lazy" />
                        <span>{item.label}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="ec-user-profile__media-empty">
                    Здесь появятся фотографии, которые пользователь добавит в профиль.
                  </div>
                )}
              </section>
            </div>
          </article>
        )}
      </Modal>

      {selectedMedia && (
        <div
          className="ec-profile-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={selectedMedia.label}
          onClick={(event) => {
            if (event.currentTarget === event.target) setSelectedMedia(null);
          }}
        >
          <div className="ec-profile-lightbox__stage">
            {media.length > 1 && (
              <button
                type="button"
                className="ec-profile-lightbox__nav ec-profile-lightbox__nav--previous"
                onClick={() => {
                  const nextIndex = (selectedIndex - 1 + media.length) % media.length;
                  setSelectedMedia(media[nextIndex]);
                }}
                aria-label="Предыдущее изображение"
              >
                ‹
              </button>
            )}
            <img src={resolveAssetUrl(selectedMedia.url) ?? ""} alt={selectedMedia.label} />
            {media.length > 1 && (
              <button
                type="button"
                className="ec-profile-lightbox__nav ec-profile-lightbox__nav--next"
                onClick={() => {
                  const nextIndex = (selectedIndex + 1) % media.length;
                  setSelectedMedia(media[nextIndex]);
                }}
                aria-label="Следующее изображение"
              >
                ›
              </button>
            )}
            <div className="ec-profile-lightbox__bar">
              <span>{selectedMedia.label} · {selectedIndex + 1} из {media.length}</span>
              <button type="button" autoFocus onClick={() => setSelectedMedia(null)} aria-label="Закрыть изображение">
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
