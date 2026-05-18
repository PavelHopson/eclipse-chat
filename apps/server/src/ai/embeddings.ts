/**
 * Embedding provider chain for semantic search (v0.77 #21).
 *
 * Архитектура — повторяет ai/provider.ts (chat completions): primary →
 * fallback. Но embeddings — отдельный API:
 *   - Ollama:  POST {OLLAMA_BASE_URL}/api/embeddings  body {model, prompt}
 *              → {embedding: [...]}
 *              (Notice: Ollama's REST API, not OpenAI-compatible /v1 path.)
 *   - OpenAI:  POST https://api.openai.com/v1/embeddings  body {model, input,
 *              dimensions}  → {data: [{embedding: [...]}]}
 *
 * Цель — 768-dim normalized vectors для дешёвого cosine search (dot-product
 * с unit-vectors). Оба провайдера могут возвращать unnormalized — нормируем
 * на этой стороне defensively.
 *
 * Env:
 *   OLLAMA_BASE_URL=http://localhost:11434
 *   OLLAMA_EMBED_MODEL=nomic-embed-text   (default; 768-dim)
 *   OPENAI_API_KEY=sk-...
 *   OPENAI_EMBED_MODEL=text-embedding-3-small  (default; with dimensions=768)
 *
 * Disabled если ни один не сетап → EmbeddingNotConfiguredError на caller.
 * Sync writer fire-and-forget'ит вызов и тихо логирует если упало —
 * features-flag pattern, embeddings необязательная фича.
 */

export class EmbeddingNotConfiguredError extends Error {
  constructor() {
    super("Embedding provider not configured");
    this.name = "EmbeddingNotConfiguredError";
  }
}

export class EmbeddingError extends Error {
  constructor(
    public provider: string,
    public status: number | null,
    message: string,
  ) {
    super(message);
    this.name = "EmbeddingError";
  }
}

export type EmbedResult = {
  vector: number[];
  model: string;
  provider: "ollama" | "openai";
};

export const EMBED_DIM = 768;

type EmbedProvider = {
  name: "ollama" | "openai";
  embed: (text: string) => Promise<EmbedResult>;
};

const EMBED_TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS) || 60_000;

function l2Normalize(v: number[]): number[] {
  let sumSq = 0;
  for (const x of v) sumSq += x * x;
  if (sumSq === 0) return v.slice();
  const norm = Math.sqrt(sumSq);
  const out = new Array<number>(v.length);
  for (let i = 0; i < v.length; i++) out[i] = v[i]! / norm;
  return out;
}

function clampDim(v: number[]): number[] {
  if (v.length === EMBED_DIM) return v;
  if (v.length > EMBED_DIM) return v.slice(0, EMBED_DIM);
  // Pad с нулями, если короче — единичный edge case (старые модели).
  const out = v.slice();
  while (out.length < EMBED_DIM) out.push(0);
  return out;
}

function getProviders(): EmbedProvider[] {
  const out: EmbedProvider[] = [];
  const ollamaUrl = (
    process.env.OLLAMA_EMBED_URL ?? process.env.OLLAMA_BASE_URL
  )?.trim();
  if (ollamaUrl) {
    const base = ollamaUrl.replace(/\/v1\/?$/, "");
    const model = process.env.OLLAMA_EMBED_MODEL?.trim() || "nomic-embed-text";
    out.push({
      name: "ollama",
      embed: async (text) => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), EMBED_TIMEOUT_MS);
        try {
          const res = await fetch(`${base}/api/embeddings`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ model, prompt: text }),
            signal: controller.signal,
          });
          if (!res.ok) {
            let body = "";
            try {
              body = await res.text();
            } catch {
              /* */
            }
            throw new EmbeddingError(
              "ollama",
              res.status,
              `ollama embeddings ${res.status}: ${body.slice(0, 200) || "no body"}`,
            );
          }
          const json = (await res.json()) as { embedding?: number[] };
          if (!Array.isArray(json.embedding) || json.embedding.length === 0) {
            throw new EmbeddingError("ollama", res.status, "Empty embedding");
          }
          return {
            vector: l2Normalize(clampDim(json.embedding)),
            model: `ollama:${model}`,
            provider: "ollama",
          };
        } finally {
          clearTimeout(timer);
        }
      },
    });
  }

  const oaiKey = process.env.OPENAI_API_KEY?.trim();
  if (oaiKey) {
    const model =
      process.env.OPENAI_EMBED_MODEL?.trim() || "text-embedding-3-small";
    out.push({
      name: "openai",
      embed: async (text) => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), EMBED_TIMEOUT_MS);
        try {
          const res = await fetch("https://api.openai.com/v1/embeddings", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${oaiKey}`,
            },
            body: JSON.stringify({ model, input: text, dimensions: EMBED_DIM }),
            signal: controller.signal,
          });
          if (!res.ok) {
            let body = "";
            try {
              body = await res.text();
            } catch {
              /* */
            }
            throw new EmbeddingError(
              "openai",
              res.status,
              `openai embeddings ${res.status}: ${body.slice(0, 200) || "no body"}`,
            );
          }
          const json = (await res.json()) as {
            data?: Array<{ embedding?: number[] }>;
            model?: string;
          };
          const v = json.data?.[0]?.embedding;
          if (!Array.isArray(v) || v.length === 0) {
            throw new EmbeddingError(
              "openai",
              res.status,
              "Empty embedding from OpenAI",
            );
          }
          return {
            vector: l2Normalize(clampDim(v)),
            model: `openai:${json.model ?? model}`,
            provider: "openai",
          };
        } finally {
          clearTimeout(timer);
        }
      },
    });
  }

  return out;
}

export function isEmbeddingConfigured(): boolean {
  return getProviders().length > 0;
}

/**
 * Embed одного текста (≤ 8000 char). Chain provider'ов — primary first,
 * fallback if fails. Throws EmbeddingNotConfiguredError если нет ни одного.
 */
export async function embedText(text: string): Promise<EmbedResult> {
  const t = text.slice(0, 8000).trim();
  if (!t) {
    throw new EmbeddingError("none", null, "Empty text");
  }
  const providers = getProviders();
  if (providers.length === 0) {
    throw new EmbeddingNotConfiguredError();
  }
  let lastErr: unknown = null;
  for (const p of providers) {
    try {
      return await p.embed(t);
    } catch (err) {
      lastErr = err;
    }
  }
  if (lastErr instanceof Error) throw lastErr;
  throw new EmbeddingError("unknown", null, "All embedding providers failed");
}

/**
 * Cosine similarity для unit-нормализованных векторов = dot-product.
 * Векторы поступают normalized из embedText() → search читает их as-is
 * и считает dot. Если длины не совпадают (другой model) — short-circuit
 * к 0 (cross-model search не имеет смысла).
 */
export function cosineSim(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i]! * b[i]!;
  return dot;
}
