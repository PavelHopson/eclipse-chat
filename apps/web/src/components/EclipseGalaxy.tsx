import type { CSSProperties } from "react";

type EclipseGalaxyProps = {
  variant?: "auth" | "home" | "shell";
  className?: string;
};

const STREAMS = Array.from({ length: 14 }, (_, index) => ({
  id: index,
  angle: `${index * 25.7}deg`,
  opacity: 0.18 + (index % 5) * 0.05,
  delay: `${index * -260}ms`,
}));
const STARS = Array.from({ length: 18 }, (_, index) => ({
  id: index,
  angle: `${index * 20}deg`,
  distance: `${26 + (index % 9) * 22}px`,
  offset: `${((index % 5) - 2) * 10}px`,
  opacity: 0.2 + (index % 4) * 0.13,
  delay: `${index * -180}ms`,
}));

export function EclipseGalaxy({
  variant = "shell",
  className = "",
}: EclipseGalaxyProps) {
  return (
    <div
      className={`ec-galaxy ec-galaxy--${variant} ${className}`.trim()}
      aria-hidden
    >
      <div className="ec-galaxy__halo" />
      <div className="ec-galaxy__ring ec-galaxy__ring--outer" />
      <div className="ec-galaxy__ring ec-galaxy__ring--inner" />
      <div className="ec-galaxy__core" />
      <div className="ec-galaxy__corona" />
      <div className="ec-galaxy__streams">
        {STREAMS.map((stream) => (
          <span
            key={stream.id}
            style={
              {
                "--stream-angle": stream.angle,
                "--stream-opacity": stream.opacity,
                "--stream-delay": stream.delay,
              } as CSSProperties
            }
          />
        ))}
      </div>
      <div className="ec-galaxy__stars">
        {STARS.map((star) => (
          <span
            key={star.id}
            style={
              {
                "--star-angle": star.angle,
                "--star-distance": star.distance,
                "--star-offset": star.offset,
                "--star-opacity": star.opacity,
                "--star-delay": star.delay,
              } as CSSProperties
            }
          />
        ))}
      </div>
    </div>
  );
}
