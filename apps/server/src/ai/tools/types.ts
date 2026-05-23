import type { FastifyBaseLogger } from "fastify";

/**
 * v1.2.28 — AI Tools foundation (Партия 2, slice 1).
 *
 * Tool — typed function callable агентом в LLM function-calling loop:
 *   1. LLM decides «нужно вызвать post_message» с args
 *   2. Backend парсит, validates, executes
 *   3. Result feeds back в LLM как assistant message
 *
 * Безопасность: каждый tool сам валидирует, что bot имеет право
 * (channel.serverId === bot.serverId; assignee — member; table — etc).
 * Никаких «trust the LLM» — мы валидируем все args.
 */

/** Контекст вызова tool'а — приходит из agent loop'а. */
export type ToolCallContext = {
  /** Shadow user id бота (Bot.userId). Под этим userId создаются messages/actions. */
  botUserId: string;
  /** Display name бота (для логирования / audit). */
  botName: string;
  /** Server в котором bot работает. Все tools scoped к нему. */
  serverId: string;
  /** Канал-источник trigger'а (бот по умолчанию пишет туда, если args не задают другой). */
  channelId?: string;
  /** Fastify logger — для structured logs о tool calls. */
  log: FastifyBaseLogger;
};

/** Результат tool execution — discriminated union для type-safe error handling. */
export type ToolResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

/**
 * Tool definition — то, что LLM видит через `tools[]` параметр + executor.
 *
 * `parameters` — JSON Schema (OpenAI / OpenRouter / Anthropic-compatible).
 */
export type Tool<Args, Result> = {
  /** Snake_case имя как в OpenAI function calling (a-z, _, digits). */
  name: string;
  /** Human-readable описание для LLM — что tool делает и когда вызывать. */
  description: string;
  /** JSON Schema аргументов. Type "object" обязателен. */
  parameters: {
    type: "object";
    properties: Record<string, unknown>;
    required: string[];
    additionalProperties?: boolean;
  };
  /** Executor: validates args + delegates. */
  execute: (args: Args, ctx: ToolCallContext) => Promise<ToolResult<Result>>;
};

/** Type-erased Tool для registry storage (varargs / varresults). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyTool = Tool<any, any>;
