import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  enqueueAndDispatchOfficeEvent: vi.fn(),
  enqueueOfficeEventOutboxWithClient: vi.fn(),
}));

vi.mock("./outbox.js", () => ({
  enqueueAndDispatchOfficeEvent: mocks.enqueueAndDispatchOfficeEvent,
  enqueueOfficeEventOutboxWithClient: mocks.enqueueOfficeEventOutboxWithClient,
}));

import {
  enqueueGrowthApprovalResolved,
  enqueueGrowthTaskCreated,
  growthTaskProgressedInput,
  publishGrowthTaskCancelled,
  publishGrowthTaskStarted,
} from "./growthEvents.js";

const context = {
  workspaceId: "workspace-1",
  runId: "run-1",
  releaseName: "Release 1.8",
};

describe("Growth Office event adapter", () => {
  beforeEach(() => {
    mocks.enqueueAndDispatchOfficeEvent.mockReset();
    mocks.enqueueOfficeEventOutboxWithClient.mockReset();
    mocks.enqueueAndDispatchOfficeEvent.mockResolvedValue(true);
    mocks.enqueueOfficeEventOutboxWithClient.mockResolvedValue("outbox-1");
  });

  it("enqueues the created event inside the caller transaction", async () => {
    const client = { officeEventOutbox: { create: vi.fn() } } as never;
    await expect(enqueueGrowthTaskCreated(client, context, "chat")).resolves.toBe("outbox-1");

    expect(mocks.enqueueOfficeEventOutboxWithClient).toHaveBeenCalledWith(client, {
      producerId: "growth-command-room",
      input: expect.objectContaining({
        workspaceId: context.workspaceId,
        type: "task.created",
        subject: { kind: "task", id: context.runId },
        metadata: { departmentId: "growth", origin: "chat" },
      }),
    });
  });

  it("maps the last Growth role to a manual approval request", () => {
    expect(growthTaskProgressedInput(context, "publish", "Publisher", 5, 5)).toMatchObject({
      type: "approval.requested",
      subject: { kind: "approval", id: context.runId },
      metadata: { departmentId: "growth", completed: 5, total: 5 },
    });
  });

  it("records an approval decision through the caller transaction", async () => {
    const client = { officeEventOutbox: { create: vi.fn() } } as never;
    await expect(enqueueGrowthApprovalResolved(client, context, "APPROVED")).resolves.toBe("outbox-1");

    expect(mocks.enqueueOfficeEventOutboxWithClient).toHaveBeenCalledWith(client, {
      producerId: "growth-command-room",
      input: expect.objectContaining({
        type: "approval.resolved",
        metadata: { departmentId: "growth", decision: "APPROVED" },
      }),
    });
  });

  it("durably enqueues non-transactional lifecycle signals before best-effort delivery", async () => {
    await expect(publishGrowthTaskStarted(context, "research", "Researcher")).resolves.toBe(true);
    await expect(publishGrowthTaskCancelled(context, "research")).resolves.toBe(true);

    expect(mocks.enqueueAndDispatchOfficeEvent).toHaveBeenCalledTimes(2);
    expect(mocks.enqueueAndDispatchOfficeEvent).toHaveBeenNthCalledWith(1, {
      producerId: "growth-command-room",
      input: expect.objectContaining({ type: "task.started" }),
    });
    expect(mocks.enqueueAndDispatchOfficeEvent).toHaveBeenNthCalledWith(2, {
      producerId: "growth-command-room",
      input: expect.objectContaining({ type: "task.cancelled" }),
    });
  });

  it("does not turn a durable enqueue failure into a false route failure", async () => {
    mocks.enqueueAndDispatchOfficeEvent.mockResolvedValueOnce(false);
    await expect(publishGrowthTaskStarted(context, "draft", "Writer")).resolves.toBe(false);
  });
});