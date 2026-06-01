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
}: Props) {
  const [position, setPosition] = useState<MenuPosition>(() => computePosition(null));
  const [toast, setToast] = useState<string | null>(null);
  const isManager = canManage(server.role);
  const canLeave = server.role !== "OWNER";

  useEffect(() => {
    if (!open) return;
    const update = () => setPosition(computePosition(triggerRef.current));
    update();
    // UXR8: закрывать поповер при любом scroll (включая список каналов под
    // ним) — capture-фаза ловит scroll вложенных контейнеров. Channel-select
    // и outside-click закрываются через onPointerDown ниже, Escape — отдельно.
    const onScroll = () => onClose();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open, triggerRef, onClose]);

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
            { key: "create-event", label: "Создать событие", disabled: true, helper: "Скоро v1.5.48+" },
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

  return (
    <div
      className="ec-popover-surface ec-server-actions-menu"
      role="menu"
      aria-label={`Действия пространства ${server.name}`}
      style={{ top: position.top, left: position.left, width: position.width }}
    >
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
            <span>{action.label}</span>
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
}
