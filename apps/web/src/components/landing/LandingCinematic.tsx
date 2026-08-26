import { useEffect } from "react";

const CHAPTERS = [
  { id: "product", index: "00", label: "Вход в орбиту" },
  { id: "features", index: "01", label: "Рабочий контур" },
  { id: "memory", index: "02", label: "AI Memory" },
  { id: "security", index: "03", label: "Контроль данных" },
  { id: "pricing", index: "04", label: "Запуск системы" },
] as const;

type LandingCinematicProps = {
  activeSection: string;
};

/**
 * One shared cinematic layer for the marketing surface.
 *
 * - scroll progress is written once per animation frame;
 * - section reveals animate only transform + opacity;
 * - reduced-motion changes are respected live;
 * - no autoplaying loop is used, so the page becomes still when the user is.
 */
export function LandingCinematic({ activeSection }: LandingCinematicProps) {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".ec-landing");
    if (!root) return;

    const revealTargets = Array.from(
      root.querySelectorAll<HTMLElement>(
        [
          ".ec-landing__trust",
          ".ec-landing__section-grid > *",
          ".ec-landing__memory-grid > *",
          ".ec-landing__security-grid > *",
          ".ec-landing__final > *",
          ".ec-landing__footer > *",
        ].join(","),
      ),
    );
    const sceneTargets = Array.from(
      root.querySelectorAll<HTMLElement>(
        "#features, #memory, #security, .ec-landing__final, .ec-landing__footer",
      ),
    );
    revealTargets.forEach((node, index) => {
      node.classList.add("ec-cine-item");
      node.style.setProperty("--ec-cine-order", String(index % 3));
    });
    sceneTargets.forEach((node) => node.classList.add("ec-cine-scene"));
    const observedTargets = [...revealTargets, ...sceneTargets];

    let frame = 0;
    let pointerFrame = 0;
    let observer: IntersectionObserver | null = null;
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const pointerQuery = window.matchMedia("(hover: hover) and (pointer: fine)");
    const pointer = { shiftX: 0, shiftY: 0, tiltX: 0, tiltY: 0 };

    const commitProgress = () => {
      frame = 0;
      const range = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);
      const progress = Math.min(Math.max(window.scrollY / range, 0), 1);
      root.style.setProperty("--ec-page-progress", progress.toFixed(4));
    };
    const scheduleProgress = () => {
      if (frame === 0) frame = window.requestAnimationFrame(commitProgress);
    };

    const commitPointer = () => {
      pointerFrame = 0;
      root.style.setProperty("--ec-pointer-shift-x", `${pointer.shiftX.toFixed(2)}px`);
      root.style.setProperty("--ec-pointer-shift-y", `${pointer.shiftY.toFixed(2)}px`);
      root.style.setProperty("--ec-pointer-tilt-x", `${pointer.tiltX.toFixed(3)}deg`);
      root.style.setProperty("--ec-pointer-tilt-y", `${pointer.tiltY.toFixed(3)}deg`);
    };
    const schedulePointer = () => {
      if (pointerFrame === 0) pointerFrame = window.requestAnimationFrame(commitPointer);
    };
    const resetPointer = () => {
      pointer.shiftX = 0;
      pointer.shiftY = 0;
      pointer.tiltX = 0;
      pointer.tiltY = 0;
      schedulePointer();
    };
    const handlePointerMove = (event: PointerEvent) => {
      if (
        motionQuery.matches ||
        !pointerQuery.matches ||
        window.innerWidth < 1024 ||
        event.pointerType === "touch"
      ) {
        return;
      }
      const normalizedX = (event.clientX / Math.max(window.innerWidth, 1) - 0.5) * 2;
      const normalizedY = (event.clientY / Math.max(window.innerHeight, 1) - 0.5) * 2;
      pointer.shiftX = normalizedX * 11;
      pointer.shiftY = normalizedY * 8;
      pointer.tiltX = normalizedY * -0.65;
      pointer.tiltY = normalizedX * 0.85;
      schedulePointer();
    };

    const configureReveal = () => {
      observer?.disconnect();
      observer = null;
      root.classList.add("is-cinematic-ready");

      if (motionQuery.matches || typeof IntersectionObserver === "undefined") {
        revealTargets.forEach((node) => node.classList.add("is-cine-visible"));
        sceneTargets.forEach((node) => node.classList.add("is-cine-scene-visible"));
        return;
      }

      observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            const node = entry.target as HTMLElement;
            node.classList.add(
              node.classList.contains("ec-cine-scene")
                ? "is-cine-scene-visible"
                : "is-cine-visible",
            );
            observer?.unobserve(entry.target);
          });
        },
        { rootMargin: "0px 0px -9% 0px", threshold: 0.12 },
      );
      observedTargets.forEach((node) => {
        const visibleClass = node.classList.contains("ec-cine-scene")
          ? "is-cine-scene-visible"
          : "is-cine-visible";
        if (!node.classList.contains(visibleClass)) observer?.observe(node);
      });
    };
    const handleMotionPreference = () => {
      configureReveal();
      if (motionQuery.matches) resetPointer();
    };

    configureReveal();
    commitProgress();
    commitPointer();
    window.addEventListener("scroll", scheduleProgress, { passive: true });
    window.addEventListener("resize", scheduleProgress);
    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    window.addEventListener("blur", resetPointer);
    document.documentElement.addEventListener("mouseleave", resetPointer);
    motionQuery.addEventListener("change", handleMotionPreference);
    pointerQuery.addEventListener("change", resetPointer);

    return () => {
      if (frame !== 0) window.cancelAnimationFrame(frame);
      if (pointerFrame !== 0) window.cancelAnimationFrame(pointerFrame);
      observer?.disconnect();
      window.removeEventListener("scroll", scheduleProgress);
      window.removeEventListener("resize", scheduleProgress);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("blur", resetPointer);
      document.documentElement.removeEventListener("mouseleave", resetPointer);
      motionQuery.removeEventListener("change", handleMotionPreference);
      pointerQuery.removeEventListener("change", resetPointer);
      root.classList.remove("is-cinematic-ready");
      root.style.removeProperty("--ec-page-progress");
      root.style.removeProperty("--ec-pointer-shift-x");
      root.style.removeProperty("--ec-pointer-shift-y");
      root.style.removeProperty("--ec-pointer-tilt-x");
      root.style.removeProperty("--ec-pointer-tilt-y");
      revealTargets.forEach((node) => {
        node.classList.remove("ec-cine-item", "is-cine-visible");
        node.style.removeProperty("--ec-cine-order");
      });
      sceneTargets.forEach((node) => {
        node.classList.remove("ec-cine-scene", "is-cine-scene-visible");
      });
    };
  }, []);

  const chapter = CHAPTERS.find((item) => item.id === activeSection) ?? CHAPTERS[0];

  return (
    <>
      <div className="ec-cinematic-space" aria-hidden>
        <span className="ec-cinematic-space__stars ec-cinematic-space__stars--near" />
        <span className="ec-cinematic-space__stars ec-cinematic-space__stars--far" />
        <span className="ec-cinematic-eclipse">
          <i className="ec-cinematic-eclipse__corona" />
          <i className="ec-cinematic-eclipse__orbit" />
          <i className="ec-cinematic-eclipse__photon ec-cinematic-eclipse__photon--one" />
          <i className="ec-cinematic-eclipse__photon ec-cinematic-eclipse__photon--two" />
          <i className="ec-cinematic-eclipse__lensing" />
          <i className="ec-cinematic-eclipse__flare" />
        </span>
        <span className="ec-cinematic-horizon" />
      </div>

      <aside className="ec-scroll-orbit" data-active={chapter.id} aria-hidden>
        <span className="ec-scroll-orbit__eyebrow">ORBITAL INDEX</span>
        <span className="ec-scroll-orbit__track"><i /></span>
        <span key={`index-${chapter.id}`} className="ec-scroll-orbit__index">{chapter.index}</span>
        <span key={`label-${chapter.id}`} className="ec-scroll-orbit__label">{chapter.label}</span>
      </aside>
    </>
  );
}
