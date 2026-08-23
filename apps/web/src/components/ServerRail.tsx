import type { ReactNode } from "react";
import type { ServerRow } from "../hooks/useServers";
import { ServerIcon } from "./ServerSwitcher";

/**
 * Постоянный global dock: продуктовые поверхности сверху, пространства в
 * середине, scoped control points снизу. Подписи намеренно видимы — core flow
 * не должен зависеть от tooltip или знания значения пиктограммы.
 */

type Props = {
  servers: ServerRow[];
  activeServerId: string | null;
  onSelect: (id: string) => void;
  onCreateRequest: () => void;
  onJoinRequest: () => void;
  homeActive: boolean;
  onHomeRequest: () => void;
  dmsActive?: boolean;
  dmsUnread?: number;
  onDmsRequest?: () => void;
  onFriendsRequest: () => void;
  friendsActive: boolean;
  friendsPending?: number;
  onProfileRequest: () => void;
  profileActive: boolean;
  officeActive: boolean;
  onOfficeRequest: () => void;
  adminActive?: boolean;
  onAdminRequest?: () => void;
  platformAdminActive?: boolean;
  onPlatformAdminRequest?: () => void;
  canCreateServer?: boolean;
  creationAllowed?: boolean;
  ownedCount?: number;
  maxOwnedServers?: number;
};

function RailButton({
  label,
  active = false,
  disabled = false,
  unread = 0,
  variant = "icon",
  caption,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  unread?: number;
  /** "icon" — круглая навигационная (Дом/ЛС/+); "server" — квадратная иконка. */
  variant?: "icon" | "server";
  caption?: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={
        "ec-rail__btn ec-rail__btn--" +
        variant +
        (caption ? " ec-rail__btn--captioned" : "") +
        (active ? " is-active" : "")
      }
      aria-label={label}
      aria-current={active ? "page" : undefined}
      title={label}
      disabled={disabled}
      onClick={onClick}
    >
      <span className="ec-rail__pill" aria-hidden />
      <span className="ec-rail__glyph">{children}</span>
      {caption && <span className="ec-rail__caption" aria-hidden>{caption}</span>}
      {unread > 0 && !active && (
        <span className="ec-rail__badge" aria-label={`${unread} непрочитанных`}>
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </button>
  );
}

export function ServerRail({
  servers,
  activeServerId,
  onSelect,
  onCreateRequest,
  onJoinRequest,
  homeActive,
  onHomeRequest,
  dmsActive = false,
  dmsUnread = 0,
  onDmsRequest,
  onFriendsRequest,
  friendsActive,
  friendsPending = 0,
  onProfileRequest,
  profileActive,
  officeActive,
  onOfficeRequest,
  adminActive = false,
  onAdminRequest,
  platformAdminActive = false,
  onPlatformAdminRequest,
  canCreateServer = true,
  creationAllowed = true,
  ownedCount = 0,
  maxOwnedServers = 2,
}: Props) {
  const addTooltip = !creationAllowed
    ? "Создавать пространства может только владелец платформы"
    : canCreateServer
    ? "Создать пространство"
    : `Лимит ${maxOwnedServers} пространств (создано ${ownedCount})`;

  return (
    <nav className="ec-rail" aria-label="Основная навигация">
      <div className="ec-rail__group" aria-label="Рабочие поверхности">
        <RailButton
          label="Сводка — важное по всем пространствам"
          caption="Сводка"
          active={homeActive}
          onClick={onHomeRequest}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M4 13h6V4H4zM14 20h6v-9h-6zM4 20h6v-3H4zM14 7h6V4h-6z" />
          </svg>
        </RailButton>
        {onDmsRequest && (
          <RailButton
            label="Личные"
            caption="Личные"
            active={dmsActive}
            unread={dmsUnread}
            onClick={onDmsRequest}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
            </svg>
          </RailButton>
        )}
        <RailButton
          label="Друзья"
          caption="Друзья"
          active={friendsActive}
          unread={friendsPending}
          onClick={onFriendsRequest}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 00-3-3.87" />
            <path d="M16 3.13a4 4 0 010 7.75" />
          </svg>
        </RailButton>
        <RailButton
          label="Agent Office — AI-команда и согласования"
          caption="Office"
          active={officeActive}
          onClick={onOfficeRequest}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <circle cx="12" cy="5" r="2.25" />
            <circle cx="5" cy="17" r="2.25" />
            <circle cx="19" cy="17" r="2.25" />
            <path d="M12 7.25v4.25M10.25 12.5 6.6 15M13.75 12.5 17.4 15" />
          </svg>
        </RailButton>
        <RailButton label="Профиль и настройки" caption="Профиль" active={profileActive} onClick={onProfileRequest}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <circle cx="12" cy="8" r="4" />
            <path d="M4 21a8 8 0 0116 0" />
          </svg>
        </RailButton>
      </div>

      <div className="ec-rail__divider" aria-hidden />

      <div className="ec-rail__section-label" aria-hidden>Пространства</div>
      <div className="ec-rail__servers" aria-label="Пространства">
        {servers.map((s) => (
          <RailButton
            key={s.id}
            label={s.name}
            variant="server"
            caption={s.name}
            active={
              s.id === activeServerId &&
              !dmsActive &&
              !profileActive &&
              !adminActive &&
              !platformAdminActive
            }
            onClick={() => onSelect(s.id)}
          >
            <ServerIcon server={s} size={44} />
          </RailButton>
        ))}
      </div>

      {(onAdminRequest || onPlatformAdminRequest) && (
        <>
          <div className="ec-rail__divider" aria-hidden />
          <div className="ec-rail__group" aria-label="Управление">
            {onAdminRequest && (
              <RailButton
                label="Админ-панель пространства"
                caption="Админ"
                active={adminActive}
                onClick={onAdminRequest}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M12 2l9 4v6c0 5-3.5 9.5-9 10-5.5-.5-9-5-9-10V6l9-4z" />
                  <path d="M9 12l2 2 4-4" />
                </svg>
              </RailButton>
            )}
            {onPlatformAdminRequest && (
              <RailButton
                label="Управление пользователями платформы"
                caption="Система"
                active={platformAdminActive}
                onClick={onPlatformAdminRequest}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-2.82 1.18V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 7.2 19.7l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 3.18 14H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.3 7.2l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 10 3.18V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 2.82 1.18l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 20.82 10H21a2 2 0 0 1 0 4h-.09A1.65 1.65 0 0 0 19.4 15z" />
                </svg>
              </RailButton>
            )}
          </div>
        </>
      )}

      <div className="ec-rail__divider" aria-hidden />

      <div className="ec-rail__group ec-rail__group--utilities" aria-label="Пространства — действия">
        <RailButton
          label={addTooltip}
          caption="Создать"
          disabled={!canCreateServer}
          onClick={() => {
            if (canCreateServer) onCreateRequest();
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </RailButton>
        <RailButton label="Вступить по приглашению" caption="Войти" onClick={onJoinRequest}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M9 18l6-6-6-6" />
            <path d="M15 3v6" />
            <path d="M21 9h-6" />
          </svg>
        </RailButton>
      </div>
    </nav>
  );
}
