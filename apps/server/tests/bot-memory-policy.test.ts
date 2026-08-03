import { describe, expect, it } from "vitest";
import {
  canReadMemoryEntry,
  normalizeBotMemoryPolicy,
} from "../src/ai/botMemoryPolicy.js";

describe("Agent Workbench memory policy", () => {
  it("fails closed for missing or malformed stored values", () => {
    expect(normalizeBotMemoryPolicy(undefined)).toBe("OFF");
    expect(normalizeBotMemoryPolicy("all")).toBe("OFF");
    expect(normalizeBotMemoryPolicy("WORKSPACE")).toBe("WORKSPACE");
  });

  it("does not expose curated memory when policy is off", () => {
    expect(
      canReadMemoryEntry("OFF", "room-1", {
        channelId: "room-1",
        visibility: "ROOM",
      }),
    ).toBe(false);
  });

  it("limits room policy to the current room", () => {
    expect(
      canReadMemoryEntry("ROOM", "room-1", {
        channelId: "room-1",
        visibility: "ROOM",
      }),
    ).toBe(true);
    expect(
      canReadMemoryEntry("ROOM", "room-1", {
        channelId: "room-2",
        visibility: "WORKSPACE",
      }),
    ).toBe(false);
  });

  it("adds only explicitly shared entries outside the current room", () => {
    expect(
      canReadMemoryEntry("WORKSPACE", "room-1", {
        channelId: "room-2",
        visibility: "WORKSPACE",
      }),
    ).toBe(true);
    expect(
      canReadMemoryEntry("WORKSPACE", "room-1", {
        channelId: "room-2",
        visibility: "ROOM",
      }),
    ).toBe(false);
  });
});
