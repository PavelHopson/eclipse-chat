/**
 * AI provider layer для Eclipse Chat.
 *
 * Архитектурно повторяет Star CRM AutoReply auto-chain: primary → fallback,
 * каждый провайдер шлёт OpenAI-compatible /chat/completions и парсит choice[0].
 *
 * Chain priority (auto-fallback по списку, первый успешный = result):
 *   1. Ollama (локальный, без API key) — приоритет для self-host
 *   2. OmniRoute (self-hosted AI gateway, provider-router + auto/fallback)
 *   3. Groq (free, LPU — очень быстрый)
 *   4. Cerebras (free, экстремально быстрый inference)
 *   5. OpenRouter (free DeepSeek/Qwen/Llama tier)
 *   6. NVIDIA Build (95 free models, требует API key)
 *   7. Mistral (free tier La Plateforme)
 *   6b. YandexGPT (РФ free-tier, OpenAI-compatible, приватный) — нужны
 *       YANDEX_API_KEY + YANDEX_FOLDER_ID; доступен из РФ, стандартный TLS
 *   6c. DeepSeek (cheap, OpenAI-compatible api.deepseek.com) — DEEPSEEK_API_KEY
 *   6d. GLM / Zhipu (cheap, z.ai standard API) — GLM_API_KEY
 *   6e. MiMo / Xiaomi (cheap, api.xiaomimimo.com) — MIMO_API_KEY
 *   6f. Custom OpenAI-compatible (generic slot, напр. OpenModel-шлюз) —
 *       CUSTOM_LLM_BASE_URL + CUSTOM_LLM_API_KEY
 *       ⚠️ 6c-6f — сторонние/КНР-провайдеры: env-gated, @ai-контент уходит
 *       к ним, НЕ для чувствительных данных. Стоят после free, перед paid.
 *   7. OpenAI (paid fallback)
 *   8. Pollinations (keyless, БЕЗ API key) — бесключевой free fallback,
 *      включён по умолчанию; стоит последним, любой реальный ключ важнее.
 *
 * Провайдеры 1-7 OpenAI-compatible + опциональны (включаются заданием своего
 * API key в env). Добавить ещё один free-провайдер = ещё один блок в
 * getProviders() по тому же шаблону. Чем больше бесплатных в цепочке — тем
 * надёжнее @ai для пользователя (на 429 одного идём к следующему).
 *
 * v1.6.61 — благодаря keyless-Pollinations (default-on) @ai сконфигурирован
 * ВСЕГДА (если не задан POLLINATIONS_DISABLED=1). `AINotConfiguredError` /
 * 503 теперь возможны только при явном отключении Pollinations И отсутствии
 * остальных ключей.
 *
 * Конфигурация:
 *   ## Self-host (рекомендуется — free, privacy)
 *   OLLAMA_BASE_URL=http://localhost:11434/v1
 *   OLLAMA_MODEL=qwen2.5:7b              — pull через `ollama pull qwen2.5:7b`
 *                                          Альтернативы: llama3.1:8b, deepseek-r1:7b,
 *                                          gemma2:9b, mistral:7b
 *
 *   ## Облачные free (рекомендуется — быстрые, бесплатный tier)
 *   OMNIROUTE_BASE_URL=http://localhost:20128/v1
 *   OMNIROUTE_MODEL=auto                 — OMNIROUTE_MODELS CSV
 *   OMNIROUTE_API_KEY=<token>            — опционально, если gateway требует auth
 *   GROQ_API_KEY=gsk_...                 — console.groq.com (free, очень быстрый)
 *   GROQ_MODEL=llama-3.3-70b-versatile   — GROQ_MODELS (CSV) для chain
 *   CEREBRAS_API_KEY=csk-...             — cloud.cerebras.ai (free, fastest)
 *   CEREBRAS_MODEL=llama-3.3-70b
 *   OPENROUTER_API_KEY=<key>             — free tier DeepSeek/Qwen/Llama
 *   OPENROUTER_MODEL=...                 — override default
 *   NVIDIA_API_KEY=nvapi-...             — 95 free моделей на build.nvidia.com
 *   NVIDIA_MODEL=qwen/qwen2.5-coder-32b-instruct
 *   MISTRAL_API_KEY=<key>                — console.mistral.ai (free tier)
 *   MISTRAL_MODEL=mistral-small-latest
 *   ## РФ free-tier (приватный, доступен из РФ — Yandex Cloud)
 *   YANDEX_API_KEY=<service-account-key> — ключ сервисного аккаунта Yandex Cloud
 *   YANDEX_FOLDER_ID=<folder-id>         — каталог Cloud (оба обязательны)
 *   YANDEX_MODEL=yandexgpt-lite/latest   — короткое имя авто-оборачивается в
 *                                          gpt://<folder>/...; или YANDEX_MODELS CSV
 *   ## Дешёвые облачные (cheap paid, OpenAI-compatible) — ⚠️ сторонние/КНР
 *   DEEPSEEK_API_KEY=<key>               — platform.deepseek.com (deepseek-chat)
 *   DEEPSEEK_MODEL=deepseek-chat         — DEEPSEEK_MODELS CSV (+deepseek-reasoner)
 *   GLM_API_KEY=<key>                    — z.ai / BigModel standard API (НЕ Coding Plan)
 *   GLM_MODEL=glm-4.6                    — GLM_MODELS CSV (glm-4.7, glm-5.2...)
 *   MIMO_API_KEY=<key>                   — platform.xiaomimimo.com
 *   MIMO_MODEL=mimo-v2.5-pro             — MIMO_MODELS CSV
 *   ## Custom OpenAI-compatible (generic, напр. OpenModel-промо)
 *   CUSTOM_LLM_BASE_URL=<url>            — base без /chat/completions
 *   CUSTOM_LLM_API_KEY=<key>             — оба обязательны для включения
 *   CUSTOM_LLM_MODEL=<model>             — CUSTOM_LLM_MODELS CSV
 *   ## Paid fallback
 *   OPENAI_API_KEY=<key>                 — paid fallback
 *   OPENAI_MODEL=gpt-4o-mini
 *
 *   ## Keyless free fallback (default-on, без регистрации)
 *   POLLINATIONS_DISABLED=1              — выключить keyless Pollinations
 *   POLLINATIONS_MODEL=openai            — POLLINATIONS_MODELS (CSV) для chain
 *                                          (напр. openai,openai-fast,mistral)
 *   POLLINATIONS_REFERRER=eclipse-chat   — идентификатор приложения
 *
 *   AI_TIMEOUT_MS=20000                  — per-request timeout
 *
 * Никакого PII не логируется в случае ошибок — только meta (latency, model).
 */

