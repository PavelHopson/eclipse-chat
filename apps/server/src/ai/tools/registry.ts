import { postMessageTool } from "./postMessage.js";
import { createTaskTool } from "./createTask.js";
import { updateTableRowTool } from "./updateTableRow.js";
import type { AnyTool, ToolCallContext, ToolResult } from "./types.js";

/**
 * v1.2.28 — Tool registry.
 *
 * Все tools, доступные агенту. Регистр имён в LLM = snake_case (OpenAI
 * function-calling convention). Для каждого:
 *   - JSON Schema → передаётся LLM в `tools[]` параметре
 *   - execute → backend выполняет с validated args
 */

export const ALL_TOOLS: AnyTool[] = [
  postMessageTool,
  createTaskTool,
  updateTableRowTool,
];

const TOOLS_BY_NAME = new Map<string, AnyTool>(
  ALL_TOOLS.map((t) => [t.name, t]),
);

export function getToolByName(name: string): AnyTool | null {
  return TOOLS_BY_NAME.get(name) ?? null;
}

/**
 * OpenAI / OpenRouter-compatible tool specs для передачи в chat() с
 * function calling. Anthropic использует другой shape, но мы пока
 * через OpenAI-compatible API (OpenRouter, DeepSeek native).
 */
export function getOpenAiToolSpecs(): Array<{
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: AnyTool["parameters"];
  };
}> {
  return ALL_TOOLS.map((t) => ({
    type: "function",
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));
}

/**
 * Execute tool call by name. Безопасный wrapper — на unknown name
 * возвращает structured error (не throw'ит), чтобы agent loop мог
 * fed это назад LLM и LLM попробовал другой подход.
 */
export async function executeToolCall(
  name: string,
  rawArgs: unknown,
  ctx: ToolCallContext,
): Promise<ToolResult<unknown>> {
  const tool = getToolByName(name);
  if (!tool) {
    return { ok: false, error: `Tool "${name}" не существует. Доступные: ${ALL_TOOLS.map((t) => t.name).join(", ")}` };
  }
  try {
    return await tool.execute(rawArgs, ctx);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    ctx.log.warn({ tool: name, err: message }, "Tool execution threw");
    return { ok: false, error: `Tool error: ${message}` };
  }
}

export type { ToolCallContext, ToolResult } from "./types.js";
