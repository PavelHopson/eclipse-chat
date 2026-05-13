import type { CSSProperties } from "react";
import { useState } from "react";
import { useBots, type BotKeyReveal, type BotRow } from "../hooks/useBots";

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

const botAvatar: CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: "var(--ec-radius-md)",
  background: "hsl(252 70% 70% / 0.18)",
  color: "hsl(252 80% 78%)",
  display: "grid",
  placeItems: "center",
  fontSize: "0.95rem",
  border: "1px solid hsl(252 70% 60% / 0.35)",
};

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

function CreateBotForm({
  onSubmit,
  busy,
  onCancel,
}: {
  onSubmit: (input: { name: string; description?: string | null }) => Promise<void>;
  busy: boolean;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || busy) return;
    await onSubmit({ name, description: description || null });
    setName("");
    setDescription("");
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
    regenerateKey,
    deleteBot,
    dismissRevealedKey,
  } = useBots(serverId);
  const [showCreate, setShowCreate] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleCreate = async (input: { name: string; description?: string | null }) => {
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
            <div style={botAvatar} aria-hidden>
              <BotIcon />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: "var(--ec-space-2)", flexWrap: "wrap" }}>
                <strong style={{ color: "var(--ec-text-strong)", fontSize: "var(--ec-text-base)" }}>
                  {bot.name}
                </strong>
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
            </div>
            <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
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

        {bots.length >= 20 && (
          <p style={{ ...fieldHint, textAlign: "center" }}>
            Достигнут лимит 20 ботов на сервер. Удали неиспользуемого, чтобы создать нового.
          </p>
        )}
      </div>
    </section>
  );
}
