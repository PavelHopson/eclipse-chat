import type { OfficeEventInput } from "./contracts.js";
import { enqueueOfficeEventOutboxWithClient } from "./outbox.js";

const CREATIVE_OFFICE_PRODUCER = "creative-studio";

type CreativeEventContext = {
  workspaceId: string;
  jobId: string;
  title: string;
};

function input(
  context: CreativeEventContext,
  type: OfficeEventInput["type"],
  subject: OfficeEventInput["subject"],
  summary: string,
  metadata: OfficeEventInput["metadata"],
): OfficeEventInput {
  return {
    workspaceId: context.workspaceId,
    type,
    subject,
    summary,
    metadata: { departmentId: "creative", ...metadata },
  };
}

export function creativeTaskCreatedInput(context: CreativeEventContext, mode: "preview" | "higgsfield"): OfficeEventInput {
  return input(
    context,
    "task.created",
    { kind: "task", id: context.jobId },
    `Creative Studio: создано задание «${context.title}»`,
    { mode },
  );
}

export function creativeApprovalRequestedInput(context: CreativeEventContext, credits: number): OfficeEventInput {
  return input(
    context,
    "approval.requested",
    { kind: "approval", id: context.jobId },
    `«${context.title}» ожидает ручного подтверждения`,
    { quotedCredits: credits },
  );
}

export function creativeApprovalResolvedInput(context: CreativeEventContext, decision: "APPROVED" | "REJECTED"): OfficeEventInput {
  return input(
    context,
    "approval.resolved",
    { kind: "approval", id: context.jobId },
    decision === "APPROVED"
      ? `«${context.title}» подтверждено человеком`
      : `«${context.title}» возвращено на доработку`,
    { decision },
  );
}

export function creativeTaskStartedInput(context: CreativeEventContext): OfficeEventInput {
  return input(
    context,
    "task.started",
    { kind: "run", id: context.jobId },
    `Creative Studio начал подготовку «${context.title}»`,
    { mode: "preview" },
  );
}

export function creativeDeliverableReadyInput(context: CreativeEventContext, filename: string): OfficeEventInput {
  return input(
    context,
    "deliverable.ready",
    { kind: "deliverable", id: context.jobId },
    `Проверочный пакет «${context.title}» готов`,
    { artifactKind: "brief-package", filename },
  );
}

export function enqueueCreativeEvent(client: unknown, event: OfficeEventInput): Promise<string> {
  return enqueueOfficeEventOutboxWithClient(client, {
    producerId: CREATIVE_OFFICE_PRODUCER,
    input: event,
  });
}
