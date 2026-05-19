import type { CSSProperties } from "react";
import { useMemo } from "react";
import { Avatar } from "./Avatar";
import type { MemberRole, MemberRow } from "../hooks/useMembers";

type Props = {
  members: MemberRow[];
  loading: boolean;
  error: string | null;
  /** Drawer-mode close button. Передаётся на mobile/tablet — на desktop omitted. */
  onClose?: () => void;
  /** Скрыть собственный header — когда MemberList вложен в IntelligencePanel
   *  (там tab-bar служит заголовком). */
  hideHeader?: boolean;
  /** Кто сейчас в каком VOICE-канале (userId → channelId или undefined). */
  voiceChannelByUser?: Record<string, string>;
  /** Лукап name канала по id — для tooltip. */
  channelNameById?: (channelId: string) => string | undefined;
  /** Текущий user id — скрыть «написать в личку» для самого себя. */
  currentUserId?: string;
  /** «Написать в личку» — открывает или создаёт DM. */
  onOpenDm?: (userId: string) => void;
};

const wrap: CSSProperties = {
  width: "100%",
  height: "100%",
  background: "var(--ec-surface-1)",
  borderLeft: "1px solid var(--ec-border-subtle)",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
};

const headerStyle: CSSProperties = {
  padding: "var(--ec-space-3) var(--ec-space-4)",
  borderBottom: "1px solid var(--ec-border-subtle)",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "var(--ec-space-2)",
};

const listScroll: CSSProperties = {
  flex: 1,
  overflow: "auto",
  padding: "var(--ec-space-3) var(--ec-space-2)",
  display: "flex",
  flexDirection: "column",
  gap: 2,
};

const rowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "auto 1fr auto",
  alignItems: "center",
  gap: "var(--ec-space-2)",
  padding: "var(--ec-space-1) var(--ec-space-2)",
  borderRadius: "var(--ec-radius-sm)",
  fontSize: "var(--ec-text-sm)",
  color: "var(--ec-text)",
  transition: "background var(--ec-dur-fast) var(--ec-ease)",
};

const avatarWrap: CSSProperties = {
  position: "relative",
  display: "inline-block",
  flexShrink: 0,
};

const presenceDot: CSSProperties = {
  position: "absolute",
  bottom: -1,
  right: -1,
  width: 10,
  height: 10,
  borderRadius: "var(--ec-radius-full)",
  border: "2px solid var(--ec-surface-1)",
};

/** v0.78 #17: ранжирование 10 ролей. Outliers OWNER first, GUEST last. */
const ROLE_RANK: Record<MemberRole, number> = {
  OWNER: 0,
  ADMIN: 1,
  MODERATOR: 2,
  ARCHITECT: 3,
  DEVELOPER: 4,
  OPERATOR: 5,
  MEMBER: 6,
  CLIENT: 7,
  VIEWER: 8,
  GUEST: 9,
};

function sortMembers(list: MemberRow[]): MemberRow[] {
  return [...list].sort((a, b) => {
    const r = ROLE_RANK[a.role] - ROLE_RANK[b.role];
    if (r !== 0) return r;
    return a.user.displayName.localeCompare(b.user.displayName, "ru");
  });
}

function roleLabel(role: MemberRole): string | null {
  if (role === "OWNER") return "OWNER";
  if (role === "ADMIN") return "ADMIN";
  if (role === "MODERATOR") return "MOD";
  return null;
}

function roleBadgeClass(role: MemberRole): string {
  if (role === "OWNER") return "ec-badge ec-badge--owner";
  if (role === "ADMIN" || role === "MODERATOR") return "ec-badge ec-badge--accent";
  return "ec-badge";
}

function MemberRowView({
  m,
  inVoiceChannel,
  voiceChannelName,
  showDmButton,
  onOpenDm,
}: {
  m: MemberRow;
  inVoiceChannel: boolean;
  voiceChannelName?: string;
  showDmButton: boolean;
  onOpenDm?: (userId: string) => void;
}) {
  const label = roleLabel(m.role);
  const tooltip =
    `${m.user.displayName} · ${m.role}` +
    (m.online ? " · в сети" : "") +
    (inVoiceChannel
      ? voiceChannelName
        ? ` · в голосовом «${voiceChannelName}»`
        : " · в голосовом"
      : "");
  return (
    <div
      style={rowStyle}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "var(--ec-surface-2)";
        const dmBtn = e.currentTarget.querySelector<HTMLElement>("[data-dm-btn]");
        if (dmBtn) dmBtn.style.opacity = "1";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
        const dmBtn = e.currentTarget.querySelector<HTMLElement>("[data-dm-btn]");
        if (dmBtn) dmBtn.style.opacity = "0";
      }}
      title={tooltip}
    >
      <span style={avatarWrap}>
        <Avatar
          url={m.user.avatar}
          name={m.user.displayName}
          size={28}
          glow={m.online && m.manualStatus !== "IDLE" && m.manualStatus !== "DND"}
        />
        <span
          aria-hidden
          style={{
            ...presenceDot,
            background: !m.online
              ? "var(--ec-presence-offline)"
              : m.manualStatus === "IDLE"
              ? "var(--ec-presence-idle)"
              : m.manualStatus === "DND"
              ? "var(--ec-presence-dnd)"
              : "var(--ec-presence-online)",
            boxShadow:
              m.online && m.manualStatus !== "IDLE" && m.manualStatus !== "DND"
                ? "0 0 6px hsl(150 50% 50% / 0.6)"
                : "none",
          }}
        />
      </span>
      <span
        style={{
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          color: m.online ? "var(--ec-text)" : "var(--ec-text-muted)",
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        {m.user.displayName}
        {/* voice-индикатор намеренно убран: кто в голосовом — видно списком
            под voice-каналом в sidebar (ChannelList), дублировать не нужно.
            inVoiceChannel остаётся в tooltip (см. выше). */}
      </span>
      {label && (
        <span className={roleBadgeClass(m.role)} style={{ fontSize: "0.6rem", padding: "0.05rem 0.35rem" }}>
          {label}
        </span>
      )}
      {showDmButton && onOpenDm && (
        <button
          data-dm-btn
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenDm(m.userId);
          }}
          aria-label={`Написать ${m.user.displayName} в личку`}
          title="Написать в личку"
          style={{
            width: 22,
            height: 22,
            border: "1px solid var(--ec-border-default)",
            background: "var(--ec-surface-1)",
            color: "var(--ec-accent)",
            borderRadius: "var(--ec-radius-xs)",
            cursor: "pointer",
            display: "grid",
            placeItems: "center",
            opacity: 0,
            transition: "opacity var(--ec-dur-fast) var(--ec-ease), background var(--ec-dur-fast) var(--ec-ease)",
            marginLeft: 4,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "var(--ec-accent-soft)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "var(--ec-surface-1)";
          }}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
          </svg>
        </button>
      )}
    </div>
  );
}

