import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import { apiJson } from "../lib/api";
import { Avatar } from "./Avatar";
import type { MemberRole, MemberRow } from "../hooks/useMembers";
import type { ChannelRow } from "../hooks/useChannels";
import type { TeamHealthData } from "../hooks/useTeamHealth";

/**
 * v0.76 #25 phase 1 Admin Panel — unified workspace settings + analytics +
 * audit для OWNER / ADMIN текущего пространства.
 *
 * Tabs:
 *   Обзор — основные счётчики, серверный mode/brand, owner info
 *   Участники — список с inline role-edit (использует существующий
 *                useMembers + updateMemberRole из AppShell)
 *   Комнаты — список с быстрыми ссылками на settings/delete (через
 *               существующие channel-settings / delete handler)
 *   Аудит — последние 100 audit events server'а (новый endpoint
 *               /api/servers/:id/audit-log)
 *   Аналитика — wire к существующему team-health endpoint'у через prop
 *
 * Доступ: только OWNER + ADMIN (resolved в AppShell перед открытием).
 * Hide-если CLIENT mode? Нет — admin нужен везде, mode переключаемый
 * именно отсюда.
 */

/** v0.76 #25: AdminPanel может менять только non-OWNER роли — поэтому
 *  сужаем сигнатуру. OWNER role transfer = отдельный feature будущего. */
export type AssignableMemberRole = "ADMIN" | "MODERATOR" | "MEMBER";

type Props = {
  serverId: string;
  serverName: string;
  currentRole: MemberRole | null;
  members: MemberRow[];
  channels: ChannelRow[];
  teamHealth: TeamHealthData | null;
  onUpdateMemberRole: (
    userId: string,
    role: AssignableMemberRole,
  ) => Promise<void>;
  onOpenChannelSettings: (channelId: string) => void;
  onOpenServerSettings: () => void;
  onClose: () => void;
};

type Tab = "overview" | "members" | "channels" | "audit" | "analytics";

type AuditEvent = {
  id: string;
  type: string;
  createdAt: string;
  metadata: string | null;
  user: { id: string; displayName: string; avatar: string | null } | null;
};

const TYPE_LABELS_RU: Record<string, string> = {
  SERVER_CREATED: "Создание пространства",
  SERVER_DELETED: "Удаление пространства",
  SERVER_BANNER_CHANGED: "Смена баннера",
  SERVER_IDENTITY_CHANGED: "Смена идентичности",
  MEMBER_ROLE_CHANGED: "Изменение роли участника",
  MEMBER_KICKED: "Кик участника",
  MESSAGE_DELETED_BY_MOD: "Удаление сообщения модератором",
  CHANNEL_CREATED: "Создание комнаты",
  CHANNEL_DELETED: "Удаление комнаты",
  BOT_CREATED: "Создание бота",
  BOT_DELETED: "Удаление бота",
  BOT_KEY_REGENERATED: "Регенерация API-ключа бота",
};

const ROLE_LABELS_RU: Record<MemberRole, string> = {
  OWNER: "Владелец",
  ADMIN: "Админ",
  MODERATOR: "Модератор",
  MEMBER: "Участник",
};

const wrap: CSSProperties = {
  flex: 1,
  minHeight: 0,
  overflow: "auto",
  padding: "var(--ec-space-6) var(--ec-space-6) var(--ec-space-8)",
  display: "flex",
  flexDirection: "column",
  gap: "var(--ec-space-4)",
  maxWidth: 1080,
  width: "100%",
  margin: "0 auto",
};

const headerRow: CSSProperties = {
  display: "flex",
  alignItems: "flex-end",
  justifyContent: "space-between",
  gap: "var(--ec-space-3)",
  flexWrap: "wrap",
};

const eyebrow: CSSProperties = {
  fontSize: "var(--ec-text-2xs)",
  fontWeight: 800,
  letterSpacing: "var(--ec-tracking-caps)",
  textTransform: "uppercase",
  color: "var(--ec-text-dim)",
};

