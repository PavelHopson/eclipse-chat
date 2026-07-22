import { memo, useEffect, useMemo, useState } from "react";
import "../styles/clean-ui.css";
import { Avatar } from "./Avatar";
import type { MemberRole, MemberRow } from "../hooks/useMembers";

type Props = {
  members: MemberRow[];
  loading: boolean;
  error: string | null;
  /** Drawer-mode close button. Передаётся на mobile/tablet — на desktop omitted. */
  onClose?: () => void;
  /** Desktop — свернуть панель участников (chevron). */
  onCollapse?: () => void;
  /** Скрыть собственный header — когда MemberList вложен в IntelligencePanel. */
  hideHeader?: boolean;
  /** Кто сейчас в каком VOICE-канале (userId → channelId или undefined). */
  voiceChannelByUser?: Record<string, string>;
  /** Лукап name канала по id — для tooltip. */
  channelNameById?: (channelId: string) => string | undefined;
  /** Текущий user id — скрыть «написать в личку» для самого себя. */
  currentUserId?: string;
  /** «Написать в личку» — открывает или создаёт DM. */
  onOpenDm?: (userId: string) => void;
  /** Открыть публичный профиль участника. */
  onOpenProfile?: (userId: string) => void;
  /** activeServerId для per-server persisted collapse state role-group sections. */
  serverId?: string | null;
};

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

/** Короткий тег роли (mono-чип). */
const ROLE_TAG: Record<MemberRole, string> = {
  OWNER: "OWN",
  ADMIN: "ADM",
  MODERATOR: "MOD",
  ARCHITECT: "ARC",
  DEVELOPER: "DEV",
  OPERATOR: "OPR",
  MEMBER: "",
  CLIENT: "CLI",
  VIEWER: "VWR",
  GUEST: "GST",
};

/** Чистые русские лейблы групп (без sci-fi-театра). */
const ROLE_GROUP_LABEL: Record<MemberRole, string> = {
  OWNER: "Владелец",
  ADMIN: "Администраторы",
  MODERATOR: "Модераторы",
  ARCHITECT: "Архитекторы",
  DEVELOPER: "Разработчики",
  OPERATOR: "Операторы",
  MEMBER: "Участники",
  CLIENT: "Клиенты",
  VIEWER: "Наблюдатели",
  GUEST: "Гости",
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
    arr.sort((a, b) => a.user.displayName.localeCompare(b.user.displayName, "ru"));
    return [[role, arr] as [MemberRole, MemberRow[]]];
  });
}

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

function roleChipClass(role: MemberRole): string {
  if (role === "OWNER") return "ec-mem-row__role ec-mem-row__role--owner";
  if (role === "ADMIN" || role === "MODERATOR") return "ec-mem-row__role ec-mem-row__role--admin";
  return "ec-mem-row__role";
}

function presenceColor(m: MemberRow): string {
  if (!m.online) return "var(--ec-presence-offline)";
  if (m.manualStatus === "IDLE") return "var(--ec-presence-idle)";
  if (m.manualStatus === "DND") return "var(--ec-presence-dnd)";
  return "var(--ec-presence-online)";
}

// memo — изменение одного участника (online-toggle и т.п.) не должно
// ре-рендерить все строки списка.
const MemberRowView = memo(function MemberRowView({
  m,
  inVoiceChannel,
  voiceChannelName,
  showDmButton,
  onOpenDm,
  onOpenProfile,
}: {
  m: MemberRow;
  inVoiceChannel: boolean;
  voiceChannelName?: string;
  showDmButton: boolean;
  onOpenDm?: (userId: string) => void;
  onOpenProfile?: (userId: string) => void;
}) {
  const tag = ROLE_TAG[m.role];
  const hasActivity = Boolean(m.user.activityEmoji || m.user.activityText);
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
      className={
        "ec-mem-row" +
        (m.online ? "" : " ec-mem-row--offline") +
        (onOpenProfile ? " ec-mem-row--clickable" : "")
      }
      title={tooltip}
      role={onOpenProfile ? "button" : undefined}
      tabIndex={onOpenProfile ? 0 : undefined}
      aria-label={onOpenProfile ? `Открыть профиль ${m.user.displayName}` : undefined}
      onClick={() => onOpenProfile?.(m.userId)}
      onKeyDown={(event) => {
        if (!onOpenProfile || (event.key !== "Enter" && event.key !== " ")) return;
        event.preventDefault();
        onOpenProfile(m.userId);
      }}
    >
      <span className="ec-mem-row__av">
        <Avatar
          url={m.user.avatar}
          name={m.user.displayName}
          size={32}
          glow={m.online && m.manualStatus !== "IDLE" && m.manualStatus !== "DND"}
        />
        <span
          aria-hidden
          className="ec-mem-row__pres"
          style={{
            background: presenceColor(m),
            boxShadow:
              m.online && m.manualStatus !== "IDLE" && m.manualStatus !== "DND"
                ? "0 0 6px hsl(150 50% 50% / 0.6)"
                : "none",
          }}
        />
      </span>
      <span className="ec-mem-row__id">
        <span className="ec-mem-row__name">{m.user.displayName}</span>
        {hasActivity && (
          <span className="ec-mem-row__act">
            {m.user.activityEmoji && <span>{m.user.activityEmoji}</span>}
            {m.user.activityText && <span>{m.user.activityText}</span>}
          </span>
        )}
      </span>
      {tag && <span className={roleChipClass(m.role)}>{tag}</span>}
      {showDmButton && onOpenDm && (
        <button
          type="button"
          className="ec-mem-row__dm"
          onClick={(e) => {
            e.stopPropagation();
            onOpenDm(m.userId);
          }}
          aria-label={`Написать ${m.user.displayName} в личку`}
          title="Написать в личку"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
          </svg>
        </button>
      )}
    </div>
  );
});

