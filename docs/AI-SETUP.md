# Eclipse Chat — AI setup

Eclipse Chat включает AI-фичи (channel digest summary + `@ai` assistant в чате).
По умолчанию AI отключён — endpoints возвращают 503. Чтобы включить, нужно
сконфигурировать хотя бы один провайдер через env-переменные в
`apps/server/.env`.

**Provider chain** (auto-fallback по списку, первый успешный = result):

| Приоритет | Провайдер | Стоимость | API key |
|---:|---|---|---|
| 1 | **Ollama** (локальный) | бесплатно (CPU/GPU server) | — |
| 2 | **OpenRouter** | бесплатные модели (DeepSeek/Qwen/Llama) | да, free tier |
| 3 | **NVIDIA Build** | 95 бесплатных моделей | да |
| 4 | **OpenAI** | paid | да |

Рекомендация для production self-host: **Ollama + OpenRouter** как fallback
(если локальный runtime упал — облако подхватит).

---

## Вариант 1 — Ollama (рекомендуется, бесплатно, privacy-first)

Локальный LLM runtime. Никаких API keys, всё inference на твоём VPS.

### Установка на сервер

```bash
# На VPS под root:
curl -fsSL https://ollama.com/install.sh | sh

# Запуск как сервис (systemd) — автоматически после install.
sudo systemctl enable --now ollama
sudo systemctl status ollama  # должен быть active (running)

# По умолчанию слушает localhost:11434
curl http://localhost:11434/api/version
# {"version":"0.x.y"}
```

### Pull нужной модели

Выбор зависит от железа сервера:

| Модель | Размер | RAM | Скорость на CPU | Когда выбирать |
|---|---|---|---|---|
| `qwen2.5:7b` | 4.7 GB | 8 GB | 5-15 t/s | **Default**. Хорошее RU + EN, ассистент |
| `llama3.1:8b` | 4.7 GB | 8 GB | 5-15 t/s | Альтернатива Qwen, EN силён |
| `deepseek-r1:7b` | 4.7 GB | 8 GB | 4-12 t/s | Reasoning-задачи, чуть медленнее |
| `gemma2:9b` | 5.5 GB | 10 GB | 4-10 t/s | Google, хороший RU |
| `phi3.5:3.8b` | 2.2 GB | 4 GB | 8-25 t/s | Слабые серверы / быстрые ответы |
| `qwen2.5:14b` | 9 GB | 16 GB | 2-8 t/s | Большой контекст, лучшее качество |
| `qwen2.5:32b` | 20 GB | 32 GB | 1-3 t/s (CPU) | Только если есть GPU |

Pull команда:

```bash
ollama pull qwen2.5:7b
# или
ollama pull llama3.1:8b
```

Тест:

```bash
ollama run qwen2.5:7b "Привет, как дела?"
```

### Подключение в Eclipse Chat

Добавь в `apps/server/.env`:

```bash
OLLAMA_BASE_URL=http://localhost:11434/v1
OLLAMA_MODEL=qwen2.5:7b
```

Restart:

```bash
sudo supervisorctl restart eclipse-chat-server
```

Проверка:

```bash
curl https://app.star-crm.ru/eclipse-chat/api/version  # должен ответить
# Зайди в чат канала, нажми «✦ Резюме ИИ» — через 10-30s появится резюме.
```

---

## Вариант 2 — OpenRouter (free облако, fastest setup)

1. Регистрация на https://openrouter.ai → Sign up
2. Settings → Keys → Create Key → копируй `sk-or-v1-...`
3. В `apps/server/.env`:
   ```bash
   OPENROUTER_API_KEY=sk-or-v1-...
   OPENROUTER_MODEL=deepseek/deepseek-chat-v3.1:free
   ```

Доступные free models (на момент написания):
- `deepseek/deepseek-chat-v3.1:free` (default)
- `deepseek/deepseek-r1:free` (reasoning)
- `qwen/qwen-2.5-72b-instruct:free`
- `meta-llama/llama-3.3-70b-instruct:free`
- `google/gemini-2.0-flash-exp:free`

Лимит обычно 20 req/min на free tier — для Eclipse Chat достаточно
(digest summary редкое действие, `@ai` mention тоже).

---

## Вариант 3 — NVIDIA Build (95 free моделей)

1. Регистрация на https://build.nvidia.com → Get API Key
2. В `apps/server/.env`:
   ```bash
   NVIDIA_API_KEY=nvapi-...
   NVIDIA_MODEL=qwen/qwen2.5-coder-32b-instruct
   ```

---

## Что включается AI

После настройки хотя бы одного провайдера:

1. **`POST /api/channels/:id/digest/summary`** — natural-language резюме
   статуса канала поверх ChannelDigest snapshot. Открой канал → нажми кнопку
   «✦ Резюме ИИ» рядом с «Собрать сводку».

2. **`@ai` mention в чате** — упоминание `@ai` (или `@ии`) в сообщении
   триггерит fire-and-forget background job: backend собирает context
   (open actions + pinned + last 20 msgs) → скармливает LLM → постит ответ
   от system-bot в ту же ветку через ~3-30s (зависит от скорости модели).

   Примеры запросов:
   - `@ai кто отвечает за разработку iOS?`
   - `@ai что было решено по deadline проекта?`
   - `@ai какие задачи открыты на этой неделе?`

   Throttle 20s per channel — нельзя спамить.

---

## Limits и safety

- Никаких PII не логируется в провайдере (только meta: latency, model, status).
- Cache в памяти отсутствует — каждый запрос свежий (digest часто меняется).
- В `@ai` flow bot не отвечает на собственные сообщения (избегаем циклов).
- Silent fail при API error — у пользователя нет «AI failed» спама в чате.
- Lockout per-channel throttle 20s между `@ai` mentions.

---

## Troubleshooting

**`curl /api/channels/X/digest/summary` возвращает 503:**
- Ни одного провайдера не задано. Проверь `apps/server/.env` → restart supervisor.

**502 Bad Gateway:**
- Все настроенные провайдеры упали. Проверь:
  - Ollama: `systemctl status ollama` + `curl localhost:11434/api/version`
  - OpenRouter: проверь quota на https://openrouter.ai/credits
  - В логах supervisor: `tail -f /var/log/supervisor/eclipse-chat-server.log`

**AI отвечает 60+ секунд:**
- Ollama на CPU — нормально. Увеличь timeout: `AI_TIMEOUT_MS=120000`.
- Попробуй модель поменьше: `ollama pull phi3.5:3.8b`.

**Бот не отвечает на `@ai`:**
- Сообщение должно содержать `@ai` как отдельное слово.
- Проверь throttle — 20s между сообщениями.
- Проверь логи: `journalctl -u ollama -f` для Ollama errors.
