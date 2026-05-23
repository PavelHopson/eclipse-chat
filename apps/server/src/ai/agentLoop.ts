import type { FastifyBaseLogger } from "fastify";
import { chat, AIProviderError, type ChatMessage } from "./provider.js";
import {
  executeToolCall,
  getOpenAiToolSpecs,
  type ToolCallContext,
} from "./tools/registry.js";

/**
 * v1.2.29 — Agent Loop Runtime (AI agents Партия 2 slice 2).
 *
 * Multi-turn function-calling цикл:
 *   1. Шлём messages + tools-spec в chat()
 *   2. Если LLM вернул tool_calls — выполняем каждый через executeToolCall
 *   3. Append tool results как `role: "tool"` messages, возвращаемся в 1
 *   4. Если LLM вернул plain text без tool_calls — это final answer
 *
 * Safety boundaries:
 *   - MAX_TURNS: 5 (защита от infinite loop'а; обычно решается за 2-3)
 *   - MAX_TOTAL_MS: 45s (latency wallclock — Pavel'я брифа «10-60s OK»)
 *   - MAX_TOOL_CALLS_PER_TURN: 5 (LLM иногда хочет 20 параллельных — обрезаем)
 *
 * При abort'е (max turns / timeout) — возвращаем то, что успели собрать
 * как partial result + флаг truncated. Caller решает как поступать.
 */

const MAX_TURNS = 5;
const MAX_TOTAL_MS = 45_000;
const MAX_TOOL_CALLS_PER_TURN = 5;

export type AgentRunResult = {
  /** Финальный текст ответа агента (что показать пользователю). */
  text: string;
  /** Кол-во tool calls которые реально выполнились. */
  toolCallCount: number;
  /** True если остановились по limit'у (turns / timeout) — не natural finish. */
  truncated: boolean;
  /** Кол-во LLM turn'ов (каждый — один chat() call). */
  turns: number;
  /** Total wallclock latency в ms. */
  latencyMs: number;
  /** Provider последнего successful chat'а (для observability). */
  provider: string;
};

export type AgentRunOptions = {
  /** System prompt с personality / role / available tools description. */
  systemPrompt: string;
  /**
   * История диалога — user message который trigger'нул агента + recent context.
   * Loop добавляет assistant + tool messages поверх.
   */
  initialMessages: ChatMessage[];
  /** Контекст для tool executor'а. */
  toolContext: ToolCallContext;
  /** Logger для structured tracing. */
  log: FastifyBaseLogger;
  /** Optional override MAX_TURNS. Default 5. */
  maxTurns?: number;
  /** Temperature для LLM. Default 0.4 (как обычный chat). */
  temperature?: number;
};

/**
 * Запустить agent loop. Возвращает результат с финальным текстом ответа
 * + meta. Не throw'ит на tool errors (LLM сам handle'ит); throw'ит только
 * на провайдерскую ошибку (AIProviderError / AINotConfiguredError) или
 * timeout.
 */
export async function runAgentLoop(opts: AgentRunOptions): Promise<AgentRunResult> {
  const { systemPrompt, initialMessages, toolContext, log } = opts;
  const maxTurns = opts.maxTurns ?? MAX_TURNS;
  const startedAt = Date.now();

  const toolSpecs = getOpenAiToolSpecs();
  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    ...initialMessages,
  ];

  let toolCallCount = 0;
  let provider = "unknown";
  let lastText = "";

  for (let turn = 1; turn <= maxTurns; turn++) {
    const elapsed = Date.now() - startedAt;
    if (elapsed > MAX_TOTAL_MS) {
      log.warn(
        { botUserId: toolContext.botUserId, elapsed, turn },
        "Agent loop timeout",
      );
      return {
        text: lastText || "Извини, я слишком долго думал — давай ещё раз короче.",
        toolCallCount,
        truncated: true,
        turns: turn - 1,
        latencyMs: elapsed,
        provider,
      };
    }

    let result;
    try {
      result = await chat(messages, {
        tools: toolSpecs,
        toolChoice: "auto",
        temperature: opts.temperature,
        // Tools-режим: chat-completions может выдать больше из-за tool-call JSON.
        maxTokens: 1000,
      });
    } catch (err) {
      // Provider error: останавливаемся, возвращаем что есть.
      if (err instanceof AIProviderError) {
        log.warn(
          { botUserId: toolContext.botUserId, turn, provider: err.provider, status: err.status },
          "Agent loop provider failed",
        );
      }
      throw err;
    }
    provider = result.provider;
    lastText = result.text;

    // No tool calls → final answer, exit loop.
    if (result.toolCalls.length === 0) {
      log.info(
        {
          botUserId: toolContext.botUserId,
          turn,
          toolCalls: toolCallCount,
          latencyMs: Date.now() - startedAt,
        },
        "Agent loop finished",
      );
      return {
        text: result.text,
        toolCallCount,
        truncated: false,
        turns: turn,
        latencyMs: Date.now() - startedAt,
        provider,
      };
    }

    // LLM хочет вызвать функции. Cap количество per-turn.
    const calls = result.toolCalls.slice(0, MAX_TOOL_CALLS_PER_TURN);

    // Append assistant message с tool_calls — required для OpenAI conversation
    // format (иначе tool messages не привязываются).
    messages.push({
      role: "assistant",
      content: result.text, // может быть пустой
      tool_calls: calls,
    });

    // Выполняем каждый, append tool message с result.
    for (const tc of calls) {
      let parsedArgs: unknown;
      try {
        parsedArgs = JSON.parse(tc.arguments);
      } catch {
        const errMsg = `Invalid JSON args: ${tc.arguments.slice(0, 100)}`;
        log.warn(
          { botUserId: toolContext.botUserId, tool: tc.name, err: errMsg },
          "Agent tool args parse failed",
        );
        messages.push({
          role: "tool",
          tool_call_id: tc.id,
          content: JSON.stringify({ ok: false, error: errMsg }),
        });
        continue;
      }
      const execResult = await executeToolCall(tc.name, parsedArgs, toolContext);
      toolCallCount++;
      messages.push({
        role: "tool",
        tool_call_id: tc.id,
        content: JSON.stringify(execResult),
      });
    }
    // Loop продолжается — следующий turn shows LLM tool results.
  }

  // Превышен max turns.
  log.warn(
    {
      botUserId: toolContext.botUserId,
      maxTurns,
      toolCalls: toolCallCount,
      latencyMs: Date.now() - startedAt,
    },
    "Agent loop max turns exceeded",
  );
  return {
    text: lastText || "Я выполнил несколько действий, но не могу подвести итог — попробуй переформулировать.",
    toolCallCount,
    truncated: true,
    turns: maxTurns,
    latencyMs: Date.now() - startedAt,
    provider,
  };
}
