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
 *   - CursorLight        — Forge-style gold/blue cursor illumination
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

/* ───────────────── CursorLight ─────────────────
 * Local operational rewrite of Eclipse Forge's cursor light. Three DOM
 * layers follow the pointer at different latencies; only compositor-safe
 * transforms and opacity change per frame. It never mounts for touch,
 * narrow screens or reduced-motion users.
 */
export function CursorLight({ className }: { className?: string }) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const goldRef = useRef<HTMLSpanElement | null>(null);
  const blueRef = useRef<HTMLSpanElement | null>(null);
  const coreRef = useRef<HTMLSpanElement | null>(null);
  const reduced = usePrefersReducedMotion();
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (reduced || typeof window === "undefined") {
      setEnabled(false);
      return;
    }
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
    const update = () => setEnabled(finePointer.matches && window.innerWidth >= 1024);
    update();
    finePointer.addEventListener("change", update);
    window.addEventListener("resize", update);
    return () => {
      finePointer.removeEventListener("change", update);
      window.removeEventListener("resize", update);
    };
  }, [reduced]);

  useEffect(() => {
    if (!enabled) return;
    const root = rootRef.current;
    const gold = goldRef.current;
    const blue = blueRef.current;
    const core = coreRef.current;
    if (!root || !gold || !blue || !core) return;

    let raf = 0;
    let initialized = false;
    const target = { x: -500, y: -500 };
    const slow = { ...target };
    const mid = { ...target };
    const fast = { ...target };
    const place = (node: HTMLElement, point: { x: number; y: number }) => {
      node.style.transform = `translate3d(${point.x}px, ${point.y}px, 0)`;
    };
    const frame = () => {
      slow.x += (target.x - slow.x) * 0.075;
      slow.y += (target.y - slow.y) * 0.075;
      mid.x += (target.x - mid.x) * 0.14;
      mid.y += (target.y - mid.y) * 0.14;
      fast.x += (target.x - fast.x) * 0.34;
      fast.y += (target.y - fast.y) * 0.34;
      place(gold, slow);
      place(blue, mid);
      place(core, fast);
      const remaining = Math.max(
        Math.abs(target.x - slow.x),
        Math.abs(target.y - slow.y),
        Math.abs(target.x - mid.x),
        Math.abs(target.y - mid.y),
        Math.abs(target.x - fast.x),
        Math.abs(target.y - fast.y),
      );
      raf = remaining > 0.1 ? window.requestAnimationFrame(frame) : 0;
    };
    const move = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      target.x = event.clientX;
      target.y = event.clientY;
      if (!initialized) {
        Object.assign(slow, target);
        Object.assign(mid, target);
        Object.assign(fast, target);
        initialized = true;
      }
      root.classList.add("is-visible");
      if (raf === 0) raf = window.requestAnimationFrame(frame);
    };
    const hide = () => root.classList.remove("is-visible");

    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("blur", hide);
    document.documentElement.addEventListener("mouseleave", hide);
    return () => {
      if (raf !== 0) window.cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("blur", hide);
      document.documentElement.removeEventListener("mouseleave", hide);
    };
  }, [enabled]);

  if (!enabled) return null;
  return (
    <div
      ref={rootRef}
      className={`ec-cursor-light${className ? ` ${className}` : ""}`}
      aria-hidden
    >
      <span ref={goldRef} className="ec-cursor-light__gold" />
      <span ref={blueRef} className="ec-cursor-light__blue" />
      <span ref={coreRef} className="ec-cursor-light__core" />
    </div>
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
    const fallback = window.setTimeout(() => setVisible(true), 180);
    if (!node || typeof IntersectionObserver === "undefined") {
      return () => window.clearTimeout(fallback);
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            window.clearTimeout(fallback);
            setVisible(true);
            io.disconnect();
          }
        });
      },
      { threshold: 0.2 },
    );
    io.observe(node);
    return () => {
      window.clearTimeout(fallback);
      io.disconnect();
    };
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
