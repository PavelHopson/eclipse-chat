import type { CSSProperties } from "react";
import { useState } from "react";
import { useBots, type BotKeyReveal, type BotRow } from "../hooks/useBots";
import {
  BOT_ROLES,
  BOT_ROLE_COLORS,
  BOT_ROLE_DESCRIPTIONS,
  BOT_ROLE_LABELS,
  type BotRole,
} from "../lib/botRoles";

type Props = {
  serverId: string;
};

const sectionLabel: CSSProperties = {
  fontSize: "var(--ec-text-2xs)",
  fontWeight: 700,
  letterSpacing: "var(--ec-tracking-caps)",
  textTransform: "uppercase",
  color: "var(--ec-text-muted)",
  margin: "0 0 var(--ec-space-2) 0",
};

const groupCard: CSSProperties = {
  background: "var(--ec-surface-2)",
  border: "1px solid var(--ec-border-default)",
  borderRadius: "var(--ec-radius-lg)",
  padding: "var(--ec-space-4)",
  display: "flex",
  flexDirection: "column",
  gap: "var(--ec-space-3)",
};

const fieldHint: CSSProperties = {
  fontSize: "var(--ec-text-2xs)",
  color: "var(--ec-text-dim)",
  lineHeight: 1.5,
  margin: 0,
};

const inputStyle: CSSProperties = {
  width: "100%",
  padding: "0.55rem 0.7rem",
  borderRadius: "var(--ec-radius-md)",
  border: "1px solid var(--ec-border-default)",
  background: "var(--ec-surface-1)",
  color: "var(--ec-text)",
  fontSize: "var(--ec-text-sm)",
  fontFamily: "inherit",
};

const botCard: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "auto 1fr auto",
  gap: "var(--ec-space-3)",
  alignItems: "start",
  padding: "var(--ec-space-3)",
  background: "var(--ec-surface-1)",
  border: "1px solid var(--ec-border-subtle)",
  borderRadius: "var(--ec-radius-md)",
  transition: "border-color var(--ec-dur-fast) var(--ec-ease), background var(--ec-dur-fast) var(--ec-ease)",
};

function roleAvatarStyle(role: BotRole): CSSProperties {
  const c = BOT_ROLE_COLORS[role];
  return {
    width: 36,
    height: 36,
    borderRadius: "var(--ec-radius-md)",
    background: c.bg,
    color: c.fg,
    display: "grid",
    placeItems: "center",
    fontSize: "0.95rem",
    border: `1px solid ${c.border}`,
  };
}

function roleChipStyle(role: BotRole): CSSProperties {
  const c = BOT_ROLE_COLORS[role];
  return {
    display: "inline-flex",
    alignItems: "center",
    padding: "0.05rem 0.45rem",
    background: c.bg,
    color: c.fg,
    border: `1px solid ${c.border}`,
    borderRadius: "var(--ec-radius-full)",
    fontSize: "0.62rem",
    fontWeight: 700,
    letterSpacing: "var(--ec-tracking-caps)",
    textTransform: "uppercase",
    lineHeight: 1.3,
  };
}

const monoChip: CSSProperties = {
  fontFamily: "var(--ec-font-mono)",
  fontSize: "var(--ec-text-2xs)",
  color: "var(--ec-text-muted)",
  background: "var(--ec-surface-2)",
  padding: "0.1rem 0.4rem",
  borderRadius: "var(--ec-radius-sm)",
  border: "1px solid var(--ec-border-subtle)",
  letterSpacing: 0,
};

function formatRelative(iso: string | null): string {
  if (!iso) return "ни разу";
  const ts = new Date(iso).getTime();
  const diff = Date.now() - ts;
  if (diff < 60_000) return "только что";
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)} мин назад`;
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)} ч назад`;
  const days = Math.floor(diff / 86400_000);
  if (days < 30) return `${days} дн назад`;
  return new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
}

function BotIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="11" width="18" height="10" rx="2" />
      <circle cx="12" cy="5" r="2" />
      <path d="M12 7v4" />
      <line x1="8" y1="16" x2="8" y2="16" />
      <line x1="16" y1="16" x2="16" y2="16" />
    </svg>
  );
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* fallback noop */
    }
  };
  return (
    <button
      type="button"
      onClick={copy}
      className={`ec-btn ec-btn--sm ${copied ? "ec-btn--ghost" : "ec-btn--primary"}`}
      style={{ minWidth: 110 }}
    >
      {copied ? "✓ Скопировано" : "Копировать ключ"}
    </button>
  );
}

