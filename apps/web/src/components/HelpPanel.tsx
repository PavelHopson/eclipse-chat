import type { CSSProperties } from "react";
import { useEffect, useState } from "react";

type Tab = "tour" | "bots" | "shortcuts";

type Props = {
  onClose: () => void;
};

const wrap: CSSProperties = {
  flex: 1,
  minHeight: 0,
  overflow: "auto",
  padding: "var(--ec-space-6) var(--ec-space-6) var(--ec-space-8)",
  display: "flex",
  flexDirection: "column",
  gap: "var(--ec-space-5)",
  maxWidth: 980,
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

const section: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "var(--ec-space-3)",
};

const sectionHeading: CSSProperties = {
  margin: 0,
  fontSize: "var(--ec-text-md)",
  fontWeight: 700,
  color: "var(--ec-text-strong)",
  letterSpacing: "var(--ec-tracking-tight)",
};

const cardGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: "var(--ec-space-3)",
};

const card: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
  padding: "var(--ec-space-4)",
  borderRadius: "var(--ec-radius-lg)",
  background: "hsl(208 16% 10% / 0.55)",
  border: "1px solid var(--ec-border-subtle)",
  boxShadow: "0 8px 24px -16px hsl(210 40% 2% / 0.7)",
};

const cardTitle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  fontSize: "var(--ec-text-sm)",
  fontWeight: 700,
  color: "var(--ec-text-strong)",
};

const cardBody: CSSProperties = {
  fontSize: "var(--ec-text-2xs)",
  color: "var(--ec-text-muted)",
  lineHeight: 1.55,
};

const cardHint: CSSProperties = {
  marginTop: 4,
  fontSize: "var(--ec-text-2xs)",
  color: "var(--ec-text-dim)",
  letterSpacing: "var(--ec-tracking-caps)",
  textTransform: "uppercase",
  fontWeight: 700,
};

const kbd: CSSProperties = {
  display: "inline-block",
  padding: "1px 6px",
  borderRadius: 4,
  background: "var(--ec-surface-2)",
  border: "1px solid var(--ec-border-default)",
  fontFamily:
    "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace",
  fontSize: "0.75em",
  color: "var(--ec-text)",
  lineHeight: 1,
};

const code: CSSProperties = {
  display: "inline-block",
  padding: "1px 6px",
  borderRadius: 4,
  background: "var(--ec-accent-soft)",
  color: "var(--ec-accent)",
  fontFamily:
    "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace",
  fontSize: "0.85em",
};

const calloutBox: CSSProperties = {
  padding: "var(--ec-space-4)",
  borderRadius: "var(--ec-radius-lg)",
  background: "var(--ec-accent-soft)",
  border: "1px solid var(--ec-border-accent)",
  color: "var(--ec-text)",
  fontSize: "var(--ec-text-sm)",
  lineHeight: 1.6,
};

const stepList: CSSProperties = {
  margin: 0,
  paddingLeft: "1.25rem",
  display: "flex",
  flexDirection: "column",
  gap: 6,
  fontSize: "var(--ec-text-sm)",
  color: "var(--ec-text-muted)",
  lineHeight: 1.55,
};

