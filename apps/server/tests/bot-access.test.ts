import { describe, expect, it } from "vitest";
import {
  canAccessBotChannel,
  canAccessBotScopedResource,
  canInvokeAgentTool,
  canViewBotWorkbench,
  normalizeAllowedChannelIds,
  normalizeBotCapabilities,
  parseAllowedChannelIds,
  parseBotCapabilities,
} from "../src/ai/botAccess.js";

describe("Agent Workbench access policy", () => {
  it("exposes Workbench only to workspace owners and admins", () => {
    expect(canViewBotWorkbench("OWNER")).toBe(true);
    expect(canViewBotWorkbench("ADMIN")).toBe(true);
    expect(canViewBotWorkbench("MODERATOR")).toBe(false);
    expect(canViewBotWorkbench("MEMBER")).toBe(false);
  });

  it("normalizes capabilities to the supported allowlist", () => {
    expect(
      normalizeBotCapabilities([
        "update_table_row",
        "send_message",
        "send_message",
        "root_access",
        42,
      ]),
    ).toEqual(["send_message", "update_table_row"]);
  });

  it("fails closed when stored capability JSON is malformed", () => {
    expect(parseBotCapabilities("not-json")).toEqual([]);
  });

  it("distinguishes all rooms from an explicit deny-all scope", () => {
    expect(canAccessBotChannel(null, "room-1")).toBe(true);
    expect(canAccessBotChannel([], "room-1")).toBe(false);
    expect(canAccessBotChannel(["room-1"], "room-1")).toBe(true);
    expect(canAccessBotChannel(["room-2"], "room-1")).toBe(false);
  });

  it("fails closed when stored channel scope is malformed", () => {
    expect(parseAllowedChannelIds("not-json")).toEqual([]);
    expect(normalizeAllowedChannelIds(null)).toBeNull();
    expect(normalizeAllowedChannelIds(["room-1", "room-1", " "])).toEqual(["room-1"]);
  });

  it("blocks workspace-wide resources for a room-scoped agent", () => {
    expect(canAccessBotScopedResource(null, null)).toBe(true);
    expect(canAccessBotScopedResource(["room-1"], null)).toBe(false);
    expect(canAccessBotScopedResource(["room-1"], "room-1")).toBe(true);
  });

  it("requires a dedicated capability for every agent tool", () => {
    expect(canInvokeAgentTool(["send_message"], "post_message")).toBe(true);
    expect(canInvokeAgentTool(["send_message"], "create_task")).toBe(false);
    expect(canInvokeAgentTool(["create_task"], "create_task")).toBe(true);
    expect(canInvokeAgentTool(["agent"], "unknown_tool")).toBe(false);
  });
});
