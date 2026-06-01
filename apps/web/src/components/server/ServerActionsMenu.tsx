import { useEffect, useMemo, useState, type RefObject } from "react";
import type { ServerRow } from "../../hooks/useServers";

type Props = {
  open: boolean;
  triggerRef: RefObject<HTMLElement | null>;
  /**
   * v1.5.55 D3 frontend — `lockedAt` теперь требуется на server типе чтобы
   * action «Изоляция» рендерил правильный label («Изоляция» когда open vs
   * «Снять изоляцию» когда уже locked).
   */
  server: Pick<ServerRow, "id" | "name" | "role" | "lockedAt">;
  onClose: () => void;
  onOpenSettings: () => void;
  onOpenInvite: () => void;
  onOpenNotifications: () => void;
  onCreateChannel: () => void;
  onCreateCategory: () => void;
  hideMutedChannels?: boolean;
  onToggleHideMutedChannels?: () => void;
  /**
   * v1.5.55 D3 frontend — переименовано из onOpenIncident.
   * Открывает IsolationConfirmDialog в caller'е (AppShell). Mode выбирается
   * по lockedAt: NULL = lock dialog, не-NULL = unlock dialog.
   * Старый onOpenIncident wire-up (открывал IncidentPanel) больше не
   * соответствует D3 spec'у; «Жалоба на рейд» = отдельный action в slice 4+.
   */
  onToggleIsolation: () => void;
  onLeaveServer: () => Promise<boolean>;
  /**
   * UXR5 — навигация по server-views прямо из popover. Завершает UXR4:
   * после того как server nav rail убран из chat mode, это основной вход в
   * Путеводитель / Каналы и роли / Участники (плюс «клик по server-иконке»).
   * «Каналы и роли» показывается только менеджерам (OWNER/ADMIN) — остальные
   * дойдут через guide → rail в non-chat view, доступ не теряется.
   */
  onSelectView?: (view: "guide" | "channels-roles" | "members") => void;
};

type MenuPosition = {
  top: number;
  left: number;
  width: number;
};

type MenuAction = {
  key: string;
  label: string;
  icon: string;
  helper?: string;
  checked?: boolean;
  disabled?: boolean;
  danger?: boolean;
  onClick?: () => void | Promise<void>;
};

type MenuSection = {
  key: string;
  label?: string;
  items: MenuAction[];
};

const MANAGE_ROLES = new Set(["OWNER", "ADMIN"]);

function canManage(role: string | null | undefined): boolean {
  return MANAGE_ROLES.has(role ?? "");
}

function computePosition(trigger: HTMLElement | null): MenuPosition {
  if (!trigger || typeof window === "undefined") return { top: 64, left: 12, width: 254 };
  const rect = trigger.getBoundingClientRect();
  const mobile = window.matchMedia("(max-width: 640px)").matches;
  const width = mobile ? Math.min(window.innerWidth - 24, 336) : 254;
  const left = mobile
    ? 12
    : Math.min(Math.max(10, rect.left), Math.max(10, window.innerWidth - width - 10));
  return {
    top: Math.min(rect.bottom + 8, window.innerHeight - 16),
    left,
    width,
  };
}