const tourCards: Array<{ title: string; body: string; hint?: string }> = [
  {
    title: "Пространства и комнаты",
    body: "Сервер = пространство, channel = комната. Левый rail — список пространств; следующая колонка — комнаты внутри активного пространства. Типы: TEXT (#), VOICE (наушники), BROADCAST (anonim trumpet, постят только OWNER/ADMIN/MODERATOR).",
    hint: "Создать: «+» в Forge Layer / channel list",
  },
  {
    title: "Сообщения и threads",
    body: "Markdown / inline code / mentions @user / replies / реакции / pin / 200MB видео и 50MB остальное. Открыть thread — кнопка «в ветке» под root-сообщением. Saved Messages «Избранное» — личный чат с самим собой.",
    hint: "Composer: Enter — отправить, Shift+Enter — перенос",
  },
  {
    title: "DMs + Group DMs",
    body: "Кнопка «📩» в Forge Layer открывает список 1-to-1 и group DM. Создать группу — «+» в шапке списка, до 24 участников + опциональное имя.",
    hint: "DM с собой = Saved Messages",
  },
  {
    title: "Voice rooms",
    body: "VOICE-канал = LiveKit room. Звонок: входишь в канал → дальше камера, screen share, multi-cam grid auto-fit. До 6 одновременных video tiles в main stage (overflow → presence chips). Шумодав, режимы голоса, diagnostics.",
    hint: "Музыка в VOICE — кнопка «▶ Музыка» в шапке",
  },
  {
    title: "Status Board (kanban)",
    body: "Server-wide доска ActionItem'ов — 4 колонки OPEN / IN_PROGRESS / REVIEW / DONE с drag-and-drop status transitions. Открывается из Forge Layer или из stat-card Team Health (с pre-filter overdue / unassigned / by assignee).",
    hint: "Карточка → drawer с priority, due, comments, approval",
  },
  {
    title: "Team Health",
    body: "Server-wide aggregate: overdue / unassigned / open totals, среднее время закрытия, top-3 overloaded, blocked members, week-over-week trends, per-channel breakdown, median first-response time.",
    hint: "Скрыто в Client Mode",
  },
  {
    title: "Информация о комнате",
    body: "Кнопка (i) в шапке чата открывает панель комнаты с 4 табами: Сводка / Память / Дела / Файлы. Сводка — автоматический дайджест канала. Память — закреплённые сообщения комнаты. Дела / Файлы — задачи и вложения в scope канала (Дела и Файлы скрыты в Client Mode).",
    hint: "Кнопка (i) в шапке чата",
  },
  {
    title: "Участники",
    body: "Правый rail — список участников пространства: роли, presence (онлайн / офлайн / в голосе), voice-state. Сворачивается кнопкой вверху rail; на мобильном выезжает как drawer.",
    hint: "Свернуть / раскрыть — кнопка вверху rail",
  },
  {
    title: "Operational Tables",
    body: "Встроенные таблицы внутри пространства — 6 field types (TEXT/NUMBER/STATUS/DATE/USER/CHECKBOX), drag-reorder колонок и строк, 2 готовых template (Задачи / CRM лиды), realtime collab.",
    hint: "Создать: ChannelList → «+» рядом с «Таблицы»",
  },
  {
    title: "Music sessions",
    body: "Synchronous listening room: один member жмёт «Слушать вместе» на audio attachment (или «Музыка» в шапке VOICE-канала) → все в комнате слышат тот же track с одной timeline-позиции. Mini-player в chat header.",
    hint: "Late-join correction встроена",
  },
  {
    title: "Operator slash-commands",
    body: "/task — превратить сообщение в задачу, /decision — в decision, /followup — follow-up. Открывает inline-prompt с title/assignee/due. Скрыто в Client Mode (calm portal).",
    hint: "Печатается в composer",
  },
  {
    title: "Поиск",
    body: "Unified operational search: messages + action items + files. Tabs с counter-badge, авто-переключение на первую non-empty категорию. ILIKE-based в v1 (без FTS).",
    hint: "Ctrl/Cmd+K — открыть",
  },
  {
    title: "Approvals на задачах",
    body: "Любой member может запросить approval у выбранного approver'а. Lifecycle NONE → PENDING → APPROVED/REJECTED. Approver видит chip в drawer и в Home «На моём одобрении».",
    hint: "В ActionItem drawer → секция «Одобрение»",
  },
  {
    title: "Home «СЕГОДНЯ»",
    body: "Cross-workspace дашборд: задачи на сегодня, просроченное, инциденты, активные voice-сессии, approvals waiting, top-5 активных комнат за last 1h.",
    hint: "Кнопка «Eclipse Chat» в top-left",
  },
  {
    title: "Incident Mode",
    body: "Кнопка ⚠ в top-bar открывает list инцидентов сервера. «Открыть инцидент» создаёт dedicated 🚨-канал, timeline, при resolve — AI post-mortem через Ollama.",
    hint: "Badge показывает open count",
  },
  {
    title: "Client Mode",
    body: "Server.mode=CLIENT прячет operator-chrome (Status Board, Дела/Файлы tabs, slash hints, BOT badges) — calm portal для клиента. Channel.internal hide отдельных каналов от MEMBER'ов клиента.",
    hint: "OWNER переключает в Server Settings",
  },
  {
    title: "Voice transcription",
    body: "Audio-attachments + voice messages автоматически транскрибируются через OpenAI Whisper (fire-and-forget). Под audio-player появляется transcript блок: shimmer при PENDING, expandable при READY.",
    hint: "Требует OPENAI_API_KEY на сервере",
  },
  {
    title: "Link embeds",
    body: "URL в сообщении автоматически разворачивается в OG preview card (title + description + thumbnail + host). Server-side fetch с SSRF guard (private-IP block, scheme whitelist, redirect chain).",
    hint: "Cache 7d / 24h FAILED",
  },
];

