import type { CSSProperties, ReactNode } from "react";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import type { UserStatus } from "../hooks/useProfile";
import type { StoredAccount } from "../lib/accountVault";
import { resolveAssetUrl } from "../lib/assets";
import { EclipseUiIcon } from "./icons/EclipseUiIcon";

/**
 * Вторичное действие в профиль-меню (slice 3 «разгрузка топбара»):
 * иконки Уведомлений / Справки уехали сюда из cmdbar, чтобы первый
 * слой не шумел. closeOnClick=false оставляет меню открытым (для
 * toggle-действий типа уведомлений — можно щёлкнуть и сразу увидеть).
 */
type ToolItem = {
  key: string;
  label: string;
  hint?: string;
  icon: ReactNode;
  onClick: () => void;
  active?: boolean;
  dim?: boolean;
  closeOnClick?: boolean;
};

type Props = {
  anchorRect: DOMRect;
  current: UserStatus;
  onSelect: (status: UserStatus) => void;
  onOpenProfile?: () => void;
  onClose: () => void;
  /** Слот темы (ThemeToggle) — рендерится строкой «Оформление». */
  themeSlot?: ReactNode;
  /** Вторичные утилиты (уведомления, справка). */
  tools?: ToolItem[];
  accounts?: StoredAccount[];
  currentAccountId?: string;
  onSwitchAccount?: (accountId: string) => void;
  onForgetAccount?: (accountId: string) => void;
  onAddAccount?: () => void;
};

const popover: CSSProperties = {
  position: "fixed",
  background: "var(--ec-overlay-bg)",
  backdropFilter: "saturate(180%) blur(14px)",
  WebkitBackdropFilter: "saturate(180%) blur(14px)",
  border: "1px solid var(--ec-border-default)",
  borderRadius: "var(--ec-radius-md)",
  boxShadow: "var(--ec-shadow-md)",
  padding: 4,
  display: "flex",
  flexDirection: "column",
  gap: 0,
  minWidth: 180,
  maxHeight: "calc(100vh - 16px)",
  overflowY: "auto",
  zIndex: 2200,
  animation: "ec-modal-zoom-in var(--ec-dur-fast) var(--ec-ease-out) both",
};

const item: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "0.4rem 0.7rem 0.4rem 0.4rem",
  background: "transparent",
  border: 0,
  borderRadius: "var(--ec-radius-sm)",
  color: "var(--ec-text)",
  fontSize: "var(--ec-text-sm)",
  cursor: "pointer",
  textAlign: "left",
  transition: "background var(--ec-dur-fast) var(--ec-ease)",
  width: "100%",
};

const dotBase: CSSProperties = {
  width: 10,
  height: 10,
  borderRadius: "var(--ec-radius-full)",
  flexShrink: 0,
};

type StatusOption = {
  value: UserStatus;
  label: string;
  description: string;
  dot: CSSProperties;
};

const OPTIONS: StatusOption[] = [
  {
    value: "ONLINE",
    label: "В сети",
    description: "Видна автоматическая активность",
    dot: { ...dotBase, background: "var(--ec-presence-online)", boxShadow: "0 0 6px hsl(150 50% 50% / 0.6)" },
  },
  {
    value: "IDLE",
    label: "Неактивен",
    description: "На месте, но отвлёкся",
    dot: { ...dotBase, background: "var(--ec-presence-idle)" },
  },
  {
    value: "DND",
    label: "Не беспокоить",
    description: "Уведомления глушатся (планируется)",
    dot: { ...dotBase, background: "var(--ec-presence-dnd)" },
  },
  {
    value: "INVISIBLE",
    label: "Невидим",
    description: "Другие видят как «не в сети»",
    dot: { ...dotBase, background: "var(--ec-presence-offline)" },
  },
];

