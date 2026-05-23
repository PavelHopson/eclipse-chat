import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

export const CINE_EASING = {
  calmOut: "cubic-bezier(0.16, 1, 0.3, 1)",
  calmInOut: "cubic-bezier(0.65, 0, 0.35, 1)",
  orbital: "cubic-bezier(0.22, 1, 0.36, 1)",
} as const;

export const CINE_DURATION = {
  fast: 220,
  base: 480,
  slow: 1200,
  orbital: 32000,
} as const;

export const CINE_STAGGER = {
  compact: 70,
  relaxed: 120,
  section: 160,
} as const;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

type RevealTag =
  | "div"
  | "section"
  | "article"
  | "header"
  | "footer"
  | "nav"
  | "aside"
  | "ul";

type RevealVariant = "fade" | "rise" | "panel";

type RevealProps = HTMLAttributes<HTMLElement> & {
  as?: RevealTag;
  children: ReactNode;
  className?: string;
  delay?: number;
  once?: boolean;
  threshold?: number;
  variant?: RevealVariant;
};

function joinClasses(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export function revealDelay(index: number, step: number = CINE_STAGGER.compact): CSSProperties {
  return { "--ec-cine-delay": `${index * step}ms` } as CSSProperties;
}

export function Reveal({
  as = "div",
  children,
  className,
  delay = 0,
  once = true,
  threshold = 0.18,
  variant = "rise",
  style,
  ...rest
}: RevealProps) {
  const ref = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(prefersReducedMotion());
  const Tag = as;

  useEffect(() => {
    if (visible || typeof IntersectionObserver === "undefined") return;
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          setVisible(true);
          if (once) observer.disconnect();
        });
      },
      { threshold },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [once, threshold, visible]);

  return (
    <Tag
      ref={ref as never}
      className={joinClasses("ec-cine-reveal", `ec-cine-reveal--${variant}`, className)}
      data-visible={visible ? "true" : "false"}
      style={
        {
          "--ec-cine-delay": `${delay}ms`,
          ...style,
        } as CSSProperties
      }
      {...rest}
    >
      {children}
    </Tag>
  );
}

type OrbitalSurfaceTag = "div" | "article" | "section" | "aside";

type OrbitalSurfaceProps = HTMLAttributes<HTMLElement> & {
  as?: OrbitalSurfaceTag;
  children: ReactNode;
  className?: string;
  intensity?: number;
};

export function OrbitalSurface({
  as = "div",
  children,
  className,
  intensity = 5,
  onPointerLeave,
  onPointerMove,
  ...rest
}: OrbitalSurfaceProps) {
  const ref = useRef<HTMLElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const reducedMotionRef = useRef(prefersReducedMotion());
  const Tag = as;

  const stateRef = useRef({
    glowX: 50,
    glowY: 50,
    tiltX: 0,
    tiltY: 0,
  });

  useEffect(() => {
    return () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
      }
    };
  }, []);

  const commitFrame = () => {
    frameRef.current = null;
    const node = ref.current;
    if (!node) return;
    const { glowX, glowY, tiltX, tiltY } = stateRef.current;
    node.style.setProperty("--ec-orbit-glow-x", `${glowX}%`);
    node.style.setProperty("--ec-orbit-glow-y", `${glowY}%`);
    node.style.setProperty("--ec-orbit-tilt-x", `${tiltX.toFixed(2)}deg`);
    node.style.setProperty("--ec-orbit-tilt-y", `${tiltY.toFixed(2)}deg`);
  };

  const scheduleCommit = () => {
    if (frameRef.current !== null) return;
    frameRef.current = window.requestAnimationFrame(commitFrame);
  };

  const handlePointerMove: React.PointerEventHandler<HTMLElement> = (event) => {
    onPointerMove?.(event);
    if (reducedMotionRef.current || event.pointerType === "touch") return;
    const node = ref.current;
    if (!node) return;

    const rect = node.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const px = Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 1);
    const py = Math.min(Math.max((event.clientY - rect.top) / rect.height, 0), 1);

    stateRef.current = {
      glowX: px * 100,
      glowY: py * 100,
      tiltX: (0.5 - py) * intensity,
      tiltY: (px - 0.5) * intensity,
    };
    scheduleCommit();
  };

  const handlePointerLeave: React.PointerEventHandler<HTMLElement> = (event) => {
    onPointerLeave?.(event);
    stateRef.current = {
      glowX: 50,
      glowY: 50,
      tiltX: 0,
      tiltY: 0,
    };
    scheduleCommit();
  };

  return (
    <Tag
      ref={ref as never}
      className={joinClasses("ec-cine-orbital-surface", className)}
      data-orbital="true"
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      {...rest}
    >
      {children}
    </Tag>
  );
}

type SignalDotProps = {
  className?: string;
  tone?: "signal" | "active" | "amber" | "idle";
};

export function SignalDot({ className, tone = "signal" }: SignalDotProps) {
  return <span className={joinClasses("ec-cine-signal-dot", `ec-cine-signal-dot--${tone}`, className)} aria-hidden />;
}
