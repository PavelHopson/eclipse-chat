import type { MemberRole } from "../../hooks/useMembers";
import type { ServerRow } from "../../hooks/useServers";

export type ServerView = "guide" | "events" | "channels-roles" | "members" | "chat";

type Props = {
  activeView: ServerView;
  onSelect: (view: ServerView) => void;
  server: ServerRow;
  memberRole: MemberRole | null;
};

const MANAGER_ROLES = new Set<MemberRole>(["OWNER", "ADMIN", "MODERATOR"]);

export function ServerNavBar({ activeView, onSelect, server, memberRole }: Props) {
  const canSeeChannelsAndRoles =
    server.mode !== "CLIENT" || (memberRole != null && MANAGER_ROLES.has(memberRole));

  const items: Array<{
    id: ServerView;
    label: string;
    disabled?: boolean;
    helper?: string;
  }> = [
    { id: "guide", label: "Путеводитель" },
    { id: "events", label: "Мероприятия", disabled: true, helper: "Скоро в v1.5.50+" },
    ...(canSeeChannelsAndRoles
      ? [{ id: "channels-roles" as const, label: "Каналы и роли" }]
      : []),
    { id: "members", label: "Участники" },
  ];

  return (
    <nav className="ec-server-nav" aria-label="Навигация по серверу">
      <div className="ec-server-nav__track" role="tablist" aria-orientation="horizontal">
        {items.map((item) => {
          const active = activeView === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={active}
              aria-controls={`ec-server-view-${item.id}`}
              disabled={item.disabled}
              title={item.helper}
              className={
                "ec-server-nav__item" +
                (active ? " ec-server-nav__item--active" : "") +
                (item.disabled ? " ec-server-nav__item--disabled" : "")
              }
              onClick={() => {
                if (!item.disabled) onSelect(item.id);
              }}
            >
              <span>{item.label}</span>
              {item.helper && <span className="ec-server-nav__soon">Скоро</span>}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
