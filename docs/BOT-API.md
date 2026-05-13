# Eclipse Chat — Bot API

Гайд для разработчиков ботов и операторских интеграций.

Bot — это сервисный участник сервера: Telegram-мост, мониторинг, AI-агент,
webhook-приёмник. Каждый бот привязан к одному серверу, получает уникальный
API-ключ и пишет в text-каналы через REST.

---

## Создание бота

UI: **Server Info → ⚙ Настройки → Боты → + Создать бота** (OWNER only).

При создании backend сразу показывает **plaintext API key**. Это единственный
момент — после закрытия модалки восстановить ключ нельзя, только regenerate
(старый ключ при этом сразу инвалидируется).

Формат ключа: `ecb_<32-char-base64-urlsafe>` — 36 символов всего.

---

## Аутентификация

Все bot-endpoint'ы требуют header:

```
Authorization: Bot ecb_AbCd1234...
```

Backend проверяет:
1. `apiKeyPrefix` (первые 12 символов) — quick lookup по unique index.
2. `bcrypt.compare(apiKey, apiKeyHash)` — full verify.

Bot аутентификация **изолирована от JWT-сессии**: bot не имеет login flow,
refresh token, 2FA. Только API-ключ.

---

## Endpoints

База: `https://app.star-crm.ru/eclipse-chat/api`

### `GET /api/bot/me`

Возвращает intro/whoami бота. Используется SDK для health-check.

```bash
curl https://app.star-crm.ru/eclipse-chat/api/bot/me \
  -H "Authorization: Bot ecb_..."
```

Ответ:

```json
{
  "bot": {
    "id": "bot_a1b2c3d4e5f6g7h8",
    "name": "Telegram Bridge",
    "serverId": "clxxx...",
    "shadowUserId": "clyyy...",
    "capabilities": ["send_message", "react"]
  }
}
```

### `POST /api/bot/reactions`

Добавить реакцию на сообщение в канале того же сервера. Idempotent
(повторный POST с теми же messageId+emoji вернёт `alreadyExists:true`).

```bash
curl -X POST https://app.star-crm.ru/eclipse-chat/api/bot/reactions \
  -H "Authorization: Bot ecb_..." \
  -H "Content-Type: application/json" \
  -d '{"messageId":"clmsg...","emoji":"👍"}'
```

Ответ:

```json
{ "ok": true }
```

**Ограничения:**
- Bot должен иметь capability `react` (по умолчанию есть)
- Emoji из whitelist (12 шт): 👍 ❤️ 😂 😮 😢 🔥 🎉 👀 🚀 💯 🙏 👏
- Канал должен принадлежать серверу бота
- Bot реакции работают ТОЛЬКО для канальных сообщений (не для DM —
  у DM нет membership-роли для бота)

### `POST /api/bot/messages`

Отправить сообщение в TEXT-канал того же сервера, что и бот.

```bash
curl -X POST https://app.star-crm.ru/eclipse-chat/api/bot/messages \
  -H "Authorization: Bot ecb_..." \
  -H "Content-Type: application/json" \
  -d '{
    "channelId": "clchan...",
    "content": "Привет от Telegram Bridge"
  }'
```

Ответ:

```json
{
  "message": {
    "messageId": "clmsg...",
    "content": "Привет от Telegram Bridge",
    "channelId": "clchan...",
    "userId": "<shadow user id>",
    "displayName": "Telegram Bridge",
    "avatar": null,
    "isBot": true,
    "createdAt": "2026-05-13T18:24:01.234Z"
  }
}
```

**Ограничения:**
- `content` максимум 8000 символов
- Канал должен быть `TEXT` (не VOICE)
- Канал должен принадлежать серверу бота — иначе 403
- Bot должен иметь capability `send_message` (по умолчанию есть)

**Ошибки:**

| Status | Причина |
|---|---|
| 401 | API-ключ невалидный или отсутствует |
| 403 | Bot пытается писать в чужой сервер ИЛИ нет capability |
| 400 | Пустой content / VOICE-канал / зеленный body |
| 404 | Канала с таким id нет |

---

## Realtime

Bot пишет → backend эмитит обычный `message:new` Socket.io-событие в room
`channel:<id>`. Все подписчики получают сообщение в реальном времени с флагом
`isBot: true`. Frontend показывает badge **BOT** рядом с именем.

