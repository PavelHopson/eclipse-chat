import type { CSSProperties } from "react";
import { useState } from "react";
import {
  useBots,
  type BotKeyReveal,
  type BotRow,
  type BotTestResult,
  type BotUsage,
} from "../hooks/useBots";
import { EmptyState } from "./EmptyState";
import { EmptyBotsIcon } from "./EmptyIcons";
import { useConfirm } from "./ConfirmDialog";
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

// v1.7.9 slice 6 (продолжение) — остаточные статические inline-стили
// BotsTab выведены в классы .ec-bots-* / .ec-bot-* (cockpit.css, рядом с
// slice-6b семейством). Inline остаётся ТОЛЬКО для per-role цветов
// (roleColorStyle / RolePicker active — из BOT_ROLE_COLORS), это
// legitimately dynamic. JS-hover в компоненте нет (bot-card :hover — CSS).

/** Per-role цвета (bg/fg/border) — единственный legitimately-dynamic
 *  inline. Layout аватара/чипа держат классы .ec-bot-avatar /
 *  .ec-bot-role-chip. */
function roleColorStyle(role: BotRole): CSSProperties {
  const c = BOT_ROLE_COLORS[role];
  return { background: c.bg, color: c.fg, border: `1px solid ${c.border}` };
}

/** Основной EN-keyword для роли (для UI hint про @-mention в BotsTab). */
function primaryRoleKeyword(role: BotRole): string {
  switch (role) {
    case "MODERATOR":
      return "moderator";
    case "PM":
      return "pm";
    case "KNOWLEDGE":
      return "knowledge";
    case "SALES":
      return "sales";
    case "GENERIC":
    default:
      return "ai";
  }
}

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
      className={`ec-btn ec-btn--sm ec-bots-copy-btn ${copied ? "ec-btn--ghost" : "ec-btn--primary"}`}
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
    <div className="ec-bots-group-card ec-bots-group-card--warn" role="alert">
      <div className="ec-bots-warn-head">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
        <strong className="ec-bots-warn-title">API-ключ показывается один раз</strong>
      </div>
      <p className="ec-bots-field-hint">
        Сохрани его в безопасном месте — secrets manager, password manager или env-переменная
        в коде бота. Восстановить нельзя, только сгенерировать новый.
      </p>
      <div className="ec-bots-key-box">
        <span className="ec-bots-key-box__value">{reveal.apiKey}</span>
      </div>
      <div className="ec-bots-actions">
        <CopyButton value={reveal.apiKey} />
        <button type="button" onClick={onDismiss} className="ec-btn ec-btn--ghost ec-btn--sm">
          Я сохранил, скрыть
        </button>
      </div>
      {bot && (
        <details className="ec-bots-curl">
          <summary className="ec-bots-curl__summary">
            Пример curl-запроса от имени «{bot.name}»
          </summary>
          <pre className="ec-bots-code">
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
      className={`ec-bot-role-group${isSm ? " ec-bot-role-group--sm" : ""}`}
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
            className={`ec-bot-role-option${isSm ? " ec-bot-role-option--sm" : ""}`}
            style={active ? { background: c.bg, color: c.fg, borderColor: c.border } : undefined}
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
    <form onSubmit={handleSubmit} className="ec-bots-group-card ec-bots-group-card--tight">
      <h3 className="ec-bots-section-label">Новый бот</h3>
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={80}
        placeholder="Имя бота (например, Telegram Bridge)"
        autoFocus
        className="ec-bots-input"
        required
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        maxLength={280}
        rows={2}
        placeholder="Что этот бот делает (необязательно, до 280 символов)"
        className="ec-bots-input ec-bots-input--area"
      />
      <div className="ec-bots-field-group">
        <span className="ec-bots-label">Роль</span>
        <RolePicker value={role} onChange={setRole} busy={busy} />
        <p className="ec-bots-field-hint">{BOT_ROLE_DESCRIPTIONS[role]}</p>
      </div>
      <div className="ec-bots-actions">
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
      <p className="ec-bots-field-hint">
        После создания получишь API-ключ — показывается один раз. Сохрани его сразу.
      </p>
    </form>
  );
}

