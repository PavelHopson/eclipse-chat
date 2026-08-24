import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { GrowthRunPayload } from "../lib/growthRunContract.js";

const resultSchema = z
  .object({
    schemaVersion: z.literal("growth.execute.result.v1"),
    step: z.enum(["research", "strategy", "draft", "claims", "final"]),
    role: z.string().min(1).max(80),
    content: z.string().trim().min(40).max(16_000),
    provider: z.literal("eclipse-ai-hub"),
    model: z.string().min(1).max(160),
    usage: z
      .object({
        promptTokens: z.number().int().nonnegative().nullable(),
        completionTokens: z.number().int().nonnegative().nullable(),
      })
      .strict(),
  })
  .strict();

export type GrowthHubResult = z.infer<typeof resultSchema>;

export class GrowthHubError extends Error {
  constructor(
    public readonly code: "not_configured" | "cancelled" | "timeout" | "rate_limited" | "unavailable" | "invalid_response",
    message: string,
  ) {
    super(message);
    this.name = "GrowthHubError";
  }
}

function normalizeGatewayBaseUrl(value: string | undefined): string | null {
  if (!value?.trim()) return null;
  try {
    const url = new URL(value.trim());
    const loopback = new Set(["localhost", "127.0.0.1", "[::1]"]);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return null;
    if (url.protocol === "http:" && !loopback.has(url.hostname)) return null;
    return url.toString().replace(/\/+$/, "");
  } catch {
    return null;
  }
}

function integerEnv(value: string | undefined, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= min && parsed <= max ? parsed : fallback;
}

export function getGrowthHubPolicy(env: NodeJS.ProcessEnv = process.env) {
  const baseUrl = normalizeGatewayBaseUrl(env.ECLIPSE_GROWTH_HUB_BASE_URL ?? env.ECLIPSE_AI_HUB_BASE_URL);
  const token = env.ECLIPSE_GROWTH_HUB_SERVICE_TOKEN?.trim();
  return {
    configured: Boolean(baseUrl && token && token.length >= 32),
    baseUrl,
    token: token && token.length >= 32 ? token : null,
    model: env.ECLIPSE_GROWTH_HUB_MODEL?.trim() || "auto/best-chat",
    timeoutMs: integerEnv(env.ECLIPSE_GROWTH_HUB_TIMEOUT_MS, 65_000, 5_000, 120_000),
    dailyRequestLimit: integerEnv(env.GROWTH_REQUESTS_PER_USER_DAY, 25, 5, 100),
  };
}

export async function executeGrowthHubStep(
  run: GrowthRunPayload,
  step: GrowthHubResult["step"],
  options: {
    signal?: AbortSignal;
    fetchImpl?: typeof fetch;
    env?: NodeJS.ProcessEnv;
    requestId?: string;
  } = {},
): Promise<GrowthHubResult> {
  const policy = getGrowthHubPolicy(options.env);
  if (!policy.configured || !policy.baseUrl || !policy.token) {
    throw new GrowthHubError("not_configured", "Growth executor пока не настроен администратором");
  }

  const controller = new AbortController();
  let timedOut = false;
  const abortFromCaller = () => controller.abort();
  options.signal?.addEventListener("abort", abortFromCaller, { once: true });
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, policy.timeoutMs);
  try {
    const requestId = options.requestId ?? randomUUID();
    const response = await (options.fetchImpl ?? fetch)(`${policy.baseUrl}/growth/execute`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${policy.token}`,
        "Content-Type": "application/json",
        "X-Request-Id": requestId,
        "Idempotency-Key": requestId,
        "X-Eclipse-Client": "eclipse-chat-growth",
      },
      body: JSON.stringify({
        schemaVersion: "growth.execute.v1",
        step,
        run: { id: run.id, input: run.input, artifacts: run.artifacts },
      }),
      signal: controller.signal,
    });
    if (!response.ok) {
      await response.body?.cancel();
      if (response.status === 429) {
        throw new GrowthHubError("rate_limited", "AI Hub временно исчерпал минутный лимит. Повторите позже");
      }
      if (response.status === 499) throw new GrowthHubError("cancelled", "Шаг остановлен");
      if (response.status === 504) throw new GrowthHubError("timeout", "AI Hub не успел ответить. Шаг можно повторить");
      throw new GrowthHubError("unavailable", "AI Hub временно недоступен. Сохранённые материалы не изменены");
    }
    const parsed = resultSchema.safeParse(await response.json());
    if (!parsed.success || parsed.data.step !== step) {
      throw new GrowthHubError("invalid_response", "AI Hub вернул некорректный результат. Материал не изменён");
    }
    return parsed.data;
  } catch (error) {
    if (error instanceof GrowthHubError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      if (!timedOut && options.signal?.aborted) throw new GrowthHubError("cancelled", "Шаг остановлен");
      throw new GrowthHubError("timeout", "AI Hub не успел ответить. Шаг можно повторить");
    }
    throw new GrowthHubError("unavailable", "AI Hub временно недоступен. Сохранённые материалы не изменены");
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", abortFromCaller);
  }
}