export function MemberList({
  members,
  loading,
  error,
  onClose,
  onCollapse,
  voiceChannelByUser,
  channelNameById,
  currentUserId,
  onOpenDm,
  onOpenProfile,
  hideHeader,
  serverId,
}: Props) {
  const { onlineGroups, offline, onlineCount } = useMemo(() => {
    const sorted = sortMembers(members);
    const onlineMembers = sorted.filter((m) => m.online);
    const offlineMembers = sorted.filter((m) => !m.online);
    return {
      onlineGroups: groupOnlineByRole(onlineMembers),
      offline: offlineMembers,
      onlineCount: onlineMembers.length,
    };
  }, [members]);

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
      localStorage.setItem(COLLAPSE_KEY_PREFIX + serverId + ":offline", offlineCollapsed ? "1" : "0");
    } catch {
      /* non-fatal */
    }
  }, [offlineCollapsed, serverId]);

  return (
    <aside className="ec-mem" aria-label="Участники пространства">
      {!hideHeader && (
        <header className="ec-mem__hd">
          <span className="ec-mem__hd-title">Участники</span>
          <span className="ec-mem__hd-count">
            {onlineCount}/{members.length}
          </span>
          {onCollapse && (
            <button type="button" onClick={onCollapse} className="ec-mem__close" aria-label="Свернуть панель" title="Свернуть">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M9 6l6 6-6 6" />
              </svg>
            </button>
          )}
          {onClose && (
            <button type="button" onClick={onClose} className="ec-mem__close" aria-label="Закрыть">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </header>
      )}

      <div className="ec-mem__scroll">
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
          <p className="ec-mem__error">{error}</p>
        ) : (
          <>
            {onlineGroups.map(([role, roleMembers]) => {
              const isCollapsed = collapsed.has(role);
              return (
                <div key={role}>
                  <button
                    type="button"
                    className="ec-mem__group"
                    onClick={() => toggleCollapsed(role)}
                    aria-expanded={!isCollapsed}
                  >
                    <span className={"ec-mem__chev" + (isCollapsed ? " is-collapsed" : "")} aria-hidden>
                      ▾
                    </span>
                    {ROLE_GROUP_LABEL[role]}
                    <span className="ec-mem__group-count">{roleMembers.length}</span>
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
                          onOpenProfile={onOpenProfile}
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
                  className="ec-mem__group"
                  onClick={() => setOfflineCollapsed((v) => !v)}
                  aria-expanded={!offlineCollapsed}
                >
                  <span className={"ec-mem__chev" + (offlineCollapsed ? " is-collapsed" : "")} aria-hidden>
                    ▾
                  </span>
                  Не в сети
                  <span className="ec-mem__group-count">{offline.length}</span>
                </button>
                {!offlineCollapsed &&
                  offline.map((m) => (
                    <MemberRowView
                      key={m.id}
                      m={m}
                      inVoiceChannel={false}
                      showDmButton={Boolean(currentUserId && m.userId !== currentUserId)}
                      onOpenDm={onOpenDm}
                      onOpenProfile={onOpenProfile}
                    />
                  ))}
              </>
            )}

            {members.length === 0 && !loading && <p className="ec-mem__hint">Никого пока нет.</p>}
          </>
        )}
      </div>
    </aside>
  );
}
