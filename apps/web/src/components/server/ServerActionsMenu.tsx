import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import type { ServerRow } from "../../hooks/useServers";
import { useConfirm } from "../ConfirmDialog";
import { EclipseUiIcon, type EclipseUiIconName } from "../icons/EclipseUiIcon";

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
  maxHeight: number;
};

const MANAGE_ROLES = new Set(["OWNER", "ADMIN"]);

function canManage(role: string | null | undefined): boolean {
  return MANAGE_ROLES.has(role ?? "");
}

function ActionIcon({ actionKey }: { actionKey: string }) {
  const names: Record<string, EclipseUiIconName> = {
    settings: "settings", invite: "invite", notifications: "notifications",
    "hide-muted": "hide-muted", "create-channel": "create-channel",
    "create-category": "create-category", "create-event": "create-event",
    incident: "incident", leave: "leave", "copy-id": "copy-id",
  };
  return names[actionKey] ? <EclipseUiIcon name={names[actionKey]} size={18} /> : null;
}

function computePosition(trigger: HTMLElement | null): MenuPosition {
  if (!trigger || typeof window === "undefined") return { top: 64, left: 12, width: 304, maxHeight: 540 };
  const rect = trigger.getBoundingClientRect();
  const width = Math.min(320, window.innerWidth - 24);
  const left = Math.max(12, Math.min(rect.left, window.innerWidth - width - 12));
  const desiredHeight = Math.min(640, window.innerHeight - 24);
  const below = window.innerHeight - rect.bottom - 20;
  const above = rect.top - 20;
  const top = below < 320 && above > below
    ? Math.max(12, rect.top - desiredHeight - 8)
    : Math.max(12, Math.min(rect.bottom + 8, window.innerHeight - 240));
  return { top, left, width, maxHeight: Math.min(desiredHeight, Math.max(120, window.innerHeight - top - 12)) };
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
    const onScroll = (event: Event) => {
      if (event.target instanceof Node && menuRef.current?.contains(event.target)) return;
      update();
    };
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
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        triggerRef.current?.focus();
        return;
      }
      const menu = menuRef.current;
      if (!menu?.contains(document.activeElement)) return;
      if (event.key === "Tab") { onClose(); return; }
      const items = Array.from(menu.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)'));
      const index = items.indexOf(document.activeElement as HTMLButtonElement);
      const target = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1
        : event.key === "ArrowDown" ? (index + 1) % items.length
        : event.key === "ArrowUp" ? (index - 1 + items.length) % items.length : -1;
      if (target >= 0) {
        event.preventDefault();
        items[target]?.focus();
      }
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose, triggerRef]);

  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]:not(:disabled)')?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(frame);
  }, [open]);

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
      { key: "copy-id", label: "Копировать ID пространства", onClick: copyServerId },
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
        maxHeight: position.maxHeight,
        overflowY: "auto",
        overscrollBehavior: "contain",
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
              <span className="ec-server-actions-menu__icon"><EclipseUiIcon name={nav.view} size={18} /></span>
              <span className="ec-server-actions-menu__label">{nav.label}</span>
            </button>
          ))}
          <div className="ec-server-actions-menu__divider" aria-hidden />
        </>
      )}
      {actions.map((action) => (
        <div key={action.key}>
          {(action.key === "create-channel" || action.key === "leave") && (
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
