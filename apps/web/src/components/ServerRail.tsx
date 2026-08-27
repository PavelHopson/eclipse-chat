import type { ReactNode } from "react";
import type { ServerRow } from "../hooks/useServers";
import { ServerIcon } from "./ServerSwitcher";
import { EclipseUiIcon } from "./icons/EclipseUiIcon";

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
  // Overlays keep their underlying conversation mounted; only the top surface is current.
  const surface = platformAdminActive ? "platform" : adminActive ? "admin"
    : profileActive ? "profile" : friendsActive ? "friends"
    : officeActive ? "office" : homeActive ? "home" : dmsActive ? "dms" : "server";
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
          active={surface === "home"}
          onClick={onHomeRequest}
        >
          <EclipseUiIcon name="overview" />
        </RailButton>
        {onDmsRequest && (
          <RailButton
            label="Личные"
            caption="Личные"
            active={surface === "dms"}
            unread={dmsUnread}
            onClick={onDmsRequest}
          >
            <EclipseUiIcon name="chat" />
          </RailButton>
        )}
        <RailButton
          label="Друзья"
          caption="Друзья"
          active={surface === "friends"}
          unread={friendsPending}
          onClick={onFriendsRequest}
        >
          <EclipseUiIcon name="people" />
        </RailButton>
        <RailButton
          label="AI-офис — команда и согласования"
          caption="AI-офис"
          active={surface === "office"}
          onClick={onOfficeRequest}
        >
          <EclipseUiIcon name="office" />
        </RailButton>
        <RailButton label="Профиль и настройки" caption="Профиль" active={surface === "profile"} onClick={onProfileRequest}>
          <EclipseUiIcon name="profile" />
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
              s.id === activeServerId && surface === "server"
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
                active={surface === "admin"}
                onClick={onAdminRequest}
              >
                <EclipseUiIcon name="shield" />
              </RailButton>
            )}
            {onPlatformAdminRequest && (
              <RailButton
                label="Управление пользователями платформы"
                caption="Система"
                active={surface === "platform"}
                onClick={onPlatformAdminRequest}
              >
                <EclipseUiIcon name="settings" />
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
          <EclipseUiIcon name="plus" />
        </RailButton>
        <RailButton label="Вступить по приглашению" caption="Войти" onClick={onJoinRequest}>
          <EclipseUiIcon name="enter" />
        </RailButton>
      </div>
    </nav>
  );
}
