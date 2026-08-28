export const INTERACTION_EVENT = "ec:interaction-preferences";
const KEY = "ec.interactions.v1";
export type InteractionPreferences = { pointer: boolean; motion: boolean };
let memoryOverride: InteractionPreferences | null = null;
export function readInteractionPreferences(): InteractionPreferences {
  if (memoryOverride) return memoryOverride;
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    return { pointer: saved.pointer !== false, motion: saved.motion !== false };
  } catch { return { pointer: true, motion: true }; }
}
export function writeInteractionPreferences(value: InteractionPreferences) {
  try { localStorage.setItem(KEY, JSON.stringify(value)); memoryOverride = null; }
  catch { memoryOverride = value; }
  window.dispatchEvent(new CustomEvent(INTERACTION_EVENT, { detail: value }));
}
