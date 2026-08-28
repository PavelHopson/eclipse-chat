import type { ConversationConnection } from "../hooks/useConversationConnection";
import { EclipseUiIcon } from "./icons/EclipseUiIcon";

export function ConnectionNotice({ state, onRetry }: { state: ConversationConnection; onRetry: () => void }) {
  if (state === "online") return null;
  const recovered = state === "recovered";
  const title = recovered ? "Соединение восстановлено" : state === "offline" ? "Нет подключения к интернету" : state === "connecting" ? "Подключаемся к пространству…" : "Восстанавливаем соединение…";
  return <div className={"ec-connection-notice" + (recovered ? " is-recovered" : "")} role="status" aria-live="polite">
    <EclipseUiIcon name={recovered ? "check" : "orbit"} size={17} />
    <span><strong>{title}</strong>{!recovered && <small>Можно продолжать писать. Отправка — после подключения.</small>}</span>
    {!recovered && <button type="button" onClick={onRetry}>Повторить</button>}
  </div>;
}
