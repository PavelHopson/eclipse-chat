import type { CSSProperties } from "react";
import { useState } from "react";
import { apiJson } from "../lib/api";
import type { ChannelRow } from "../hooks/useChannels";

/**
 * v0.89 #26 phase 2 — Integrations tab внутри AdminPanel.
 *
 * Supports two types phase 2a:
 *   - TELEGRAM_OUTGOING: Eclipse → TG (требует bot token + chat id)
 *   - GITHUB_WEBHOOK:    GH → Eclipse (server generates path + secret;
 *                        UI показывает one-time на create)
 *
 * Edit post-create поддерживает только enabled/name/channelId/refresh-token.
 * Phase 2b — incoming Telegram, Notion sync.
 */

export type AdminIntegration = {
  id: string;
  serverId: string;
  type: "TELEGRAM_OUTGOING" | "GITHUB_WEBHOOK";
  name: string;
  channelId: string | null;
  webhookPath: string | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  lastEventAt: string | null;
  eventCount: number;
};

type Props = {
  serverId: string;
  channels: ChannelRow[];
  integrations: AdminIntegration[] | null;
  loading: boolean;
  error: string | null;
  showCreate: boolean;
  onShowCreate: () => void;
  onHideCreate: () => void;
  onChange: (next: AdminIntegration[] | null) => void;
  onError: (msg: string | null) => void;
};

const muted: CSSProperties = {
  fontSize: "var(--ec-text-2xs)",
  color: "var(--ec-text-muted)",
};

const row: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(160px, 1.4fr) 1fr auto auto",
  alignItems: "center",
  gap: 12,
  padding: "var(--ec-space-3)",
  borderRadius: "var(--ec-radius-md)",
  background: "hsl(208 16% 10% / 0.4)",
  border: "1px solid var(--ec-border-subtle)",
};

const labelStyle: CSSProperties = {
  fontSize: "var(--ec-text-2xs)",
  fontWeight: 700,
  letterSpacing: "var(--ec-tracking-caps)",
  textTransform: "uppercase",
  color: "var(--ec-text-dim)",
  marginBottom: 4,
};

const TYPE_LABEL: Record<AdminIntegration["type"], string> = {
  TELEGRAM_OUTGOING: "Telegram →",
  GITHUB_WEBHOOK: "GitHub ←",
};

const TYPE_HINT: Record<AdminIntegration["type"], string> = {
  TELEGRAM_OUTGOING: "Сообщения из канала пересылаются в Telegram-чат",
  GITHUB_WEBHOOK: "События GitHub публикуются в канал",
};