export class AINotConfiguredError extends Error {
  constructor() {
    super("AI provider not configured");
    this.name = "AINotConfiguredError";
  }
}

export class AIProviderError extends Error {
  constructor(
    public provider: string,
    public status: number | null,
    message: string,
  ) {
    super(message);
    this.name = "AIProviderError";
  }
}

/**
 * v1.2.29 — Function calling поддержка.
 *
 * Базовое: { role: "user|assistant|system"; content: string }.
 * Расширения:
 *   - assistant с tool_calls (LLM хочет вызвать функцию)
 *   - "tool" role с tool_call_id + content (результат функции)
 *
 * Совместимо с OpenAI Chat Completions API (OpenRouter / Ollama в Tools-mode /
 * NVIDIA Build / native OpenAI).
 */
export type ChatToolCall = {
  id: string;
  /** function-name из tool spec, snake_case. */
  name: string;
  /** Сырая строка args от LLM (JSON.parse — caller'а). */
  arguments: string;
};

export type ChatMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: string }
  | {
      role: "assistant";
      content: string;
      /** v1.2.29 — если LLM вызвал функции, content может быть пустым. */
      tool_calls?: ChatToolCall[];
    }
  | {
      /** v1.2.29 — результат выполнения tool'а. */
      role: "tool";
      tool_call_id: string;
      content: string;
    };

