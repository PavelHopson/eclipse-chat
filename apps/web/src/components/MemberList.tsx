import { useEffect, useMemo, useState } from "react";
import { Avatar } from "./Avatar";
import { gameIcon, type GameIconName } from "../lib/gameIcons";
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
  /** v1.5.40 — activeServerId для per-server persisted collapse state
   *  role-group sections. Null = standalone view (collapse не persist'ится). */
  serverId?: string | null;
};

// v1.1.93 slice 4: inline-style консоли MemberList вынесены в классы
// .ec-member-list* / .ec-member-row* (components.css). JS-hover убран.

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

/** v1.1.4 — monospace 3-char tag для каждой из 10 ролей (TACTICAL VIEW). */
const ROLE_TAG: Record<MemberRole, string> = {
  OWNER: "OWN",
  ADMIN: "ADM",
  MODERATOR: "MOD",
  ARCHITECT: "ARC",
  DEVELOPER: "DEV",
  OPERATOR: "OPR",
  MEMBER: "MEM",
  CLIENT: "CLI",
  VIEWER: "VWR",
  GUEST: "GST",
};

/** v1.5.40 — Discord-style role-group section labels. Сохраняют Eclipse
 *  identity (cyberpunk tactical), но дают clear role hierarchy через
 *  grouping vs flat list. Inspired by Discord (President | 1, Vice | 1,
 *  Sergeant at Arms | 4, etc) — order по ROLE_RANK. */
const ROLE_GROUP_LABEL: Record<MemberRole, string> = {
  OWNER: "КОМАНДОРЫ",
  ADMIN: "ОПЕРАТОРЫ",
  MODERATOR: "МОДЕРАТОРЫ",
  ARCHITECT: "АРХИТЕКТУРА",
  DEVELOPER: "ИНЖЕНЕРЫ",
  OPERATOR: "ДИСПЕТЧЕРЫ",
  MEMBER: "ЛИЧНЫЙ_СОСТАВ",
  CLIENT: "КЛИЕНТЫ",
  VIEWER: "НАБЛЮДАТЕЛИ",
  GUEST: "ГОСТИ",
};

const ROLE_ORDER: MemberRole[] = [
  "OWNER",
  "ADMIN",
  "MODERATOR",
  "ARCHITECT",
  "DEVELOPER",
  "OPERATOR",
  "MEMBER",
  "CLIENT",
  "VIEWER",
  "GUEST",
];

function groupOnlineByRole(members: MemberRow[]): Array<[MemberRole, MemberRow[]]> {
  const buckets = new Map<MemberRole, MemberRow[]>();
  for (const m of members) {
    const arr = buckets.get(m.role) ?? [];
    arr.push(m);
    buckets.set(m.role, arr);
  }
  return ROLE_ORDER.flatMap((role) => {
    const arr = buckets.get(role);
    if (!arr || arr.length === 0) return [];
    // Sort by displayName within role group (RU locale).
    arr.sort((a, b) => a.user.displayName.localeCompare(b.user.displayName, "ru"));
    return [[role, arr] as [MemberRole, MemberRow[]]];
  });
}

/** localStorage key prefix для collapse state. Per-server scope чтобы
 *  preferences не пересекались между серверами. */
const COLLAPSE_KEY_PREFIX = "eclipse_chat:member_groups_collapsed:";

