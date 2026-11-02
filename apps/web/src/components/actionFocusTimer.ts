export function focusRemainingMs(deadlineMs: number, nowMs: number): number {
  return Math.max(0, deadlineMs - nowMs);
}

export function focusDeadlineMs(nowMs: number, remainingMs: number): number {
  return nowMs + Math.max(0, remainingMs);
}

export function focusElapsedMs(durationMs: number, remainingMs: number): number {
  return Math.max(0, Math.min(durationMs, durationMs - remainingMs));
}
