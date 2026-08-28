import { z } from "zod";

const common = { expectedQueue: z.array(z.string().min(1).max(128)).max(1000), from: z.number().int().min(0).max(999) };
export const queueEditBody = z.discriminatedUnion("action", [
  z.object({ ...common, action: z.literal("remove") }).strict(),
  z.object({ ...common, action: z.literal("move"), to: z.number().int().min(0).max(999) }).strict(),
]);
export type QueueEdit = z.infer<typeof queueEditBody>;

/** Compare exact occurrences: duplicate attachment IDs are separate queue entries. */
export function editMusicQueue(queue: string[], edit: QueueEdit): string[] | null {
  if (queue.length !== edit.expectedQueue.length || queue.some((id, i) => id !== edit.expectedQueue[i])) return null;
  if (edit.from >= queue.length || edit.action === "move" && edit.to >= queue.length) return null;
  const next = [...queue];
  const [item] = next.splice(edit.from, 1);
  if (edit.action === "move") next.splice(edit.to, 0, item);
  return next;
}