function RevealedKeyPanel({
  reveal,
  bot,
  onDismiss,
}: {
  reveal: BotKeyReveal;
  bot: BotRow | undefined;
  onDismiss: () => void;
}) {
  return (
    <div
      style={{
        ...groupCard,
        border: "1px solid hsl(38 90% 60% / 0.55)",
        background: "hsl(38 90% 60% / 0.06)",
        marginTop: "var(--ec-space-3)",
      }}
      role="alert"
    >
      <div style={{ display: "flex", alignItems: "center", gap: "var(--ec-space-2)" }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ec-warn)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
        <strong style={{ color: "var(--ec-warn)", letterSpacing: "var(--ec-tracking-wide)" }}>
          API-ключ показывается один раз
        </strong>
      </div>
      <p style={fieldHint}>
        Сохрани его в безопасном месте — secrets manager, password manager или env-переменная
        в коде бота. Восстановить нельзя, только сгенерировать новый.
      </p>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--ec-space-2)",
          padding: "var(--ec-space-2) var(--ec-space-3)",
          background: "var(--ec-surface-1)",
          border: "1px solid var(--ec-border-default)",
          borderRadius: "var(--ec-radius-md)",
          fontFamily: "var(--ec-font-mono)",
          fontSize: "var(--ec-text-sm)",
          color: "var(--ec-text-strong)",
          wordBreak: "break-all",
          overflowWrap: "anywhere",
        }}
      >
        <span style={{ flex: 1, minWidth: 0 }}>{reveal.apiKey}</span>
      </div>
      <div style={{ display: "flex", gap: "var(--ec-space-2)", justifyContent: "flex-end" }}>
        <CopyButton value={reveal.apiKey} />
        <button type="button" onClick={onDismiss} className="ec-btn ec-btn--ghost ec-btn--sm">
          Я сохранил, скрыть
        </button>
      </div>
      {bot && (
        <details style={{ marginTop: "var(--ec-space-2)" }}>
          <summary
            style={{
              cursor: "pointer",
              fontSize: "var(--ec-text-2xs)",
              color: "var(--ec-text-muted)",
              letterSpacing: "var(--ec-tracking-wide)",
            }}
          >
            Пример curl-запроса от имени «{bot.name}»
          </summary>
          <pre
            style={{
              marginTop: "var(--ec-space-2)",
              padding: "var(--ec-space-3)",
              background: "var(--ec-surface-3)",
              border: "1px solid var(--ec-border-subtle)",
              borderRadius: "var(--ec-radius-md)",
              fontSize: "0.7rem",
              fontFamily: "var(--ec-font-mono)",
              color: "var(--ec-text)",
              overflow: "auto",
              whiteSpace: "pre",
            }}
          >
{`curl -X POST https://app.star-crm.ru/eclipse-chat/api/bot/messages \\
  -H "Authorization: Bot ${reveal.apiKey}" \\
  -H "Content-Type: application/json" \\
  -d '{"channelId":"<channel-id>","content":"Привет от ${bot.name}!"}'`}
          </pre>
        </details>
      )}
    </div>
  );
}

function RolePicker({
  value,
  onChange,
  busy,
  size = "md",
}: {
  value: BotRole;
  onChange: (role: BotRole) => void;
  busy?: boolean;
  size?: "sm" | "md";
}) {
  const isSm = size === "sm";
  return (
    <div
      role="radiogroup"
      aria-label="Роль бота"
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: isSm ? 4 : 6,
      }}
    >
      {BOT_ROLES.map((role) => {
        const c = BOT_ROLE_COLORS[role];
        const active = role === value;
        return (
          <button
            key={role}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={busy}
            onClick={() => onChange(role)}
            style={{
              padding: isSm ? "0.2rem 0.55rem" : "0.35rem 0.7rem",
              fontSize: isSm ? "var(--ec-text-2xs)" : "var(--ec-text-xs)",
              fontWeight: 600,
              letterSpacing: "var(--ec-tracking-wide)",
              borderRadius: "var(--ec-radius-full)",
              background: active ? c.bg : "var(--ec-surface-1)",
              color: active ? c.fg : "var(--ec-text-muted)",
              border: `1px solid ${active ? c.border : "var(--ec-border-subtle)"}`,
              cursor: busy ? "wait" : "pointer",
              transition:
                "background var(--ec-dur-fast) var(--ec-ease), color var(--ec-dur-fast) var(--ec-ease), border-color var(--ec-dur-fast) var(--ec-ease)",
              fontFamily: "inherit",
            }}
          >
            {BOT_ROLE_LABELS[role]}
          </button>
        );
      })}
    </div>
  );
}

