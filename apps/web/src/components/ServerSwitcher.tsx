import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { CSSProperties, ReactNode } from "react";
import type { ServerRow } from "../hooks/useServers";
import { resolveAssetUrl } from "../lib/assets";

/**
 * ServerSwitcher (v1.1.91 redesign slice 2) — topbar-кнопка
 * «Пространства» + выпадающая навигационная панель.
 *
 * Бывший far-left rail свёрнут в один topbar-control. Панель
 * рендерится через portal в document.body (`.ec-shell__top` несёт
 * overflow:hidden + backdrop-filter — обрезал бы absolute-потомка).
 *
 * Визуальный слой — `.ec-srv-*` в components.css (grammar v2):
 * theme-aware токены вместо прежнего хардкода hsl(214 …), который
 * ломал триггер в светлой теме SOLAR. Hover/focus — только CSS.
 */

type Props = {
  servers: ServerRow[];
  activeServerId: string | null;
  onSelect: (id: string) => void;
  onCreateRequest: () => void;
  onJoinRequest: () => void;
  dmsActive?: boolean;
  dmsUnread?: number;
  onDmsRequest?: () => void;
  onHomeRequest: () => void;
  homeActive: boolean;
  onSearchRequest: () => void;
  searchEnabled: boolean;
  canCreateServer?: boolean;
  ownedCount?: number;
  maxOwnedServers?: number;
  compact?: boolean;
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

  const sizeStyle: CSSProperties = {
    width: size,
    height: size,
    fontSize: size <= 22 ? "0.6rem" : "var(--ec-text-sm)",
  };

  if (!iconUrl || errored) {
    return (
      <span className="ec-srv-icon" style={sizeStyle} aria-hidden>
        {initials(server.name)}
      </span>
    );
  }
  return (
    <span className="ec-srv-icon" style={sizeStyle} aria-hidden>
      <img
        src={iconUrl}
        alt=""
        loading="lazy"
        decoding="async"
        onError={() => setErrored(true)}
      />
    </span>
  );
}

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
      className="ec-srv-menu-row"
      title={title ?? label}
      disabled={disabled}
      aria-current={active || undefined}
      onClick={onClick}
    >
      <span className="ec-srv-menu-row__icon" aria-hidden>
        {icon}
      </span>
      <span className="ec-srv-menu-row__label">{label}</span>
      {trailing}
    </button>
  );
}

function UnreadBadge({ count }: { count: number }) {
  return (
    <span className="ec-unread-badge" aria-label={`${count} непрочитанных`}>
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
  compact = false,
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
      className="ec-srv-panel"
      style={{
        top: anchor.top,
        left: anchor.left,
        maxHeight: `calc(100dvh - ${Math.round(anchor.top) + 16}px)`,
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

      <div className="ec-srv-divider" aria-hidden />

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
        // v1.5.36 — server row с banner backdrop когда у сервера есть
        // banner asset. Расширенный layout (height ~64px) с cover image
        // + gradient overlay. Без banner — стандартный compact MenuRow.
        const bannerUrl = s.banner ? resolveAssetUrl(s.banner) : null;
        if (bannerUrl) {
          return (
            <button
              key={s.id}
              type="button"
              role="menuitem"
              className={`ec-srv-menu-row ec-srv-menu-row--banner${isActive ? " is-active" : ""}`}
              title={s.name}
              aria-current={isActive || undefined}
              onClick={pick(() => onSelect(s.id))}
              style={{ backgroundImage: `url("${bannerUrl}")` }}
            >
              <span className="ec-srv-menu-row__icon" aria-hidden>
                <ServerIcon server={s} size={22} />
              </span>
              <span className="ec-srv-menu-row__label">{s.name}</span>
            </button>
          );
        }
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
        <p className="ec-srv-empty">
          Пространств пока нет — создайте первое ниже.
        </p>
      )}

      <div className="ec-srv-divider" aria-hidden />

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
        aria-label="Пространства и навигация"
        title="Пространства и навигация"
        onClick={toggle}
        className={"ec-srv-trigger" + (compact ? " ec-srv-trigger--compact" : "")}
      >
        {triggerIcon}
        {!compact && (
          <>
            <span className="ec-srv-trigger__label">{triggerLabel}</span>
            <svg
              className="ec-srv-trigger__caret"
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </>
        )}
      </button>

      {open && panel ? createPortal(panel, document.body) : null}
    </div>
  );
}
