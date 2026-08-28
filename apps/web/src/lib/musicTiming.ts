/** Server clock at receipt + monotonic elapsed time, not the listener's wall clock. */
export function sessionPositionMs(session: {
  isPlaying: boolean; positionMs: number; startedAt: string | null; serverNow?: string;
}, fallbackNow = Date.now()): number {
  const offset = Number.isFinite(session.positionMs) ? Math.max(0, session.positionMs) : 0;
  if (!session.isPlaying || !session.startedAt) return offset;
  const start = Date.parse(session.startedAt);
  const server = session.serverNow ? Date.parse(session.serverNow) : fallbackNow;
  if (!Number.isFinite(start) || !Number.isFinite(server)) return offset;
  return Math.max(0, offset + server - start);
}

export function boundedMediaPosition(position: number, duration?: number | null): number {
  const value = Number.isFinite(position) ? Math.max(0, position) : 0;
  return duration != null && Number.isFinite(duration) && duration > 0 ? Math.min(value, duration) : value;
}

export function mediaClock(position: number, duration?: number | null): string {
  const seconds = Math.floor(boundedMediaPosition(position, duration) / 1000);
  return Math.floor(seconds / 60) + ":" + String(seconds % 60).padStart(2, "0");
}