export function IntegrationsTabContent({
  serverId,
  channels,
  integrations,
  loading,
  error,
  showCreate,
  onShowCreate,
  onHideCreate,
  onChange,
  onError,
}: Props) {
  const [showGithubSetup, setShowGithubSetup] = useState<{
    name: string;
    webhookPath: string;
    webhookSecret: string;
    setupHint: string;
  } | null>(null);

  const toggle = async (integration: AdminIntegration) => {
    onError(null);
    try {
      const res = await apiJson<{ integration: AdminIntegration }>(
        `/api/integrations/${encodeURIComponent(integration.id)}`,
        {
          method: "PATCH",
          body: JSON.stringify({ enabled: !integration.enabled }),
        },
      );
      onChange(
        (integrations ?? []).map((i) =>
          i.id === res.integration.id ? res.integration : i,
        ),
      );
    } catch (e) {
      onError(e instanceof Error ? e.message : "Не удалось переключить");
    }
  };

  const remove = async (integration: AdminIntegration) => {
    if (!window.confirm(`Удалить интеграцию «${integration.name}»?`)) return;
    onError(null);
    try {
      await apiJson(`/api/integrations/${encodeURIComponent(integration.id)}`, {
        method: "DELETE",
      });
      onChange((integrations ?? []).filter((i) => i.id !== integration.id));
    } catch (e) {
      onError(e instanceof Error ? e.message : "Не удалось удалить");
    }
  };

  const handleCreate = async (input: CreateIntegrationInput) => {
    onError(null);
    try {
      const res = await apiJson<{
        integration: AdminIntegration;
        github?: { webhookPath: string; webhookSecret: string; setupHint: string };
      }>(`/api/servers/${encodeURIComponent(serverId)}/integrations`, {
        method: "POST",
        body: JSON.stringify(input),
      });
      onChange([res.integration, ...(integrations ?? [])]);
      onHideCreate();
      if (res.github) {
        setShowGithubSetup({
          name: res.integration.name,
          webhookPath: res.github.webhookPath,
          webhookSecret: res.github.webhookSecret,
          setupHint: res.github.setupHint,
        });
      }
    } catch (e) {
      onError(e instanceof Error ? e.message : "Не удалось создать");
    }
  };

  if (loading) return <p style={muted}>Загружаем интеграции…</p>;
  if (error) return <p style={{ color: "var(--ec-danger)" }}>{error}</p>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--ec-space-3)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <p style={muted}>
          Внешние интеграции: Telegram (Eclipse → TG) и GitHub (GH → Eclipse через webhook).
          Сообщения шифруются конфигом сервера; HMAC проверяется на каждый GH-event.
        </p>
        {!showCreate && (
          <button
            type="button"
            onClick={onShowCreate}
            className="ec-btn ec-btn--primary ec-btn--sm"
          >
            Добавить
          </button>
        )}
      </div>

      {showCreate && (
        <CreateIntegrationForm
          channels={channels}
          onCancel={onHideCreate}
          onCreate={(input) => void handleCreate(input)}
        />
      )}

      {showGithubSetup && (
        <div
          style={{
            padding: "var(--ec-space-4)",
            background: "hsl(195 50% 12% / 0.65)",
            border: "1px solid hsl(195 60% 35% / 0.3)",
            borderRadius: "var(--ec-radius-lg)",
            display: "flex",
            flexDirection: "column",
            gap: "var(--ec-space-2)",
          }}
        >
          <strong style={{ color: "var(--ec-text-strong)" }}>
            Настройка GitHub webhook для «{showGithubSetup.name}»
          </strong>
          <p style={{ ...muted, lineHeight: 1.5 }}>{showGithubSetup.setupHint}</p>
          <div style={{ display: "flex", gap: 6 }}>
            <button
              type="button"
              onClick={() =>
                navigator.clipboard.writeText(showGithubSetup.webhookSecret).catch(() => undefined)
              }
              className="ec-btn ec-btn--ghost ec-btn--sm"
            >
              Скопировать secret
            </button>
            <button
              type="button"
              onClick={() => setShowGithubSetup(null)}
              className="ec-btn ec-btn--primary ec-btn--sm"
            >
              Готово
            </button>
          </div>
          <p style={{ ...muted, color: "var(--ec-warn)" }}>
            ⚠ Этот secret видно только сейчас. После закрытия его можно посмотреть только
            повторной генерацией (требует delete + recreate).
          </p>
        </div>
      )}

      {(integrations?.length ?? 0) === 0 && !showCreate && (
        <p style={muted}>Интеграций нет. Добавь Telegram-чат или GitHub-репозиторий.</p>
      )}

      {(integrations ?? []).map((int) => {
        const ch = channels.find((c) => c.id === int.channelId);
        return (
          <div key={int.id} style={row}>
            <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
              <span
                style={{
                  fontSize: "var(--ec-text-sm)",
                  fontWeight: 700,
                  color: "var(--ec-text-strong)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {TYPE_LABEL[int.type]} · {int.name}
              </span>
              <span style={muted}>
                {ch ? `#${ch.name}` : "канал удалён"} · {TYPE_HINT[int.type]}
              </span>
              {int.eventCount > 0 && (
                <span style={muted}>
                  Сработало {int.eventCount} раз
                  {int.lastEventAt
                    ? ` · последний — ${new Date(int.lastEventAt).toLocaleString("ru-RU")}`
                    : ""}
                </span>
              )}
              {int.type === "GITHUB_WEBHOOK" && int.webhookPath && (
                <code
                  style={{
                    fontSize: "0.7rem",
                    color: "var(--ec-text-dim)",
                    background: "hsl(208 16% 8% / 0.6)",
                    padding: "0.15rem 0.4rem",
                    borderRadius: "var(--ec-radius-xs)",
                    fontFamily: "var(--ec-font-mono)",
                    wordBreak: "break-all",
                  }}
                >
                  /api/integrations/gh/{int.webhookPath}
                </code>
              )}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span
                style={{
                  display: "inline-flex",
                  padding: "0.18rem 0.55rem",
                  borderRadius: "var(--ec-radius-full)",
                  background: int.enabled
                    ? "hsl(150 50% 18% / 0.5)"
                    : "hsl(0 30% 20% / 0.4)",
                  color: int.enabled ? "hsl(150 60% 70%)" : "hsl(0 50% 70%)",
                  fontSize: "var(--ec-text-2xs)",
                  fontWeight: 700,
                  letterSpacing: "var(--ec-tracking-wide)",
                  alignSelf: "flex-start",
                }}
              >
                {int.enabled ? "ON" : "OFF"}
              </span>
              <span style={muted}>создан {new Date(int.createdAt).toLocaleDateString("ru-RU")}</span>
            </div>
            <button
              type="button"
              onClick={() => void toggle(int)}
              className="ec-btn ec-btn--ghost ec-btn--sm"
            >
              {int.enabled ? "Отключить" : "Включить"}
            </button>
            <button
              type="button"
              onClick={() => void remove(int)}
              className="ec-btn ec-btn--ghost ec-btn--sm ec-btn--danger"
              aria-label={`Удалить ${int.name}`}
              title="Удалить"
            >
              ✕
            </button>
          </div>
        );
      })}
    </div>
  );
}

