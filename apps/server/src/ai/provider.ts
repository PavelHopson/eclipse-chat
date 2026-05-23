/**
 * AI provider layer для Eclipse Chat.
 *
 * Архитектурно повторяет Star CRM AutoReply auto-chain: primary → fallback,
 * каждый провайдер шлёт OpenAI-compatible /chat/completions и парсит choice[0].
 *
 * Chain priority (auto-fallback по списку, первый успешный = result):
 *   1. Ollama (локальный, без API key) — приоритет для self-host
 *   2. OpenRouter (free DeepSeek/Qwen tier)
 *   3. NVIDIA Build (95 free models, требует API key)
 *   4. OpenAI (paid fallback)
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
 *   ## Облачные free / paid
 *   OPENROUTER_API_KEY=<key>             — free tier DeepSeek/Qwen/Llama
 *   OPENROUTER_MODEL=...                 — override default
 *   NVIDIA_API_KEY=nvapi-...             — 95 free моделей на build.nvidia.com
 *   NVIDIA_MODEL=qwen/qwen2.5-coder-32b-instruct
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

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type ChatResult = {
  text: string;
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
  model: string;
  /** Дополнительный header для OpenRouter rankings. */
  extraHeaders?: Record<string, string>;
};

function getProviders(): ProviderConfig[] {
  const out: ProviderConfig[] = [];

  // 1. Ollama (локальный) — приоритет. Без API key.
  //    Включается если задан OLLAMA_BASE_URL ИЛИ OLLAMA_MODEL (значит admin
  //    осознанно настроил локальный runtime).
  const ollamaUrl = process.env.OLLAMA_BASE_URL?.trim();
  const ollamaModel = process.env.OLLAMA_MODEL?.trim();
  if (ollamaUrl || ollamaModel) {
    out.push({
      name: "ollama",
      baseUrl: ollamaUrl ?? "http://localhost:11434/v1",
      apiKey: "ollama", // dummy, Ollama игнорирует
      model: ollamaModel ?? "qwen2.5:7b",
    });
  }

  // 2. OpenRouter — free tier DeepSeek/Qwen/Llama.
  const orKey = process.env.OPENROUTER_API_KEY?.trim();
  if (orKey) {
    out.push({
      name: "openrouter",
      baseUrl: "https://openrouter.ai/api/v1",
      apiKey: orKey,
      model: process.env.OPENROUTER_MODEL ?? "deepseek/deepseek-chat-v3.1:free",
      extraHeaders: {
        "HTTP-Referer": "https://app.star-crm.ru/eclipse-chat/",
        "X-Title": "Eclipse Chat",
      },
    });
  }

  // 3. NVIDIA Build — 95 free моделей (Qwen, GLM, DeepSeek, Kimi, Gemma, Mistral).
  //    OpenAI-compatible на https://integrate.api.nvidia.com/v1.
  const nvKey = process.env.NVIDIA_API_KEY?.trim();
  if (nvKey) {
    out.push({
      name: "nvidia",
      baseUrl: "https://integrate.api.nvidia.com/v1",
      apiKey: nvKey,
      model: process.env.NVIDIA_MODEL ?? "qwen/qwen2.5-coder-32b-instruct",
    });
  }

  // 4. OpenAI — paid fallback.
  const oaiKey = process.env.OPENAI_API_KEY?.trim();
  if (oaiKey) {
    out.push({
      name: "openai",
      baseUrl: "https://api.openai.com/v1",
      apiKey: oaiKey,
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
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

async function callProvider(
  cfg: ProviderConfig,
  messages: ChatMessage[],
  opts: { temperature?: number; maxTokens?: number },
): Promise<ChatResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  const started = Date.now();
  try {
    const body = {
      model: cfg.model,
      messages,
      temperature: opts.temperature ?? 0.4,
      max_tokens: opts.maxTokens ?? 600,
      stream: false,
    };
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
        `${cfg.name} ${res.status}: ${errText.slice(0, 200) || "no body"}`,
      );
    }
    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
      model?: string;
    };
    const text = json.choices?.[0]?.message?.content?.trim() ?? "";
    if (!text) {
      throw new AIProviderError(cfg.name, res.status, "Empty completion");
    }
    return {
      text,
      model: json.model ?? cfg.model,
      provider: cfg.name,
      latencyMs: Date.now() - started,
      promptTokens: json.usage?.prompt_tokens,
      completionTokens: json.usage?.completion_tokens,
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Выполнить chat-completion с auto-fallback по списку провайдеров.
 *
 * Возвращает первый успешный ответ. Если все упали — throws AIProviderError
 * с meta последнего. Если ни один не сконфигурирован — AINotConfiguredError.
 */
export async function chat(
  messages: ChatMessage[],
  opts: { temperature?: number; maxTokens?: number } = {},
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
      // logger в caller; here просто continue
    }
  }
  if (lastErr instanceof Error) throw lastErr;
  throw new AIProviderError("unknown", null, "All providers failed");
}
