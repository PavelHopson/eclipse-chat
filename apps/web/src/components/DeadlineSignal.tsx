import type { CSSProperties } from "react";

type DeadlineSignalProps = {
  label: string;
  color: string;
  overdue: boolean;
  dueAt: string | null;
};

function urgency(dueAt: string | null, overdue: boolean): number {
  if (!dueAt) return 0.25;
  if (overdue) return 1;
  const hoursLeft = (new Date(dueAt).getTime() - Date.now()) / 3_600_000;
  if (hoursLeft <= 3) return 0.88;
  if (hoursLeft <= 12) return 0.72;
  if (hoursLeft <= 24) return 0.56;
  if (hoursLeft <= 72) return 0.38;
  return 0.22;
}

export function DeadlineSignal({
  label,
  color,
  overdue,
  dueAt,
}: DeadlineSignalProps) {
  const value = urgency(dueAt, overdue);
  const dash = Math.round(28 * value);
  const readableDate = dueAt
    ? new Date(dueAt).toLocaleString("ru-RU", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : label;

  return (
    <span
      className={`ec-deadline-signal${overdue ? " ec-deadline-signal--overdue" : ""}`}
      style={
        {
          "--deadline-color": color,
          "--deadline-dash": dash,
        } as CSSProperties
      }
      title={`Дедлайн: ${readableDate}`}
    >
      <span className="ec-deadline-signal__ring" aria-hidden>
        <svg viewBox="0 0 12 12">
          <circle cx="6" cy="6" r="4.5" />
          <circle cx="6" cy="6" r="4.5" pathLength="28" />
        </svg>
      </span>
      <span>{label}</span>
    </span>
  );
}
