import { describe, expect, it } from "vitest";
import {
  isValidQueuedUpdatePayload,
  parseBotActionApprovalPayload,
  parseBotActionApprovalPreview,
  requiresOwnerApproval,
} from "../src/ai/actionApproval.js";

describe("agent action approval policy", () => {
  it("requires Owner approval only for sensitive table mutations", () => {
    expect(requiresOwnerApproval("update_table_row")).toBe(true);
    expect(requiresOwnerApproval("create_task")).toBe(false);
    expect(requiresOwnerApproval("post_message")).toBe(false);
    expect(requiresOwnerApproval("update_table_row", true)).toBe(false);
  });

  it("accepts only the strict queued update payload", () => {
    expect(isValidQueuedUpdatePayload({
      table_id: "table-1",
      row_id: "row-1",
      cell_updates: [{ field_id: "field-1", value: "DONE" }],
    })).toBe(true);
    expect(isValidQueuedUpdatePayload({
      table_id: "table-1",
      row_id: "row-1",
      cell_updates: [],
      server_id: "other-workspace",
    })).toBe(false);
  });

  it("fails closed for malformed or oversized previews", () => {
    expect(parseBotActionApprovalPreview("not-json")).toBeNull();
    expect(parseBotActionApprovalPreview(JSON.stringify({
      kind: "update_table_row",
      tableName: "Delivery",
      rowId: "row-1",
      updates: [{ fieldName: "Status", value: "DONE" }],
      totalUpdates: 1,
    }))).toMatchObject({ tableName: "Delivery", totalUpdates: 1 });
    expect(parseBotActionApprovalPreview(JSON.stringify({
      kind: "update_table_row",
      tableName: "x".repeat(121),
      rowId: "row-1",
      updates: [],
      totalUpdates: 1,
    }))).toBeNull();
  });

  it("rejects non-object payloads before execution", () => {
    expect(parseBotActionApprovalPayload("[]")).toBeNull();
    expect(parseBotActionApprovalPayload("null")).toBeNull();
    expect(parseBotActionApprovalPayload("{\"row_id\":\"row-1\"}"))
      .toEqual({ row_id: "row-1" });
  });
});