const shortcutsList: Array<{ k: string; what: string }> = [
  { k: "Ctrl / ⌘ + K", what: "Открыть поиск (messages + actions + files)" },
  { k: "Enter", what: "Отправить сообщение" },
  { k: "Shift + Enter", what: "Перенос строки в composer" },
  { k: "Esc", what: "Закрыть модалку / drawer / thread panel" },
  { k: "@", what: "Mention member или AI-роль (@pm / @moderator / @knowledge / @sales)" },
  { k: ":", what: "Autocomplete emoji" },
  { k: "/", what: "Slash-команды: /task /decision /followup" },
];

const aiRoles: Array<{ key: string; label: string; hint: string }> = [
  {
    key: "GENERIC",
    label: "GENERIC",
    hint: "Без специализации. Telegram-bridge, мониторинг, простой responder. Default.",
  },
  {
    key: "MODERATOR",
    label: "MODERATOR",
    hint: "Channel watchdog: этикет, warnings, suggestions для MOD'ов. Mention: @moderator / @мод.",
  },
  {
    key: "PM",
    label: "PM",
    hint: "Project management: задачи, decisions, follow-up reminders. Mention: @pm / @менеджер.",
  },
  {
    key: "KNOWLEDGE",
    label: "KNOWLEDGE",
    hint: "Q&A над pinned + history. Mention: @knowledge / @знания / @кб.",
  },
  {
    key: "SALES",
    label: "SALES",
    hint: "Outreach / клиентские диалоги. Mention: @sales / @продажи.",
  },
];

const apiBlock: CSSProperties = {
  fontFamily:
    "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace",
  fontSize: "var(--ec-text-2xs)",
  padding: "var(--ec-space-3)",
  borderRadius: "var(--ec-radius-md)",
  background: "hsl(208 16% 6% / 0.7)",
  border: "1px solid var(--ec-border-subtle)",
  color: "var(--ec-text)",
  overflowX: "auto",
  lineHeight: 1.5,
  whiteSpace: "pre",
};

