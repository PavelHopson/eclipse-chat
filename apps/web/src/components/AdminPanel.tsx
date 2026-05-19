import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import { apiJson } from "../lib/api";
import { Avatar } from "./Avatar";
import { InvoicesTabContent } from "./AdminInvoicesTab";
import { IntegrationsTabContent, type AdminIntegration } from "./AdminIntegrationsTab";
import { ComposioConnections } from "./ComposioConnections";
import type { MemberRole, MemberRow } from "../hooks/useMembers";
import type { ChannelRow } from "../hooks/useChannels";
import type { TeamHealthData } from "../hooks/useTeamHealth";
import { useComposio } from "../hooks/useComposio";
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
  /** v0.83 #24 phase 1: server mode. CLIENT → показываем кнопку «Открыть портал». */
  serverMode?: "ENGINEERING" | "CLIENT";
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
  /** v0.83 #24 phase 1: открыть client portal (preview для OWNER/ADMIN). */
  onOpenClientPortal?: () => void;
  onClose: () => void;
};

type Tab =
  | "overview"
  | "members"
  | "channels"
  | "roles"
  | "automation"
  | "invoices"
  | "integrations"
  | "audit"
  | "analytics";

/** v0.86 #24 phase 2: invoice shape от backend. */
type AdminInvoiceItem = {
  id: string;
  position: number;
  title: string;
  amount: number;
};
type AdminInvoice = {
  id: string;
  serverId: string;
  number: string;
  title: string;
  status: "DRAFT" | "SENT" | "PAID" | "CANCELLED";
  currency: string;
  amountTotal: number;
  issuedAt: string | null;
  dueAt: string | null;
  paidAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: { id: string; displayName: string; avatar: string | null } | null;
  items: AdminInvoiceItem[];
};

/** v0.80 #26 phase 1: AutomationRule shape от backend.
 *  v0.82 #19 phase 1: расширение discriminator'ов. */
type AutomationTrigger = {
  type: "MESSAGE_NEW";
  keyword?: string;
  channelId?: string | null;
  caseInsensitive?: boolean;
  regex?: string;
};
type AutomationActionPostMessage = {
  type: "POST_MESSAGE";
  channelId: string;
  template: string;
};
type AutomationActionCreateTask = {
  type: "CREATE_TASK";
  taskType: "TASK" | "DECISION" | "FOLLOW_UP";
  titleTemplate: string;
};
type AutomationActionSendWebhook = {
  type: "SEND_WEBHOOK";
  url: string;
  secret?: string;
};
/** v1.0.2 #11.5: Composio action — execute action на подключённом
 *  external app (Gmail / Slack / Notion / etc) с template params. */
