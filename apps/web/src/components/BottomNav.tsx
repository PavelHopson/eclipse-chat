import type { ReactNode } from "react";
import { EclipseUiIcon } from "./icons/EclipseUiIcon";

/** Мобильный global dock: пять предсказуемых destinations под большой палец. */

export type BottomTab = "home" | "servers" | "dms" | "office" | "me";

type Props = {
  active: BottomTab;
  onHome: () => void;
  onServers: () => void;
  onDms: () => void;
  onOffice: () => void;
  onProfile: () => void;
  dmsUnread?: number;
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
      aria-current={active ? "page" : undefined}
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
  onHome,
  onServers,
  onDms,
  onOffice,
  onProfile,
  dmsUnread = 0,
}: Props) {
  return (
    <nav className="ec-bnav" aria-label="Основная навигация">
      <TabButton label="Сводка" active={active === "home"} onClick={onHome}>
        <EclipseUiIcon name="overview" size={22} />
      </TabButton>
      <TabButton label="Комнаты" active={active === "servers"} onClick={onServers}>
        <EclipseUiIcon name="channels-roles" size={22} />
      </TabButton>
      <TabButton label="Личные" active={active === "dms"} badge={dmsUnread} onClick={onDms}>
        <EclipseUiIcon name="chat" size={22} />
      </TabButton>
      <TabButton label="AI-офис" active={active === "office"} onClick={onOffice}>
        <EclipseUiIcon name="office" size={22} />
      </TabButton>
      <TabButton label="Я" active={active === "me"} onClick={onProfile}>
        <EclipseUiIcon name="profile" size={22} />
      </TabButton>
    </nav>
  );
}
