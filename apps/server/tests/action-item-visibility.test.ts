import { describe, expect, it } from "vitest";
import {
  serializeActionItem,
  type ActionItemWithRelations,
} from "../src/actionItems.js";

const user = {
  id: "user-1",
  displayName: "Operator",
  avatar: null,
  email: "operator@example.test",
  botProfile: null,
};

function actionWithMixedDependencies(): ActionItemWithRelations {
  return {
    id: "action-public",
    title: "Prepare client release",
    description: null,
    type: "TASK",
    status: "OPEN",
    priority: "NORMAL",
    dueAt: null,
    createdAt: new Date("2026-08-02T10:00:00.000Z"),
    updatedAt: new Date("2026-08-02T10:00:00.000Z"),
    serverId: "server-1",
    channelId: "channel-public",
    channel: { internal: false },
    sourceMessageId: "message-1",
    createdByUserId: user.id,
    createdBy: user,
    assigneeUserId: null,
    assignee: null,
    requiresApproval: false,
    approverUserId: null,
    approver: null,
    approvalStatus: "NONE",
    approvalNote: null,
    approvedAt: null,
    escalatedAt: null,
    aiSummary: null,
    aiSummaryUpdatedAt: null,
    dependencies: [
      {
        dependsOnActionItem: {
          id: "dependency-public",
          title: "Client-visible dependency",
          status: "OPEN",
          type: "TASK",
          channel: { internal: false },
        },
      },
      {
        dependsOnActionItem: {
          id: "dependency-private",
          title: "Private incident title",
          status: "OPEN",
          type: "TASK",
          channel: { internal: true },
        },
      },
    ],
    blocks: [],
  };
}

describe("action item visibility", () => {
  it("does not serialize dependency titles across room visibility scopes", () => {
    const serialized = serializeActionItem(actionWithMixedDependencies());

    expect(serialized.dependencies).toEqual([
      expect.objectContaining({
        id: "dependency-public",
        title: "Client-visible dependency",
      }),
    ]);
    expect(JSON.stringify(serialized)).not.toContain("Private incident title");
  });
});
