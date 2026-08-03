export const BOT_CAPABILITIES = [
  "send_message",
  "react",
  "agent",
  "create_task",
  "update_table_row",
] as const;

export type BotCapability = (typeof BOT_CAPABILITIES)[number];

const BOT_CAPABILITY_SET = new Set<string>(BOT_CAPABILITIES);

export function canViewBotWorkbench(role: string): role is "OWNER" | "ADMIN" {
  return role === "OWNER" || role === "ADMIN";
}

export const AGENT_TOOL_CAPABILITY = {
  post_message: "send_message",
  create_task: "create_task",
  update_table_row: "update_table_row",
} as const satisfies Record<string, BotCapability>;

export type AgentToolName = keyof typeof AGENT_TOOL_CAPABILITY;

export function normalizeBotCapabilities(value: unknown): BotCapability[] {
  if (!Array.isArray(value)) return [];
  const unique = new Set<BotCapability>();
  for (const item of value) {
    if (typeof item === "string" && BOT_CAPABILITY_SET.has(item)) {
      unique.add(item as BotCapability);
    }
  }
  return BOT_CAPABILITIES.filter((capability) => unique.has(capability));
}

export function parseBotCapabilities(raw: string): BotCapability[] {
  try {
    return normalizeBotCapabilities(JSON.parse(raw));
  } catch {
    return [];
  }
}

/**
 * null means every room in the bot's own workspace. An explicit empty array
 * means no room. Malformed stored JSON fails closed to an empty scope.
 */
export function normalizeAllowedChannelIds(value: unknown): string[] | null {
  if (value === null) return null;
  if (!Array.isArray(value)) return [];
  const ids = new Set<string>();
  for (const item of value) {
    if (typeof item === "string") {
      const id = item.trim();
      if (id) ids.add(id);
    }
  }
  return [...ids];
}

export function parseAllowedChannelIds(raw: string | null): string[] | null {
  if (raw === null) return null;
  try {
    return normalizeAllowedChannelIds(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function hasBotCapability(
  capabilities: readonly string[],
  capability: BotCapability,
): boolean {
  return capabilities.includes(capability);
}

export function canAccessBotChannel(
  allowedChannelIds: readonly string[] | null,
  channelId: string,
): boolean {
  return allowedChannelIds === null || allowedChannelIds.includes(channelId);
}

export function canAccessBotScopedResource(
  allowedChannelIds: readonly string[] | null,
  channelId: string | null,
): boolean {
  if (allowedChannelIds === null) return true;
  return channelId !== null && allowedChannelIds.includes(channelId);
}

export function capabilityForAgentTool(name: string): BotCapability | null {
  return Object.prototype.hasOwnProperty.call(AGENT_TOOL_CAPABILITY, name)
    ? AGENT_TOOL_CAPABILITY[name as AgentToolName]
    : null;
}

export function canInvokeAgentTool(
  capabilities: readonly string[],
  name: string,
): boolean {
  const required = capabilityForAgentTool(name);
  return required !== null && hasBotCapability(capabilities, required);
}
