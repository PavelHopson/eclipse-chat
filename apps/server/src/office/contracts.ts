import { z } from "zod";

export const OFFICE_EVENT_SCHEMA_VERSION = "office.event.v1" as const;

export const officeEventTypeSchema = z.enum([
  "task.created",
  "task.started",
  "task.progressed",
  "task.cancelled",
  "task.completed",
  "task.failed",
  "approval.requested",
  "approval.resolved",
  "agent.state.changed",
  "deliverable.ready",
]);

export const officeSubjectSchema = z.object({
  kind: z.enum(["task", "run", "approval", "agent", "deliverable"]),
  id: z.string().trim().min(1).max(160),
}).strict();

const officeMetadataValueSchema = z.union([
  z.string().trim().max(240),
  z.number().finite(),
  z.boolean(),
  z.null(),
]);

const SENSITIVE_METADATA_KEY = /(authorization|cookie|credential|password|private.?key|secret|token|api.?key)/i;

const officeMetadataSchema = z.record(
  z.string().min(1).max(64),
  officeMetadataValueSchema,
).superRefine((metadata, context) => {
  for (const key of Object.keys(metadata)) {
    if (SENSITIVE_METADATA_KEY.test(key)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Sensitive metadata key is forbidden: ${key}`,
        path: [key],
      });
    }
  }
});

export const officeEventInputSchema = z.object({
  workspaceId: z.string().trim().min(1).max(160).refine((value) => !/[\u0000-\u001f\u007f]/u.test(value), "workspaceId contains control characters"),
  type: officeEventTypeSchema,
  subject: officeSubjectSchema,
  summary: z.string().trim().min(1).max(320),
  metadata: officeMetadataSchema.default({}),
}).strict();

export const officeEventSchema = officeEventInputSchema.extend({
  schemaVersion: z.literal(OFFICE_EVENT_SCHEMA_VERSION),
  id: z.string().uuid(),
  sequence: z.number().int().positive(),
  occurredAt: z.string().datetime(),
}).strict();

export type OfficeEventInput = z.input<typeof officeEventInputSchema>;
export type OfficeEvent = z.infer<typeof officeEventSchema>;