type AutomationActionComposio = {
  type: "COMPOSIO_ACTION";
  connectionId: string;
  actionName: string;
  /** JSON-string с placeholders {{user}}/{{message}}/{{channel}}. */
  paramsTemplate: string;
};
type AutomationAction =
  | AutomationActionPostMessage
  | AutomationActionCreateTask
  | AutomationActionSendWebhook
  | AutomationActionComposio;
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
  serverMode,
  currentRole,
  members,
  channels,
  teamHealth,
  onUpdateMemberRole,
  onOpenChannelSettings,
  onOpenServerSettings,
  onOpenClientPortal,
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
  // v0.86 #24 phase 2: invoices tab state.
  const [invoices, setInvoices] = useState<AdminInvoice[] | null>(null);
  const [invoicesLoading, setInvoicesLoading] = useState(false);
  const [invoicesError, setInvoicesError] = useState<string | null>(null);
  const [showCreateInvoice, setShowCreateInvoice] = useState(false);
  // v0.89 #26 phase 2: integrations tab state.
  const [integrations, setIntegrations] = useState<AdminIntegration[] | null>(null);
  const [integrationsLoading, setIntegrationsLoading] = useState(false);
  const [integrationsError, setIntegrationsError] = useState<string | null>(null);
  const [showCreateIntegration, setShowCreateIntegration] = useState(false);

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

  // v0.89 #26: lazy load integrations при первом open tab'а.
  useEffect(() => {
    if (tab !== "integrations" || integrations !== null) return;
    setIntegrationsLoading(true);
    setIntegrationsError(null);
    apiJson<{ integrations: AdminIntegration[] }>(
      `/api/servers/${encodeURIComponent(serverId)}/integrations`,
    )
      .then((d) => setIntegrations(d.integrations))
      .catch((e) =>
        setIntegrationsError(
          e instanceof Error ? e.message : "Не удалось загрузить интеграции",
        ),
      )
      .finally(() => setIntegrationsLoading(false));
  }, [tab, integrations, serverId]);

  // v0.86 #24: lazy load invoices при первом open tab'а.
  useEffect(() => {
    if (tab !== "invoices" || invoices !== null) return;
    setInvoicesLoading(true);
    setInvoicesError(null);
    apiJson<{ invoices: AdminInvoice[] }>(
      `/api/servers/${encodeURIComponent(serverId)}/invoices`,
    )
      .then((d) => setInvoices(d.invoices))
      .catch((e) =>
        setInvoicesError(
          e instanceof Error ? e.message : "Не удалось загрузить счета",
        ),
      )
      .finally(() => setInvoicesLoading(false));
  }, [tab, invoices, serverId]);

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
    trigger: AutomationTrigger;
    action: AutomationAction;
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
            trigger: input.trigger,
            action: input.action,
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
        {serverMode === "CLIENT" && (
          <button
            type="button"
            role="tab"
            aria-selected={tab === "invoices"}
            onClick={() => setTab("invoices")}
            style={tabBtn(tab === "invoices")}
          >
            Счета{invoices ? ` · ${invoices.length}` : ""}
          </button>
        )}
        <button
          type="button"
          role="tab"
          aria-selected={tab === "integrations"}
          onClick={() => setTab("integrations")}
          style={tabBtn(tab === "integrations")}
        >
          Интеграции{integrations ? ` · ${integrations.length}` : ""}
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
          {/* v0.83 #24 phase 1: Client portal preview entry (OWNER/ADMIN only;
              tab already gated by accessDenied). Only useful если mode=CLIENT. */}
          {serverMode === "CLIENT" && onOpenClientPortal && (
            <button
              type="button"
              onClick={onOpenClientPortal}
              style={{
                ...card,
                cursor: "pointer",
                alignItems: "flex-start",
                textAlign: "left",
                transition: "background var(--ec-dur-fast) var(--ec-ease)",
              }}
            >
              <span style={cardLabel}>Клиентский портал</span>
              <span
                style={{
                  ...cardValue,
                  fontSize: "var(--ec-text-md)",
                  color: "var(--ec-accent)",
                }}
              >
                Открыть превью →
              </span>
              <span style={{ fontSize: "var(--ec-text-2xs)", color: "var(--ec-text-dim)" }}>
                Так это видит клиент: прогресс, одобрения, файлы
              </span>
            </button>
          )}
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
              serverId={serverId}
              channels={channels}
              onCancel={() => setShowCreateRule(false)}
              onCreate={(input) => void createRule(input)}
            />
          )}
        </div>
      )}

      {tab === "integrations" && (
        <>
          <IntegrationsTabContent
            serverId={serverId}
            channels={channels}
            integrations={integrations}
            loading={integrationsLoading}
            error={integrationsError}
            showCreate={showCreateIntegration}
            onShowCreate={() => setShowCreateIntegration(true)}
            onHideCreate={() => setShowCreateIntegration(false)}
            onChange={(next) => setIntegrations(next)}
            onError={(msg) => setIntegrationsError(msg)}
          />
          {/* v1.0.1 #11.5 Composio Automation Expansion. */}
          <ComposioConnections serverId={serverId} />
        </>
      )}

      {tab === "invoices" && (
        <InvoicesTabContent
          serverId={serverId}
          invoices={invoices}
          loading={invoicesLoading}
          error={invoicesError}
          showCreate={showCreateInvoice}
          onShowCreate={() => setShowCreateInvoice(true)}
          onHideCreate={() => setShowCreateInvoice(false)}
          onChange={(next) => setInvoices(next)}
          onError={(msg) => setInvoicesError(msg)}
        />
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
  // v0.82 #19 phase 1: per-action-type description. v1.0.2: + COMPOSIO_ACTION.
  const actionLabel =
    rule.action?.type === "POST_MESSAGE"
      ? "Постить в"
      : rule.action?.type === "CREATE_TASK"
        ? "Создать"
        : rule.action?.type === "SEND_WEBHOOK"
          ? "Webhook →"
          : rule.action?.type === "COMPOSIO_ACTION"
            ? "Composio →"
            : "—";
  const actionPreview =
    rule.action?.type === "POST_MESSAGE"
      ? (() => {
          const a = rule.action as AutomationActionPostMessage;
          const ch =
            channels.find((c) => c.id === a.channelId)?.name ?? "(удалён)";
          return (
            <>
              <strong style={{ color: "var(--ec-accent)" }}>#{ch}</strong>:{" "}
              <span style={{ fontStyle: "italic" }}>
                {a.template.slice(0, 120)}
              </span>
            </>
          );
        })()
      : rule.action?.type === "CREATE_TASK"
        ? (() => {
            const a = rule.action as AutomationActionCreateTask;
            const typeLabel =
              a.taskType === "DECISION"
                ? "решение"
                : a.taskType === "FOLLOW_UP"
                  ? "follow-up"
                  : "задачу";
            return (
              <>
                <strong style={{ color: "var(--ec-accent)" }}>{typeLabel}</strong>
                : <span style={{ fontStyle: "italic" }}>
                  {a.titleTemplate.slice(0, 120)}
                </span>
              </>
            );
          })()
        : rule.action?.type === "SEND_WEBHOOK"
          ? (() => {
              const a = rule.action as AutomationActionSendWebhook;
              let host = a.url;
              try {
                host = new URL(a.url).host;
              } catch {
                /* ignore */
              }
              return (
                <span
                  style={{
                    fontFamily: "var(--ec-font-mono)",
                    color: "var(--ec-accent)",
                  }}
                >
                  {host}
                </span>
              );
            })()
          : rule.action?.type === "COMPOSIO_ACTION"
            ? (() => {
                const a = rule.action as AutomationActionComposio;
                return (
                  <span style={{ fontFamily: "var(--ec-font-mono)", color: "var(--ec-accent)" }}>
                    {a.actionName}
                  </span>
                );
              })()
            : null;
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
          {rule.trigger?.regex
            ? `regex /${rule.trigger.regex}/`
            : rule.trigger?.keyword
              ? `сообщение содержит «${rule.trigger.keyword}»`
              : "любое сообщение"}{" "}
          в <strong style={{ color: "var(--ec-accent)" }}>#{trigChannelName}</strong>
          <br />
          <strong style={{ color: "var(--ec-text)" }}>THEN</strong> {actionLabel}{" "}
          {actionPreview}
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

type ActionKind = "POST_MESSAGE" | "CREATE_TASK" | "SEND_WEBHOOK" | "COMPOSIO_ACTION";

function CreateRuleForm({
  serverId,
  channels,
  onCancel,
  onCreate,
}: {
  serverId: string;
  channels: ChannelRow[];
  onCancel: () => void;
  onCreate: (input: {
    name: string;
    trigger: AutomationTrigger;
    action: AutomationAction;
  }) => void;
}) {
  const textChannels = channels.filter(
    (c) => c.type === "TEXT" || c.type === "BROADCAST",
  );
  const [name, setName] = useState("");
  const [keyword, setKeyword] = useState("");
  const [useRegex, setUseRegex] = useState(false);
  const [regex, setRegex] = useState("");
  const [trigCh, setTrigCh] = useState<string>("");
  const [actionKind, setActionKind] = useState<ActionKind>("POST_MESSAGE");
  // POST_MESSAGE fields
  const [actCh, setActCh] = useState<string>(textChannels[0]?.id ?? "");
  const [tmpl, setTmpl] = useState("");
  // CREATE_TASK fields
  const [taskType, setTaskType] = useState<"TASK" | "DECISION" | "FOLLOW_UP">(
    "TASK",
  );
  const [titleTemplate, setTitleTemplate] = useState("");
  // SEND_WEBHOOK fields
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  // v1.0.2 COMPOSIO_ACTION fields
  const composio = useComposio(serverId);
  const activeConnections = composio.connections.filter(
    (c) => c.status === "ACTIVE",
  );
  const [composioConnectionId, setComposioConnectionId] = useState<string>("");
  const [composioActions, setComposioActions] = useState<
    Array<{ name: string; displayName: string; description?: string }>
  >([]);
  const [composioActionsLoading, setComposioActionsLoading] = useState(false);
  const [composioActionName, setComposioActionName] = useState<string>("");
  const [composioParams, setComposioParams] = useState<string>(
    '{\n  "to": "team@example.com",\n  "subject": "Eclipse: {{user}} триггер в #{{channel}}",\n  "body": "{{message}}"\n}',
  );

  // Lazy-load actions list когда connection selected.
  useEffect(() => {
    if (!composioConnectionId || actionKind !== "COMPOSIO_ACTION") {
      setComposioActions([]);
      return;
    }
    setComposioActionsLoading(true);
    setComposioActionName("");
    (async () => {
      try {
        const data = await fetch(
          `/api/servers/${encodeURIComponent(serverId)}/composio/connections/${encodeURIComponent(composioConnectionId)}/actions`,
          {
            credentials: "include",
          },
        ).then((r) => r.json() as Promise<{ actions?: typeof composioActions; error?: string }>);
        if (data.actions) {
          setComposioActions(data.actions);
        } else {
          setComposioActions([]);
        }
      } catch {
        setComposioActions([]);
      } finally {
        setComposioActionsLoading(false);
      }
    })();
  }, [composioConnectionId, actionKind, serverId]);

  // Validate JSON syntax для COMPOSIO_ACTION params textarea.
  const composioParamsValid = useMemo(() => {
    if (actionKind !== "COMPOSIO_ACTION") return true;
    try {
      const parsed = JSON.parse(composioParams);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed);
    } catch {
      return false;
    }
  }, [actionKind, composioParams]);

  const regexValid = useMemo(() => {
    if (!useRegex || !regex) return true;
    try {
      new RegExp(regex);
      return true;
    } catch {
      return false;
    }
  }, [useRegex, regex]);

  const canSubmit =
    name.trim() &&
    regexValid &&
    (actionKind === "POST_MESSAGE"
      ? !!actCh && !!tmpl.trim()
      : actionKind === "CREATE_TASK"
        ? !!titleTemplate.trim()
        : actionKind === "SEND_WEBHOOK"
          ? webhookUrl.trim().startsWith("https://")
          : actionKind === "COMPOSIO_ACTION"
            ? !!composioConnectionId && !!composioActionName && composioParamsValid
            : false);

  const inputStyle: React.CSSProperties = {
    padding: "0.4rem 0.6rem",
    borderRadius: "var(--ec-radius-sm)",
    background: "var(--ec-input-bg)",
    border: "1px solid var(--ec-border-default)",
    color: "var(--ec-text)",
    fontSize: "var(--ec-text-sm)",
  };

  const handleSubmit = () => {
    const trigger: AutomationTrigger = {
      type: "MESSAGE_NEW",
      caseInsensitive: true,
      channelId: trigCh || null,
      ...(useRegex
        ? { regex: regex.trim() || undefined }
        : { keyword: keyword.trim() || undefined }),
    };
    let action: AutomationAction;
    if (actionKind === "POST_MESSAGE") {
      action = {
        type: "POST_MESSAGE",
        channelId: actCh,
        template: tmpl.trim(),
      };
    } else if (actionKind === "CREATE_TASK") {
      action = {
        type: "CREATE_TASK",
        taskType,
        titleTemplate: titleTemplate.trim(),
      };
    } else if (actionKind === "SEND_WEBHOOK") {
      action = {
        type: "SEND_WEBHOOK",
        url: webhookUrl.trim(),
        ...(webhookSecret.trim() ? { secret: webhookSecret.trim() } : {}),
      };
    } else {
      // COMPOSIO_ACTION — paramsTemplate стораджит как JSON-string,
      // engine на сервере парсит + рендерит placeholders deep.
      action = {
        type: "COMPOSIO_ACTION",
        connectionId: composioConnectionId,
        actionName: composioActionName,
        paramsTemplate: composioParams,
      };
    }
    onCreate({ name: name.trim(), trigger, action });
  };

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
        }}
      >
        Новое правило
      </h3>
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Название (например, «'купить' → #sales»)"
        maxLength={120}
        style={inputStyle}
      />

      <div style={{ ...cardLabel, marginTop: 4 }}>WHEN — триггер</div>
      <div
        style={{
          display: "flex",
          gap: 12,
          alignItems: "center",
          fontSize: "var(--ec-text-2xs)",
          color: "var(--ec-text-muted)",
        }}
      >
        <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <input
            type="radio"
            name="match-mode"
            checked={!useRegex}
            onChange={() => setUseRegex(false)}
          />
          substring
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <input
            type="radio"
            name="match-mode"
            checked={useRegex}
            onChange={() => setUseRegex(true)}
          />
          regex
        </label>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "var(--ec-space-2)",
        }}
      >
        {useRegex ? (
          <input
            type="text"
            value={regex}
            onChange={(e) => setRegex(e.target.value)}
            placeholder={'Regex: \\bкупит[ьеть]\\b'}
            maxLength={500}
            style={{
              ...inputStyle,
              fontFamily: "var(--ec-font-mono)",
              borderColor: regexValid
                ? "var(--ec-border-default)"
                : "var(--ec-danger)",
            }}
          />
        ) : (
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="Keyword (например, «купить»)"
            maxLength={200}
            style={inputStyle}
          />
        )}
        <select
          value={trigCh}
          onChange={(e) => setTrigCh(e.target.value)}
          style={inputStyle}
        >
          <option value="">— любой канал —</option>
          {textChannels.map((c) => (
            <option key={c.id} value={c.id}>
              #{c.name}
            </option>
          ))}
        </select>
      </div>

      <div style={{ ...cardLabel, marginTop: 4 }}>THEN — действие</div>
      <select
        value={actionKind}
        onChange={(e) => setActionKind(e.target.value as ActionKind)}
        style={inputStyle}
      >
        <option value="POST_MESSAGE">Запостить сообщение</option>
        <option value="CREATE_TASK">Создать задачу / решение / follow-up</option>
        <option value="SEND_WEBHOOK">Отправить webhook</option>
        <option value="COMPOSIO_ACTION">
          Composio action (Gmail / Slack / Notion / …)
        </option>
      </select>
      {actionKind === "POST_MESSAGE" && (
        <>
          <select
            value={actCh}
            onChange={(e) => setActCh(e.target.value)}
            style={inputStyle}
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
            placeholder="Шаблон: «{{user}} упомянул(а) keyword в #{{channel}}»"
            maxLength={2000}
            rows={3}
            style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }}
          />
        </>
      )}
      {actionKind === "CREATE_TASK" && (
        <>
          <select
            value={taskType}
            onChange={(e) =>
              setTaskType(e.target.value as "TASK" | "DECISION" | "FOLLOW_UP")
            }
            style={inputStyle}
          >
            <option value="TASK">Задача</option>
            <option value="DECISION">Решение</option>
            <option value="FOLLOW_UP">Follow-up</option>
          </select>
          <textarea
            value={titleTemplate}
            onChange={(e) => setTitleTemplate(e.target.value)}
            placeholder="Title-шаблон: «Уточнить запрос от {{user}}»"
            maxLength={300}
            rows={2}
            style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }}
          />
        </>
      )}
      {actionKind === "SEND_WEBHOOK" && (
        <>
          <input
            type="url"
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            placeholder="https://example.com/webhook"
            maxLength={400}
            style={{ ...inputStyle, fontFamily: "var(--ec-font-mono)" }}
          />
          <input
            type="text"
            value={webhookSecret}
            onChange={(e) => setWebhookSecret(e.target.value)}
            placeholder="HMAC secret (опционально, X-Eclipse-Signature)"
            maxLength={200}
            style={{ ...inputStyle, fontFamily: "var(--ec-font-mono)" }}
          />
          <p
            style={{
              margin: 0,
              fontSize: "var(--ec-text-2xs)",
              color: "var(--ec-text-dim)",
              lineHeight: 1.4,
            }}
          >
            Только https://. SSRF guard — localhost / private IPs отвергаются.
            Тело: JSON {`{eventType, ruleId, serverId, content, ...}`}.
          </p>
        </>
      )}
      {actionKind === "COMPOSIO_ACTION" && (
        <>
          {composio.status && !composio.status.enabled && (
            <p
              style={{
                margin: 0,
                padding: "var(--ec-space-2) var(--ec-space-3)",
                color: "var(--ec-status-warn)",
                background: "color-mix(in srgb, var(--ec-status-warn) 12%, transparent)",
                border: "1px solid color-mix(in srgb, var(--ec-status-warn) 35%, transparent)",
                borderRadius: "var(--ec-radius-md)",
                fontSize: "var(--ec-text-2xs)",
                lineHeight: 1.5,
              }}
            >
              ⚠ Composio не настроен на сервере. Сначала установите COMPOSIO_API_KEY
              в .env (см. секцию «Composio» во вкладке Интеграции).
            </p>
          )}
          {composio.status?.enabled && activeConnections.length === 0 && (
            <p
              style={{
                margin: 0,
                padding: "var(--ec-space-2) var(--ec-space-3)",
                color: "var(--ec-text-muted)",
                background: "var(--ec-surface-2)",
                border: "1px solid var(--ec-border-default)",
                borderRadius: "var(--ec-radius-md)",
                fontSize: "var(--ec-text-2xs)",
                lineHeight: 1.5,
              }}
            >
              Нет активных Composio подключений. Подключите app (Gmail / Slack / …)
              во вкладке «Интеграции» — он появится в этом списке.
            </p>
          )}
          {composio.status?.enabled && activeConnections.length > 0 && (
            <>
              <select
                value={composioConnectionId}
                onChange={(e) => setComposioConnectionId(e.target.value)}
                style={inputStyle}
              >
                <option value="">— выбери подключение —</option>
                {activeConnections.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.displayName} ({c.appName})
                  </option>
                ))}
              </select>
              {composioConnectionId && (
                <select
                  value={composioActionName}
                  onChange={(e) => setComposioActionName(e.target.value)}
                  disabled={composioActionsLoading}
                  style={inputStyle}
                >
                  <option value="">
                    {composioActionsLoading
                      ? "Загружаем actions…"
                      : composioActions.length === 0
                      ? "— actions не получены —"
                      : "— выбери action —"}
                  </option>
                  {composioActions.map((a) => (
                    <option key={a.name} value={a.name}>
                      {a.displayName} ({a.name})
                    </option>
                  ))}
                </select>
              )}
              {composioActionName && (
                <>
                  <textarea
                    value={composioParams}
                    onChange={(e) => setComposioParams(e.target.value)}
                    rows={8}
                    maxLength={4000}
                    placeholder='JSON params с placeholders {{user}} / {{message}} / {{channel}}'
                    style={{
                      ...inputStyle,
                      fontFamily: "var(--ec-font-mono)",
                      fontSize: "0.78rem",
                      resize: "vertical",
                      minHeight: 140,
                      borderColor: composioParamsValid
                        ? "var(--ec-border-default)"
                        : "var(--ec-danger)",
                    }}
                  />
                  {!composioParamsValid && (
                    <p
                      style={{
                        margin: 0,
                        fontSize: "var(--ec-text-2xs)",
                        color: "var(--ec-danger)",
                      }}
                    >
                      ⚠ Неверный JSON. Params должен быть object {`{}`}, не array / scalar.
                    </p>
                  )}
                  <p
                    style={{
                      margin: 0,
                      fontSize: "var(--ec-text-2xs)",
                      color: "var(--ec-text-dim)",
                      lineHeight: 1.5,
                    }}
                  >
                    String values поддерживают placeholders <code style={{ fontFamily: "var(--ec-font-mono)" }}>{`{{user}}`}</code>,{" "}
                    <code style={{ fontFamily: "var(--ec-font-mono)" }}>{`{{message}}`}</code>,{" "}
                    <code style={{ fontFamily: "var(--ec-font-mono)" }}>{`{{channel}}`}</code>.
                    Engine рендерит deep через nested objects / arrays. На каждый
                    fire Composio выполняет action с этими params.
                  </p>
                </>
              )}
            </>
          )}
        </>
      )}

      <div
        style={{
          display: "flex",
          gap: 6,
          justifyContent: "flex-end",
          marginTop: 4,
        }}
      >
        <button
          type="button"
          onClick={onCancel}
          className="ec-btn ec-btn--ghost ec-btn--sm"
        >
          Отмена
        </button>
        <button
          type="button"
          disabled={!canSubmit}
          onClick={handleSubmit}
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
