import { describe, expect, it } from "vitest";
import { focusDeadlineMs, focusElapsedMs, focusRemainingMs } from "../../web/src/components/actionFocusTimer.js";

describe("task focus timer", () => {
  it("preserves remaining time across pause and resume", () => {
    const remaining = focusRemainingMs(focusDeadlineMs(10_000, 90_000), 40_000);
    expect(remaining).toBe(60_000);
    expect(focusDeadlineMs(200_000, remaining)).toBe(260_000);
  });
  it("expires correctly after an inactive tab", () => {
    expect(focusRemainingMs(focusDeadlineMs(10_000, 1_000), 86_410_000)).toBe(0);
  });
  it("keeps progress within the chosen duration", () => {
    expect(focusElapsedMs(60_000, 15_000)).toBe(45_000);
    expect(focusElapsedMs(60_000, 0)).toBe(60_000);
    expect(focusElapsedMs(60_000, 90_000)).toBe(0);
  });
});
