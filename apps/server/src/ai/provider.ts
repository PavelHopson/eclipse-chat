/**
 * AI provider layer для Eclipse Chat.
 *
 * Архитектурно повторяет Star CRM AutoReply auto-chain: primary → fallback,
 * каждый провайдер шлёт OpenAI-compatible /chat/completions и парсит choice[0].
 *
 * Chain priority (auto-fallback по списку, первый успешный = result):
 *   1. Ollama (локальный, без API key) — приоритет для self-host
 *   2. Groq (free, LPU — очень быстрый)
 *   3. Cerebras (free, экстремально быстрый inference)
 *   4. OpenRouter (free DeepSeek/Qwen/Llama tier)
 *   5. NVIDIA Build (95 free models, требует API key)
 *   6. Mistral (free tier La Plateforme)
 *   7. OpenAI (paid fallback)
 *
 * Все провайдеры OpenAI-compatible + опциональны (включаются заданием своего
 * API key в env). Добавить ещё один free-провайдер = ещё один блок в
 * getProviders() по тому же шаблону. Чем больше бесплатных в цепочке — тем
 * надёжнее @ai для пользователя (на 429 одного идём к следующему).
 *
 * Если ни один не сконфигурирован — `chat()` бросает `AINotConfiguredError`,
 * route возвращает 503 с пояснением. Это позволяет деплоить Eclipse Chat
 * без AI и включать фичу позже только env-переменной.
 *
 * Конфигурация:
 *   ## Self-host (рекомендуется — free, privacy)
 *   OLLAMA_BASE_URL=http://localhost:11434/v1
 *   OLLAMA_MODEL=qwen2.5:7b              — pull через `ollama pull qwen2.5:7b`
 *                                          Альтернативы: llama3.1:8b, deepseek-r1:7b,
 *                                          gemma2:9b, mistral:7b
 *
 *   ## Облачные free (рекомендуется — быстрые, бесплатный tier)
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
 *   ## Paid fallback
 *   OPENAI_API_KEY=<key>                 — paid fallback
 *   OPENAI_MODEL=gpt-4o-mini
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
  apiKey: string;
  /** v1.5.18 — поддержка нескольких моделей одного провайдера.
   * First model trie'д первым; на 429/5xx — fallback к следующей model
   * в array'е перед тем как уйти на следующий provider. */
  models: string[];
  /** Дополнительный header для OpenRouter rankings. */
  extraHeaders?: Record<string, string>;
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

  // 2. Groq — бесплатный, очень быстрый (LPU). Free tier (дневной лимит → на
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

  // 3. Cerebras — бесплатный, экстремально быстрый inference. Free tier.
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

  // 4. OpenRouter — free tier DeepSeek/Qwen/Llama.
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

  // 5. NVIDIA Build — 95 free моделей.
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

  // 6. Mistral — бесплатный tier (La Plateforme). OpenAI-compatible.
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
  return out;
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
    };
    if (opts.tools && opts.tools.length > 0) {
      body.tools = opts.tools;
      body.tool_choice = opts.toolChoice ?? "auto";
    }
    const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cfg.apiKey}`,
        ...cfg.extraHeaders,
      },
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
