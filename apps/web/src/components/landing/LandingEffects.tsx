import type { CSSProperties, ReactNode } from "react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

/**
 * v1.4.0 wow-pass — 4 cinematic premium effects для landing surfaces.
 *
 * All effects respect prefers-reduced-motion (skip animations).
 * Vanilla — no libraries — keeps bundle compact.
 *
 *   - CursorTrail        — cyan dust trail attached к hero zone
 *   - SplitTextReveal    — letter-by-letter slide-up reveal через IO
 *   - TiltCard           — 3D parallax tilt на mouse position
 *   - MagneticButton     — wrapper translates child slightly towards cursor
 */

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return reduced;
}

/* ───────────────── CursorTrail ─────────────────
 * Canvas-based cyan dust trail. Mount as fixed overlay over hero zone.
 * On mousemove — spawn N particles с velocity + fade. Draw RAF loop.
 *
 * Adapted concept from docs/design/effects/dd/ (grey HSL strands).
 * Recolored to cyan + redesigned as discrete particles вместо strands.
 */
type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  size: number;
};

export function CursorTrail({
  className,
  density = 1,
}: {
  className?: string;
  density?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const rafRef = useRef<number | null>(null);
  const reduced = usePrefersReducedMotion();
  const lastMouseRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (reduced) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = 0;
    let height = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.scale(dpr, dpr);
    };
    resize();

    const handleMove = (event: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      if (x < 0 || y < 0 || x > width || y > height) return;
      lastMouseRef.current = { x, y };
      for (let i = 0; i < density * 2; i++) {
        particlesRef.current.push({
          x,
          y,
          vx: (Math.random() - 0.5) * 0.6,
          vy: (Math.random() - 0.5) * 0.6 - 0.1,
          life: 1,
          size: Math.random() * 2 + 0.6,
        });
      }
      if (particlesRef.current.length > 220) {
        particlesRef.current.splice(0, particlesRef.current.length - 220);
      }
    };

    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      const particles = particlesRef.current;
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.012;
        if (p.life <= 0) {
          particles.splice(i, 1);
          continue;
        }
        const alpha = p.life * 0.7;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(154, 216, 239, ${alpha})`;
        ctx.shadowColor = `rgba(93, 181, 217, ${alpha * 0.9})`;
        ctx.shadowBlur = 12;
        ctx.fill();
      }
      ctx.shadowBlur = 0;
      rafRef.current = window.requestAnimationFrame(draw);
    };

    rafRef.current = window.requestAnimationFrame(draw);
    window.addEventListener("mousemove", handleMove, { passive: true });
    window.addEventListener("resize", resize);

    return () => {
      if (rafRef.current !== null) window.cancelAnimationFrame(rafRef.current);
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("resize", resize);
      particlesRef.current = [];
    };
  }, [density, reduced]);

  if (reduced) return null;
  return (
    <canvas
      ref={canvasRef}
      className={`ec-cursor-trail${className ? ` ${className}` : ""}`}
      aria-hidden
    />
  );
}

/* ───────────────── SplitTextReveal ─────────────────
 * Wrap children text — split by characters, animate slide-up sequentially
 * через IntersectionObserver. Works на H1/H2 strings.
 */
export function SplitTextReveal({
  children,
  delay = 0,
  stagger = 18,
  className,
}: {
  children: string;
  delay?: number;
  stagger?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const [visible, setVisible] = useState(false);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    if (reduced) {
      setVisible(true);
      return;
    }
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisible(true);
            io.disconnect();
          }
        });
      },
      { threshold: 0.2 },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [reduced]);

  const chars = useMemo(() => {
    return Array.from(children);
  }, [children]);

  return (
    <span
      ref={ref}
      className={`ec-split-text${visible ? " is-visible" : ""}${className ? ` ${className}` : ""}`}
      data-text={children}
    >
      {chars.map((char, index) => {
        if (char === "\n") return <br key={index} />;
        if (char === " ") return <span key={index} className="ec-split-text__space"> </span>;
        const style: CSSProperties = {
          "--ec-split-delay": `${delay + index * stagger}ms`,
        } as CSSProperties;
        return (
          <span key={index} className="ec-split-text__char" style={style}>
            {char}
          </span>
        );
      })}
    </span>
  );
}

/* ───────────────── TiltCard ─────────────────
 * 3D parallax tilt wrapper. Mouse-over → rotate transform proportional
 * к cursor offset. На leave → reset через transition.
 *
 * Adapted concept from docs/design/effects/Карточка анимированная паралакс/
 * (was vanilla-tilt.js dep) — rewritten inline vanilla без lib.
 */
export function TiltCard({
  children,
  className,
  intensity = 8,
}: {
  children: ReactNode;
  className?: string;
  intensity?: number;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const reduced = usePrefersReducedMotion();

  const handleMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (reduced || event.pointerType === "touch") return;
      const node = ref.current;
      if (!node) return;
      const rect = node.getBoundingClientRect();
      const px = (event.clientX - rect.left) / rect.width;
      const py = (event.clientY - rect.top) / rect.height;
      const rotX = (0.5 - py) * intensity;
      const rotY = (px - 0.5) * intensity;
      node.style.setProperty("--ec-tilt-rx", `${rotX.toFixed(2)}deg`);
      node.style.setProperty("--ec-tilt-ry", `${rotY.toFixed(2)}deg`);
      node.style.setProperty("--ec-tilt-glow-x", `${(px * 100).toFixed(0)}%`);
      node.style.setProperty("--ec-tilt-glow-y", `${(py * 100).toFixed(0)}%`);
      node.style.setProperty("--ec-tilt-active", "1");
    },
    [intensity, reduced],
  );

  const handleLeave = useCallback(() => {
    const node = ref.current;
    if (!node) return;
    node.style.setProperty("--ec-tilt-rx", "0deg");
    node.style.setProperty("--ec-tilt-ry", "0deg");
    node.style.setProperty("--ec-tilt-active", "0");
  }, []);

  return (
    <div
      ref={ref}
      className={`ec-tilt-card${className ? ` ${className}` : ""}`}
      onPointerMove={handleMove}
      onPointerLeave={handleLeave}
    >
      <div className="ec-tilt-card__inner">{children}</div>
      <div className="ec-tilt-card__glow" aria-hidden />
    </div>
  );
}

/* ───────────────── MagneticButton ─────────────────
 * Wrapper translates child slightly towards cursor (magnetic pull).
 * Reset on leave. Intensity controls translation distance.
 *
 * Pure transform — no library needed.
 */
export function MagneticButton({
  children,
  className,
  intensity = 0.25,
}: {
  children: ReactNode;
  className?: string;
  intensity?: number;
}) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const reduced = usePrefersReducedMotion();

  const handleMove = useCallback(
    (event: React.PointerEvent<HTMLSpanElement>) => {
      if (reduced || event.pointerType === "touch") return;
      const node = ref.current;
      if (!node) return;
      const rect = node.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = (event.clientX - cx) * intensity;
      const dy = (event.clientY - cy) * intensity;
      node.style.setProperty("--ec-magnet-x", `${dx.toFixed(1)}px`);
      node.style.setProperty("--ec-magnet-y", `${dy.toFixed(1)}px`);
    },
    [intensity, reduced],
  );

  const handleLeave = useCallback(() => {
    const node = ref.current;
    if (!node) return;
    node.style.setProperty("--ec-magnet-x", "0px");
    node.style.setProperty("--ec-magnet-y", "0px");
  }, []);

  return (
    <span
      ref={ref}
      className={`ec-magnetic${className ? ` ${className}` : ""}`}
      onPointerMove={handleMove}
      onPointerLeave={handleLeave}
    >
      {children}
    </span>
  );
}
