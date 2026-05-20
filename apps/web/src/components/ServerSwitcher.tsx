import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { CSSProperties, ReactNode } from "react";
import type { ServerRow } from "../hooks/useServers";
import { resolveAssetUrl } from "../lib/assets";

/**
 * ServerSwitcher — topbar-кнопка «Серверы» + выпадающая панель.
 *
 * v1.1.51: бывший вертикальный far-left rail (`ServerList`) свёрнут в
 * один topbar-control. Кнопка показывает иконку + имя активного
 * пространства (DM-режим → «Личные сообщения»); клик раскрывает панель
 * со всем содержимым прежнего rail:
 *   ┌─ NAV     — Главная / Поиск
 *   ├─ SPACES  — Личные сообщения + список пространств
 *   └─ ADD     — Создать / Вступить
 *
 * Панель рендерится через portal в document.body — `.ec-shell__top`
 * несёт `overflow:hidden` + `backdrop-filter` (containing block для
 * fixed-потомков), внутри неё absolute/fixed-popover был бы обрезан.
 * Portal + position:fixed + clamp к viewport — popover свободен.
 *
 * Постоянный визуальный вес ↓ (vertical rail убран целиком), доступ к
 * пространствам — progressive disclosure по клику. Согласуется с WS-1.
 */

type Props = {
  servers: ServerRow[];
  activeServerId: string | null;
  onSelect: (id: string) => void;
  onCreateRequest: () => void;
  onJoinRequest: () => void;
  /** DM mode active (activeServerId === null + user в DM-view). */
  dmsActive?: boolean;
  /** Total unread DM count для badge. */
  dmsUnread?: number;
  onDmsRequest?: () => void;
  /** NAV — Home (operational overview). */
  onHomeRequest: () => void;
  homeActive: boolean;
  /** NAV — Search. Server-scoped: disabled без активного сервера. */
  onSearchRequest: () => void;
  searchEnabled: boolean;
  /** v0.64: лимит OWNER-серверов на аккаунт (backend-enforced). */
  canCreateServer?: boolean;
  ownedCount?: number;
  maxOwnedServers?: number;
};

const PANEL_WIDTH = 264;

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "??";
}

/** Квадратная иконка пространства — img с fallback на инициалы. */
function ServerIcon({ server, size }: { server: ServerRow; size: number }) {
  const [errored, setErrored] = useState(false);
  const iconUrl = resolveAssetUrl(server.icon);

  useEffect(() => {
    setErrored(false);
  }, [server.icon]);

  const box: CSSProperties = {
    width: size,
    height: size,
    flexShrink: 0,
    borderRadius: "var(--ec-radius-sm)",
    background: "var(--ec-surface-3)",
    color: "var(--ec-text)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 700,
    fontSize: size <= 22 ? "0.6rem" : "var(--ec-text-sm)",
    overflow: "hidden",
  };

  if (!iconUrl || errored) {
    return (
      <span style={box} aria-hidden>
        {initials(server.name)}
      </span>
    );
  }
  return (
    <span style={box} aria-hidden>
      <img
        src={iconUrl}
        alt=""
        loading="lazy"
        decoding="async"
        onError={() => setErrored(true)}
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
      />
    </span>
  );
}

const triggerBase: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  height: 36,
  maxWidth: 230,
  padding: "0 0.5rem 0 0.42rem",
  border: "1px solid hsl(205 70% 72% / 0.12)",
  borderRadius: "var(--ec-radius-md)",
  color: "var(--ec-text)",
  cursor: "pointer",
  fontSize: "var(--ec-text-sm)",
  fontWeight: 600,
  boxShadow: "inset 0 1px 0 hsl(0 0% 100% / 0.035)",
  transition:
    "background var(--ec-dur-fast) var(--ec-ease), border-color var(--ec-dur-fast) var(--ec-ease)",
};

const dividerStyle: CSSProperties = {
  height: 1,
  background: "var(--ec-border-subtle)",
  margin: "var(--ec-space-1) var(--ec-space-1)",
};

