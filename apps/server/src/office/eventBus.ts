import { randomUUID } from "node:crypto";
import {
  OFFICE_EVENT_SCHEMA_VERSION,
  officeEventInputSchema,
  officeEventSchema,
  type OfficeEvent,
  type OfficeEventInput,
} from "./contracts.js";

export class OfficeEventValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OfficeEventValidationError";
  }
}

export class TenantOfficeEventBus {
  readonly #capacityPerWorkspace: number;
  readonly #events = new Map<string, OfficeEvent[]>();
  readonly #sequences = new Map<string, number>();

  constructor(capacityPerWorkspace = 500) {
    if (!Number.isInteger(capacityPerWorkspace) || capacityPerWorkspace < 10 || capacityPerWorkspace > 5_000) {
      throw new Error("Office event retention must be between 10 and 5000 events per workspace");
    }
    this.#capacityPerWorkspace = capacityPerWorkspace;
  }

  publish(input: OfficeEventInput): OfficeEvent {
    const parsed = officeEventInputSchema.safeParse(input);
    if (!parsed.success) {
      throw new OfficeEventValidationError(parsed.error.issues[0]?.message ?? "Invalid office event");
    }
    const nextSequence = (this.#sequences.get(parsed.data.workspaceId) ?? 0) + 1;
    const event = officeEventSchema.parse({
      ...parsed.data,
      schemaVersion: OFFICE_EVENT_SCHEMA_VERSION,
      id: randomUUID(),
      sequence: nextSequence,
      occurredAt: new Date().toISOString(),
    });
    const workspaceEvents = this.#events.get(event.workspaceId) ?? [];
    workspaceEvents.push(event);
    if (workspaceEvents.length > this.#capacityPerWorkspace) {
      workspaceEvents.splice(0, workspaceEvents.length - this.#capacityPerWorkspace);
    }
    this.#events.set(event.workspaceId, workspaceEvents);
    this.#sequences.set(event.workspaceId, nextSequence);
    return event;
  }

  list(workspaceId: string, options: { after?: number; limit?: number } = {}): OfficeEvent[] {
    const after = Number.isInteger(options.after) && (options.after ?? 0) >= 0 ? options.after ?? 0 : 0;
    const limit = Number.isInteger(options.limit) && (options.limit ?? 0) > 0
      ? Math.min(options.limit ?? 50, 100)
      : 50;
    return (this.#events.get(workspaceId) ?? [])
      .filter((event) => event.sequence > after)
      .slice(0, limit);
  }

  cursor(workspaceId: string): number {
    return this.#sequences.get(workspaceId) ?? 0;
  }

  clearForTests(): void {
    this.#events.clear();
    this.#sequences.clear();
  }
}

export const officeEventBus = new TenantOfficeEventBus();
