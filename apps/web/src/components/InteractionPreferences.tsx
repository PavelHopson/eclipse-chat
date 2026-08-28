import { useEffect, useState } from "react";
import { INTERACTION_EVENT, readInteractionPreferences, writeInteractionPreferences } from "../lib/interactionPreferences";
export function InteractionPreferences() {
  const [value, setValue] = useState(readInteractionPreferences);
  useEffect(() => {
    const update = () => setValue(readInteractionPreferences());
    window.addEventListener(INTERACTION_EVENT, update);
    window.addEventListener("storage", update);
    return () => { window.removeEventListener(INTERACTION_EVENT, update); window.removeEventListener("storage", update); };
  }, []);
  return <section className="ec-settings-card ec-settings-card--stack">
    <strong>Эффекты Eclipse</strong>
    <label className="ec-settings-toggle-row"><span>Фирменный курсор</span>
      <input type="checkbox" checked={value.pointer} onChange={e => { const next = { ...value, pointer: e.target.checked }; setValue(next); writeInteractionPreferences(next); }} />
    </label>
    <label className="ec-settings-toggle-row"><span>Анимации интерфейса</span>
      <input type="checkbox" checked={value.motion} onChange={e => { const next = { ...value, motion: e.target.checked }; setValue(next); writeInteractionPreferences(next); }} />
    </label>
    <span className="ec-settings-muted">Системное уменьшение движения имеет приоритет. Подсветка фокуса и состояния кнопок остаются.</span>
  </section>;
}