export function HelpPanel({ onClose }: Props) {
  const [tab, setTab] = useState<Tab>("tour");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div style={wrap}>
      <div style={headerRow}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={eyebrow}>Eclipse Chat · справка</span>
          <h1 style={titleStyle}>Как пользоваться платформой</h1>
          <p
            style={{
              margin: 0,
              fontSize: "var(--ec-text-sm)",
              color: "var(--ec-text-muted)",
              maxWidth: 640,
              lineHeight: 1.6,
            }}
          >
            Operational communication infrastructure — communication, execution,
            memory и AI как одна система. Здесь — короткий тур по слоям и гайд
            по настройке ботов.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="ec-btn ec-btn--ghost ec-btn--sm"
          aria-label="Закрыть справку"
        >
          Закрыть
        </button>
      </div>

      <div style={tabBar} role="tablist" aria-label="Разделы справки">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "tour"}
          onClick={() => setTab("tour")}
          style={tabBtn(tab === "tour")}
        >
          Полный функционал
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "bots"}
          onClick={() => setTab("bots")}
          style={tabBtn(tab === "bots")}
        >
          Настройка ботов
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "shortcuts"}
          onClick={() => setTab("shortcuts")}
          style={tabBtn(tab === "shortcuts")}
        >
          Горячие клавиши
        </button>
      </div>

      {tab === "tour" && (
        <div style={section}>
          <h2 style={sectionHeading}>Слои платформы</h2>
          <div style={cardGrid}>
            {tourCards.map((c) => (
              <div key={c.title} style={card}>
                <div style={cardTitle}>{c.title}</div>
                <div style={cardBody}>{c.body}</div>
                {c.hint && <div style={cardHint}>{c.hint}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "bots" && (
        <div style={section}>
          <h2 style={sectionHeading}>Что такое бот в Eclipse Chat</h2>
          <p
            style={{
              margin: 0,
              fontSize: "var(--ec-text-sm)",
              color: "var(--ec-text-muted)",
              lineHeight: 1.6,
            }}
          >
            Бот — сервисный участник пространства: Telegram-мост, мониторинг,
            AI-агент, webhook-приёмник. Имеет shadow-user (отображается в
            ленте с avatar и role-badge), уникальный API-ключ{" "}
            <span style={code}>ecb_*</span> и пишет в TEXT-каналы через REST.
          </p>

          <h2 style={{ ...sectionHeading, marginTop: "var(--ec-space-4)" }}>
            Создание
          </h2>
          <ol style={stepList}>
            <li>
              Открой пространство → <strong>Server Info</strong> (заголовок в
              ChannelList) → <strong>⚙ Настройки</strong> → таб{" "}
              <strong>Боты</strong>. Доступно только OWNER'у.
            </li>
            <li>
              Жми <strong>+ Создать бота</strong>. В форме укажи имя и роль
              (см. ниже). Backend сразу показывает{" "}
              <strong>plaintext API key</strong> — это единственный момент,
              после закрытия модалки восстановить ключ нельзя, только
              regenerate (старый сразу инвалидируется).
            </li>
            <li>
              Опционально включи <em>autoRespond</em> на @-mention бота и/или
              задай <em>systemPromptOverride</em> (custom prompt для
              AI-ответов). Webhook URL — для outbound событий (HMAC-подпись в
              header).
            </li>
          </ol>

          <h2 style={{ ...sectionHeading, marginTop: "var(--ec-space-4)" }}>
            Роли бота
          </h2>
          <div style={cardGrid}>
            {aiRoles.map((r) => (
              <div key={r.key} style={card}>
                <div style={cardTitle}>{r.label}</div>
                <div style={cardBody}>{r.hint}</div>
              </div>
            ))}
          </div>

          <h2 style={{ ...sectionHeading, marginTop: "var(--ec-space-4)" }}>
            Аутентификация
          </h2>
          <p
            style={{
              margin: 0,
              fontSize: "var(--ec-text-sm)",
              color: "var(--ec-text-muted)",
              lineHeight: 1.6,
            }}
          >
            Все bot-endpoint'ы требуют header{" "}
            <span style={code}>Authorization: Bot ecb_...</span>. Изолировано
            от JWT-сессии: нет login flow, refresh token или 2FA — только
            API-ключ.
          </p>

          <h2 style={{ ...sectionHeading, marginTop: "var(--ec-space-4)" }}>
            Базовые endpoints
          </h2>
          <pre style={apiBlock}>
{`GET  /api/bot/me                — whoami, capabilities, role
POST /api/bot/messages          — отправить сообщение в TEXT-канал
POST /api/bot/reactions         — поставить реакцию (idempotent)
POST /api/bot/actions           — превратить сообщение в task/decision/followup`}
          </pre>

          <h2 style={{ ...sectionHeading, marginTop: "var(--ec-space-4)" }}>
            Outbound webhooks (опционально)
          </h2>
          <p
            style={{
              margin: 0,
              fontSize: "var(--ec-text-sm)",
              color: "var(--ec-text-muted)",
              lineHeight: 1.6,
            }}
          >
            Если у бота задан Webhook URL, Eclipse Chat шлёт POST на каждое
            событие, относящееся к нему (mentions, новое сообщение в подписке
            каналов). В header — HMAC-SHA256 signature{" "}
            <span style={code}>X-Eclipse-Signature</span>, ключ —{" "}
            <span style={code}>webhookSecret</span> бота. Сверь signature
            прежде чем обрабатывать payload.
          </p>

          <div style={calloutBox}>
            Полная документация — <span style={code}>docs/BOT-API.md</span> в
            репозитории. Там же — примеры curl/JS/Python, retry-логика,
            rate-limit, и SDK quickstart.
          </div>
        </div>
      )}

      {tab === "shortcuts" && (
        <div style={section}>
          <h2 style={sectionHeading}>Горячие клавиши</h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "auto 1fr",
              gap: "var(--ec-space-2) var(--ec-space-5)",
              alignItems: "baseline",
              maxWidth: 720,
            }}
          >
            {shortcutsList.map((s) => (
              <div key={s.k} style={{ display: "contents" }}>
                <div
                  style={{
                    textAlign: "right",
                    whiteSpace: "nowrap",
                  }}
                >
                  <span style={kbd}>{s.k}</span>
                </div>
                <div
                  style={{
                    fontSize: "var(--ec-text-sm)",
                    color: "var(--ec-text-muted)",
                    lineHeight: 1.5,
                  }}
                >
                  {s.what}
                </div>
              </div>
            ))}
          </div>

          <h2 style={{ ...sectionHeading, marginTop: "var(--ec-space-4)" }}>
            Mentions и роли
          </h2>
          <p
            style={{
              margin: 0,
              fontSize: "var(--ec-text-sm)",
              color: "var(--ec-text-muted)",
              lineHeight: 1.6,
            }}
          >
            Печатай <span style={code}>@</span> — открывается autocomplete с
            members + 5 AI-mentions (<span style={code}>@ai</span>,{" "}
            <span style={code}>@moderator</span>,{" "}
            <span style={code}>@pm</span>,{" "}
            <span style={code}>@knowledge</span>,{" "}
            <span style={code}>@sales</span>). RU-варианты тоже работают
            (<span style={code}>@мод</span>,{" "}
            <span style={code}>@менеджер</span>,{" "}
            <span style={code}>@кб</span>,{" "}
            <span style={code}>@продажи</span>).
          </p>
        </div>
      )}
    </div>
  );
}