function CreateBotForm({
  onSubmit,
  busy,
  onCancel,
}: {
  onSubmit: (input: {
    name: string;
    description?: string | null;
    role: BotRole;
  }) => Promise<void>;
  busy: boolean;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [role, setRole] = useState<BotRole>("GENERIC");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || busy) return;
    await onSubmit({ name, description: description || null, role });
    setName("");
    setDescription("");
    setRole("GENERIC");
  };

  return (
    <form onSubmit={handleSubmit} style={{ ...groupCard, gap: "var(--ec-space-2)" }}>
      <h3 style={sectionLabel}>Новый бот</h3>
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={80}
        placeholder="Имя бота (например, Telegram Bridge)"
        autoFocus
        style={inputStyle}
        required
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        maxLength={280}
        rows={2}
        placeholder="Что этот бот делает (необязательно, до 280 символов)"
        style={{ ...inputStyle, resize: "vertical", minHeight: 60 }}
      />
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span
          style={{
            fontSize: "var(--ec-text-2xs)",
            color: "var(--ec-text-muted)",
            letterSpacing: "var(--ec-tracking-wide)",
          }}
        >
          Роль
        </span>
        <RolePicker value={role} onChange={setRole} busy={busy} />
        <p style={{ ...fieldHint, marginTop: 2 }}>{BOT_ROLE_DESCRIPTIONS[role]}</p>
      </div>
      <div style={{ display: "flex", gap: "var(--ec-space-2)", justifyContent: "flex-end" }}>
        <button type="button" onClick={onCancel} disabled={busy} className="ec-btn ec-btn--ghost ec-btn--sm">
          Отмена
        </button>
        <button
          type="submit"
          disabled={!name.trim() || busy}
          className="ec-btn ec-btn--primary ec-btn--sm"
        >
          {busy ? "Создаём…" : "Создать бота"}
        </button>
      </div>
      <p style={fieldHint}>
        После создания получишь API-ключ — показывается один раз. Сохрани его сразу.
      </p>
    </form>
  );
}