const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: "var(--ec-text-2xl)",
  fontWeight: 700,
  letterSpacing: "var(--ec-tracking-tight)",
  color: "var(--ec-text-strong)",
};

const tabBar: CSSProperties = {
  display: "flex",
  gap: "var(--ec-space-1)",
  padding: 4,
  background: "hsl(208 16% 8% / 0.6)",
  border: "1px solid var(--ec-border-subtle)",
  borderRadius: "var(--ec-radius-lg)",
  alignSelf: "flex-start",
  flexWrap: "wrap",
};

function tabBtn(active: boolean): CSSProperties {
  return {
    padding: "0.45rem 0.95rem",
    borderRadius: "var(--ec-radius-md)",
    background: active ? "var(--ec-accent-soft)" : "transparent",
    border: active ? "1px solid var(--ec-border-accent)" : "1px solid transparent",
    color: active ? "var(--ec-accent)" : "var(--ec-text-muted)",
    fontSize: "var(--ec-text-sm)",
    fontWeight: 600,
    cursor: "pointer",
    transition:
      "background var(--ec-dur-fast) var(--ec-ease), color var(--ec-dur-fast) var(--ec-ease)",
  };
}

const card: CSSProperties = {
  padding: "var(--ec-space-4)",
  borderRadius: "var(--ec-radius-lg)",
  background: "hsl(208 16% 10% / 0.55)",
  border: "1px solid var(--ec-border-subtle)",
  display: "flex",
  flexDirection: "column",
  gap: 4,
};

const cardLabel: CSSProperties = {
  fontSize: "var(--ec-text-2xs)",
  fontWeight: 700,
  letterSpacing: "var(--ec-tracking-caps)",
  textTransform: "uppercase",
  color: "var(--ec-text-dim)",
};

const cardValue: CSSProperties = {
  fontSize: "var(--ec-text-xl)",
  fontWeight: 700,
  color: "var(--ec-text-strong)",
};

const row: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "auto 1fr auto auto",
  alignItems: "center",
  gap: 12,
  padding: "var(--ec-space-2) var(--ec-space-3)",
  borderRadius: "var(--ec-radius-md)",
  background: "hsl(208 16% 10% / 0.4)",
  border: "1px solid var(--ec-border-subtle)",
};

function formatRel(iso: string): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return iso;
  const dt = Date.now() - t;
  const s = Math.max(0, Math.floor(dt / 1000));
  if (s < 60) return `${s} с назад`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} мин назад`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ч назад`;
  const d = Math.floor(h / 24);
  return `${d} д назад`;
}