export function ServerActionsMenu({
  open,
  triggerRef,
  server,
  onClose,
  onOpenSettings,
  onOpenInvite,
  onOpenNotifications,
  onCreateChannel,
  onCreateCategory,
  hideMutedChannels = false,
  onToggleHideMutedChannels,
  onToggleIsolation,
  onLeaveServer,
  onSelectView,
}: Props) {
  const [position, setPosition] = useState<MenuPosition>(() => computePosition(null));
  const [toast, setToast] = useState<string | null>(null);
  const isManager = canManage(server.role);
  const canLeave = server.role !== "OWNER";

  useEffect(() => {
    if (!open) return;
    const update = () => setPosition(computePosition(triggerRef.current));
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, triggerRef]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      const trigger = triggerRef.current;
      if (trigger && target && trigger.contains(target)) return;
      if (target instanceof Element && target.closest(".ec-server-actions-menu")) return;
      onClose();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose, triggerRef]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 1600);
    return () => window.clearTimeout(t);
  }, [toast]);

  const copyServerId = async () => {
    try {
      await navigator.clipboard.writeText(server.id);
      setToast("ID скопирован");
    } catch {
      setToast("Clipboard недоступен");
    }
  };

  const leave = async () => {
    const ok = window.confirm(`Покинуть «${server.name}»?`);
    if (!ok) return;
    await onLeaveServer();
  };

  const sections = useMemo<MenuSection[]>(
    () => [
      ...(onSelectView
        ? [
            {
              key: "navigation",
              label: "Навигация",
              items: [
                { key: "view-guide", icon: "⌂", label: "Путеводитель", onClick: () => onSelectView("guide") },
                ...(isManager
                  ? [
                      {
                        key: "view-channels",
                        icon: "#",
                        label: "Каналы и роли",
                        onClick: () => onSelectView("channels-roles"),
                      },
                    ]
                  : []),
                { key: "view-members", icon: "◉", label: "Участники", onClick: () => onSelectView("members") },
              ],
            },
          ]
        : []),
      {
        key: "primary",
        label: "Сервер",
        items: [
          ...(isManager
            ? [{ key: "settings", icon: "⚙", label: "Настройки сервера", onClick: onOpenSettings }]
            : []),
          { key: "invite", icon: "+", label: "Пригласить", onClick: onOpenInvite },
          { key: "notifications", icon: "◌", label: "Уведомления", onClick: onOpenNotifications },
          ...(onToggleHideMutedChannels
            ? [
                {
                  key: "hide-muted",
                  icon: hideMutedChannels ? "✓" : "–",
                  label: hideMutedChannels ? "Показать заглушённые" : "Скрыть заглушённые",
                  checked: hideMutedChannels,
                  onClick: onToggleHideMutedChannels,
                },
              ]
            : []),
        ],
      },
      ...(isManager
        ? [
            {
              key: "create",
              label: "Создать",
              items: [
                { key: "create-channel", icon: "#", label: "Канал", onClick: onCreateChannel },
                { key: "create-category", icon: "▣", label: "Категорию", onClick: onCreateCategory },
                { key: "create-event", icon: "◇", label: "Событие", disabled: true, helper: "Скоро" },
              ],
            },
            {
              key: "moderation",
              label: "Модерация",
              items: [
                {
                  key: "incident",
                  icon: server.lockedAt ? "🔓" : "🔒",
                  label: server.lockedAt ? "Снять изоляцию" : "Изоляция",
                  onClick: onToggleIsolation,
                },
              ],
            },
          ]
        : []),
      {
        key: "utility",
        items: [
          { key: "copy-id", icon: "ID", label: "Копировать ID", onClick: copyServerId },
          ...(canLeave ? [{ key: "leave", icon: "↩", label: "Покинуть сервер", danger: true, onClick: leave }] : []),
        ],
      },
    ],
    [
      canLeave,
      isManager,
      onCreateCategory,
      onCreateChannel,
      onToggleIsolation,
      onToggleHideMutedChannels,
      onOpenInvite,
      onOpenNotifications,
      onOpenSettings,
      onSelectView,
      hideMutedChannels,
      server.lockedAt,
      server.id,
      server.name,
    ],
  );

  if (!open) return null;

  return (
    <div
      className="ec-popover-surface ec-server-actions-menu"
      role="menu"
      aria-label={`Действия пространства ${server.name}`}
      style={{ top: position.top, left: position.left, width: position.width }}
    >
      {sections.map((section, index) => (
        <section key={section.key} className="ec-server-actions-menu__section">
          {index > 0 && <div className="ec-server-actions-menu__divider" aria-hidden />}
          {section.label && <div className="ec-server-actions-menu__label">{section.label}</div>}
          {section.items.map((action) => (
            <button
              key={action.key}
              type="button"
              role="menuitem"
              className={
                "ec-popover-item ec-server-actions-menu__item" +
                (action.disabled ? " ec-server-actions-menu__item--disabled" : "") +
                (action.danger ? " ec-server-actions-menu__item--danger" : "") +
                (action.checked ? " ec-server-actions-menu__item--checked" : "")
              }
              disabled={action.disabled}
              onClick={() => {
                if (action.disabled || !action.onClick) return;
                void action.onClick();
                if (action.key !== "copy-id") onClose();
              }}
            >
              <span className="ec-server-actions-menu__icon" aria-hidden>
                {action.icon}
              </span>
              <span className="ec-server-actions-menu__text">{action.label}</span>
              {action.helper && <span className="ec-server-actions-menu__helper">{action.helper}</span>}
              {action.checked && <span className="ec-server-actions-menu__check" aria-hidden>✓</span>}
            </button>
          ))}
        </section>
      ))}
      {toast && (
        <div className="ec-server-actions-menu__toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}
