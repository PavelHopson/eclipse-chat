/** Shared presentation limits. Media positions never exceed known duration. */
export function mediaTime(ms: number): string {
  const seconds = Math.floor(Math.max(0, Number.isFinite(ms) ? ms : 0) / 1000);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor(seconds / 60) % 60;
  const tail = String(seconds % 60).padStart(2, "0");
  return hours ? hours + ":" + String(minutes).padStart(2, "0") + ":" + tail : minutes + ":" + tail;
}

export function boundedSeek(ms: number, duration: number): number {
  if (!Number.isFinite(duration) || duration <= 0) return 0;
  return Math.min(duration, Math.max(0, Number.isFinite(ms) ? ms : 0));
}

export function preferredAudioChatWidth(roomWidth: number, compact: boolean): number {
  return compact ? Math.min(820, roomWidth - 260) : roomWidth * .48;
}

export type QueueEdit = { expectedQueue: string[]; from: number; to?: number; action: "move" | "remove" };
