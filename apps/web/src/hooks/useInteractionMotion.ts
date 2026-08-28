import { useEffect, useState } from "react";
import { INTERACTION_EVENT, readInteractionPreferences } from "../lib/interactionPreferences";

/** Decorative work stops in hidden tabs and respects both user and OS preferences. */
export function useInteractionMotion() {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setEnabled(!document.hidden && !reduced.matches && readInteractionPreferences().motion);
    update();
    reduced.addEventListener("change", update);
    document.addEventListener("visibilitychange", update);
    window.addEventListener(INTERACTION_EVENT, update);
    window.addEventListener("storage", update);
    return () => {
      reduced.removeEventListener("change", update);
      document.removeEventListener("visibilitychange", update);
      window.removeEventListener(INTERACTION_EVENT, update);
      window.removeEventListener("storage", update);
    };
  }, []);
  return enabled;
}