/** v1.2.29 — OpenAI-compatible tool spec для passing в chat() opts. */
export type ChatToolSpec = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<string, unknown>;
      required: string[];
      additionalProperties?: boolean;
    };
  };
};

export type ChatResult = {
  text: string;
  /** v1.2.29 — Tool calls если LLM решил позвать функции. Empty array = pure text reply. */
  toolCalls: ChatToolCall[];
  model: string;
  provider: string;
  latencyMs: number;
  promptTokens?: number;
  completionTokens?: number;
};

type ProviderConfig = {
  name: string;
  baseUrl: string;
  /** Если undefined — Authorization header не отправляется. */
  apiKey?: string;
  /** v1.5.18 — поддержка нескольких моделей одного провайдера.
   * First model trie'д первым; на 429/5xx — fallback к следующей model
   * в array'е перед тем как уйти на следующий provider. */
  models: string[];
  /** Дополнительный header для OpenRouter rankings. */
  extraHeaders?: Record<string, string>;
  /** v1.6.61 — provider-specific поля в JSON body запроса (мерджатся поверх
   *  base body). Для Pollinations: `private:true` (генерация НЕ в публичную
   *  ленту) + `referrer`. Не должен содержать model/messages (их задаёт base). */
  extraBody?: Record<string, unknown>;
};

export type AiProviderDiagnostic = {
  priority: number;
  name: string;
  kind: "local" | "gateway" | "cloud" | "keyless";
  baseHost: string;
  hasAuth: boolean;
  modelCount: number;
  models: string[];
};

/** v1.5.18 — utility для парсинга CSV список моделей из env. Trim'ит
 *  пустоты, dedupes, пропускает пустые строки. Если CSV пуст/не задан
 *  → возвращает [fallback]. */
function parseModels(envValue: string | undefined, fallback: string): string[] {
  if (!envValue) return [fallback];
  const list = envValue
    .split(",")
    .map((m) => m.trim())
    .filter((m) => m.length > 0);
  // Dedupe сохраняя порядок.
  const seen = new Set<string>();
  const dedup: string[] = [];
  for (const m of list) {
    if (!seen.has(m)) {
      seen.add(m);
      dedup.push(m);
    }
  }
  return dedup.length > 0 ? dedup : [fallback];
}

