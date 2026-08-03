export const BOT_MEMORY_POLICIES = ["OFF", "ROOM", "WORKSPACE"] as const;

export type BotMemoryPolicy = (typeof BOT_MEMORY_POLICIES)[number];

const BOT_MEMORY_POLICY_SET = new Set<string>(BOT_MEMORY_POLICIES);

export function normalizeBotMemoryPolicy(value: unknown): BotMemoryPolicy {
  return typeof value === "string" && BOT_MEMORY_POLICY_SET.has(value)
    ? (value as BotMemoryPolicy)
    : "OFF";
}

export function canReadMemoryEntry(
  policy: BotMemoryPolicy,
  currentChannelId: string,
  entry: { channelId: string | null; visibility: "ROOM" | "WORKSPACE" },
): boolean {
  if (policy === "OFF") return false;
  if (entry.channelId === currentChannelId) return true;
  return policy === "WORKSPACE" && entry.visibility === "WORKSPACE";
}