export function AdminPanel({
  serverId,
  serverName,
  currentRole,
  members,
  channels,
  teamHealth,
  onUpdateMemberRole,
  onOpenChannelSettings,
  onOpenServerSettings,
  onClose,
}: Props) {
  const [tab, setTab] = useState<Tab>("overview");
  const [audit, setAudit] = useState<AuditEvent[] | null>(null);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (tab !== "audit" || audit !== null) return;
    setAuditLoading(true);
    setAuditError(null);
    apiJson<{ events: AuditEvent[] }>(
      `/api/servers/${encodeURIComponent(serverId)}/audit-log`,
    )
      .then((d) => setAudit(d.events))
      .catch((e) =>
        setAuditError(
          e instanceof Error ? e.message : "Не удалось загрузить audit-log",
        ),
      )
      .finally(() => setAuditLoading(false));
  }, [tab, audit, serverId]);

  const onlineCount = useMemo(
    () => members.filter((m) => m.online).length,
    [members],
  );
  const ownerMember = useMemo(
    () => members.find((m) => m.role === "OWNER"),
    [members],
  );

  const accessDenied = currentRole !== "OWNER" && currentRole !== "ADMIN";
  if (accessDenied) {
    return (
      <div style={wrap}>
        <div style={headerRow}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={eyebrow}>Admin · доступ закрыт</span>
            <h1 style={titleStyle}>Только для OWNER / ADMIN</h1>
            <p
              style={{
                margin: 0,
                color: "var(--ec-text-muted)",
                fontSize: "var(--ec-text-sm)",
              }}
            >
              Запроси повышение роли у владельца пространства.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ec-btn ec-btn--ghost ec-btn--sm"
            aria-label="Закрыть"
          >
            Закрыть
          </button>
        </div>
      </div>
    );
  }

  const canEditRoles = currentRole === "OWNER";

  return (
    <div style={wrap}>
      <div style={headerRow}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={eyebrow}>Admin · {serverName}</span>
          <h1 style={titleStyle}>Управление пространством</h1>
          <p
            style={{
              margin: 0,
              fontSize: "var(--ec-text-sm)",
              color: "var(--ec-text-muted)",
              maxWidth: 640,
              lineHeight: 1.5,
            }}
          >
            Единый экран для настроек, ролей, аудита и аналитики команды.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="ec-btn ec-btn--ghost ec-btn--sm"
          aria-label="Закрыть"
        >
          Закрыть
        </button>
      </div>

      <div style={tabBar} role="tablist" aria-label="Разделы">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "overview"}
          onClick={() => setTab("overview")}
          style={tabBtn(tab === "overview")}
        >
          Обзор
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "members"}
          onClick={() => setTab("members")}
          style={tabBtn(tab === "members")}
        >
          Участники · {members.length}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "channels"}
          onClick={() => setTab("channels")}
          style={tabBtn(tab === "channels")}
        >
          Комнаты · {channels.length}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "audit"}
          onClick={() => setTab("audit")}
          style={tabBtn(tab === "audit")}
        >
          Аудит
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "analytics"}
          onClick={() => setTab("analytics")}
          style={tabBtn(tab === "analytics")}
        >
          Аналитика
        </button>
      </div>

      {tab === "overview" && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "var(--ec-space-3)",
          }}
        >
          <div style={card}>
            <span style={cardLabel}>Участников</span>
            <span style={cardValue}>{members.length}</span>
            <span style={{ fontSize: "var(--ec-text-2xs)", color: "var(--ec-text-dim)" }}>
              {onlineCount} онлайн
            </span>
          </div>
          <div style={card}>
            <span style={cardLabel}>Комнат</span>
            <span style={cardValue}>{channels.length}</span>
            <span style={{ fontSize: "var(--ec-text-2xs)", color: "var(--ec-text-dim)" }}>
              {channels.filter((c) => c.type === "TEXT" || c.type === "EXECUTION").length} текст ·{" "}
              {channels.filter((c) => c.type === "VOICE").length} голос ·{" "}
              {channels.filter((c) => c.type === "BROADCAST").length} канал
            </span>
          </div>
          <div style={card}>
            <span style={cardLabel}>Открытых задач</span>
            <span style={cardValue}>
              {teamHealth?.counts.openTotal ?? "—"}
            </span>
            <span style={{ fontSize: "var(--ec-text-2xs)", color: "var(--ec-text-dim)" }}>
              {teamHealth?.counts.overdueTotal ?? 0} просрочено
            </span>
          </div>
          <div style={card}>
            <span style={cardLabel}>Владелец</span>
            <span
              style={{
                ...cardValue,
                fontSize: "var(--ec-text-md)",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              {ownerMember && (
                <>
                  <Avatar
                    url={ownerMember.user.avatar}
                    name={ownerMember.user.displayName}
                    size={20}
                  />
                  {ownerMember.user.displayName}
                </>
              )}
            </span>
          </div>
          <button
            type="button"
            onClick={onOpenServerSettings}
            style={{
              ...card,
              cursor: "pointer",
              alignItems: "flex-start",
              textAlign: "left",
              transition: "background var(--ec-dur-fast) var(--ec-ease)",
            }}
          >
            <span style={cardLabel}>Настройки</span>
            <span
              style={{
                ...cardValue,
                fontSize: "var(--ec-text-md)",
                color: "var(--ec-accent)",
              }}
            >
              Открыть →
            </span>
            <span style={{ fontSize: "var(--ec-text-2xs)", color: "var(--ec-text-dim)" }}>
              Имя · режим · brand · боты
            </span>
          </button>
        </div>
      )}

      {tab === "members" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {members.map((m) => (
            <div key={m.userId} style={row}>
              <Avatar
                url={m.user.avatar}
                name={m.user.displayName}
                size={28}
              />
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontWeight: 600,
                    color: "var(--ec-text)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {m.user.displayName}
                </div>
                <div
                  style={{
                    fontSize: "var(--ec-text-2xs)",
                    color: "var(--ec-text-dim)",
                  }}
                >
                  {m.online ? "online" : "offline"}
                </div>
              </div>
              {canEditRoles && m.role !== "OWNER" ? (
                <select
                  value={m.role}
                  onChange={(e) =>
                    void onUpdateMemberRole(
                      m.userId,
                      e.target.value as AssignableMemberRole,
                    )
                  }
                  style={{
                    padding: "0.3rem 0.55rem",
                    borderRadius: "var(--ec-radius-sm)",
                    background: "var(--ec-input-bg)",
                    border: "1px solid var(--ec-border-default)",
                    color: "var(--ec-text)",
                    fontSize: "var(--ec-text-2xs)",
                  }}
                >
                  <option value="ADMIN">{ROLE_LABELS_RU.ADMIN}</option>
                  <option value="MODERATOR">{ROLE_LABELS_RU.MODERATOR}</option>
                  <option value="MEMBER">{ROLE_LABELS_RU.MEMBER}</option>
                </select>
              ) : (
                <span
                  style={{
                    padding: "0.2rem 0.55rem",
                    borderRadius: "var(--ec-radius-full)",
                    background:
                      m.role === "OWNER"
                        ? "var(--ec-accent-soft)"
                        : "var(--ec-surface-2)",
                    color:
                      m.role === "OWNER"
                        ? "var(--ec-accent)"
                        : "var(--ec-text-muted)",
                    fontSize: "0.65rem",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "var(--ec-tracking-caps)",
                  }}
                >
                  {ROLE_LABELS_RU[m.role]}
                </span>
              )}
              <span aria-hidden />
            </div>
          ))}
        </div>
      )}

      {tab === "channels" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {channels.map((c) => (
            <div
              key={c.id}
              style={{
                ...row,
                gridTemplateColumns: "auto 1fr auto auto",
              }}
            >
              <span
                style={{
                  width: 26,
                  height: 26,
                  display: "grid",
                  placeItems: "center",
                  borderRadius: "var(--ec-radius-sm)",
                  background: "var(--ec-surface-2)",
                  color: "var(--ec-accent)",
                  fontSize: "0.85rem",
                  fontWeight: 700,
                }}
              >
                {c.type === "VOICE"
                  ? "🔊"
                  : c.type === "BROADCAST"
                    ? "📣"
                    : c.type === "EXECUTION"
                      ? "▦"
                      : "#"}
              </span>
              <div
                style={{
                  minWidth: 0,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                <div style={{ fontWeight: 600, color: "var(--ec-text)" }}>
                  {c.name}
                </div>
                <div
                  style={{
                    fontSize: "var(--ec-text-2xs)",
                    color: "var(--ec-text-dim)",
                  }}
                >
                  {c.type === "EXECUTION" ? "канбан" : c.type.toLowerCase()}
                  {c.expiresAt ? ` · временная` : ""}
                  {c.internal ? ` · internal` : ""}
                </div>
              </div>
              <span aria-hidden />
              <button
                type="button"
                onClick={() => onOpenChannelSettings(c.id)}
                style={{
                  padding: "0.25rem 0.6rem",
                  background: "transparent",
                  border: "1px solid var(--ec-border-default)",
                  borderRadius: "var(--ec-radius-sm)",
                  color: "var(--ec-text-muted)",
                  cursor: "pointer",
                  fontSize: "var(--ec-text-2xs)",
                }}
              >
                Настройки
              </button>
            </div>
          ))}
        </div>
      )}

      {tab === "audit" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {auditLoading && (
            <p style={{ color: "var(--ec-text-dim)" }}>Загружаем audit-log…</p>
          )}
          {auditError && (
            <p style={{ color: "var(--ec-danger)" }}>{auditError}</p>
          )}
          {!auditLoading && audit && audit.length === 0 && (
            <p style={{ color: "var(--ec-text-dim)" }}>
              Нет событий для этого пространства.
            </p>
          )}
          {audit?.map((e) => (
            <div
              key={e.id}
              style={{
                ...row,
                gridTemplateColumns: "auto 1fr auto",
              }}
            >
              {e.user ? (
                <Avatar
                  url={e.user.avatar}
                  name={e.user.displayName}
                  size={22}
                />
              ) : (
                <span
                  aria-hidden
                  style={{
                    width: 22,
                    height: 22,
                    display: "grid",
                    placeItems: "center",
                    borderRadius: "var(--ec-radius-full)",
                    background: "var(--ec-surface-2)",
                    color: "var(--ec-text-dim)",
                    fontSize: "0.65rem",
                    fontWeight: 700,
                  }}
                >
                  ?
                </span>
              )}
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: "var(--ec-text-sm)",
                    color: "var(--ec-text)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  <strong>{e.user?.displayName ?? "система"}</strong>{" "}
                  <span style={{ color: "var(--ec-text-muted)" }}>
                    — {TYPE_LABELS_RU[e.type] ?? e.type}
                  </span>
                </div>
                {e.metadata && (
                  <div
                    style={{
                      fontSize: "var(--ec-text-2xs)",
                      color: "var(--ec-text-dim)",
                      fontFamily:
                        "ui-monospace, SFMono-Regular, monospace",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                    title={e.metadata}
                  >
                    {e.metadata}
                  </div>
                )}
              </div>
              <span
                style={{
                  fontSize: "var(--ec-text-2xs)",
                  color: "var(--ec-text-dim)",
                  whiteSpace: "nowrap",
                }}
                title={e.createdAt}
              >
                {formatRel(e.createdAt)}
              </span>
            </div>
          ))}
        </div>
      )}

      {tab === "analytics" && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "var(--ec-space-3)",
          }}
        >
          {!teamHealth ? (
            <p style={{ color: "var(--ec-text-dim)" }}>
              Открой «Здоровье команды» в ChannelList, чтобы прогрузить
              аналитику.
            </p>
          ) : (
            <>
              <StatCard label="Открыто" value={teamHealth.counts.openTotal} />
              <StatCard
                label="Просрочено"
                value={teamHealth.counts.overdueTotal}
                tone="warn"
              />
              <StatCard
                label="Без ответственного"
                value={teamHealth.counts.unassignedTotal}
                tone="idle"
              />
              <StatCard
                label="Среднее закрытие"
                value={
                  teamHealth.avgResolutionDays
                    ? `${teamHealth.avgResolutionDays.toFixed(1)} д`
                    : "—"
                }
                tone="exec"
              />
              {teamHealth.responseTime?.medianMs != null && (
                <StatCard
                  label="Время первого ответа"
                  value={formatDurationShort(teamHealth.responseTime.medianMs)}
                  tone="exec"
                />
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function formatDurationShort(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 60) return `${s} с`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} мин`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ч`;
  return `${Math.floor(h / 24)} д`;
}

function StatCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number | string;
  tone?: "default" | "warn" | "idle" | "exec";
}) {
  const stripe =
    tone === "warn"
      ? "var(--ec-status-warn)"
      : tone === "idle"
        ? "var(--ec-status-idle)"
        : tone === "exec"
          ? "var(--ec-status-exec)"
          : "var(--ec-accent)";
  return (
    <div
      style={{
        ...card,
        boxShadow: `inset 3px 0 0 0 ${stripe}`,
      }}
    >
      <span style={cardLabel}>{label}</span>
      <span style={cardValue}>{value}</span>
    </div>
  );
}