function getProviders(): ProviderConfig[] {
  const out: ProviderConfig[] = [];

  // 1. Ollama (локальный) — приоритет. Без API key.
  //    Включается если задан OLLAMA_BASE_URL ИЛИ OLLAMA_MODEL.
  //    OLLAMA_MODELS (CSV) — несколько моделей с auto-fallback.
  const ollamaUrl = process.env.OLLAMA_BASE_URL?.trim();
  const ollamaModelEnv = process.env.OLLAMA_MODEL?.trim();
  const ollamaModelsEnv = process.env.OLLAMA_MODELS?.trim();
  if (ollamaUrl || ollamaModelEnv || ollamaModelsEnv) {
    out.push({
      name: "ollama",
      baseUrl: ollamaUrl ?? "http://localhost:11434/v1",
      apiKey: "ollama", // dummy, Ollama игнорирует
      models: parseModels(ollamaModelsEnv ?? ollamaModelEnv, "qwen2.5:7b"),
    });
  }

  // 2. OmniRoute — self-hosted OpenAI-compatible AI gateway.
  //    Reference: https://github.com/diegosouzapw/OmniRoute
  //    По README gateway слушает http://localhost:20128/v1 и поддерживает
  //    model=auto / auto/* routing. Включаем только явным env, чтобы прод
  //    случайно не начал слать @ai traffic в локальный/внешний router.
  const omniRouteUrl = process.env.OMNIROUTE_BASE_URL?.trim();
  const omniRouteKey = process.env.OMNIROUTE_API_KEY?.trim();
  const omniRouteModelEnv = process.env.OMNIROUTE_MODEL?.trim();
  const omniRouteModelsEnv = process.env.OMNIROUTE_MODELS?.trim();
  if (omniRouteUrl || omniRouteKey || omniRouteModelEnv || omniRouteModelsEnv) {
    out.push({
      name: "omniroute",
      baseUrl: (omniRouteUrl ?? "http://localhost:20128/v1").replace(/\/+$/, ""),
      apiKey: omniRouteKey || undefined,
      models: parseModels(omniRouteModelsEnv ?? omniRouteModelEnv, "auto"),
      extraHeaders: {
        "X-Title": "Eclipse Chat",
      },
    });
  }

  // 3. Groq — бесплатный, очень быстрый (LPU). Free tier (дневной лимит → на
  //    429 цепочка идёт к следующему провайдеру). GROQ_MODELS (CSV) для chain.
  const groqKey = process.env.GROQ_API_KEY?.trim();
  if (groqKey) {
    out.push({
      name: "groq",
      baseUrl: "https://api.groq.com/openai/v1",
      apiKey: groqKey,
      models: parseModels(
        process.env.GROQ_MODELS ?? process.env.GROQ_MODEL,
        "llama-3.3-70b-versatile",
      ),
    });
  }

  // 4. Cerebras — бесплатный, экстремально быстрый inference. Free tier.
  const cerebrasKey = process.env.CEREBRAS_API_KEY?.trim();
  if (cerebrasKey) {
    out.push({
      name: "cerebras",
      baseUrl: "https://api.cerebras.ai/v1",
      apiKey: cerebrasKey,
      models: parseModels(
        process.env.CEREBRAS_MODELS ?? process.env.CEREBRAS_MODEL,
        "llama-3.3-70b",
      ),
    });
  }

  // 5. OpenRouter — free tier DeepSeek/Qwen/Llama.
  //    v1.5.18 — OPENROUTER_MODELS (CSV) расширяет single OPENROUTER_MODEL —
  //    при 429 на одной модели идём дальше по списку до paid fallback.
  //    Default chain: DeepSeek → Llama 3.3 → Qwen 2.5 (все :free).
  const orKey = process.env.OPENROUTER_API_KEY?.trim();
  if (orKey) {
    const defaultChain = [
      "deepseek/deepseek-chat-v3.1:free",
      "meta-llama/llama-3.3-70b-instruct:free",
      "qwen/qwen-2.5-72b-instruct:free",
    ].join(",");
    out.push({
      name: "openrouter",
      baseUrl: "https://openrouter.ai/api/v1",
      apiKey: orKey,
      models: parseModels(
        process.env.OPENROUTER_MODELS ?? process.env.OPENROUTER_MODEL,
        // Fallback при пустом env — первая модель из default chain;
        // дальше chain не разворачивается (single fallback). При CSV/
        // OPENROUTER_MODELS — берём весь список.
        defaultChain.split(",")[0],
      ).concat(
        // Если env не задан вообще — extend chain'ом по дефолту.
        process.env.OPENROUTER_MODELS || process.env.OPENROUTER_MODEL
          ? []
          : defaultChain.split(",").slice(1),
      ),
      extraHeaders: {
        "HTTP-Referer": "https://app.star-crm.ru/eclipse-chat/",
        "X-Title": "Eclipse Chat",
      },
    });
  }

  // 6. NVIDIA Build — 95 free моделей.
  const nvKey = process.env.NVIDIA_API_KEY?.trim();
  if (nvKey) {
    out.push({
      name: "nvidia",
      baseUrl: "https://integrate.api.nvidia.com/v1",
      apiKey: nvKey,
      models: parseModels(
        process.env.NVIDIA_MODELS ?? process.env.NVIDIA_MODEL,
        "qwen/qwen2.5-coder-32b-instruct",
      ),
    });
  }

  // 7. Mistral — бесплатный tier (La Plateforme). OpenAI-compatible.
  const mistralKey = process.env.MISTRAL_API_KEY?.trim();
  if (mistralKey) {
    out.push({
      name: "mistral",
      baseUrl: "https://api.mistral.ai/v1",
      apiKey: mistralKey,
      models: parseModels(
        process.env.MISTRAL_MODELS ?? process.env.MISTRAL_MODEL,
        "mistral-small-latest",
      ),
    });
  }

  // 6b. YandexGPT — РФ free-tier через OpenAI-compatible эндпоинт Yandex Cloud.
  //     v1.6.62 — приватный (промпты не публикуются) и доступный из РФ
  //     альтернатив-ключ, когда регистрация западных сервисов недоступна.
  //     Требует ДВЕ env: YANDEX_API_KEY (ключ сервисного аккаунта) +
  //     YANDEX_FOLDER_ID (каталог Cloud). Auth = `Api-Key <key>` (НЕ Bearer) →
  //     переопределяем дефолтный Bearer через extraHeaders. Модель = URI
  //     `gpt://<folder>/<model>` — короткие имена в YANDEX_MODELS авто-
  //     оборачиваются (полные gpt:// URI оставляются как есть). Стандартный
  //     TLS (без российского CA — в отличие от GigaChat, потому выбран он).
  const yandexKey = process.env.YANDEX_API_KEY?.trim();
  const yandexFolder = process.env.YANDEX_FOLDER_ID?.trim();
  if (yandexKey && yandexFolder) {
    const yandexModels = parseModels(
      process.env.YANDEX_MODELS ?? process.env.YANDEX_MODEL,
      "yandexgpt-lite/latest",
    ).map((m) => (m.startsWith("gpt://") ? m : `gpt://${yandexFolder}/${m}`));
    out.push({
      name: "yandexgpt",
      baseUrl: "https://llm.api.cloud.yandex.net/v1",
      apiKey: yandexKey, // в Bearer не идёт — auth переопределён extraHeaders
      models: yandexModels,
      extraHeaders: {
        // Yandex Cloud API key передаётся как `Api-Key <key>`, не `Bearer`.
        Authorization: `Api-Key ${yandexKey}`,
      },
    });
  }

  // 6c. DeepSeek — официальный OpenAI-compatible API (api.deepseek.com).
  //     v1.6.71 — сильная дешёвая модель (deepseek-chat / deepseek-reasoner).
  //     ⚠️ Провайдер из КНР — @ai-контент уходит к нему; env-gated, не для
  //     чувствительных данных. DEEPSEEK_MODELS (CSV).
  const deepseekKey = process.env.DEEPSEEK_API_KEY?.trim();
  if (deepseekKey) {
    out.push({
      name: "deepseek",
      baseUrl: "https://api.deepseek.com/v1",
      apiKey: deepseekKey,
      models: parseModels(
        process.env.DEEPSEEK_MODELS ?? process.env.DEEPSEEK_MODEL,
        "deepseek-chat",
      ),
    });
  }

  // 6d. GLM / Zhipu (z.ai) — OpenAI-compatible standard API (api.z.ai/api/paas/v4).
  //     v1.6.71 — GLM-4.6/4.7/5.2, дёшево. ⚠️ Это standard pay-per-token API,
  //     НЕ Coding-Plan-подписка (та живёт на /api/coding/paas/v4 и нужна для
  //     Claude Code, не для @ai). ⚠️ Провайдер из КНР (Zhipu) — env-gated,
  //     не для чувствительных данных. GLM_MODELS (CSV).
  const glmKey = process.env.GLM_API_KEY?.trim();
  if (glmKey) {
    out.push({
      name: "glm",
      baseUrl: "https://api.z.ai/api/paas/v4",
      apiKey: glmKey,
      models: parseModels(
        process.env.GLM_MODELS ?? process.env.GLM_MODEL,
        "glm-4.6",
      ),
    });
  }

  // 6e. MiMo (Xiaomi) — официальный OpenAI-compatible API (api.xiaomimimo.com/v1).
  //     v1.6.71 — mimo-v2.5-pro (агентские/мультимодальные задачи). ⚠️
  //     Маркетинговые цифры канала («Opus в 28× дешевле») НЕ проверены —
  //     берём как обычный дешёвый провайдер. ⚠️ Провайдер из КНР (Xiaomi) —
  //     env-gated. MIMO_MODELS (CSV).
  const mimoKey = process.env.MIMO_API_KEY?.trim();
  if (mimoKey) {
    out.push({
      name: "mimo",
      baseUrl: "https://api.xiaomimimo.com/v1",
      apiKey: mimoKey,
      models: parseModels(
        process.env.MIMO_MODELS ?? process.env.MIMO_MODEL,
        "mimo-v2.5-pro",
      ),
    });
  }

  // 6f. Custom OpenAI-compatible эндпоинт — generic slot для любого совместимого
  //     провайдера/шлюза. v1.6.71 — добавлен под OpenModel (DeepSeek-V4-Flash
  //     free-промо до 28.06.2026), но URL НЕ хардкодим: провенанс шлюза не
  //     подтверждён → задаётся целиком через env. Включается только если заданы
  //     И CUSTOM_LLM_BASE_URL, И CUSTOM_LLM_API_KEY. ⚠️ Проверяй TOS/политику
  //     данных эндпоинта перед чувствительными данными. CUSTOM_LLM_MODELS (CSV).
  const customUrl = process.env.CUSTOM_LLM_BASE_URL?.trim();
  const customKey = process.env.CUSTOM_LLM_API_KEY?.trim();
  if (customUrl && customKey) {
    out.push({
      name: "custom",
      baseUrl: customUrl.replace(/\/+$/, ""),
      apiKey: customKey,
      models: parseModels(
        process.env.CUSTOM_LLM_MODELS ?? process.env.CUSTOM_LLM_MODEL,
        "deepseek-v4-flash",
      ),
    });
  }

  // 7. OpenAI — paid fallback.
  const oaiKey = process.env.OPENAI_API_KEY?.trim();
  if (oaiKey) {
    out.push({
      name: "openai",
      baseUrl: "https://api.openai.com/v1",
      apiKey: oaiKey,
      models: parseModels(
        process.env.OPENAI_MODELS ?? process.env.OPENAI_MODEL,
        "gpt-4o-mini",
      ),
    });
  }

  // 8. Pollinations — публичный OpenAI-compatible эндпоинт БЕЗ ключа (keyless).
  //    v1.6.61 — добавлен как бесключевой fallback для регионов/команд, где
  //    регистрация западных AI-сервисов недоступна (нельзя получить ключ).
  //    Включён ПО УМОЛЧАНИЮ и стоит ПОСЛЕДНИМ: любой реальный ключ выше по
  //    списку имеет приоритет; когда ключей нет вообще — @ai всё равно живой.
  //    Отключить полностью: POLLINATIONS_DISABLED=1.
  //    Приватность: шлём `private:true` (генерация НЕ попадает в публичную
  //    ленту Pollinations) + `referrer`. Как и любой cloud-LLM, контент @ai
  //    уходит на внешний сервис — для полной приватности используйте Ollama.
  //    Надёжность: анонимный tier rate-limited (429) и иногда медленный —
  //    retry/backoff + model-fallback это сглаживают; это best-effort free.
  if (process.env.POLLINATIONS_DISABLED !== "1") {
    out.push({
      name: "pollinations",
      // baseUrl + "/chat/completions" = реальный эндпоинт (проверено).
      baseUrl: "https://text.pollinations.ai/openai",
      apiKey: "pollinations", // dummy — эндпоинт игнорирует Authorization
      models: parseModels(
        process.env.POLLINATIONS_MODELS ?? process.env.POLLINATIONS_MODEL,
        "openai",
      ),
      extraBody: {
        private: true,
        referrer: process.env.POLLINATIONS_REFERRER?.trim() || "eclipse-chat",
      },
    });
  }
  return out;
}

