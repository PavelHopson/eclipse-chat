import type { ReactNode } from "react";
import type { ServerRow } from "../hooks/useServers";
import { ServerIcon } from "./ServerSwitcher";

/**
 * ServerRail (v1.6.57 — Discord-каркас) — постоянный левый вертикальный
 * рейл-иконок: Личные · Друзья · Я + список Пространств (серверов) + создать/
 * вступить. Единая таксономия с мобайл BottomNav (Пространства/Личные/Друзья/Я).
 *
 * Заменяет на desktop выпадающий ServerSwitcher из топбара: смена сервера
 * теперь в один клик (а не открыть-дропдаун-выбрать). На mobile рейл не
 * рендерится — там нижний таб-бар (slice 2). Чистый CSS-слой `.ec-rail-*`.
 */

type Props = {
  servers: ServerRow[];
  activeServerId: string | null;
  onSelect: (id: string) => void;
  onCreateRequest: () => void;
  onJoinRequest: () => void;
  dmsActive?: boolean;
  dmsUnread?: number;
  onDmsRequest?: () => void;
  onFriendsRequest: () => void;
  friendsActive: boolean;
  friendsPending?: number;
  onProfileRequest: () => void;
  profileActive: boolean;
  canCreateServer?: boolean;
  ownedCount?: number;
  maxOwnedServers?: number;
};

function RailButton({
  label,
  active = false,
  disabled = false,
  unread = 0,
  variant = "icon",
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  unread?: number;
  /** "icon" — круглая навигационная (Дом/ЛС/+); "server" — квадратная иконка. */
  variant?: "icon" | "server";
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={
        "ec-rail__btn ec-rail__btn--" +
        variant +
        (active ? " is-active" : "")
      }
      aria-label={label}
      aria-current={active || undefined}
      title={label}
      disabled={disabled}
      onClick={onClick}
    >
      <span className="ec-rail__pill" aria-hidden />
      <span className="ec-rail__glyph">{children}</span>
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
  dmsActive = false,
  dmsUnread = 0,
  onDmsRequest,
  onFriendsRequest,
  friendsActive,
  friendsPending = 0,
  onProfileRequest,
  profileActive,
  canCreateServer = true,
  ownedCount = 0,
  maxOwnedServers = 2,
}: Props) {
  const addTooltip = canCreateServer
    ? "Создать пространство"
    : `Лимит ${maxOwnedServers} пространств (создано ${ownedCount})`;

  return (
    <nav className="ec-rail" aria-label="Серверы и навигация">
      {/* Единая таксономия (десктоп rail = мобайл BottomNav):
          Личные · Друзья · Я — плюс список Пространств (иконки серверов) ниже.
          «Главная» ретайрнута (была размыта = ЛС+Друзья, и никогда не
          подсвечивалась — homeOpen мёртв). */}
      <div className="ec-rail__group">
        {onDmsRequest && (
          <RailButton
            label="Личные"
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
        <RailButton label="Я" active={profileActive} onClick={onProfileRequest}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <circle cx="12" cy="8" r="4" />
            <path d="M4 21a8 8 0 0116 0" />
          </svg>
        </RailButton>
      </div>

      <div className="ec-rail__divider" aria-hidden />

      <div className="ec-rail__servers">
        {servers.map((s) => (
          <RailButton
            key={s.id}
            label={s.name}
            variant="server"
            active={s.id === activeServerId && !dmsActive}
            onClick={() => onSelect(s.id)}
          >
            <ServerIcon server={s} size={44} />
          </RailButton>
        ))}
      </div>

      <div className="ec-rail__divider" aria-hidden />

      <div className="ec-rail__group">
        <RailButton
          label={addTooltip}
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
        <RailButton label="Вступить по приглашению" onClick={onJoinRequest}>
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
