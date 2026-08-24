import type { OfficeEventInput } from "./contracts.js";
import {
  enqueueAndDispatchOfficeEvent,
  enqueueOfficeEventOutboxWithClient,
} from "./outbox.js";

const GROWTH_OFFICE_PRODUCER = "growth-command-room";

type GrowthEventContext = {
  workspaceId: string;
  runId: string;
  releaseName: string;
};

export function growthTaskCreatedInput(
  context: GrowthEventContext,
  origin: "chat" | "import",
): OfficeEventInput {
  return {
    workspaceId: context.workspaceId,
    type: "task.created",
    subject: { kind: "task", id: context.runId },
    summary: "Growth: создана задача «" + context.releaseName + "»",
    metadata: { departmentId: "growth", origin },
  };
}

export function growthTaskStartedInput(
  context: GrowthEventContext,
  step: string,
  role: string,
): OfficeEventInput {
  return {
    workspaceId: context.workspaceId,
    type: "task.started",
    subject: { kind: "run", id: context.runId },
    summary: role + " начал этап «" + step + "»",
    metadata: { departmentId: "growth", step, role },
  };
}

export function growthTaskProgressedInput(
  context: GrowthEventContext,
  step: string,
  role: string,
  completed: number,
  total: number,
): OfficeEventInput {
  return {
    workspaceId: context.workspaceId,
    type: completed >= total ? "approval.requested" : "task.progressed",
    subject: { kind: completed >= total ? "approval" : "run", id: context.runId },
    summary: completed >= total
      ? "«" + context.releaseName + "» готово к ручной проверке"
      : role + " завершил этап «" + step + "»",
    metadata: { departmentId: "growth", step, role, completed, total },
  };
}

export function growthTaskCancelledInput(
  context: GrowthEventContext,
  step: string,
): OfficeEventInput {
  return {
    workspaceId: context.workspaceId,
    type: "task.cancelled",
    subject: { kind: "run", id: context.runId },
    summary: "Этап «" + step + "» остановлен оператором",
    metadata: { departmentId: "growth", step },
  };
}

export function growthApprovalResolvedInput(
  context: GrowthEventContext,
  decision: "APPROVED" | "REJECTED",
): OfficeEventInput {
  return {
    workspaceId: context.workspaceId,
    type: "approval.resolved",
    subject: { kind: "approval", id: context.runId },
    summary: decision === "APPROVED"
      ? "«" + context.releaseName + "» утверждено человеком"
      : "«" + context.releaseName + "» возвращено на доработку",
    metadata: { departmentId: "growth", decision },
  };
}

function enqueueGrowthInput(client: unknown, input: OfficeEventInput): Promise<string> {
  return enqueueOfficeEventOutboxWithClient(client, {
    producerId: GROWTH_OFFICE_PRODUCER,
    input,
  });
}

function publishGrowthInput(input: OfficeEventInput): Promise<boolean> {
  return enqueueAndDispatchOfficeEvent({
    producerId: GROWTH_OFFICE_PRODUCER,
    input,
  });
}

export function enqueueGrowthTaskCreated(
  client: unknown,
  context: GrowthEventContext,
  origin: "chat" | "import",
): Promise<string> {
  return enqueueGrowthInput(client, growthTaskCreatedInput(context, origin));
}

export function enqueueGrowthTaskStarted(
  client: unknown,
  context: GrowthEventContext,
  step: string,
  role: string,
): Promise<string> {
  return enqueueGrowthInput(client, growthTaskStartedInput(context, step, role));
}

export function enqueueGrowthTaskCancelled(
  client: unknown,
  context: GrowthEventContext,
  step: string,
): Promise<string> {
  return enqueueGrowthInput(client, growthTaskCancelledInput(context, step));
}
export function enqueueGrowthTaskProgressed(
  client: unknown,
  context: GrowthEventContext,
  step: string,
  role: string,
  completed: number,
  total: number,
): Promise<string> {
  return enqueueGrowthInput(
    client,
    growthTaskProgressedInput(context, step, role, completed, total),
  );
}

export function enqueueGrowthApprovalResolved(
  client: unknown,
  context: GrowthEventContext,
  decision: "APPROVED" | "REJECTED",
): Promise<string> {
  return enqueueGrowthInput(client, growthApprovalResolvedInput(context, decision));
}

export function publishGrowthTaskCreated(
  context: GrowthEventContext,
  origin: "chat" | "import",
): Promise<boolean> {
  return publishGrowthInput(growthTaskCreatedInput(context, origin));
}

export function publishGrowthTaskStarted(
  context: GrowthEventContext,
  step: string,
  role: string,
): Promise<boolean> {
  return publishGrowthInput(growthTaskStartedInput(context, step, role));
}

export function publishGrowthTaskProgressed(
  context: GrowthEventContext,
  step: string,
  role: string,
  completed: number,
  total: number,
): Promise<boolean> {
  return publishGrowthInput(growthTaskProgressedInput(context, step, role, completed, total));
}

export function publishGrowthTaskCancelled(
  context: GrowthEventContext,
  step: string,
): Promise<boolean> {
  return publishGrowthInput(growthTaskCancelledInput(context, step));
}

export function publishGrowthApprovalResolved(
  context: GrowthEventContext,
  decision: "APPROVED" | "REJECTED",
): Promise<boolean> {
  return publishGrowthInput(growthApprovalResolvedInput(context, decision));
}