function providerKind(name: string): AiProviderDiagnostic["kind"] {
  if (name === "ollama") return "local";
  if (name === "omniroute" || name === "custom") return "gateway";
  if (name === "pollinations") return "keyless";
  return "cloud";
}

function baseHost(baseUrl: string): string {
  try {
    return new URL(baseUrl).host;
  } catch {
    return "custom-endpoint";
  }
}

function sanitizeModel(model: string): string {
  // YandexGPT model URI contains folder id; it is not a key, but we do not need
  // to expose tenant-like identifiers in admin diagnostics.
  return model.replace(/^gpt:\/\/[^/]+\//, "gpt://<folder>/");
}

export function listAiProviderDiagnostics(): AiProviderDiagnostic[] {
  return getProviders().map((cfg, index) => ({
    priority: index + 1,
    name: cfg.name,
    kind: providerKind(cfg.name),
    baseHost: baseHost(cfg.baseUrl),
    hasAuth: Boolean(cfg.apiKey || cfg.extraHeaders?.Authorization),
    modelCount: cfg.models.length,
    models: cfg.models.map(sanitizeModel),
  }));
}

export function isAiConfigured(): boolean {
  return getProviders().length > 0;
}

// Ollama на CPU может отвечать 30-60s — увеличили default. AI_TIMEOUT_MS env
// для override (например, 120000 если запускаешь 32B model на слабом железе).
const DEFAULT_TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS) || 60_000;

