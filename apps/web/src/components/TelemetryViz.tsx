/**
 * v1.5.2 — telemetry visual primitives для topbar pills.
 *
 *   - Sparkline: SVG mini line chart (последние N значений).
 *     Auto-scaled vertically, smooth path с last point dot indicator.
 *   - NetworkWave: animated cyan bars (3-5 bars rising/falling) для
 *     СЕТЬ pill, indicates live network heartbeat.
 */

export function Sparkline({
  values,
  width = 36,
  height = 12,
  color = "currentColor",
}: {
  values: number[];
  width?: number;
  height?: number;
  color?: string;
}) {
  if (values.length < 2) {
    return (
      <span
        className="ec-sparkline ec-sparkline--empty"
        aria-hidden
        style={{ display: "inline-block", width, height, opacity: 0.4 }}
      />
    );
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const step = width / (values.length - 1);
  const points = values
    .map((v, i) => {
      const x = i * step;
      const y = height - ((v - min) / range) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const lastX = (values.length - 1) * step;
  const lastY = height - ((values[values.length - 1] - min) / range) * height;
  return (
    <svg
      className="ec-sparkline"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden
    >
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.85"
      />
      <circle
        cx={lastX}
        cy={lastY}
        r="1.8"
        fill={color}
      >
        <animate
          attributeName="r"
          values="1.4;2.4;1.4"
          dur="2s"
          repeatCount="indefinite"
        />
      </circle>
    </svg>
  );
}

export function NetworkWave({ active = true }: { active?: boolean }) {
  return (
    <span className={`ec-net-wave${active ? " is-active" : ""}`} aria-hidden>
      <span className="ec-net-wave__bar" />
      <span className="ec-net-wave__bar" />
      <span className="ec-net-wave__bar" />
      <span className="ec-net-wave__bar" />
    </span>
  );
}
