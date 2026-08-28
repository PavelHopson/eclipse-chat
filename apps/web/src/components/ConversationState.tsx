import { EclipseUiIcon } from "./icons/EclipseUiIcon";

export function ConversationState({ kind, title, detail, onRetry, actionLabel = "Повторить" }: {
  kind: "loading" | "empty" | "error"; title: string; detail?: string; onRetry?: () => void; actionLabel?: string;
}) {
  return <div className={"ec-conversation-state ec-conversation-state--" + kind} role={kind === "error" ? "alert" : "status"}>
    {kind === "loading" ? <div className="ec-conversation-skeleton" aria-hidden><span /><span /><span /></div>
      : <EclipseUiIcon name={kind === "error" ? "risk" : "chat"} size={24} />}
    <strong>{title}</strong>
    {detail && <p>{detail}</p>}
    {onRetry && <button type="button" onClick={onRetry}>{actionLabel}</button>}
  </div>;
}