export function MemberList({
  members,
  loading,
  error,
  onClose,
  voiceChannelByUser,
  channelNameById,
  currentUserId,
  onOpenDm,
  hideHeader,
}: Props) {
  const { online, offline } = useMemo(() => {
    const sorted = sortMembers(members);
    return {
      online: sorted.filter((m) => m.online),
      offline: sorted.filter((m) => !m.online),
    };
  }, [members]);

  return (
    <aside
      style={hideHeader ? { ...wrap, borderLeft: "none" } : wrap}
      aria-label="Участники пространства"
    >
      {!hideHeader && (
        <header style={headerStyle}>
          <span style={{ fontSize: "var(--ec-text-sm)", fontWeight: 600, color: "var(--ec-text-strong)" }}>
            Участники
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: "var(--ec-text-2xs)", color: "var(--ec-text-dim)", fontFeatureSettings: '"tnum"' }}>
              {online.length}/{members.length}
            </span>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="ec-shell__members-close ec-btn ec-btn--ghost ec-btn--sm"
                aria-label="Закрыть"
                style={{ width: 28, height: 28, padding: 0 }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>
        </header>
      )}

      <div style={listScroll}>
        {loading && members.length === 0 ? (
          <div className="ec-skeleton-list" aria-label="Загрузка участников">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="ec-skeleton-row">
                <div className="ec-skeleton-row__avatar" />
                <div className="ec-skeleton-row__bars">
                  <div className="ec-skeleton-row__bar" />
                  <div className="ec-skeleton-row__bar ec-skeleton-row__bar--sub" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <p style={{ color: "var(--ec-danger)", fontSize: "var(--ec-text-sm)", padding: "var(--ec-space-2)", margin: 0 }}>
            {error}
          </p>
        ) : (
          <>
            {online.length > 0 && (
              <>
                <div className="ec-section-label" style={{ marginBottom: "var(--ec-space-2)" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <span className="ec-dot ec-dot--online" />СВЯЗАННЫЕ_УЗЛЫ
                  </span>
                  <span style={{ color: "var(--ec-text-dim)", fontFeatureSettings: '"tnum"' }}>{online.length}</span>
                </div>
                {online.map((m) => {
                  const vc = voiceChannelByUser?.[m.userId];
                  return (
                    <MemberRowView
                      key={m.id}
                      m={m}
                      inVoiceChannel={Boolean(vc)}
                      voiceChannelName={vc ? channelNameById?.(vc) : undefined}
                      showDmButton={Boolean(currentUserId && m.userId !== currentUserId)}
                      onOpenDm={onOpenDm}
                    />
                  );
                })}
              </>
            )}

            {offline.length > 0 && (
              <>
                <div
                  className="ec-section-label"
                  style={{ marginTop: online.length > 0 ? "var(--ec-space-4)" : 0, marginBottom: "var(--ec-space-2)" }}
                >
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <span className="ec-dot ec-dot--offline" />СПЯЩИЙ_РЕЖИМ
                  </span>
                  <span style={{ color: "var(--ec-text-dim)", fontFeatureSettings: '"tnum"' }}>{offline.length}</span>
                </div>
                {offline.map((m) => (
                  <MemberRowView
                    key={m.id}
                    m={m}
                    inVoiceChannel={false}
                    showDmButton={Boolean(currentUserId && m.userId !== currentUserId)}
                    onOpenDm={onOpenDm}
                  />
                ))}
              </>
            )}

            {members.length === 0 && !loading && (
              <p style={{ color: "var(--ec-text-dim)", fontSize: "var(--ec-text-sm)", padding: "var(--ec-space-2)", margin: 0 }}>
                Никого пока нет.
              </p>
            )}
          </>
        )}
      </div>
    </aside>
  );
}