export function StatusMenu({
  anchorRect,
  current,
  onSelect,
  onOpenProfile,
  onClose,
  themeSlot,
  tools,
  accounts = [],
  currentAccountId,
  onSwitchAccount,
  onForgetAccount,
  onAddAccount,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    // Delay listener: чтобы initial click (открывший меню) сам не закрыл
    const t = setTimeout(() => document.addEventListener("mousedown", onDocClick), 0);
    document.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  // Positioning: ниже-слева от anchor (user-chip), clamp в viewport
  const POP_W = 276;
  const POP_H = accounts.length > 1 ? 590 : 500;
  const margin = 8;
  let left = anchorRect.left;
  let top = anchorRect.bottom + 6;
  if (left + POP_W > window.innerWidth - margin) {
    left = window.innerWidth - POP_W - margin;
  }
  if (top + POP_H > window.innerHeight - margin) {
    top = Math.max(margin, anchorRect.top - POP_H - 6);
  }
  if (top < margin) top = margin;
  if (left < margin) left = margin;

  return createPortal(
    <div ref={ref} style={{ ...popover, left, top, minWidth: POP_W }} role="menu" aria-label="Статус">
      {(accounts.length > 0 || onAddAccount) && (
        <section className="ec-account-switcher" aria-label="Аккаунты">
          <div className="ec-account-switcher__label">Аккаунты</div>
          {accounts.map((account) => {
            const active = account.id === currentAccountId;
            return (
              <div key={account.id} className="ec-account-switcher__row" data-active={active}>
                <button
                  type="button"
                  role="menuitemradio"
                  aria-checked={active}
                  onClick={() => {
                    if (!active) onSwitchAccount?.(account.id);
                    onClose();
                  }}
                >
                  <span className="ec-account-switcher__avatar" aria-hidden>
                    {account.user.avatar
                      ? <img src={resolveAssetUrl(account.user.avatar) ?? ""} alt="" />
                      : account.user.displayName.slice(0, 1).toUpperCase()}
                  </span>
                  <span>
                    <strong>{account.user.displayName}</strong>
                    <small>{account.user.email}</small>
                  </span>
                  {active && <EclipseUiIcon name="check" size={15} />}
                </button>
                {!active && onForgetAccount && (
                  <button
                    type="button"
                    className="ec-account-switcher__forget"
                    aria-label={`Забыть аккаунт ${account.user.displayName}`}
                    title="Убрать с этого устройства"
                    onClick={() => onForgetAccount(account.id)}
                  >
                    <EclipseUiIcon name="close" size={14} />
                  </button>
                )}
              </div>
            );
          })}
          {onAddAccount && (
            <button
              type="button"
              className="ec-account-switcher__add"
              role="menuitem"
              onClick={() => { onAddAccount(); onClose(); }}
            >
              <EclipseUiIcon name="plus" size={16} />
              <span>Добавить аккаунт</span>
            </button>
          )}
        </section>
      )}
      {(accounts.length > 0 || onAddAccount) && (
        <div style={{ height: 1, background: "var(--ec-border-subtle)", margin: "4px 0" }} aria-hidden />
      )}
      {OPTIONS.map((o) => {
        const isActive = o.value === current;
        return (
          <button
            key={o.value}
            type="button"
            role="menuitemradio"
            aria-checked={isActive}
            onClick={() => {
              onSelect(o.value);
              onClose();
            }}
            style={{
              ...item,
              background: isActive ? "var(--ec-surface-3)" : "transparent",
            }}
            onMouseEnter={(e) => {
              if (!isActive) e.currentTarget.style.background = "var(--ec-surface-2)";
            }}
            onMouseLeave={(e) => {
              if (!isActive) e.currentTarget.style.background = "transparent";
            }}
          >
            <span style={o.dot} aria-hidden />
            <span style={{ display: "flex", flexDirection: "column", minWidth: 0, flex: 1 }}>
              <span style={{ fontWeight: 600, color: isActive ? "var(--ec-text-strong)" : "var(--ec-text)" }}>
                {o.label}
              </span>
              <span style={{ fontSize: "var(--ec-text-2xs)", color: "var(--ec-text-dim)" }}>
                {o.description}
              </span>
            </span>
            {isActive && <EclipseUiIcon name="check" size={14} />}
          </button>
        );
      })}
      {(themeSlot || (tools && tools.length > 0) || onOpenProfile) && (
        <div style={{ height: 1, background: "var(--ec-border-subtle)", margin: "4px 0" }} aria-hidden />
      )}
      {themeSlot && (
        <div style={{ ...item, cursor: "default", justifyContent: "space-between" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            <span aria-hidden style={{ width: 10, display: "grid", placeItems: "center", color: "var(--ec-text-muted)" }}>
              <EclipseUiIcon name="orbit" size={13} />
            </span>
            <span style={{ color: "var(--ec-text)" }}>Оформление</span>
          </span>
          {themeSlot}
        </div>
      )}
      {tools?.map((t) => (
        <button
          key={t.key}
          type="button"
          role="menuitem"
          onClick={() => {
            t.onClick();
            if (t.closeOnClick !== false) onClose();
          }}
          style={{ ...item, opacity: t.dim ? 0.55 : 1 }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--ec-surface-2)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
        >
          <span aria-hidden style={{ width: 10, display: "grid", placeItems: "center", color: t.active ? "var(--ec-accent)" : "var(--ec-text-muted)" }}>
            {t.icon}
          </span>
          <span style={{ display: "flex", flexDirection: "column", minWidth: 0, flex: 1 }}>
            <span style={{ color: t.active ? "var(--ec-text-strong)" : "var(--ec-text)" }}>{t.label}</span>
            {t.hint && (
              <span style={{ fontSize: "var(--ec-text-2xs)", color: "var(--ec-text-dim)" }}>{t.hint}</span>
            )}
          </span>
        </button>
      ))}
      {onOpenProfile && (
        <button
          type="button"
          role="menuitem"
          onClick={() => {
            onOpenProfile();
            onClose();
          }}
          style={item}
          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--ec-surface-2)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
        >
          <span aria-hidden style={{ width: 10, display: "grid", placeItems: "center", color: "var(--ec-text-muted)" }}>
            <EclipseUiIcon name="profile" size={13} />
          </span>
          <span style={{ color: "var(--ec-text)" }}>Профиль…</span>
        </button>
      )}
    </div>,
    document.body,
  );
}
