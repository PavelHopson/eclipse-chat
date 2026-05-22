import { useMemo } from "react";
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
      <span className="ec-member-row__name">
        {m.user.displayName}
        {/* voice-индикатор намеренно убран: кто в голосовом — видно списком
            под voice-каналом в sidebar (ChannelList), дублировать не нужно.
            inVoiceChannel остаётся в tooltip (см. выше). */}
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
}: Props) {
  const { online, offline, inVoiceCount } = useMemo(() => {
    const sorted = sortMembers(members);
    const inVoice = voiceChannelByUser
      ? members.reduce((n, m) => (voiceChannelByUser[m.userId] ? n + 1 : n), 0)
      : 0;
    return {
      online: sorted.filter((m) => m.online),
      offline: sorted.filter((m) => !m.online),
      inVoiceCount: inVoice,
    };
  }, [members, voiceChannelByUser]);

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
            {online.length}/{members.length}
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
          {online.length === 0 ? (
            <span>сеть в покое</span>
          ) : (
            <span>
              <span className="ec-net-signal__num">{online.length}</span>{" "}
              {pluralNodes(online.length)} в сети
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
            {online.length > 0 && (
              <>
                <div className="ec-section-label">
                  <span className="ec-section-label__group">
                    <span className="ec-dot ec-dot--online" />СВЯЗАННЫЕ_УЗЛЫ
                  </span>
                  <span className="ec-channel-section__count">{online.length}</span>
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
                  style={{ marginTop: online.length > 0 ? "var(--ec-space-4)" : 0 }}
                >
                  <span className="ec-section-label__group">
                    <span className="ec-dot ec-dot--offline" />СПЯЩИЙ_РЕЖИМ
                  </span>
                  <span className="ec-channel-section__count">{offline.length}</span>
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
              <p className="ec-member-list__hint">Никого пока нет.</p>
            )}
          </>
        )}
      </div>
    </aside>
  );
}
