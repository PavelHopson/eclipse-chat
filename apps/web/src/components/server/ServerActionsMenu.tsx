import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import type { ServerRow } from "../../hooks/useServers";
import { useConfirm } from "../ConfirmDialog";

type Props = {
  open: boolean;
  triggerRef: RefObject<HTMLElement | null>;
  renderMode?: "portal" | "inline";
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

const MANAGE_ROLES = new Set(["OWNER", "ADMIN"]);

function canManage(role: string | null | undefined): boolean {
  return MANAGE_ROLES.has(role ?? "");
}

function ActionIcon({ actionKey }: { actionKey: string }) {
  const common = {
    width: 16,
    height: 16,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.9,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  switch (actionKey) {
    case "settings":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 0 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V22h-4v-.2a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 0 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H2v-4h.2a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1A2 2 0 0 1 6.1 3.3l.1.1a1.7 1.7 0 0 0 1.8.3 1.7 1.7 0 0 0 1-1.5V2h4v.2a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 0 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8 1.7 1.7 0 0 0 1.5 1h.2v4h-.2a1.7 1.7 0 0 0-1.5 1Z" />
        </svg>
      );
    case "invite":
      return (
        <svg {...common}>
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M19 8v6" />
          <path d="M22 11h-6" />
        </svg>
      );
    case "notifications":
      return (
        <svg {...common}>
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
      );
    case "hide-muted":
      return (
        <svg {...common}>
          <path d="M3 3l18 18" />
          <path d="M10 5 6 9H2v6h4l4 4V5Z" />
          <path d="M16 9.5c.5.7.8 1.6.8 2.5" />
        </svg>
      );
    case "create-channel":
      return (
        <svg {...common}>
          <path d="M5 9h14" />
          <path d="M4 15h14" />
          <path d="M10 3 8 21" />
          <path d="M16 3l-2 18" />
        </svg>
      );
    case "create-category":
      return (
        <svg {...common}>
          <path d="M3 7h7l2 2h9v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
          <path d="M12 13h6" />
          <path d="M15 10v6" />
        </svg>
      );
    case "create-event":
      return (
        <svg {...common}>
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M16 3v4" />
          <path d="M8 3v4" />
          <path d="M3 11h18" />
        </svg>
      );
    case "incident":
      return (
        <svg {...common}>
          <rect x="3" y="11" width="18" height="10" rx="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      );
    case "copy-id":
      return (
        <svg {...common}>
          <rect x="9" y="9" width="12" height="12" rx="2" />
          <rect x="3" y="3" width="12" height="12" rx="2" />
        </svg>
      );
    case "leave":
      return (
        <svg {...common}>
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <path d="M16 17l5-5-5-5" />
          <path d="M21 12H9" />
        </svg>
      );
    default:
      return null;
  }
}

function computePosition(trigger: HTMLElement | null): MenuPosition {
  if (!trigger || typeof window === "undefined") return { top: 64, left: 12, width: 280 };
  const rect = trigger.getBoundingClientRect();
  const mobile = window.matchMedia("(max-width: 640px)").matches;
  const width = mobile ? Math.min(window.innerWidth * 0.8, 360) : 286;
  const left = Math.min(Math.max(10, rect.left), Math.max(10, window.innerWidth - width - 10));
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
  renderMode = "portal",
}: Props) {
  const [position, setPosition] = useState<MenuPosition>(() => computePosition(null));
  const [toast, setToast] = useState<string | null>(null);
  const confirm = useConfirm();
  const menuRef = useRef<HTMLDivElement | null>(null);
  const isManager = canManage(server.role);
  const canLeave = server.role !== "OWNER";

  useEffect(() => {
    if (!open) return;
    const update = () => setPosition(computePosition(triggerRef.current));
    update();
    // Keep the portal anchored while the rail/page scrolls. Closing on every
    // captured scroll made the menu disappear immediately when layout changes
    // emitted a scroll after opening.
    const onScroll = () => update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open, triggerRef]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      const trigger = triggerRef.current;
      if (trigger && target && trigger.contains(target)) return;
      if (target && menuRef.current?.contains(target)) return;
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
    const ok = await confirm({
      title: "Покинуть пространство?",
      message: `Вы выйдете из «${server.name}». Вернуться можно будет по приглашению.`,
      confirmLabel: "Покинуть",
      danger: true,
    });
    if (!ok) return;
    await onLeaveServer();
  };

  const actions = useMemo(
    () => [
      ...(isManager
        ? [
            { key: "settings", label: "Настройки сервера", onClick: onOpenSettings },
          ]
        : []),
      { key: "invite", label: "Пригласить", onClick: onOpenInvite },
      { key: "notifications", label: "Уведомления", onClick: onOpenNotifications },
      ...(onToggleHideMutedChannels
        ? [
            {
              key: "hide-muted",
              label: hideMutedChannels ? "Показать заглушённые" : "Скрыть заглушённые",
              onClick: onToggleHideMutedChannels,
            },
          ]
        : []),
      ...(isManager
        ? [
            { key: "create-channel", label: "Создать канал", onClick: onCreateChannel },
            { key: "create-category", label: "Создать категорию", onClick: onCreateCategory },
            { key: "create-event", label: "Создать событие", disabled: true, helper: "Скоро" },
            {
              key: "incident",
              // v1.5.55 D3 — label переключается по lockedAt.
              label: server.lockedAt ? "Снять изоляцию" : "Изоляция",
              onClick: onToggleIsolation,
            },
          ]
        : []),
      { key: "copy-id", label: "Копировать ID", onClick: copyServerId },
      ...(canLeave ? [{ key: "leave", label: "Покинуть сервер", danger: true, onClick: leave }] : []),
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
      hideMutedChannels,
      server.lockedAt,
      server.id,
      server.name,
    ],
  );

  if (!open) return null;

  const inline = renderMode === "inline";

  const menu = (
    <div
      ref={menuRef}
      data-ec-server-menu="true"
      className={"ec-popover-surface ec-server-actions-menu" + (inline ? " ec-server-actions-menu--inline" : "")}
      role="menu"
      aria-label={`Действия пространства ${server.name}`}
      style={{
        top: inline ? "calc(100% + 8px)" : position.top,
        left: inline ? "12px" : position.left,
        right: inline ? "12px" : undefined,
        width: inline ? "auto" : position.width,
        zIndex: 10000,
        // Solid-фон inline — бьёт любой (в т.ч. устаревший из кэша) CSS-чанк,
        // чтобы поповер никогда не просвечивал список каналов под собой.
        background: "var(--ec-surface-2)",
        backdropFilter: "none",
        WebkitBackdropFilter: "none",
        backgroundImage: "none",
      }}
    >
      {onSelectView && (
        <>
          <div
            role="presentation"
            style={{
              padding: "6px 12px 2px",
              fontSize: "0.68rem",
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              color: "var(--ec-text-dim)",
            }}
          >
            Навигация
          </div>
          {(
            [
              { view: "guide" as const, label: "Путеводитель" },
              ...(isManager
                ? [{ view: "channels-roles" as const, label: "Каналы и роли" }]
                : []),
              { view: "members" as const, label: "Участники" },
            ]
          ).map((nav) => (
            <button
              key={`nav-${nav.view}`}
              type="button"
              role="menuitem"
              className="ec-popover-item ec-server-actions-menu__item"
              onClick={() => {
                onSelectView?.(nav.view);
                onClose();
              }}
            >
              <span>{nav.label}</span>
            </button>
          ))}
          <div className="ec-server-actions-menu__divider" aria-hidden />
        </>
      )}
      {actions.map((action) => (
        <div key={action.key}>
          {(action.key === "create-channel" || action.key === "copy-id" || action.key === "leave") && (
            <div className="ec-server-actions-menu__divider" aria-hidden />
          )}
          <button
            type="button"
            role="menuitem"
            className={
              "ec-popover-item ec-server-actions-menu__item" +
              (action.disabled ? " ec-server-actions-menu__item--disabled" : "") +
              (action.danger ? " ec-server-actions-menu__item--danger" : "")
            }
            disabled={action.disabled}
            onClick={() => {
              if (action.disabled || !action.onClick) return;
              action.onClick();
              if (action.key !== "copy-id") onClose();
            }}
          >
            <span className="ec-server-actions-menu__icon">
              <ActionIcon actionKey={action.key} />
            </span>
            <span className="ec-server-actions-menu__label">{action.label}</span>
            {action.helper && <span className="ec-server-actions-menu__helper">{action.helper}</span>}
          </button>
        </div>
      ))}
      {toast && (
        <div className="ec-server-actions-menu__toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );

  if (inline) return menu;
  if (typeof document === "undefined") return null;
  return createPortal(menu, document.body);
}