/** Один пункт меню — icon + label + опц. правый слот (badge/marker). */
function MenuRow({
  icon,
  label,
  active = false,
  disabled = false,
  title,
  trailing,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  active?: boolean;
  disabled?: boolean;
  title?: string;
  trailing?: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      title={title ?? label}
      disabled={disabled}
      aria-current={active || undefined}
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        width: "100%",
        padding: "0.46rem 0.5rem",
        background: active ? "var(--ec-accent-soft)" : "transparent",
        border: 0,
        borderRadius: "var(--ec-radius-sm)",
        color: active
          ? "var(--ec-accent)"
          : disabled
          ? "var(--ec-text-dim)"
          : "var(--ec-text-muted)",
        fontSize: "var(--ec-text-sm)",
        fontWeight: active ? 600 : 500,
        textAlign: "left",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        transition:
          "background var(--ec-dur-fast) var(--ec-ease), color var(--ec-dur-fast) var(--ec-ease)",
      }}
      onMouseEnter={(e) => {
        if (active || disabled) return;
        e.currentTarget.style.background = "var(--ec-surface-3)";
        e.currentTarget.style.color = "var(--ec-text)";
      }}
      onMouseLeave={(e) => {
        if (active || disabled) return;
        e.currentTarget.style.background = "transparent";
        e.currentTarget.style.color = "var(--ec-text-muted)";
      }}
    >
      <span
        aria-hidden
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 22,
          flexShrink: 0,
        }}
      >
        {icon}
      </span>
      <span
        style={{
          flex: 1,
          minWidth: 0,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </span>
      {trailing}
    </button>
  );
}

