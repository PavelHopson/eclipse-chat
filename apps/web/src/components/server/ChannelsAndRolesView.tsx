import { ChannelGlyph } from "../icons/ChannelCustomIcons";
import type { ChannelRow } from "../../hooks/useChannels";
import type { MemberRole, MemberRow } from "../../hooks/useMembers";
import type { CSSProperties } from "react";
import {
  PERMISSION_GROUPS,
  PERMISSION_LABELS_RU,
  ROLE_DESCRIPTIONS_RU,
  ROLE_LABELS_RU,
  ROLE_ORDER,
  ROLE_TONES,
  hasPermission,
} from "../../lib/memberRoles";

type Props = {
  serverName: string;
  channels: ChannelRow[];
  members: MemberRow[];
  currentRole: MemberRole | null;
  onOpenChannelSettings: (channelId: string) => void;
};

const CHANNEL_TYPE_LABEL: Record<ChannelRow["type"], string> = {
  TEXT: "Текст",
  VOICE: "Голос",
  EXECUTION: "Дела",
  BROADCAST: "Вещание",
};

const MANAGER_ROLES = new Set<MemberRole>(["OWNER", "ADMIN", "MODERATOR"]);

function roleCounts(members: MemberRow[]): Map<MemberRole, number> {
  const counts = new Map<MemberRole, number>();
  for (const member of members) counts.set(member.role, (counts.get(member.role) ?? 0) + 1);
  return counts;
}

function RoleChip({ role }: { role: MemberRole }) {
  const tone = ROLE_TONES[role];
  return (
    <span
      className="ec-server-role-chip"
      style={{ "--role-fg": tone.fg, "--role-bg": tone.bg, "--role-border": tone.border } as CSSProperties}
    >
      {ROLE_LABELS_RU[role]}
    </span>
  );
}

export function ChannelsAndRolesView({
  serverName,
  channels,
  members,
  currentRole,
  onOpenChannelSettings,
}: Props) {
  const counts = roleCounts(members);
  const canOpenSettings = currentRole != null && MANAGER_ROLES.has(currentRole);

  return (
    <section
      id="ec-server-view-channels-roles"
      role="tabpanel"
      aria-label="Каналы и роли"
      className="ec-server-view"
    >
      <div className="ec-server-view__hero ec-holo-edge">
        <div>
          <span className="ec-server-view__eyebrow">{serverName}</span>
          <h2>Каналы и роли</h2>
          <p>
            {channels.length} комнат · {ROLE_ORDER.length} ролей · {members.length} участников
          </p>
        </div>
      </div>

      <div className="ec-server-view__grid">
        <section className="ec-server-view__panel">
          <div className="ec-server-view__section-head">
            <div>
              <h3>Каналы</h3>
              <p>Обзор структуры сервера без перехода в админ-панель.</p>
            </div>
          </div>
          {channels.length === 0 ? (
            <div className="ec-server-view__empty">Каналы ещё не созданы.</div>
          ) : (
            <div className="ec-server-channel-overview">
              {channels.map((channel) => (
                <article key={channel.id} className="ec-server-channel-card">
                  <span className="ec-server-channel-card__icon" aria-hidden>
                    <ChannelGlyph type={channel.type} icon={channel.emoji} />
                  </span>
                  <div className="ec-server-channel-card__main">
                    <strong>{channel.name}</strong>
                    <span>
                      {CHANNEL_TYPE_LABEL[channel.type]} · {channel._count.messages} сообщений
                    </span>
                  </div>
                  {canOpenSettings && (
                    <button
                      type="button"
                      className="ec-icon-btn"
                      aria-label={`Настройки канала ${channel.name}`}
                      title="Настройки"
                      onClick={() => onOpenChannelSettings(channel.id)}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <circle cx="12" cy="12" r="3" />
                        <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
                      </svg>
                    </button>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="ec-server-view__panel">
          <div className="ec-server-view__section-head">
            <div>
              <h3>Роли</h3>
              <p>Матрица доступа и текущая численность по ролям.</p>
            </div>
          </div>
          <div className="ec-server-role-grid">
            {ROLE_ORDER.map((role) => (
              <article key={role} className="ec-server-role-card">
                <div className="ec-server-role-card__top">
                  <RoleChip role={role} />
                  <span>{counts.get(role) ?? 0}</span>
                </div>
                <p>{ROLE_DESCRIPTIONS_RU[role]}</p>
              </article>
            ))}
          </div>
          <div className="ec-server-permission-matrix" aria-label="Матрица прав ролей">
            {PERMISSION_GROUPS.map((group) => (
              <div key={group.name} className="ec-server-permission-group">
                <h4>{group.name}</h4>
                {group.perms.map((permission) => (
                  <div key={permission} className="ec-server-permission-row">
                    <span>{PERMISSION_LABELS_RU[permission]}</span>
                    <div>
                      {ROLE_ORDER.map((role) => (
                        <span
                          key={role}
                          className={
                            "ec-server-permission-dot" +
                            (hasPermission(role, permission) ? " ec-server-permission-dot--on" : "")
                          }
                          title={`${ROLE_LABELS_RU[role]}: ${hasPermission(role, permission) ? "есть" : "нет"}`}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}
