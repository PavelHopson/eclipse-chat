import { describe, expect, it } from "vitest";
import {
  creativeApprovalRequestedInput,
  creativeApprovalResolvedInput,
  creativeDeliverableReadyInput,
  creativeTaskCreatedInput,
  creativeTaskStartedInput,
} from "./creativeEvents.js";
import { officeEventInputSchema } from "./contracts.js";

const context = { workspaceId: "server-a", jobId: "job-a", title: "Весенний ролик" };

describe("Creative Studio Office events", () => {
  it("maps the lifecycle to bounded, tenant-scoped events", () => {
    const events = [
      creativeTaskCreatedInput(context, "preview"),
      creativeApprovalRequestedInput(context, 0),
      creativeApprovalResolvedInput(context, "APPROVED"),
      creativeTaskStartedInput(context),
      creativeDeliverableReadyInput(context, "spring-video.json"),
    ];
    expect(events.map((event) => event.type)).toEqual([
      "task.created",
      "approval.requested",
      "approval.resolved",
      "task.started",
      "deliverable.ready",
    ]);
    for (const event of events) expect(officeEventInputSchema.parse(event).workspaceId).toBe("server-a");
  });
});
