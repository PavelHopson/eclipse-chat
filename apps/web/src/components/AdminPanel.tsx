import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import { apiJson } from "../lib/api";
import { Avatar } from "./Avatar";
import type { MemberRole, MemberRow } from "../hooks/useMembers";
import type { ChannelRow } from "../hooks/useChannels";
import type { TeamHealthData } from "../hooks/useTeamHealth";
import {
  PERMISSION_GROUPS,
  PERMISSION_LABELS_RU,
  ROLE_DESCRIPTIONS_RU,
  ROLE_LABELS_RU as ROLE_LABELS_FROM_LIB,
  ROLE_ORDER,
  ROLE_TONES,
  hasPermission,
} from "../lib/memberRoles";

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
 *  сужаем сигнатуру. OWNER role transfer = отдельный feature будущего.
 *  v0.78 #17 phase 1: 9 assignable ролей. */
export type AssignableMemberRole = Exclude<MemberRole, "OWNER">;

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

type Tab =
  | "overview"
  | "members"
  | "channels"
  | "roles"
  | "automation"
  | "audit"
  | "analytics";

/** v0.80 #26 phase 1: AutomationRule shape от backend. */
type AutomationTrigger = {
  type: "MESSAGE_NEW";
  keyword?: string;
  channelId?: string | null;
  caseInsensitive?: boolean;
};
type AutomationAction = {
  type: "POST_MESSAGE";
  channelId: string;
  template: string;
};
type AutomationRule = {
  id: string;
  serverId: string;
  name: string;
  enabled: boolean;
  trigger: AutomationTrigger | null;
  action: AutomationAction | null;
  createdAt: string;
  lastFiredAt: string | null;
  fireCount: number;
};

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

