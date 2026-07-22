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
      { id: "account-sessions", label: "Сессии и устройства" },
    ],
  },
  {
    label: "Персонализация",
    items: [
      { id: "activity-status", label: "Кастомный статус" },
      { id: "notifications-push", label: "Уведомления и звук" },
      { id: "notifications-quiet", label: "Тихие часы" },
      { id: "appearance", label: "Тема и интерфейс" },
    ],
  },
  {
    label: "Приложение",
    items: [
      { id: "voice-video", label: "Голос и видео", soon: "v1.5.55+" },
      { id: "content", label: "Контент", soon: "v1.5.55+" },
      { id: "hotkeys", label: "Горячие клавиши" },
      { id: "install", label: "Установить приложение" },
    ],
  },
  {
    label: "Данные и связи",
    items: [
      { id: "data-export", label: "Экспорт данных", soon: "v1.5.55+" },
      { id: "integrations", label: "Интеграции", soon: "v1.5.55+" },
    ],
  },
  {
    label: "Дополнительно",
    items: [{ id: "developer", label: "Для разработчика", soon: "v1.5.55+" }],
  },
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
    const defaults = new Set(["Данные и связи", "Дополнительно"]);
    if (typeof localStorage === "undefined") return defaults;
    try {
      const raw = localStorage.getItem(SETTINGS_COLLAPSED_KEY);
      return new Set(raw ? JSON.parse(raw) as string[] : defaults);
    } catch {
      return defaults;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_LAST_ACTIVE_KEY, active);
    } catch {
      /* localStorage может быть отключён */
    }
  }, [active]);

  useEffect(() => {
    const activeGroup = SETTINGS_GROUPS.find((group) =>
      group.items.some((item) => item.id === active),
    );
    if (!activeGroup) return;
    setCollapsed((prev) => {
      if (!prev.has(activeGroup.label)) return prev;
      const next = new Set(prev);
      next.delete(activeGroup.label);
      return next;
    });
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