function UnreadBadge({ count }: { count: number }) {
  return (
    <span
      aria-label={`${count} непрочитанных`}
      style={{
        flexShrink: 0,
        minWidth: 18,
        height: 18,
        padding: "0 5px",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: "var(--ec-radius-full)",
        background: "var(--ec-accent)",
        color: "var(--ec-accent-text)",
        fontSize: "0.6rem",
        fontWeight: 700,
        fontFeatureSettings: '"tnum"',
        boxShadow: "0 0 8px hsl(195 70% 60% / 0.5)",
      }}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

export function ServerSwitcher({
  servers,
  activeServerId,
  onSelect,
  onCreateRequest,
  onJoinRequest,
  dmsActive = false,
  dmsUnread = 0,
  onDmsRequest,
  onHomeRequest,
  homeActive,
  onSearchRequest,
  searchEnabled,
  canCreateServer = true,
  ownedCount = 0,
  maxOwnedServers = 2,
}: Props) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<{ top: number; left: number } | null>(
    null,
  );
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Закрытие по клику вне (триггер + панель) / Esc / resize.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (rootRef.current?.contains(t)) return;
      if (panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onResize = () => setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
    };
  }, [open]);

  const activeServer = servers.find((s) => s.id === activeServerId) ?? null;

  const toggle = () => {
    if (open) {
      setOpen(false);
      return;
    }
    const r = rootRef.current?.getBoundingClientRect();
    if (r) {
      const left = Math.max(
        8,
        Math.min(r.left, window.innerWidth - PANEL_WIDTH - 8),
      );
      setAnchor({ top: r.bottom + 6, left });
    }
    setOpen(true);
  };

  // Каждый выбор закрывает панель.
  const pick = (fn: () => void) => () => {
    fn();
    setOpen(false);
  };

  const addTooltip = canCreateServer
    ? "Создать пространство"
    : `Достигнут лимит ${maxOwnedServers} пространств (создано ${ownedCount}).`;

  // ── trigger: иконка + имя активного контекста ──────────────
  let triggerIcon: ReactNode;
  let triggerLabel: string;
  if (dmsActive) {
    triggerLabel = "Личные сообщения";
    triggerIcon = (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--ec-accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
      </svg>
    );
  } else if (activeServer) {
    triggerLabel = activeServer.name;
    triggerIcon = <ServerIcon server={activeServer} size={22} />;
  } else {
    triggerLabel = "Пространства";
    triggerIcon = (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--ec-accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </svg>
    );
  }

  const panel = anchor && (
    <div
      ref={panelRef}
      role="menu"
      aria-label="Пространства и навигация"
      style={{
        position: "fixed",
        top: anchor.top,
        left: anchor.left,
        zIndex: 200,
        width: PANEL_WIDTH,
        maxWidth: "calc(100vw - 16px)",
        maxHeight: `calc(100dvh - ${Math.round(anchor.top) + 16}px)`,
        overflowY: "auto",
        background: "var(--ec-surface-2)",
        borderRadius: "var(--ec-radius-md)",
        boxShadow: "var(--ec-shadow-modal)",
        padding: "var(--ec-space-2)",
        display: "flex",
        flexDirection: "column",
        gap: 1,
      }}
    >
      {/* ── NAV ─────────────────────────────────────────────── */}
      <MenuRow
        label="Главная"
        active={homeActive}
        onClick={pick(onHomeRequest)}
        icon={
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M3 10.5L12 3l9 7.5" />
            <path d="M5 9.5V21h14V9.5" />
            <path d="M9 21v-6h6v6" />
          </svg>
        }
      />
      <MenuRow
        label="Поиск"
        disabled={!searchEnabled}
        title={searchEnabled ? "Поиск (Ctrl+K)" : "Поиск — откройте пространство"}
        onClick={pick(onSearchRequest)}
        icon={
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        }
      />

      <div style={dividerStyle} aria-hidden />

      {/* ── SPACES ──────────────────────────────────────────── */}
      {onDmsRequest && (
        <MenuRow
          label="Личные сообщения"
          active={dmsActive}
          onClick={pick(onDmsRequest)}
          trailing={
            dmsUnread > 0 && !dmsActive ? (
              <UnreadBadge count={dmsUnread} />
            ) : undefined
          }
          icon={
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
            </svg>
          }
        />
      )}
      {servers.map((s) => {
        const isActive = s.id === activeServerId && !dmsActive;
        return (
          <MenuRow
            key={s.id}
            label={s.name}
            title={s.name}
            active={isActive}
            onClick={pick(() => onSelect(s.id))}
            icon={<ServerIcon server={s} size={22} />}
          />
        );
      })}
      {servers.length === 0 && (
        <p
          style={{
            margin: 0,
            padding: "0.4rem 0.5rem",
            color: "var(--ec-text-dim)",
            fontSize: "var(--ec-text-xs)",
          }}
        >
          Пространств пока нет — создайте первое ниже.
        </p>
      )}

      <div style={dividerStyle} aria-hidden />

      {/* ── ADD ─────────────────────────────────────────────── */}
      <MenuRow
        label="Создать пространство"
        disabled={!canCreateServer}
        title={addTooltip}
        onClick={pick(() => {
          if (canCreateServer) onCreateRequest();
        })}
        icon={
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        }
      />
      <MenuRow
        label="Вступить по приглашению"
        onClick={pick(onJoinRequest)}
        icon={
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M9 18l6-6-6-6" />
            <path d="M15 3v6" />
            <path d="M21 9h-6" />
          </svg>
        }
      />
    </div>
  );

  return (
    <div ref={rootRef} style={{ flexShrink: 0 }}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        title="Пространства и навигация"
        onClick={toggle}
        style={{
          ...triggerBase,
          borderColor: open
            ? "hsl(195 70% 60% / 0.34)"
            : "hsl(205 70% 72% / 0.12)",
          background: open
            ? "hsl(214 26% 13% / 0.72)"
            : "hsl(214 22% 9% / 0.48)",
        }}
        onMouseEnter={(e) => {
          if (open) return;
          e.currentTarget.style.background = "hsl(214 26% 13% / 0.72)";
          e.currentTarget.style.borderColor = "hsl(195 70% 60% / 0.22)";
        }}
        onMouseLeave={(e) => {
          if (open) return;
          e.currentTarget.style.background = "hsl(214 22% 9% / 0.48)";
          e.currentTarget.style.borderColor = "hsl(205 70% 72% / 0.12)";
        }}
      >
        {triggerIcon}
        <span
          style={{
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            letterSpacing: "0.01em",
          }}
        >
          {triggerLabel}
        </span>
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--ec-text-dim)"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
          style={{
            flexShrink: 0,
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform var(--ec-dur-fast) var(--ec-ease)",
          }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && panel ? createPortal(panel, document.body) : null}
    </div>
  );
}
