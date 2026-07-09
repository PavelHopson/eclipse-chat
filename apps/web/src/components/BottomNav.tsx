import type { ReactNode } from "react";

/**
 * BottomNav (v1.6.58 — Discord-каркас, слайс 2) — мобильный нижний таб-бар.
 *
 * Заменяет гамбургер-навигацию на ≤1024: 4 всегда-видимых таба под большой
 * палец — Серверы / Личные / Друзья / Я. Рендерится только на mobile
 * (grid-area «nav» в responsive.css). Каждый таб ведёт в свой контекст в
 * один тап; списки (каналы/ЛС) открываются левым drawer'ом.
 */

export type BottomTab = "servers" | "dms" | "friends" | "me";

type Props = {
  active: BottomTab;
  onServers: () => void;
  onDms: () => void;
  onFriends: () => void;
  onProfile: () => void;
  dmsUnread?: number;
  friendsPending?: number;
};

function TabButton({
  label,
  active,
  badge = 0,
  onClick,
  children,
}: {
  label: string;
  active: boolean;
  badge?: number;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={"ec-bnav__tab" + (active ? " is-active" : "")}
      aria-label={label}
      aria-current={active || undefined}
      onClick={onClick}
    >
      <span className="ec-bnav__icon">
        {children}
        {badge > 0 && (
          <span className="ec-bnav__badge" aria-label={`${badge} новых`}>
            {badge > 99 ? "99+" : badge}
          </span>
        )}
      </span>
      <span className="ec-bnav__label">{label}</span>
    </button>
  );
}

export function BottomNav({
  active,
  onServers,
  onDms,
  onFriends,
  onProfile,
  dmsUnread = 0,
  friendsPending = 0,
}: Props) {
  return (
    <nav className="ec-bnav" aria-label="Основная навигация">
      <TabButton label="Пространства" active={active === "servers"} onClick={onServers}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
        </svg>
      </TabButton>
      <TabButton label="Личные" active={active === "dms"} badge={dmsUnread} onClick={onDms}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
        </svg>
      </TabButton>
      <TabButton label="Друзья" active={active === "friends"} badge={friendsPending} onClick={onFriends}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 00-3-3.87" />
          <path d="M16 3.13a4 4 0 010 7.75" />
        </svg>
      </TabButton>
      <TabButton label="Я" active={active === "me"} onClick={onProfile}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21a8 8 0 0116 0" />
        </svg>
      </TabButton>
    </nav>
  );
}