function loadCollapsed(serverId: string | null | undefined): Set<MemberRole> {
  if (!serverId || typeof localStorage === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(COLLAPSE_KEY_PREFIX + serverId);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as MemberRole[];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function saveCollapsed(serverId: string | null | undefined, set: Set<MemberRole>) {
  if (!serverId || typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(COLLAPSE_KEY_PREFIX + serverId, JSON.stringify([...set]));
  } catch {
    /* private mode / quota — non-fatal */
  }
}

/** v1.1.63 §10 — русская плюрализация «узел» для network-signal-строки. */
function pluralNodes(n: number): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return "узел";
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return "узла";
  return "узлов";
}

function statusPillClass(role: MemberRole): string {
  if (role === "OWNER") return "ec-status-pill ec-status-pill--owner";
  if (role === "ADMIN" || role === "MODERATOR") return "ec-status-pill ec-status-pill--admin";
  return "ec-status-pill";
}

/** v1.1.24: game-иконка для топ-ролей (crown/rune/shield). Null для
 *  остальных — у них только monospace tag. */
function roleGameIcon(role: MemberRole): GameIconName | null {
  if (role === "OWNER") return "owner_crown";
  if (role === "ADMIN") return "admin_rune";
  if (role === "MODERATOR") return "mod_shield";
  return null;
}

function ActivityLine({
  emoji,
  text,
}: {
  emoji: string | null | undefined;
  text: string | null | undefined;
}) {
  if (!emoji && !text) return null;
  return (
    <span className="ec-activity-line" title={[emoji, text].filter(Boolean).join(" ")}>
      {emoji && <span className="ec-activity-line__emoji">{emoji}</span>}
      {text && <span className="ec-activity-line__text">{text}</span>}
    </span>
  );
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
  const tag = ROLE_TAG[m.role];
  const pillClass = statusPillClass(m.role);
  const roleIcon = roleGameIcon(m.role);
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
      className={"ec-member-row" + (m.online ? "" : " ec-member-row--offline")}
      title={tooltip}
    >
      <span className="ec-member-row__avatar">
        <Avatar
          url={m.user.avatar}
          name={m.user.displayName}
          size={28}
          glow={m.online && m.manualStatus !== "IDLE" && m.manualStatus !== "DND"}
        />
        <span
          aria-hidden
          className="ec-member-row__presence"
          style={{
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
      <span className="ec-member-row__identity">
        <span className="ec-member-row__name">
          {m.user.displayName}
          {/* voice-индикатор намеренно убран: кто в голосовом — видно списком
              под voice-каналом в sidebar (ChannelList), дублировать не нужно.
              inVoiceChannel остаётся в tooltip (см. выше). */}
        </span>
        <ActivityLine emoji={m.user.activityEmoji} text={m.user.activityText} />
      </span>
      <span className={pillClass} title={m.role}>
        {roleIcon && (
          <img
            className="ec-role-icon"
            src={gameIcon(roleIcon)}
            alt=""
            width={15}
            height={15}
            loading="lazy"
            draggable={false}
          />
        )}
        {tag}
      </span>
      {showDmButton && onOpenDm && (
        <button
          type="button"
          className="ec-member-row__dm"
          onClick={(e) => {
            e.stopPropagation();
            onOpenDm(m.userId);
          }}
          aria-label={`Написать ${m.user.displayName} в личку`}
          title="Написать в личку"
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
  serverId,
}: Props) {
  const { onlineGroups, offline, inVoiceCount, onlineCount } = useMemo(() => {
    const sorted = sortMembers(members);
    const onlineMembers = sorted.filter((m) => m.online);
    const offlineMembers = sorted.filter((m) => !m.online);
    const inVoice = voiceChannelByUser
      ? members.reduce((n, m) => (voiceChannelByUser[m.userId] ? n + 1 : n), 0)
      : 0;
    return {
      onlineGroups: groupOnlineByRole(onlineMembers),
      offline: offlineMembers,
      inVoiceCount: inVoice,
      onlineCount: onlineMembers.length,
    };
  }, [members, voiceChannelByUser]);

  // v1.5.40 — per-server persistent collapse state для role-group sections.
  // Re-init when serverId changes (другое пространство → свой набор preferences).
  const [collapsed, setCollapsed] = useState<Set<MemberRole>>(() => loadCollapsed(serverId));
  useEffect(() => {
    setCollapsed(loadCollapsed(serverId));
  }, [serverId]);
  const toggleCollapsed = (role: MemberRole) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(role)) next.delete(role);
      else next.add(role);
      saveCollapsed(serverId, next);
      return next;
    });
  };
  const [offlineCollapsed, setOfflineCollapsed] = useState<boolean>(() => {
    if (!serverId || typeof localStorage === "undefined") return false;
    try {
      return localStorage.getItem(COLLAPSE_KEY_PREFIX + serverId + ":offline") === "1";
    } catch {
      return false;
    }
  });
  useEffect(() => {
    if (!serverId || typeof localStorage === "undefined") return;
    try {
      localStorage.setItem(
        COLLAPSE_KEY_PREFIX + serverId + ":offline",
        offlineCollapsed ? "1" : "0",
      );
    } catch {
      /* non-fatal */
    }
  }, [offlineCollapsed, serverId]);

  return (
    <aside className="ec-member-list" aria-label="Участники пространства">
      {!hideHeader && (
        <header className="ec-tactical-header">
          <span className="ec-tactical-header__title">
            <svg
              className="ec-tactical-header__icon"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
              <line x1="8" y1="2" x2="8" y2="18" />
              <line x1="16" y1="6" x2="16" y2="22" />
            </svg>
            ТАКТИЧЕСКИЙ ВИД
          </span>
          <span className="ec-tactical-header__count" title="онлайн / всего">
            {onlineCount}/{members.length}
          </span>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="ec-shell__members-close ec-btn ec-btn--ghost ec-btn--sm"
              aria-label="Закрыть"
              style={{ width: 28, height: 28, padding: 0, marginLeft: "var(--ec-space-2)" }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </header>
      )}

      {/* v1.1.63 §10 — network intelligence layer: спокойная signal-строка
          (узлы в сети / в эфире). Фиксирована под header'ом, не скроллится. */}
      {!error && !(loading && members.length === 0) && (
        <div className="ec-net-signal" aria-label="Состояние сети">
          <span className="ec-net-signal__glyph" aria-hidden>
            ◇
          </span>
          {onlineCount === 0 ? (
            <span>сеть в покое</span>
          ) : (
            <span>
              <span className="ec-net-signal__num">{onlineCount}</span>{" "}
              {pluralNodes(onlineCount)} в сети
              {inVoiceCount > 0 && (
                <span className="ec-net-signal__air">
                  {" · "}
                  <span className="ec-net-signal__num">{inVoiceCount}</span> в
                  эфире
                </span>
              )}
            </span>
          )}
        </div>
      )}

      <div className="ec-member-list__scroll">
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
          <p className="ec-member-list__error">{error}</p>
        ) : (
          <>
            {/* v1.5.40 — Discord-style role-grouped online members.
             *  Каждая роль (КОМАНДОРЫ / ОПЕРАТОРЫ / МОДЕРАТОРЫ / ...) =
             *  collapsible section с count. Persist collapse state per-server
             *  через localStorage (see toggleCollapsed + COLLAPSE_KEY_PREFIX).
             *  Замена прежнего flat СВЯЗАННЫЕ_УЗЛЫ list — даёт role hierarchy
             *  visible сразу. Inspired by Discord (President | 1, ...). */}
            {onlineGroups.map(([role, roleMembers], groupIdx) => {
              const isCollapsed = collapsed.has(role);
              return (
                <div key={role} style={groupIdx > 0 ? { marginTop: "var(--ec-space-3)" } : undefined}>
                  <button
                    type="button"
                    className="ec-section-label ec-section-label--toggle"
                    onClick={() => toggleCollapsed(role)}
                    aria-expanded={!isCollapsed}
                    aria-label={`${ROLE_GROUP_LABEL[role]} — ${roleMembers.length}`}
                  >
                    <span className="ec-section-label__group">
                      <span className="ec-dot ec-dot--online" />
                      <span
                        className="ec-section-label__chevron"
                        style={{
                          display: "inline-block",
                          transform: isCollapsed ? "rotate(-90deg)" : "rotate(0deg)",
                          transition: "transform var(--ec-dur-fast) var(--ec-ease)",
                          marginRight: 4,
                        }}
                        aria-hidden
                      >
                        ▾
                      </span>
                      {ROLE_GROUP_LABEL[role]}
                    </span>
                    <span className="ec-channel-section__count">{roleMembers.length}</span>
                  </button>
                  {!isCollapsed &&
                    roleMembers.map((m) => {
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
                </div>
              );
            })}

            {offline.length > 0 && (
              <>
                <button
                  type="button"
                  className="ec-section-label ec-section-label--toggle"
                  onClick={() => setOfflineCollapsed((v) => !v)}
                  aria-expanded={!offlineCollapsed}
                  style={{ marginTop: onlineCount > 0 ? "var(--ec-space-4)" : 0 }}
                >
                  <span className="ec-section-label__group">
                    <span className="ec-dot ec-dot--offline" />
                    <span
                      className="ec-section-label__chevron"
                      style={{
                        display: "inline-block",
                        transform: offlineCollapsed ? "rotate(-90deg)" : "rotate(0deg)",
                        transition: "transform var(--ec-dur-fast) var(--ec-ease)",
                        marginRight: 4,
                      }}
                      aria-hidden
                    >
                      ▾
                    </span>
                    СПЯЩИЙ_РЕЖИМ
                  </span>
                  <span className="ec-channel-section__count">{offline.length}</span>
                </button>
                {!offlineCollapsed &&
                  offline.map((m) => (
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
              <p className="ec-member-list__hint">Никого пока нет.</p>
            )}
          </>
        )}
      </div>
    </aside>
  );
}