export function BotsTab({ serverId }: Props) {
  const {
    bots,
    loading,
    error,
    revealed,
    createBot,
    updateBot,
    regenerateKey,
    deleteBot,
    dismissRevealedKey,
  } = useBots(serverId);
  const [showCreate, setShowCreate] = useState(false);
  const [busy, setBusy] = useState(false);
  /** Bot id у которого открыта webhook-форма. Null = ни один. */
  const [webhookOpen, setWebhookOpen] = useState<string | null>(null);
  /** Bot id у которого открыт role-picker. Null = ни один. */
  const [roleEditOpen, setRoleEditOpen] = useState<string | null>(null);
  /** Drafts of webhook URLs + secrets, keyed by botId. */
  const [webhookDrafts, setWebhookDrafts] = useState<Record<string, { url: string; secret: string }>>({});

  const ensureDraft = (bot: BotRow) => {
    if (webhookDrafts[bot.id]) return;
    setWebhookDrafts((prev) => ({
      ...prev,
      [bot.id]: { url: bot.webhookUrl ?? "", secret: "" },
    }));
  };

  const handleSaveWebhook = async (bot: BotRow) => {
    const draft = webhookDrafts[bot.id];
    if (!draft) return;
    setBusy(true);
    try {
      const patch: { webhookUrl?: string | null; webhookSecret?: string | null } = {
        webhookUrl: draft.url.trim() || null,
      };
      // Только если secret typed — иначе сохраняем как есть (не очищаем)
      if (draft.secret) patch.webhookSecret = draft.secret;
      const ok = await updateBot(bot.id, patch);
      if (ok) {
        setWebhookDrafts((prev) => ({
          ...prev,
          [bot.id]: { url: draft.url, secret: "" }, // Reset secret после save
        }));
      }
    } finally {
      setBusy(false);
    }
  };

  const handleClearWebhook = async (bot: BotRow) => {
    if (!window.confirm(`Удалить webhook у «${bot.name}»? Бот перестанет получать события.`)) {
      return;
    }
    setBusy(true);
    try {
      await updateBot(bot.id, { webhookUrl: null, webhookSecret: null });
      setWebhookDrafts((prev) => ({ ...prev, [bot.id]: { url: "", secret: "" } }));
    } finally {
      setBusy(false);
    }
  };

  const handleCreate = async (input: {
    name: string;
    description?: string | null;
    role: BotRole;
  }) => {
    setBusy(true);
    try {
      const result = await createBot(input);
      if (result) {
        setShowCreate(false);
      }
    } finally {
      setBusy(false);
    }
  };

  const handleRoleChange = async (bot: BotRow, nextRole: BotRole) => {
    if (nextRole === bot.role) {
      setRoleEditOpen(null);
      return;
    }
    setBusy(true);
    try {
      const ok = await updateBot(bot.id, { role: nextRole });
      if (ok) setRoleEditOpen(null);
    } finally {
      setBusy(false);
    }
  };

  const handleRegenerate = async (botId: string, botName: string) => {
    if (
      !window.confirm(
        `Новый ключ для «${botName}». Текущий перестанет работать сразу. Продолжить?`,
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      await regenerateKey(botId);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (botId: string, botName: string) => {
    if (
      !window.confirm(
        `Удалить бота «${botName}»? Все его сообщения и реакции тоже исчезнут. Это необратимо.`,
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      await deleteBot(botId);
    } finally {
      setBusy(false);
    }
  };

  const revealedBot = revealed ? bots.find((b) => b.id === revealed.botId) : undefined;

  return (
    <section>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "var(--ec-space-3)",
        }}
      >
        <h3 style={{ ...sectionLabel, margin: 0 }}>Боты сервера ({bots.length}/20)</h3>
        {!showCreate && bots.length < 20 && (
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="ec-btn ec-btn--primary ec-btn--sm"
          >
            + Создать бота
          </button>
        )}
      </div>

      {error && (
        <div
          style={{
            padding: "var(--ec-space-2) var(--ec-space-3)",
            marginBottom: "var(--ec-space-3)",
            background: "var(--ec-danger-soft)",
            color: "var(--ec-danger)",
            border: "1px solid var(--ec-danger)",
            borderRadius: "var(--ec-radius-md)",
            fontSize: "var(--ec-text-sm)",
          }}
        >
          {error}
        </div>
      )}

      {showCreate && (
        <CreateBotForm
          onSubmit={handleCreate}
          busy={busy}
          onCancel={() => setShowCreate(false)}
        />
      )}

      {revealed && (
        <RevealedKeyPanel reveal={revealed} bot={revealedBot} onDismiss={dismissRevealedKey} />
      )}

      <div style={{ marginTop: "var(--ec-space-3)", display: "flex", flexDirection: "column", gap: "var(--ec-space-2)" }}>
        {loading && bots.length === 0 && (
          <div style={{ ...fieldHint, padding: "var(--ec-space-4)", textAlign: "center" }}>
            Загружаем ботов…
          </div>
        )}

        {!loading && bots.length === 0 && !showCreate && (
          <div
            className="ec-empty"
            style={{
              padding: "var(--ec-space-5) var(--ec-space-4)",
              background:
                "linear-gradient(135deg, hsl(252 70% 70% / 0.06), hsl(195 70% 60% / 0.04))",
              border: "1px dashed var(--ec-border-default)",
              borderRadius: "var(--ec-radius-lg)",
              textAlign: "center",
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                margin: "0 auto var(--ec-space-2)",
                borderRadius: "50%",
                background: "hsl(252 70% 70% / 0.18)",
                color: "hsl(252 80% 78%)",
                display: "grid",
                placeItems: "center",
                border: "1px solid hsl(252 70% 60% / 0.35)",
              }}
              aria-hidden
            >
              <BotIcon />
            </div>
            <div className="ec-empty-title" style={{ fontSize: "var(--ec-text-lg)" }}>
              Пока ни одного бота
            </div>
            <div className="ec-empty-hint" style={{ maxWidth: 360, margin: "0 auto" }}>
              Боты — это сервисные участники: Telegram-мост, мониторинг, AI-агенты.
              Каждый получает API-ключ и пишет в каналы через REST.
            </div>
          </div>
        )}

        {bots.map((bot) => (
          <div
            key={bot.id}
            style={botCard}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "var(--ec-border-default)";
              e.currentTarget.style.background = "var(--ec-surface-2)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "var(--ec-border-subtle)";
              e.currentTarget.style.background = "var(--ec-surface-1)";
            }}
          >
            <div style={roleAvatarStyle(bot.role)} aria-hidden>
              <BotIcon />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--ec-space-2)", flexWrap: "wrap" }}>
                <strong style={{ color: "var(--ec-text-strong)", fontSize: "var(--ec-text-base)" }}>
                  {bot.name}
                </strong>
                <button
                  type="button"
                  onClick={() =>
                    setRoleEditOpen((cur) => (cur === bot.id ? null : bot.id))
                  }
                  disabled={busy}
                  title="Изменить роль"
                  style={{
                    ...roleChipStyle(bot.role),
                    cursor: busy ? "wait" : "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  {BOT_ROLE_LABELS[bot.role]}
                </button>
                <span style={monoChip}>{bot.apiKeyPrefix}…</span>
              </div>
              {bot.description && (
                <p
                  style={{
                    margin: "4px 0 0",
                    fontSize: "var(--ec-text-xs)",
                    color: "var(--ec-text-muted)",
                    lineHeight: 1.4,
                  }}
                >
                  {bot.description}
                </p>
              )}
              <div
                style={{
                  marginTop: 4,
                  display: "flex",
                  gap: "var(--ec-space-3)",
                  fontSize: "var(--ec-text-2xs)",
                  color: "var(--ec-text-dim)",
                  flexWrap: "wrap",
                }}
              >
                <span>создан {bot.owner.displayName}</span>
                <span>•</span>
                <span>использован: {formatRelative(bot.lastUsedAt)}</span>
                <span>•</span>
                <span>{bot.capabilities.join(", ") || "нет capabilities"}</span>
              </div>
              {roleEditOpen === bot.id && (
                <div
                  style={{
                    marginTop: "var(--ec-space-2)",
                    padding: "var(--ec-space-2) var(--ec-space-3)",
                    background: "var(--ec-surface-2)",
                    border: "1px solid var(--ec-border-accent)",
                    borderRadius: "var(--ec-radius-md)",
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                  }}
                >
                  <div
                    style={{
                      fontSize: "var(--ec-text-2xs)",
                      color: "var(--ec-text-muted)",
                      letterSpacing: "var(--ec-tracking-wide)",
                    }}
                  >
                    Сменить роль
                  </div>
                  <RolePicker
                    size="sm"
                    value={bot.role}
                    busy={busy}
                    onChange={(next) => void handleRoleChange(bot, next)}
                  />
                  <p style={fieldHint}>{BOT_ROLE_DESCRIPTIONS[bot.role]}</p>
                </div>
              )}
            </div>
            <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
              <button
                type="button"
                onClick={() => {
                  ensureDraft(bot);
                  setWebhookOpen((cur) => (cur === bot.id ? null : bot.id));
                }}
                disabled={busy}
                className="ec-btn ec-btn--ghost ec-btn--sm"
                title={bot.webhookUrl ? "Webhook настроен — редактировать" : "Подключить webhook"}
                style={
                  bot.webhookUrl
                    ? {
                        color: "var(--ec-ok)",
                        borderColor: "var(--ec-border-accent)",
                      }
                    : undefined
                }
              >
                {bot.webhookUrl ? "🔗 Webhook" : "+ Webhook"}
              </button>
              <button
                type="button"
                onClick={() => void handleRegenerate(bot.id, bot.name)}
                disabled={busy}
                className="ec-btn ec-btn--ghost ec-btn--sm"
                title="Сгенерировать новый ключ (старый перестанет работать)"
              >
                Новый ключ
              </button>
              <button
                type="button"
                onClick={() => void handleDelete(bot.id, bot.name)}
                disabled={busy}
                className="ec-btn ec-btn--danger ec-btn--sm"
                title="Удалить бота навсегда"
              >
                Удалить
              </button>
            </div>
          </div>
        ))}
        {/* Webhook form — inline под bot row если открыт */}
        {webhookOpen && (() => {
          const bot = bots.find((b) => b.id === webhookOpen);
          if (!bot) return null;
          const draft = webhookDrafts[bot.id] ?? { url: "", secret: "" };
          return (
            <div
              key={`webhook-${bot.id}`}
              style={{
                marginTop: "var(--ec-space-2)",
                padding: "var(--ec-space-3)",
                background: "var(--ec-surface-2)",
                border: "1px solid var(--ec-border-accent)",
                borderRadius: "var(--ec-radius-md)",
                display: "flex",
                flexDirection: "column",
                gap: "var(--ec-space-2)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <strong style={{ fontSize: "var(--ec-text-sm)" }}>
                  Webhook для «{bot.name}»
                </strong>
                <button
                  type="button"
                  onClick={() => setWebhookOpen(null)}
                  className="ec-btn ec-btn--ghost ec-btn--sm"
                  style={{ padding: "0.2rem 0.5rem" }}
                  title="Закрыть"
                >
                  ✕
                </button>
              </div>
              <label
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                  fontSize: "var(--ec-text-2xs)",
                  color: "var(--ec-text-muted)",
                  letterSpacing: "var(--ec-tracking-wide)",
                }}
              >
                URL (https://…)
                <input
                  type="url"
                  value={draft.url}
                  onChange={(e) =>
                    setWebhookDrafts((prev) => ({
                      ...prev,
                      [bot.id]: { ...draft, url: e.target.value },
                    }))
                  }
                  placeholder="https://my-bot.example.com/eclipse-events"
                  style={inputStyle}
                />
              </label>
              <label
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                  fontSize: "var(--ec-text-2xs)",
                  color: "var(--ec-text-muted)",
                  letterSpacing: "var(--ec-tracking-wide)",
                }}
              >
                Secret (HMAC-SHA256 signing){" "}
                {bot.webhookSecretSet && (
                  <span style={{ color: "var(--ec-ok)" }}>· уже задан</span>
                )}
                <input
                  type="password"
                  value={draft.secret}
                  onChange={(e) =>
                    setWebhookDrafts((prev) => ({
                      ...prev,
                      [bot.id]: { ...draft, secret: e.target.value },
                    }))
                  }
                  placeholder={
                    bot.webhookSecretSet
                      ? "Оставь пустым чтобы не менять, или введи новый"
                      : "Опционально — для signature verification на receiver-side"
                  }
                  style={inputStyle}
                />
              </label>
              <p style={fieldHint}>
                Каждое сообщение в каналах сервера будет POST'нуто на URL.
                Headers: <code style={monoChip}>X-Eclipse-Event: message.created</code>,
                <code style={monoChip}>X-Eclipse-Bot-Id: {bot.id}</code>,
                и (если secret) <code style={monoChip}>X-Eclipse-Bot-Signature: sha256=&lt;hex&gt;</code>.
                <br />
                Timeout 5s, бот не получает свои собственные messages (anti-loop).
              </p>
              <div style={{ display: "flex", gap: "var(--ec-space-2)", justifyContent: "flex-end" }}>
                {bot.webhookUrl && (
                  <button
                    type="button"
                    onClick={() => void handleClearWebhook(bot)}
                    disabled={busy}
                    className="ec-btn ec-btn--danger ec-btn--sm"
                  >
                    Удалить webhook
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void handleSaveWebhook(bot)}
                  disabled={busy || !draft.url.trim()}
                  className="ec-btn ec-btn--primary ec-btn--sm"
                >
                  {busy ? "Сохраняем…" : "Сохранить"}
                </button>
              </div>
            </div>
          );
        })()}

        {bots.length >= 20 && (
          <p style={{ ...fieldHint, textAlign: "center" }}>
            Достигнут лимит 20 ботов на сервер. Удали неиспользуемого, чтобы создать нового.
          </p>
        )}
      </div>
    </section>
  );
}
