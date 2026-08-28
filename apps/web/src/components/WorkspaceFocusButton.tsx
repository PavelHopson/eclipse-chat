import { EclipseUiIcon } from "./icons/EclipseUiIcon";

export function WorkspaceFocusButton({ active, onToggle }: { active: boolean; onToggle: () => void }) {
  return <button type="button" className="ec-workspace-focus" aria-pressed={active} onClick={onToggle}
    title={active ? "Вернуть боковые панели" : "Освободить место для переписки"}>
    <EclipseUiIcon name={active ? "collapse" : "expand"} size={17} />
    <span>{active ? "Вернуть панели" : "Фокус"}</span>
  </button>;
}