Bot **не подключается к Socket.io** — это not implemented. Если нужен
event-driven бот (реагирует на upcoming messages) — пока подходящего пути
нет. Workaround: long-polling через `GET /api/channels/:id/messages`.

---

## Лимиты

- 20 ботов на сервер (hard cap)
- Rate limit: 100 запросов / минута (общий global limit для bot-endpoint'ов)
- Размер content: 8000 символов (та же кеп как у human messages)

---

## Capabilities

Сейчас по умолчанию у нового бота: `["send_message", "react"]`.

| Capability | Endpoint | Что разрешено |
|---|---|---|
| `send_message` | `POST /api/bot/messages` | Писать в TEXT-канал |
| `react` | `POST /api/bot/reactions` | Ставить реакции (12 emoji whitelist) |

Granular ACL (read/write/manage_channels/etc) — на roadmap'е, пока fixed set.

---

## Audit

Каждое действие OWNER'а над ботами фиксируется в audit log:

- `BOT_CREATED` — создан бот (metadata: botId, serverId, name)
- `BOT_KEY_REGENERATED` — перевыпущен ключ
- `BOT_DELETED` — удалён бот (metadata: name для post-mortem)

Audit log read-only для OWNER через будущий admin panel (v0.13).

---

## Безопасность

### Что делать если ключ утёк

1. UI → Server Settings → Боты → **Новый ключ** (regenerate).
2. Старый ключ сразу перестаёт работать.
3. Обнови env-переменную в коде бота на новый ключ.
4. Audit log зафиксирует регенерацию.

### Best practices

- **Никогда не коммить ключ** в git. Используй env-переменные / secrets manager.
- **Не log'уй ключ** в plaintext (даже на dev-стенде).
- Для production бота — обновляй ключ при ротации команды операторов.
- Если бот скомпрометирован (например, сервер бота взломан) — сразу
  **удали бота целиком**, а не regenerate. Все его сообщения и реакции
  тоже удалятся.

### Архитектурное

Bot — это не отдельная User-сущность, а **shadow user** (1-to-1 с реальной
User-таблицей). Email вида `bot-<botId>@eclipse-chat.local`, password-hash
sentinel что никогда не пройдёт login. Это упрощает Message.userId,
Reaction, Avatar, Member — никакого polymorphism, всё работает как с
обычным юзером.

Cascade удаления:
- Удалить bot → cascade удалит shadow user → cascade удалит Member +
  все его Messages + Reactions.
- Удалить owner user → cascade удалит все его bots.

---

## Пример: minimal Node.js bot

```javascript
import { setTimeout as sleep } from "node:timers/promises";

const API = "https://app.star-crm.ru/eclipse-chat/api";
const KEY = process.env.ECLIPSE_BOT_KEY;
const CHANNEL = process.env.ECLIPSE_CHANNEL_ID;

async function sendMessage(content) {
  const res = await fetch(`${API}/bot/messages`, {
    method: "POST",
    headers: {
      "Authorization": `Bot ${KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ channelId: CHANNEL, content }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Send failed: ${res.status} ${err}`);
  }
  return res.json();
}

// Heartbeat пример
while (true) {
  await sendMessage(`tick ${new Date().toISOString()}`);
  await sleep(60_000);
}
```

---

## Пример: Telegram-bridge template

Не входит в репо — общая идея:

1. Telegram bot (telegraf / grammY) слушает `text` updates.
2. На каждое сообщение — `POST /api/bot/messages` в Eclipse Chat.
3. `displayName` бота можно подменить под имя автора Telegram (delete + create
   bot per author — слишком дорого, лучше один bot с префиксом `[TG] <name>:`
   в content).

Reverse direction (Eclipse → Telegram) — невозможно через bot API сейчас,
потому что bots не получают push-events. Workaround: long-polling
`GET /api/channels/:id/messages?take=N` с трекингом last seen messageId.

---

## Версия API

Сейчас API stable on v0.12.1. Breaking changes — только через мажорный bump
(`/api/v2/bot/...`). Совместимость с существующими ключами гарантируется.

Текущий status — actively maintained. Обратная связь — Pavel Hopson или issues
в репо.
