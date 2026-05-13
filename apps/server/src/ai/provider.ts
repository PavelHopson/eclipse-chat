/**
 * AI provider layer для Eclipse Chat.
 *
 * Архитектурно повторяет Star CRM AutoReply auto-chain: primary → fallback,
 * каждый провайдер шлёт OpenAI-compatible /chat/completions и парсит choice[0].
 *
 * По умолчанию провайдер = OpenRouter (free DeepSeek/Qwen). Без API key
 * `chat()` бросает `AINotConfiguredError` — route catches и возвращает 503
 * с пояснением. Это позволяет деплоить Eclipse Chat без AI и включать
 * фичу позже только env-переменной.
 *
 * Конфигурация:
 *   OPENROUTER_API_KEY=<key>           — primary provider
 *   OPENROUTER_MODEL=...               — override default model
 *   OPENAI_API_KEY=<key>               — fallback (если openrouter упал)
 *   OPENAI_MODEL=gpt-4o-mini           — override
 *   AI_TIMEOUT_MS=20000                — per-request timeout
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
  const orKey = process.env.OPENROUTER_API_KEY?.trim();
  if (orKey) {
    out.push({
      name: "openrouter",
      baseUrl: "https://openrouter.ai/api/v1",
      apiKey: orKey,
      model: process.env.OPENROUTER_MODEL ?? "deepseek/deepseek-chat-v3.1:free",
      extraHeaders: {
        "HTTP-Referer": "https://app.star-crm.ru/eclipse-chat",
        "X-Title": "Eclipse Chat",
      },
    });
  }
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

const DEFAULT_TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS) || 20_000;

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