type ChatOpts = {
  temperature?: number;
  maxTokens?: number;
  tools?: ChatToolSpec[];
  toolChoice?: "auto" | "none" | "required";
};

/**
 * v1.5.18 — единичный вызов конкретной (provider × model) пары.
 * Бросает AIProviderError на не-2xx с status кодом. Caller'ы наверху
 * решают: retry с backoff (429/5xx), пропустить (4xx other), fallback
 * на следующую модель/провайдера.
 */
async function callProviderModel(
  cfg: ProviderConfig,
  model: string,
  messages: ChatMessage[],
  opts: ChatOpts,
): Promise<ChatResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  const started = Date.now();
  try {
    const body: Record<string, unknown> = {
      model,
      messages,
      temperature: opts.temperature ?? 0.4,
      max_tokens: opts.maxTokens ?? 600,
      stream: false,
      // v1.6.61 — provider-specific body поля (напр. Pollinations private/referrer).
      // Идут ПОСЛЕ base, но model/messages в extraBody мы не кладём (см. тип).
      ...(cfg.extraBody ?? {}),
    };
    if (opts.tools && opts.tools.length > 0) {
      body.tools = opts.tools;
      body.tool_choice = opts.toolChoice ?? "auto";
    }
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(cfg.apiKey ? { Authorization: `Bearer ${cfg.apiKey}` } : {}),
      ...cfg.extraHeaders,
    };
    const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      let errText = "";
      try {
        errText = await res.text();
      } catch {
        /* */
      }
      throw new AIProviderError(
        cfg.name,
        res.status,
        `${cfg.name}/${model} ${res.status}: ${errText.slice(0, 200) || "no body"}`,
      );
    }
    const json = (await res.json()) as {
      choices?: Array<{
        message?: {
          content?: string | null;
          tool_calls?: Array<{
            id?: string;
            type?: string;
            function?: { name?: string; arguments?: string };
          }>;
        };
      }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
      model?: string;
    };
    const msg = json.choices?.[0]?.message;
    const text = (msg?.content ?? "").trim();
    const toolCalls: ChatToolCall[] = (msg?.tool_calls ?? [])
      .filter((tc) => tc.function?.name)
      .map((tc, idx) => ({
        id: tc.id ?? `call_${idx}`,
        name: tc.function!.name!,
        arguments: tc.function!.arguments ?? "{}",
      }));
    if (!text && toolCalls.length === 0) {
      throw new AIProviderError(cfg.name, res.status, "Empty completion");
    }
    return {
      text,
      toolCalls,
      model: json.model ?? model,
      provider: cfg.name,
      latencyMs: Date.now() - started,
      promptTokens: json.usage?.prompt_tokens,
      completionTokens: json.usage?.completion_tokens,
    };
  } finally {
    clearTimeout(timer);
  }
}