// v0.78 #17: используем ROLE_LABELS_FROM_LIB (10 ролей) — single source.
const ROLE_LABELS_RU = ROLE_LABELS_FROM_LIB;

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
  // v0.80 #26 phase 1: automation tab state.
  const [rules, setRules] = useState<AutomationRule[] | null>(null);
  const [rulesLoading, setRulesLoading] = useState(false);
  const [rulesError, setRulesError] = useState<string | null>(null);
  const [showCreateRule, setShowCreateRule] = useState(false);

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

  // v0.80 #26: lazy load automation rules при первом open tab'а.
  useEffect(() => {
    if (tab !== "automation" || rules !== null) return;
    setRulesLoading(true);
    setRulesError(null);
    apiJson<{ rules: AutomationRule[] }>(
      `/api/servers/${encodeURIComponent(serverId)}/automations`,
    )
      .then((d) => setRules(d.rules))
      .catch((e) =>
        setRulesError(
          e instanceof Error ? e.message : "Не удалось загрузить правила",
        ),
      )
      .finally(() => setRulesLoading(false));
  }, [tab, rules, serverId]);

  const toggleRule = async (rule: AutomationRule) => {
    try {
      const data = await apiJson<{ rule: AutomationRule }>(
        `/api/automations/${encodeURIComponent(rule.id)}`,
        {
          method: "PATCH",
          body: JSON.stringify({ enabled: !rule.enabled }),
          headers: { "Content-Type": "application/json" },
        },
      );
      setRules((prev) =>
        prev ? prev.map((r) => (r.id === rule.id ? data.rule : r)) : prev,
      );
    } catch (e) {
      setRulesError(
        e instanceof Error ? e.message : "Не удалось обновить правило",
      );
    }
  };

  const deleteRule = async (rule: AutomationRule) => {
    if (!window.confirm(`Удалить правило «${rule.name}»?`)) return;
    try {
      await apiJson(`/api/automations/${encodeURIComponent(rule.id)}`, {
        method: "DELETE",
      });
      setRules((prev) => (prev ? prev.filter((r) => r.id !== rule.id) : prev));
    } catch (e) {
      setRulesError(e instanceof Error ? e.message : "Не удалось удалить");
    }
  };

  const createRule = async (input: {
    name: string;
    keyword: string;
    triggerChannelId: string | null;
    actionChannelId: string;
    template: string;
  }) => {
    try {
      const data = await apiJson<{ rule: AutomationRule }>(
        `/api/servers/${encodeURIComponent(serverId)}/automations`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: input.name,
            enabled: true,
            trigger: {
              type: "MESSAGE_NEW",
              keyword: input.keyword || undefined,
              channelId: input.triggerChannelId,
              caseInsensitive: true,
            },
            action: {
              type: "POST_MESSAGE",
              channelId: input.actionChannelId,
              template: input.template,
            },
          }),
        },
      );
      setRules((prev) => (prev ? [data.rule, ...prev] : [data.rule]));
      setShowCreateRule(false);
    } catch (e) {
      setRulesError(e instanceof Error ? e.message : "Не удалось создать правило");
    }
  };

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
          aria-selected={tab === "roles"}
          onClick={() => setTab("roles")}
          style={tabBtn(tab === "roles")}
        >
          Роли · {ROLE_ORDER.length}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "automation"}
          onClick={() => setTab("automation")}
          style={tabBtn(tab === "automation")}
        >
          Автоматизация{rules ? ` · ${rules.length}` : ""}
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
                  {ROLE_ORDER.filter((r) => r !== "OWNER").map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABELS_RU[r]}
                    </option>
                  ))}
                </select>
              ) : (
                <RoleChip role={m.role} />
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

      {tab === "roles" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--ec-space-4)" }}>
          <p
            style={{
              margin: 0,
              fontSize: "var(--ec-text-sm)",
              color: "var(--ec-text-muted)",
              lineHeight: 1.55,
              maxWidth: 720,
            }}
          >
            10 ролей × {PERMISSION_GROUPS.flatMap((g) => g.perms).length}{" "}
            permission'ов. Phase 1 — read-only матрица (hardcoded), phase 2 —
            редактируемые per-workspace overrides.
          </p>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "var(--ec-space-3)",
            }}
          >
            {ROLE_ORDER.map((r) => (
              <div key={r} style={card}>
                <RoleChip role={r} />
                <p
                  style={{
                    margin: "6px 0 0",
                    fontSize: "var(--ec-text-2xs)",
                    color: "var(--ec-text-muted)",
                    lineHeight: 1.5,
                  }}
                >
                  {ROLE_DESCRIPTIONS_RU[r]}
                </p>
              </div>
            ))}
          </div>

          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                borderCollapse: "collapse",
                width: "100%",
                fontSize: "var(--ec-text-2xs)",
                minWidth: 760,
              }}
            >
              <thead>
                <tr>
                  <th
                    style={{
                      textAlign: "left",
                      padding: "0.5rem 0.6rem",
                      borderBottom: "1px solid var(--ec-border-default)",
                      color: "var(--ec-text-dim)",
                      letterSpacing: "var(--ec-tracking-caps)",
                      textTransform: "uppercase",
                      fontWeight: 700,
                      position: "sticky",
                      left: 0,
                      background: "var(--ec-bg)",
                    }}
                  >
                    Permission
                  </th>
                  {ROLE_ORDER.map((r) => (
                    <th
                      key={r}
                      style={{
                        padding: "0.5rem 0.4rem",
                        borderBottom: "1px solid var(--ec-border-default)",
                        textAlign: "center",
                        whiteSpace: "nowrap",
                        color: ROLE_TONES[r].fg,
                        letterSpacing: "var(--ec-tracking-caps)",
                        textTransform: "uppercase",
                        fontWeight: 700,
                      }}
                    >
                      {ROLE_LABELS_RU[r]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PERMISSION_GROUPS.map((group) => (
                  <>
                    <tr key={`grp-${group.name}`}>
                      <td
                        colSpan={ROLE_ORDER.length + 1}
                        style={{
                          padding: "0.45rem 0.6rem",
                          background: "hsl(208 16% 10% / 0.6)",
                          color: "var(--ec-text-dim)",
                          fontWeight: 700,
                          letterSpacing: "var(--ec-tracking-caps)",
                          textTransform: "uppercase",
                          fontSize: "0.62rem",
                          position: "sticky",
                          left: 0,
                        }}
                      >
                        {group.name}
                      </td>
                    </tr>
                    {group.perms.map((p) => (
                      <tr key={p}>
                        <td
                          style={{
                            padding: "0.35rem 0.6rem",
                            borderBottom: "1px solid var(--ec-border-subtle)",
                            color: "var(--ec-text)",
                            position: "sticky",
                            left: 0,
                            background: "var(--ec-bg)",
                          }}
                        >
                          {PERMISSION_LABELS_RU[p]}
                        </td>
                        {ROLE_ORDER.map((r) => (
                          <td
                            key={r}
                            style={{
                              padding: "0.35rem 0.4rem",
                              borderBottom: "1px solid var(--ec-border-subtle)",
                              textAlign: "center",
                              color: hasPermission(r, p)
                                ? ROLE_TONES[r].fg
                                : "var(--ec-text-dim)",
                              fontFamily: hasPermission(r, p)
                                ? "var(--ec-font-mono)"
                                : undefined,
                              fontWeight: hasPermission(r, p) ? 700 : 400,
                            }}
                          >
                            {hasPermission(r, p) ? "✓" : "·"}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "automation" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--ec-space-3)" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: "var(--ec-space-3)",
              flexWrap: "wrap",
            }}
          >
            <p
              style={{
                margin: 0,
                fontSize: "var(--ec-text-sm)",
                color: "var(--ec-text-muted)",
                lineHeight: 1.5,
                maxWidth: 640,
              }}
            >
              Trigger → Action правила для workspace. Phase 1: keyword-match
              на сообщение → пост от системного бота в target-канал. Placeholders:
              <code style={{ background: "var(--ec-surface-2)", padding: "0 4px" }}>
                {"{{user}}"}
              </code>
              ,{" "}
              <code style={{ background: "var(--ec-surface-2)", padding: "0 4px" }}>
                {"{{message}}"}
              </code>
              ,{" "}
              <code style={{ background: "var(--ec-surface-2)", padding: "0 4px" }}>
                {"{{channel}}"}
              </code>
              .
            </p>
            {(currentRole === "OWNER" || currentRole === "ADMIN") && (
              <button
                type="button"
                onClick={() => setShowCreateRule(true)}
                className="ec-btn ec-btn--primary ec-btn--sm"
              >
                + Создать правило
              </button>
            )}
          </div>
          {rulesLoading && (
            <p style={{ color: "var(--ec-text-dim)" }}>Загружаем…</p>
          )}
          {rulesError && (
            <p style={{ color: "var(--ec-danger)" }}>{rulesError}</p>
          )}
          {rules && rules.length === 0 && !rulesLoading && (
            <p
              style={{
                color: "var(--ec-text-dim)",
                fontSize: "var(--ec-text-sm)",
              }}
            >
              Правил пока нет. Создай первое — keyword в #channel → автоответ.
            </p>
          )}
          {rules?.map((r) => (
            <AutomationRow
              key={r.id}
              rule={r}
              channels={channels}
              onToggle={() => void toggleRule(r)}
              onDelete={() => void deleteRule(r)}
              canEdit={currentRole === "OWNER" || currentRole === "ADMIN"}
            />
          ))}
          {showCreateRule && (
            <CreateRuleForm
              channels={channels}
              onCancel={() => setShowCreateRule(false)}
              onCreate={(input) => void createRule(input)}
            />
          )}
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

function AutomationRow({
  rule,
  channels,
  onToggle,
  onDelete,
  canEdit,
}: {
  rule: AutomationRule;
  channels: ChannelRow[];
  onToggle: () => void;
  onDelete: () => void;
  canEdit: boolean;
}) {
  const trigChannelName = rule.trigger?.channelId
    ? channels.find((c) => c.id === rule.trigger?.channelId)?.name ??
      "(удалён)"
    : "любой канал";
  const actChannelName = rule.action?.channelId
    ? channels.find((c) => c.id === rule.action?.channelId)?.name ??
      "(удалён)"
    : "—";
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr auto",
        gap: "var(--ec-space-3)",
        padding: "var(--ec-space-3) var(--ec-space-4)",
        borderRadius: "var(--ec-radius-md)",
        background: "hsl(208 16% 10% / 0.55)",
        border: "1px solid var(--ec-border-subtle)",
        alignItems: "center",
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <strong
            style={{
              color: "var(--ec-text-strong)",
              fontSize: "var(--ec-text-sm)",
            }}
          >
            {rule.name}
          </strong>
          {!rule.enabled && (
            <span
              style={{
                padding: "0.1rem 0.45rem",
                borderRadius: "var(--ec-radius-full)",
                background: "var(--ec-surface-2)",
                color: "var(--ec-text-dim)",
                fontSize: "0.6rem",
                fontWeight: 700,
                textTransform: "uppercase",
              }}
            >
              выключено
            </span>
          )}
          {rule.fireCount > 0 && (
            <span
              style={{
                fontSize: "0.65rem",
                color: "var(--ec-text-dim)",
                fontWeight: 600,
              }}
              title={`Last fired: ${rule.lastFiredAt ?? "—"}`}
            >
              сработало {rule.fireCount}×
            </span>
          )}
        </div>
        <div
          style={{
            marginTop: 6,
            fontSize: "var(--ec-text-2xs)",
            color: "var(--ec-text-muted)",
            lineHeight: 1.5,
          }}
        >
          <strong style={{ color: "var(--ec-text)" }}>WHEN</strong>{" "}
          {rule.trigger?.keyword
            ? `сообщение содержит «${rule.trigger.keyword}»`
            : "любое сообщение"}{" "}
          в <strong style={{ color: "var(--ec-accent)" }}>#{trigChannelName}</strong>
          <br />
          <strong style={{ color: "var(--ec-text)" }}>THEN</strong> постить в{" "}
          <strong style={{ color: "var(--ec-accent)" }}>#{actChannelName}</strong>
          :{" "}
          <span style={{ fontStyle: "italic" }}>
            {(rule.action?.template ?? "").slice(0, 120)}
          </span>
        </div>
      </div>
      {canEdit && (
        <div style={{ display: "flex", gap: 6 }}>
          <button
            type="button"
            onClick={onToggle}
            style={{
              padding: "0.2rem 0.55rem",
              borderRadius: "var(--ec-radius-sm)",
              background: rule.enabled
                ? "var(--ec-accent-soft)"
                : "var(--ec-surface-2)",
              border: `1px solid ${rule.enabled ? "var(--ec-border-accent)" : "var(--ec-border-default)"}`,
              color: rule.enabled ? "var(--ec-accent)" : "var(--ec-text-muted)",
              cursor: "pointer",
              fontSize: "var(--ec-text-2xs)",
              fontWeight: 600,
            }}
          >
            {rule.enabled ? "Выключить" : "Включить"}
          </button>
          <button
            type="button"
            onClick={onDelete}
            style={{
              padding: "0.2rem 0.55rem",
              borderRadius: "var(--ec-radius-sm)",
              background: "transparent",
              border: "1px solid var(--ec-border-default)",
              color: "var(--ec-text-muted)",
              cursor: "pointer",
              fontSize: "var(--ec-text-2xs)",
            }}
          >
            Удалить
          </button>
        </div>
      )}
    </div>
  );
}

function CreateRuleForm({
  channels,
  onCancel,
  onCreate,
}: {
  channels: ChannelRow[];
  onCancel: () => void;
  onCreate: (input: {
    name: string;
    keyword: string;
    triggerChannelId: string | null;
    actionChannelId: string;
    template: string;
  }) => void;
}) {
  const textChannels = channels.filter(
    (c) => c.type === "TEXT" || c.type === "BROADCAST",
  );
  const [name, setName] = useState("");
  const [keyword, setKeyword] = useState("");
  const [trigCh, setTrigCh] = useState<string>("");
  const [actCh, setActCh] = useState<string>(textChannels[0]?.id ?? "");
  const [tmpl, setTmpl] = useState("");
  return (
    <div
      style={{
        padding: "var(--ec-space-4)",
        borderRadius: "var(--ec-radius-lg)",
        background: "hsl(208 16% 8% / 0.8)",
        border: "1px solid var(--ec-border-accent)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--ec-space-2)",
      }}
    >
      <h3
        style={{
          margin: 0,
          fontSize: "var(--ec-text-md)",
          fontWeight: 700,
          color: "var(--ec-text-strong)",
          letterSpacing: "var(--ec-tracking-tight)",
        }}
      >
        Новое правило
      </h3>
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Название (например, «Sales-keyword → #sales»)"
        maxLength={120}
        style={{
          padding: "0.4rem 0.6rem",
          borderRadius: "var(--ec-radius-sm)",
          background: "var(--ec-input-bg)",
          border: "1px solid var(--ec-border-default)",
          color: "var(--ec-text)",
          fontSize: "var(--ec-text-sm)",
        }}
      />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "var(--ec-space-2)",
        }}
      >
        <input
          type="text"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="Keyword (например, «купить»)"
          maxLength={200}
          style={{
            padding: "0.4rem 0.6rem",
            borderRadius: "var(--ec-radius-sm)",
            background: "var(--ec-input-bg)",
            border: "1px solid var(--ec-border-default)",
            color: "var(--ec-text)",
            fontSize: "var(--ec-text-sm)",
          }}
        />
        <select
          value={trigCh}
          onChange={(e) => setTrigCh(e.target.value)}
          style={{
            padding: "0.4rem 0.6rem",
            borderRadius: "var(--ec-radius-sm)",
            background: "var(--ec-input-bg)",
            border: "1px solid var(--ec-border-default)",
            color: "var(--ec-text)",
            fontSize: "var(--ec-text-sm)",
          }}
        >
          <option value="">— любой канал —</option>
          {textChannels.map((c) => (
            <option key={c.id} value={c.id}>
              #{c.name}
            </option>
          ))}
        </select>
      </div>
      <select
        value={actCh}
        onChange={(e) => setActCh(e.target.value)}
        style={{
          padding: "0.4rem 0.6rem",
          borderRadius: "var(--ec-radius-sm)",
          background: "var(--ec-input-bg)",
          border: "1px solid var(--ec-border-default)",
          color: "var(--ec-text)",
          fontSize: "var(--ec-text-sm)",
        }}
      >
        {textChannels.map((c) => (
          <option key={c.id} value={c.id}>
            Постить в #{c.name}
          </option>
        ))}
      </select>
      <textarea
        value={tmpl}
        onChange={(e) => setTmpl(e.target.value)}
        placeholder="Шаблон: «{{user}} упомянул(а) ключевое слово в #{{channel}}»"
        maxLength={2000}
        rows={3}
        style={{
          padding: "0.4rem 0.6rem",
          borderRadius: "var(--ec-radius-sm)",
          background: "var(--ec-input-bg)",
          border: "1px solid var(--ec-border-default)",
          color: "var(--ec-text)",
          fontSize: "var(--ec-text-sm)",
          fontFamily: "inherit",
          resize: "vertical",
        }}
      />
      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
        <button
          type="button"
          onClick={onCancel}
          className="ec-btn ec-btn--ghost ec-btn--sm"
        >
          Отмена
        </button>
        <button
          type="button"
          disabled={!name.trim() || !actCh || !tmpl.trim()}
          onClick={() =>
            onCreate({
              name: name.trim(),
              keyword: keyword.trim(),
              triggerChannelId: trigCh || null,
              actionChannelId: actCh,
              template: tmpl.trim(),
            })
          }
          className="ec-btn ec-btn--primary ec-btn--sm"
        >
          Создать
        </button>
      </div>
    </div>
  );
}

function RoleChip({ role }: { role: MemberRole }) {
  const tone = ROLE_TONES[role];
  return (
    <span
      style={{
        padding: "0.2rem 0.55rem",
        borderRadius: "var(--ec-radius-full)",
        background: tone.bg,
        color: tone.fg,
        border: `1px solid ${tone.border}`,
        fontSize: "0.65rem",
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "var(--ec-tracking-caps)",
        display: "inline-block",
        whiteSpace: "nowrap",
      }}
    >
      {ROLE_LABELS_RU[role]}
    </span>
  );
}