export function BotsTab({ serverId }: Props) {
  const confirm = useConfirm();
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
    fetchUsage,
    testBot,
  } = useBots(serverId);
  const [showCreate, setShowCreate] = useState(false);
  const [busy, setBusy] = useState(false);
  /** Bot id у которого открыта webhook-форма. Null = ни один. */
  const [webhookOpen, setWebhookOpen] = useState<string | null>(null);
  /** Bot id у которого открыт role-picker. Null = ни один. */
  const [roleEditOpen, setRoleEditOpen] = useState<string | null>(null);
  /** Bot id у которого открыт редактор system prompt. */
  const [promptEditOpen, setPromptEditOpen] = useState<string | null>(null);
  /** v1.2.27 — Bot id у которого открыт редактор personality. */
  const [personalityEditOpen, setPersonalityEditOpen] = useState<string | null>(null);
  /** v1.2.27 — Drafts of personality, keyed by botId. */
  const [personalityDrafts, setPersonalityDrafts] = useState<Record<string, string>>({});
  /** v1.0 #11 AI controls: bot id у которого открыт test-run panel. */
  const [testOpen, setTestOpen] = useState<string | null>(null);
  /** v1.0 #11 AI controls: bot id у которого открыта statistics panel. */
  const [usageOpen, setUsageOpen] = useState<string | null>(null);
  /** Drafts of webhook URLs + secrets, keyed by botId. */
  const [webhookDrafts, setWebhookDrafts] = useState<Record<string, { url: string; secret: string }>>({});
  const [promptDrafts, setPromptDrafts] = useState<Record<string, string>>({});
  /** v1.0: drafts of test-input (последний typed text) per bot. */
  const [testDrafts, setTestDrafts] = useState<Record<string, string>>({});
  /** v1.0: last test-run result per bot (response + provider + latency). */
  const [testResults, setTestResults] = useState<Record<string, BotTestResult | null>>({});
  /** v1.0: usage stats cache per bot. Lazy-fetched on first open. */
  const [usageCache, setUsageCache] = useState<Record<string, BotUsage>>({});
  /** v1.0: per-bot busy flag для test/usage operations (не блокирует whole tab). */
  const [perBotBusy, setPerBotBusy] = useState<Record<string, boolean>>({});

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
    const ok = await confirm({
      title: "Удалить webhook?",
      message: `Бот «${bot.name}» перестанет получать события на этот адрес.`,
      confirmLabel: "Удалить webhook",
      danger: true,
    });
    if (!ok) return;
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

  const ensurePromptDraft = (bot: BotRow) => {
    if (promptDrafts[bot.id] !== undefined) return;
    setPromptDrafts((prev) => ({
      ...prev,
      [bot.id]: bot.systemPromptOverride ?? "",
    }));
  };

  const handleToggleAutoRespond = async (bot: BotRow) => {
    setBusy(true);
    try {
      await updateBot(bot.id, { autoRespond: !bot.autoRespond });
    } finally {
      setBusy(false);
    }
  };

  const handleSavePrompt = async (bot: BotRow) => {
    const draft = promptDrafts[bot.id];
    if (draft === undefined) return;
    setBusy(true);
    try {
      const trimmed = draft.trim();
      const ok = await updateBot(bot.id, {
        systemPromptOverride: trimmed ? trimmed : null,
      });
      if (ok) setPromptEditOpen(null);
    } finally {
      setBusy(false);
    }
  };

  const handleResetPrompt = async (bot: BotRow) => {
    setBusy(true);
    try {
      const ok = await updateBot(bot.id, { systemPromptOverride: null });
      if (ok) {
        setPromptDrafts((prev) => ({ ...prev, [bot.id]: "" }));
        setPromptEditOpen(null);
      }
    } finally {
      setBusy(false);
    }
  };

  const ensurePersonalityDraft = (bot: BotRow) => {
    if (personalityDrafts[bot.id] !== undefined) return;
    setPersonalityDrafts((prev) => ({
      ...prev,
      [bot.id]: bot.personality ?? "",
    }));
  };

  const handleSavePersonality = async (bot: BotRow) => {
    const draft = personalityDrafts[bot.id];
    if (draft === undefined) return;
    setBusy(true);
    try {
      const trimmed = draft.trim().slice(0, 1000);
      const ok = await updateBot(bot.id, {
        personality: trimmed ? trimmed : null,
      });
      if (ok) setPersonalityEditOpen(null);
    } finally {
      setBusy(false);
    }
  };

  const handleClearPersonality = async (bot: BotRow) => {
    setBusy(true);
    try {
      const ok = await updateBot(bot.id, { personality: null });
      if (ok) {
        setPersonalityDrafts((prev) => ({ ...prev, [bot.id]: "" }));
        setPersonalityEditOpen(null);
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
    const ok = await confirm({
      title: "Сгенерировать новый ключ?",
      message: `Текущий ключ бота «${botName}» перестанет работать сразу — не забудьте обновить его там, где он используется.`,
      confirmLabel: "Новый ключ",
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      await regenerateKey(botId);
    } finally {
      setBusy(false);
    }
  };

  /** v1.0: load usage stats для bot. Cached after first load. */
  const handleOpenUsage = async (bot: BotRow) => {
    setUsageOpen((cur) => (cur === bot.id ? null : bot.id));
    if (usageCache[bot.id]) return; // already cached
    setPerBotBusy((prev) => ({ ...prev, [bot.id]: true }));
    try {
      const data = await fetchUsage(bot.id);
      if (data) {
        setUsageCache((prev) => ({ ...prev, [bot.id]: data }));
      }
    } finally {
      setPerBotBusy((prev) => ({ ...prev, [bot.id]: false }));
    }
  };

  /** v1.0: open test panel + init draft если пустой. */
  const handleOpenTest = (bot: BotRow) => {
    setTestOpen((cur) => (cur === bot.id ? null : bot.id));
    if (testDrafts[bot.id] === undefined) {
      setTestDrafts((prev) => ({
        ...prev,
        [bot.id]: "Привет! Кратко скажи кто ты и что умеешь.",
      }));
    }
  };

  /** v1.0: run test prompt. Не отправляет в канал — только preview. */
  const handleRunTest = async (bot: BotRow) => {
    const input = testDrafts[bot.id]?.trim();
    if (!input) return;
    setPerBotBusy((prev) => ({ ...prev, [bot.id]: true }));
    setTestResults((prev) => ({ ...prev, [bot.id]: null })); // clear stale
    try {
      const result = await testBot(bot.id, input);
      setTestResults((prev) => ({ ...prev, [bot.id]: result }));
    } finally {
      setPerBotBusy((prev) => ({ ...prev, [bot.id]: false }));
    }
  };

  const handleDelete = async (botId: string, botName: string) => {
    const ok = await confirm({
      title: "Удалить бота?",
      message: `«${botName}» и все его сообщения и реакции будут удалены безвозвратно.`,
      confirmLabel: "Удалить бота",
      danger: true,
    });
    if (!ok) return;
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
      <div className="ec-bots-header">
        <h3 className="ec-bots-section-label">Боты пространства ({bots.length}/20)</h3>
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

      {error && <div className="ec-bots-error">{error}</div>}

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

      <div className="ec-bots-list">
        {loading && bots.length === 0 && (
          <div className="ec-bots-field-hint ec-bots-loading">
            Загружаем ботов…
          </div>
        )}

        {!loading && bots.length === 0 && !showCreate && (
          <EmptyState
            icon={<EmptyBotsIcon />}
            title="Пока ни одного бота"
            hint="Боты — это сервисные участники: Telegram-мост, мониторинг, AI-агенты. Каждый получает API-ключ и пишет в комнаты через REST."
          />
        )}

        {bots.map((bot) => (
          <div key={bot.id} className="ec-hover-lift ec-bot-card">
            <div className="ec-bot-avatar" style={roleColorStyle(bot.role)} aria-hidden>
              <BotIcon />
            </div>
            <div className="ec-bot-card__body">
              <div className="ec-bot-card__namerow">
                <strong className="ec-bot-name">{bot.name}</strong>
                <button
                  type="button"
                  onClick={() =>
                    setRoleEditOpen((cur) => (cur === bot.id ? null : bot.id))
                  }
                  disabled={busy}
                  title="Изменить роль"
                  className="ec-bot-role-chip"
                  style={roleColorStyle(bot.role)}
                >
                  {BOT_ROLE_LABELS[bot.role]}
                </button>
                <span className="ec-bots-mono-chip">{bot.apiKeyPrefix}…</span>
              </div>
              {bot.description && (
                <p className="ec-bot-desc">{bot.description}</p>
              )}
              {bot.role !== "GENERIC" && (
                <p
                  className="ec-bot-note"
                  style={{ color: BOT_ROLE_COLORS[bot.role].fg }}
                  title="Eclipse Chat генерирует ответ от этого бота когда участник упоминает соответствующий @keyword"
                >
                  Отвечает на{" "}
                  <code className="ec-bot-kw">@{primaryRoleKeyword(bot.role)}</code>
                  -mentions в комнатах
                </p>
              )}
              {bot.autoRespond && (
                <p className="ec-bot-note ec-bot-note--ai">
                  Автоответ в текстовых комнатах пространства на каждое сообщение
                  {bot.systemPromptOverride ? " · свой промпт" : ""}
                </p>
              )}
              <div className="ec-bot-meta">
                <span>создан {bot.owner.displayName}</span>
                <span>•</span>
                <span>использован: {formatRelative(bot.lastUsedAt)}</span>
                <span>•</span>
                <span>{bot.capabilities.join(", ") || "нет capabilities"}</span>
              </div>
              {roleEditOpen === bot.id && (
                <div className="ec-bots-panel">
                  <div className="ec-bots-label">Сменить роль</div>
                  <RolePicker
                    size="sm"
                    value={bot.role}
                    busy={busy}
                    onChange={(next) => void handleRoleChange(bot, next)}
                  />
                  <p className="ec-bots-field-hint">{BOT_ROLE_DESCRIPTIONS[bot.role]}</p>
                </div>
              )}
            </div>
            <div className="ec-bot-card__actions">
              <button
                type="button"
                onClick={() => void handleToggleAutoRespond(bot)}
                disabled={busy}
                className={`ec-btn ec-btn--ghost ec-btn--sm${bot.autoRespond ? " ec-bot-btn--ai" : ""}`}
                title={
                  bot.autoRespond
                    ? "Выключить автоответ"
                    : "Автоответ в текстовых комнатах пространства"
                }
              >
                {bot.autoRespond ? "Авто ✓" : "Авто"}
              </button>
              <button
                type="button"
                onClick={() => void updateBot(bot.id, { agentMode: !bot.agentMode })}
                disabled={busy}
                className={`ec-btn ec-btn--ghost ec-btn--sm${bot.agentMode ? " ec-bot-btn--ai" : ""}`}
                title={
                  bot.agentMode
                    ? "Agent mode: бот может вызывать tools (отправлять сообщения / создавать задачи / править таблицы)"
                    : "Включить agent mode — бот сможет действовать в сервере, не только отвечать"
                }
              >
                {bot.agentMode ? "Agent ✓" : "Agent"}
              </button>
              <button
                type="button"
                onClick={() => {
                  ensurePersonalityDraft(bot);
                  setPersonalityEditOpen((cur) => (cur === bot.id ? null : bot.id));
                }}
                disabled={busy}
                className={`ec-btn ec-btn--ghost ec-btn--sm${bot.personality ? " ec-bot-btn--accent" : ""}`}
                title="Характер бота: имя, манера, юмор"
              >
                Личность
              </button>
              <button
                type="button"
                onClick={() => {
                  ensurePromptDraft(bot);
                  setPromptEditOpen((cur) => (cur === bot.id ? null : bot.id));
                }}
                disabled={busy}
                className={`ec-btn ec-btn--ghost ec-btn--sm${bot.systemPromptOverride ? " ec-bot-btn--accent" : ""}`}
                title="Кастомный system prompt (advanced)"
              >
                Промпт
              </button>
              <button
                type="button"
                onClick={() => handleOpenTest(bot)}
                disabled={busy}
                className={`ec-btn ec-btn--ghost ec-btn--sm${testOpen === bot.id ? " ec-bot-btn--accent" : ""}`}
                title="Тест AI-промпта без отправки в канал"
              >
                Тест
              </button>
              <button
                type="button"
                onClick={() => void handleOpenUsage(bot)}
                disabled={busy}
                className={`ec-btn ec-btn--ghost ec-btn--sm${usageOpen === bot.id ? " ec-bot-btn--accent" : ""}`}
                title="Статистика использования"
              >
                Стата
              </button>
              <button
                type="button"
                onClick={() => {
                  ensureDraft(bot);
                  setWebhookOpen((cur) => (cur === bot.id ? null : bot.id));
                }}
                disabled={busy}
                className={`ec-btn ec-btn--ghost ec-btn--sm${bot.webhookUrl ? " ec-bot-btn--ok" : ""}`}
                title={bot.webhookUrl ? "Webhook настроен — редактировать" : "Подключить webhook"}
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
            <div key={`webhook-${bot.id}`} className="ec-bots-panel">
              <div className="ec-bots-panel__head">
                <strong className="ec-bots-panel__title">Webhook для «{bot.name}»</strong>
                <button
                  type="button"
                  onClick={() => setWebhookOpen(null)}
                  className="ec-btn ec-btn--ghost ec-btn--sm ec-bots-panel__close"
                  title="Закрыть"
                >
                  ✕
                </button>
              </div>
              <label className="ec-bots-labeled-field">
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
                  className="ec-bots-input"
                />
              </label>
              <label className="ec-bots-labeled-field">
                Secret (HMAC-SHA256 signing){" "}
                {bot.webhookSecretSet && (
                  <span className="ec-bots-ok-note">· уже задан</span>
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
                  className="ec-bots-input"
                />
              </label>
              <p className="ec-bots-field-hint">
                Каждое сообщение в комнатах пространства будет POST'нуто на URL.
                Headers: <code className="ec-bots-mono-chip">X-Eclipse-Event: message.created</code>,
                <code className="ec-bots-mono-chip">X-Eclipse-Bot-Id: {bot.id}</code>,
                и (если secret) <code className="ec-bots-mono-chip">X-Eclipse-Bot-Signature: sha256=&lt;hex&gt;</code>.
                <br />
                Timeout 5s, бот не получает свои собственные messages (anti-loop).
              </p>
              <div className="ec-bots-actions">
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

        {personalityEditOpen && (() => {
          const bot = bots.find((b) => b.id === personalityEditOpen);
          if (!bot) return null;
          const draft = personalityDrafts[bot.id] ?? bot.personality ?? "";
          return (
            <div key={`personality-${bot.id}`} className="ec-bots-panel">
              <div className="ec-bots-panel__head">
                <strong className="ec-bots-panel__title">Личность — «{bot.name}»</strong>
                <button
                  type="button"
                  onClick={() => setPersonalityEditOpen(null)}
                  className="ec-btn ec-btn--ghost ec-btn--sm ec-bots-panel__close"
                  title="Закрыть"
                >
                  ✕
                </button>
              </div>
              <p className="ec-bots-field-hint">
                Опиши характер и манеру общения бота — имя, юмор, любимые
                фразы, на что реагирует. Это «оверлей» поверх роли{" "}
                <span className="ec-bot-role-chip" style={roleColorStyle(bot.role)}>{BOT_ROLE_LABELS[bot.role]}</span>;
                бот будет отвечать в этом стиле, оставаясь в своей зоне
                ответственности. Имя бота для отображения меняй полем
                «Название» выше. До 1000 символов.
              </p>
              <textarea
                value={draft}
                onChange={(e) =>
                  setPersonalityDrafts((prev) => ({
                    ...prev,
                    [bot.id]: e.target.value,
                  }))
                }
                rows={6}
                maxLength={1000}
                className="ec-bots-input"
                placeholder={`Пример:\n\nТебя зовут Алёша. Ты дружелюбный senior dev, любишь шутить про code smells и legacy. Говоришь по-русски, иногда вставляешь «короче», «по-братски», «жесть». Не любишь когда деплоят в пятницу. Эмодзи используй сдержанно: 🔥 / 👀 / 😅.`}
              />
              <div className="ec-bots-panel__head">
                <span className="ec-bots-counter">{draft.length} / 1000</span>
                <div className="ec-bots-actions">
                  <button
                    type="button"
                    onClick={() => void handleClearPersonality(bot)}
                    disabled={busy || !bot.personality}
                    className="ec-btn ec-btn--ghost ec-btn--sm"
                    title="Убрать личность (вернуться к чистой роли)"
                  >
                    Очистить
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleSavePersonality(bot)}
                    disabled={busy}
                    className="ec-btn ec-btn--primary ec-btn--sm"
                  >
                    {busy ? "Сохраняем…" : "Сохранить"}
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

        {promptEditOpen && (() => {
          const bot = bots.find((b) => b.id === promptEditOpen);
          if (!bot) return null;
          const draft = promptDrafts[bot.id] ?? bot.systemPromptOverride ?? "";
          return (
            <div key={`prompt-${bot.id}`} className="ec-bots-panel">
              <div className="ec-bots-panel__head">
                <strong className="ec-bots-panel__title">System prompt — «{bot.name}»</strong>
                <button
                  type="button"
                  onClick={() => setPromptEditOpen(null)}
                  className="ec-btn ec-btn--ghost ec-btn--sm ec-bots-panel__close"
                  title="Закрыть"
                >
                  ✕
                </button>
              </div>
              <p className="ec-bots-field-hint">
                Пустое поле = шаблон роли{" "}
                <span className="ec-bot-role-chip" style={roleColorStyle(bot.role)}>{BOT_ROLE_LABELS[bot.role]}</span>.
                Если включён автоответ и несколько ботов с авто — отвечает самый старый.
              </p>
              <textarea
                value={draft}
                onChange={(e) =>
                  setPromptDrafts((prev) => ({ ...prev, [bot.id]: e.target.value }))
                }
                rows={8}
                maxLength={8000}
                placeholder={BOT_ROLE_DESCRIPTIONS[bot.role]}
                className="ec-bots-input ec-bots-input--code"
              />
              <div className="ec-bots-actions">
                <button
                  type="button"
                  onClick={() => void handleResetPrompt(bot)}
                  disabled={busy || !bot.systemPromptOverride}
                  className="ec-btn ec-btn--ghost ec-btn--sm"
                >
                  Сбросить к шаблону
                </button>
                <button
                  type="button"
                  onClick={() => void handleSavePrompt(bot)}
                  disabled={busy}
                  className="ec-btn ec-btn--primary ec-btn--sm"
                >
                  {busy ? "Сохраняем…" : "Сохранить"}
                </button>
              </div>
            </div>
          );
        })()}

        {/* v1.0 #11 AI controls: test-run panel — inline под bot card. */}
        {testOpen && (() => {
          const bot = bots.find((b) => b.id === testOpen);
          if (!bot) return null;
          const draft = testDrafts[bot.id] ?? "";
          const result = testResults[bot.id] ?? null;
          const running = perBotBusy[bot.id] === true;
          return (
            <div key={`test-${bot.id}`} className="ec-bots-panel">
              <div className="ec-bots-panel__head">
                <strong className="ec-bots-panel__title">Тест AI · «{bot.name}»</strong>
                <button
                  type="button"
                  onClick={() => setTestOpen(null)}
                  className="ec-btn ec-btn--ghost ec-btn--sm ec-bots-panel__close"
                  title="Закрыть"
                >
                  ✕
                </button>
              </div>
              <p className="ec-bots-field-hint">
                Прогон system prompt с твоим input'ом — НЕ отправляется в канал.
                Преглу для проверки prompt-override'а перед production-использованием.
              </p>
              <textarea
                value={draft}
                onChange={(e) =>
                  setTestDrafts((prev) => ({ ...prev, [bot.id]: e.target.value }))
                }
                rows={3}
                maxLength={2000}
                placeholder="Что спросить у бота — будет передано как user message"
                className="ec-bots-input ec-bots-input--area"
                disabled={running}
              />
              <div className="ec-bots-actions">
                <button
                  type="button"
                  onClick={() => void handleRunTest(bot)}
                  disabled={running || !draft.trim()}
                  className="ec-btn ec-btn--primary ec-btn--sm"
                >
                  {running ? "Запрашиваю…" : "Запустить тест"}
                </button>
              </div>
              {result && (
                <div className="ec-bots-result">
                  {result.ok ? (
                    <>
                      <div className="ec-bots-result__meta">
                        <span className="ec-bots-mono-chip">provider: {result.provider}</span>
                        {result.model && <span className="ec-bots-mono-chip">model: {result.model}</span>}
                        <span className="ec-bots-mono-chip">{result.latencyMs} ms</span>
                        <span className="ec-bots-mono-chip">
                          prompt: {result.systemPromptLength} chars
                          {result.isOverride ? " (override)" : " (template)"}
                        </span>
                      </div>
                      <div className="ec-bots-result__body">{result.response}</div>
                    </>
                  ) : (
                    <div className="ec-bots-result__error">⚠ {result.error}</div>
                  )}
                </div>
              )}
            </div>
          );
        })()}

        {/* v1.0 #11 AI controls: usage stats panel. */}
        {usageOpen && (() => {
          const bot = bots.find((b) => b.id === usageOpen);
          if (!bot) return null;
          const usage = usageCache[bot.id];
          const loading = perBotBusy[bot.id] === true && !usage;
          return (
            <div key={`usage-${bot.id}`} className="ec-bots-panel">
              <div className="ec-bots-panel__head">
                <strong className="ec-bots-panel__title">Статистика · «{bot.name}»</strong>
                <button
                  type="button"
                  onClick={() => setUsageOpen(null)}
                  className="ec-btn ec-btn--ghost ec-btn--sm ec-bots-panel__close"
                  title="Закрыть"
                >
                  ✕
                </button>
              </div>
              {loading && (
                <p className="ec-bots-field-hint">Загружаем статистику…</p>
              )}
              {!loading && usage && (
                <>
                  <div className="ec-bots-stat-grid">
                    <div className="ec-bots-stat">
                      <div className="ec-bots-caps-label">24 часа</div>
                      <div className="ec-bots-stat__value">{usage.messages24h}</div>
                    </div>
                    <div className="ec-bots-stat">
                      <div className="ec-bots-caps-label">7 дней</div>
                      <div className="ec-bots-stat__value">{usage.messages7d}</div>
                    </div>
                    <div className="ec-bots-stat">
                      <div className="ec-bots-caps-label">Всего</div>
                      <div className="ec-bots-stat__value">{usage.totalMessages}</div>
                    </div>
                  </div>
                  {usage.topChannels.length > 0 ? (
                    <div>
                      <div className="ec-bots-chan-head">Топ комнат</div>
                      <div className="ec-bots-chan-list">
                        {usage.topChannels.map((ch) => (
                          <div key={ch.id} className="ec-bots-chan-row">
                            <span className="ec-bots-chan-name">
                              {ch.type === "VOICE" ? "🔊 " : ch.type === "BROADCAST" ? "📣 " : ch.type === "EXECUTION" ? "▢ " : "# "}
                              {ch.name}
                            </span>
                            <span className="ec-bots-mono-chip">{ch.count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="ec-bots-field-hint">Бот ещё ничего не написал.</p>
                  )}
                  <p className="ec-bots-field-hint">
                    Последнее использование API:{" "}
                    <strong className="ec-bots-value">
                      {formatRelative(usage.lastUsedAt)}
                    </strong>
                  </p>
                </>
              )}
              {!loading && !usage && (
                <p className="ec-bots-field-hint">Не удалось загрузить статистику.</p>
              )}
            </div>
          );
        })()}

        {bots.length >= 20 && (
          <p className="ec-bots-field-hint ec-bots-field-hint--center">
            Достигнут лимит 20 ботов на пространство. Удали неиспользуемого, чтобы создать нового.
          </p>
        )}
      </div>
    </section>
  );
}
