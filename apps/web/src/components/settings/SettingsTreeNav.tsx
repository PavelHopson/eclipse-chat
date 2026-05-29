import { useEffect, useState } from "react";

export type SettingsViewId =
  | "account-profile"
  | "account-security"
  | "account-sessions"
  | "activity-status"
  | "notifications-push"
  | "notifications-quiet"
  | "appearance"
  | "content"
  | "data-export"
  | "integrations"
  | "voice-video"
  | "hotkeys"
  | "developer"
  | "install";

type NavItem = {
  id: SettingsViewId;
  label: string;
  soon?: string;
  hidden?: boolean;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

type Props = {
  active: SettingsViewId;
  installAvailable: boolean;
  onSelect: (view: SettingsViewId) => void;
  onLogout: () => void;
};

export const SETTINGS_LAST_ACTIVE_KEY = "ec.settings.lastActive";
const SETTINGS_COLLAPSED_KEY = "ec.settings.collapsedGroups";

export const SETTINGS_GROUPS: NavGroup[] = [
  {
    label: "Учётная запись",
    items: [
      { id: "account-profile", label: "Профиль" },
      { id: "account-security", label: "Безопасность" },
      { id: "account-sessions", label: "Сессии и устройства", soon: "v1.5.53+" },
    ],
  },
  { label: "Активность", items: [{ id: "activity-status", label: "Кастомный статус" }] },
  {
    label: "Уведомления",
    items: [
      { id: "notifications-push", label: "Push-уведомления" },
      { id: "notifications-quiet", label: "Тихие часы" },
    ],
  },
  { label: "Внешний вид", items: [{ id: "appearance", label: "Тема, плотность, фокус" }] },
  { label: "Контент и общение", items: [{ id: "content", label: "Контент", soon: "v1.5.5X+" }] },
  { label: "Данные", items: [{ id: "data-export", label: "Экспорт", soon: "v1.5.5X+" }] },
  { label: "Интеграции", items: [{ id: "integrations", label: "Интеграции", soon: "v1.5.5X+" }] },
  { label: "Голос и видео", items: [{ id: "voice-video", label: "Голос и видео", soon: "v1.5.5X+" }] },
  { label: "Горячие клавиши", items: [{ id: "hotkeys", label: "Горячие клавиши", soon: "v1.5.5X+" }] },
  { label: "Разработчик", items: [{ id: "developer", label: "Разработчик", soon: "v1.5.5X+" }] },
  { label: "Установить", items: [{ id: "install", label: "Установить приложение" }] },
];

function visibleGroups(installAvailable: boolean): NavGroup[] {
  return SETTINGS_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => installAvailable || item.id !== "install"),
  })).filter((group) => group.items.length > 0);
}

export function isSettingsViewId(value: string | null): value is SettingsViewId {
  return SETTINGS_GROUPS.some((group) => group.items.some((item) => item.id === value));
}

export function SettingsTreeNav({ active, installAvailable, onSelect, onLogout }: Props) {
  const [collapsed, setCollapsed] = useState<Set<string>>(() => {
    if (typeof localStorage === "undefined") return new Set();
    try {
      const raw = localStorage.getItem(SETTINGS_COLLAPSED_KEY);
      return new Set(raw ? JSON.parse(raw) as string[] : []);
    } catch {
      return new Set();
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_LAST_ACTIVE_KEY, active);
    } catch {
      /* localStorage может быть отключён */
    }
  }, [active]);

  const toggleGroup = (label: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      try {
        localStorage.setItem(SETTINGS_COLLAPSED_KEY, JSON.stringify([...next]));
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  return (
    <aside className="ec-settings-tree-nav" aria-label="Разделы настроек">
      {visibleGroups(installAvailable).map((group) => (
        <section
          key={group.label}
          className={
            "ec-settings-tree-nav__group" +
            (collapsed.has(group.label) ? " ec-settings-tree-nav__group--collapsed" : "")
          }
        >
          <button
            type="button"
            className="ec-settings-tree-nav__group-trigger"
            aria-expanded={!collapsed.has(group.label)}
            onClick={() => toggleGroup(group.label)}
          >
            <span>{group.label}</span>
            <span aria-hidden>{collapsed.has(group.label) ? "›" : "⌄"}</span>
          </button>
          {group.items.map((item) => (
              <button
                key={item.id}
                type="button"
                className={
                  "ec-settings-category-item" +
                  (active === item.id ? " ec-settings-category-item--active" : "")
                }
                aria-current={active === item.id ? "page" : undefined}
                onClick={() => onSelect(item.id)}
              >
                <span>{item.label}</span>
                {item.soon && <span className="ec-settings-category-item__soon">Скоро</span>}
              </button>
            ))}
        </section>
      ))}
      <button
        type="button"
        className="ec-settings-category-item ec-settings-category-item--danger"
        onClick={() => void onLogout()}
      >
        Выйти
      </button>
    </aside>
  );
}