/** Sleep helper (Promise wrapper над setTimeout). */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * v1.5.18 — retry-aware wrapper над callProviderModel:
 * - 429 (rate limit) → exponential backoff 500/1500/4000ms, 3 attempts max.
 * - 5xx (server) → single retry after 1000ms.
 * - Прочие ошибки (4xx auth/bad request, network, timeout) → fail immediately.
 *
 * Если все retry'и упали — throws AIProviderError. Caller (outer chat())
 * пробует следующую model в array'е или следующий provider.
 */
const BACKOFF_DELAYS_MS = [500, 1500, 4000];

async function callWithRetry(
  cfg: ProviderConfig,
  model: string,
  messages: ChatMessage[],
  opts: ChatOpts,
): Promise<ChatResult> {
  let lastErr: unknown = null;
  // attempts: initial + 3 retries (для 429) = 4 total.
  for (let attempt = 0; attempt <= BACKOFF_DELAYS_MS.length; attempt++) {
    try {
      return await callProviderModel(cfg, model, messages, opts);
    } catch (err) {
      lastErr = err;
      if (!(err instanceof AIProviderError)) throw err;
      const status = err.status ?? 0;
      const isRateLimit = status === 429;
      const isServerErr = status >= 500 && status < 600;
      if (!isRateLimit && !isServerErr) {
        // 4xx auth/bad request / network → no retry, surfaces caller.
        throw err;
      }
      // Last attempt — no more delays, propagate.
      if (attempt >= BACKOFF_DELAYS_MS.length) break;
      // 5xx — single retry с фиксированным 1s; rate-limit — exponential.
      const delayMs = isServerErr && attempt > 0 ? 0 : BACKOFF_DELAYS_MS[attempt];
      if (delayMs === 0) break; // 5xx single retry — exit после первого retry'я
      console.warn(
        `[ai] retry ${cfg.name}/${model} after ${delayMs}ms (status ${status}, attempt ${attempt + 1})`,
      );
      await sleep(delayMs);
    }
  }
  if (lastErr instanceof Error) throw lastErr;
  throw new AIProviderError(cfg.name, null, "All retries failed");
}