type CreateIntegrationInput =
  | {
      type: "TELEGRAM_OUTGOING";
      name: string;
      channelId: string;
      botToken: string;
      chatId: string;
    }
  | {
      type: "GITHUB_WEBHOOK";
      name: string;
      channelId: string;
    };

function CreateIntegrationForm({
  channels,
  onCancel,
  onCreate,
}: {
  channels: ChannelRow[];
  onCancel: () => void;
  onCreate: (input: CreateIntegrationInput) => void;
}) {
  const [type, setType] = useState<"TELEGRAM_OUTGOING" | "GITHUB_WEBHOOK">(
    "TELEGRAM_OUTGOING",
  );
  const [name, setName] = useState("");
  const [channelId, setChannelId] = useState<string>(
    channels.find((c) => c.type !== "VOICE")?.id ?? "",
  );
  const [botToken, setBotToken] = useState("");
  const [chatId, setChatId] = useState("");

  const canSubmit =
    name.trim().length > 0 &&
    channelId.length > 0 &&
    (type === "GITHUB_WEBHOOK" || (botToken.trim().length > 0 && chatId.trim().length > 0));

  return (
    <div
      style={{
        ...row,
        gridTemplateColumns: "1fr",
        padding: "var(--ec-space-4)",
      }}
    >
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--ec-space-3)" }}>
        <div>
          <div style={labelStyle}>Тип</div>
          <select
            className="ec-field"
            value={type}
            onChange={(e) => setType(e.target.value as typeof type)}
          >
            <option value="TELEGRAM_OUTGOING">Telegram → (исходящий мост)</option>
            <option value="GITHUB_WEBHOOK">GitHub ← (входящий webhook)</option>
          </select>
        </div>
        <div>
          <div style={labelStyle}>Название</div>
          <input
            className="ec-field"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={type === "TELEGRAM_OUTGOING" ? "Команда → TG" : "github.com/myrepo"}
            maxLength={120}
          />
        </div>
      </div>
      <div>
        <div style={labelStyle}>Канал {type === "GITHUB_WEBHOOK" ? "(куда постить)" : "(источник)"}</div>
        <select
          className="ec-field"
          value={channelId}
          onChange={(e) => setChannelId(e.target.value)}
        >
          {channels
            .filter((c) => c.type !== "VOICE")
            .map((c) => (
              <option key={c.id} value={c.id}>
                #{c.name}
              </option>
            ))}
        </select>
      </div>
      {type === "TELEGRAM_OUTGOING" && (
        <>
          <div>
            <div style={labelStyle}>Bot token</div>
            <input
              className="ec-field"
              type="password"
              value={botToken}
              onChange={(e) => setBotToken(e.target.value)}
              placeholder="123456789:ABC-DEF..."
              autoComplete="off"
            />
            <p style={muted}>
              Создай бота через @BotFather, скопируй token. Затем добавь бота в нужный
              Telegram-чат как админа (или включи групповой режим).
            </p>
          </div>
          <div>
            <div style={labelStyle}>Chat ID</div>
            <input
              className="ec-field"
              type="text"
              value={chatId}
              onChange={(e) => setChatId(e.target.value)}
              placeholder="-1001234567890 (или @channel_name)"
            />
            <p style={muted}>
              Для группы — отрицательное число (-100…). Узнать ID можно через @userinfobot.
            </p>
          </div>
        </>
      )}
      {type === "GITHUB_WEBHOOK" && (
        <p style={muted}>
          После создания мы сгенерируем URL и secret. Скопируешь их в GitHub → Settings →
          Webhooks → Add webhook. События: push, pull_request, issues, release.
        </p>
      )}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
        <button type="button" onClick={onCancel} className="ec-btn ec-btn--ghost ec-btn--sm">
          Отмена
        </button>
        <button
          type="button"
          disabled={!canSubmit}
          onClick={() =>
            onCreate(
              type === "TELEGRAM_OUTGOING"
                ? {
                    type,
                    name: name.trim(),
                    channelId,
                    botToken: botToken.trim(),
                    chatId: chatId.trim(),
                  }
                : { type, name: name.trim(), channelId },
            )
          }
          className="ec-btn ec-btn--primary ec-btn--sm"
        >
          Создать
        </button>
      </div>
    </div>
  );
}