/**
 * v1.5.18 — provider-level call: iterate через ВСЕ models у этого
 * провайдера. На каждой — callWithRetry (backoff на 429/5xx). Если
 * все упали — propagate'ит последнюю ошибку наверх.
 */
async function callProvider(
  cfg: ProviderConfig,
  messages: ChatMessage[],
  opts: ChatOpts,
): Promise<ChatResult> {
  let lastErr: unknown = null;
  for (const model of cfg.models) {
    try {
      return await callWithRetry(cfg, model, messages, opts);
    } catch (err) {
      lastErr = err;
      if (err instanceof AIProviderError) {
        console.warn(
          `[ai] model failed ${cfg.name}/${model}: ${err.message}, trying next model`,
        );
      }
      // continue к next model
    }
  }
  if (lastErr instanceof Error) throw lastErr;
  throw new AIProviderError(cfg.name, null, "All models failed");
}

/**
 * Выполнить chat-completion с auto-fallback по списку провайдеров.
 *
 * Возвращает первый успешный ответ. Если все упали — throws AIProviderError
 * с meta последнего. Если ни один не сконфигурирован — AINotConfiguredError.
 */
export async function chat(
  messages: ChatMessage[],
  opts: {
    temperature?: number;
    maxTokens?: number;
    /** v1.2.29 — tools spec для function calling. */
    tools?: ChatToolSpec[];
    /** v1.2.29 — "auto" (default) / "none" / "required". */
    toolChoice?: "auto" | "none" | "required";
  } = {},
): Promise<ChatResult> {
  const providers = getProviders();
  if (providers.length === 0) {
    throw new AINotConfiguredError();
  }
  let lastErr: unknown = null;
  for (const cfg of providers) {
    try {
      return await callProvider(cfg, messages, opts);
    } catch (err) {
      lastErr = err;
      if (err instanceof AIProviderError) {
        console.warn(
          `[ai] provider failed ${cfg.name} (models tried: ${cfg.models.join(", ")}): ${err.message}, trying next provider`,
        );
      }
      // continue к next provider
    }
  }
  if (lastErr instanceof Error) throw lastErr;
  throw new AIProviderError("unknown", null, "All providers failed");
}
