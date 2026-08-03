import { useState } from "react";
import type {
  PersonalDigest,
  PersonalDigestItem,
  PersonalDigestLiveCall,
} from "../hooks/usePersonalDigest";
import {
  isActionableDigestItem,
  type CommandInboxApproval,
} from "../hooks/useCommandInbox";

type Props = {
  data: PersonalDigest | null;
  approvals: CommandInboxApproval[];
  currentUserId: string;
  loading: boolean;
  error: string | null;
  notice: string | null;
  approvalBusyId: string | null;
  actionBusyId: string | null;
  onReload: () => void;
  onOpenItem: (item: PersonalDigestItem) => void;
  onClaimItem: (item: PersonalDigestItem) => Promise<boolean>;
  onApprove: (approval: CommandInboxApproval) => Promise<boolean>;
  onReject: (approval: CommandInboxApproval) => Promise<boolean>;
  onOpenApprovalSource: (approval: CommandInboxApproval) => void;
  onJoinCall: (call: PersonalDigestLiveCall) => Promise<boolean>;
  onOpenNotificationSettings: () => void;
};

function actionCountLabel(count: number): string {
  const lastTwo = count % 100;
  const last = count % 10;
  if (lastTwo >= 11 && lastTwo <= 14) return `${count} действий`;
  if (last === 1) return `${count} действие`;
  if (last >= 2 && last <= 4) return `${count} действия`;
  return `${count} действий`;
}

function relativeTime(iso: string): string {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60_000));
  if (minutes < 1) return "сейчас";
  if (minutes < 60) return `${minutes} мин`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ч`;
  return `${Math.floor(hours / 24)} дн.`;
}

function commandFor(item: PersonalDigestItem): {
  label: string;
  eyebrow: string;
  tone: string;
  claim: boolean;
} {
  if (item.kind === "APPROVAL") {
    return { label: "Принять решение", eyebrow: "Нужно ваше решение", tone: "critical", claim: false };
  }
  if (item.actionStatus === "REVIEW") {
    return { label: "Проверить результат", eyebrow: "Готово к проверке", tone: "review", claim: false };
  }
  if (
    item.actionItemId &&
    item.actionStatus === "OPEN" &&
    item.assigneeUserId === null &&
    (item.kind === "TASK" || item.kind === "FOLLOW_UP")
  ) {
    return { label: "Взять задачу", eyebrow: "Нужен ответственный", tone: "assign", claim: true };
  }
  if (item.kind === "ROOM_ACTIVITY") {
    return { label: "Ответить в комнате", eyebrow: "Ждёт ответа", tone: "answer", claim: false };
  }
  return { label: "Разобрать сигнал", eyebrow: "Требует внимания", tone: "risk", claim: false };
}

function CardIcon({ kind }: { kind: "approval" | "assign" | "answer" | "review" | "call" | "risk" }) {
  if (kind === "call") {
    return <svg viewBox="0 0 24 24" aria-hidden><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H11l-5.5 4v-4A2.5 2.5 0 0 1 3 13.5v-8Z" /><path d="M9 9.5h6M12 6.5v6" /></svg>;
  }
  if (kind === "approval" || kind === "review") {
    return <svg viewBox="0 0 24 24" aria-hidden><path d="M5 12.5 9.2 17 19 7" /></svg>;
  }
  if (kind === "assign") {
    return <svg viewBox="0 0 24 24" aria-hidden><circle cx="9" cy="8" r="3" /><path d="M3.5 19a5.5 5.5 0 0 1 11 0M18 8v6M15 11h6" /></svg>;
  }
  if (kind === "answer") {
    return <svg viewBox="0 0 24 24" aria-hidden><path d="M20 15a2 2 0 0 1-2 2H8l-4 3V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9Z" /></svg>;
  }
  return <svg viewBox="0 0 24 24" aria-hidden><path d="M12 3 2.8 20h18.4L12 3Z" /><path d="M12 9v5M12 17.5h.01" /></svg>;
}

export function MobileCommandInbox({
  data,
  approvals,
  currentUserId,
  loading,
  error,
  notice,
  approvalBusyId,
  actionBusyId,
  onReload,
  onOpenItem,
  onClaimItem,
  onApprove,
  onReject,
  onOpenApprovalSource,
  onJoinCall,
  onOpenNotificationSettings,
}: Props) {
  const [joiningCallId, setJoiningCallId] = useState<string | null>(null);
  const digestItems = data?.priorityItems.filter((item) =>
    isActionableDigestItem(item, currentUserId),
  ) ?? [];
  const liveCalls = data?.liveCalls ?? [];
  const total = approvals.length + digestItems.length + liveCalls.length;

  return (
    <main className="ec-command-inbox" aria-labelledby="command-inbox-title">
      <header className="ec-command-inbox__header">
        <div className="ec-command-inbox__signal" aria-hidden><span /></div>
        <div>
          <span className="ec-command-inbox__eyebrow">Command inbox</span>
          <h1 id="command-inbox-title">Что требует решения</h1>
          <p>{total > 0 ? `${actionCountLabel(total)} собрано по приоритету` : "Сейчас ничего срочного"}</p>
        </div>
        <button type="button" className="ec-command-inbox__refresh" onClick={onReload} disabled={loading}>
          {loading ? "Обновляю…" : "Обновить"}
        </button>
      </header>

      {(error || notice) && (
        <div className={`ec-command-inbox__feedback${error ? " is-error" : " is-success"}`} role={error ? "alert" : "status"} aria-live="polite">
          {error ?? notice}
        </div>
      )}

      {loading && !data ? (
        <div className="ec-command-inbox__loading" role="status">
          <span aria-hidden />
          <strong>Собираю только доступные вам действия…</strong>
        </div>
      ) : total === 0 ? (
        <section className="ec-command-inbox__empty">
          <div className="ec-command-inbox__empty-orbit" aria-hidden />
          <h2>Всё разобрано</h2>
          <p>Новые решения, ответы и активные звонки появятся здесь автоматически.</p>
          <button type="button" className="ec-btn ec-btn--primary" onClick={onReload}>Проверить сейчас</button>
        </section>
      ) : (
        <section className="ec-command-inbox__queue" aria-label="Очередь действий">
          {approvals.map((approval) => {
            const busy = approvalBusyId === approval.id;
            return (
              <article key={`bot:${approval.id}`} className="ec-command-card is-critical">
                <div className="ec-command-card__top">
                  <span className="ec-command-card__icon"><CardIcon kind="approval" /></span>
                  <div>
                    <span className="ec-command-card__eyebrow">AI просит разрешение</span>
                    <h2>Изменить таблицу «{approval.preview.tableName}»</h2>
                  </div>
                  <time dateTime={approval.expiresAt}>до {new Date(approval.expiresAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}</time>
                </div>
                <p className="ec-command-card__context">{approval.serverName}{approval.sourceChannelName ? ` · #${approval.sourceChannelName}` : ""} · агент {approval.botName}</p>
                <div className="ec-command-card__preview" aria-label="Точные изменения">
                  {approval.preview.updates.slice(0, 4).map((update, index) => (
                    <div key={`${update.fieldName}-${index}`}><span>{update.fieldName}</span><code>{update.value || "(пусто)"}</code></div>
                  ))}
                </div>
                <div className="ec-command-card__actions">
                  <button type="button" className="ec-btn ec-btn--primary" onClick={() => void onApprove(approval)} disabled={Boolean(approvalBusyId)}>
                    {busy ? "Выполняю…" : "Разрешить изменение"}
                  </button>
                  <button type="button" className="ec-command-card__secondary" onClick={() => void onReject(approval)} disabled={Boolean(approvalBusyId)}>Отклонить</button>
                  {approval.sourceChannelId && <button type="button" className="ec-command-card__source" onClick={() => onOpenApprovalSource(approval)}>Открыть источник</button>}
                </div>
              </article>
            );
          })}

          {liveCalls.map((call) => {
            const joining = joiningCallId === call.channelId;
            return (
              <article key={`call:${call.channelId}`} className="ec-command-card is-call">
                <div className="ec-command-card__top">
                  <span className="ec-command-card__icon"><CardIcon kind="call" /></span>
                  <div>
                    <span className="ec-command-card__eyebrow">Прямой эфир</span>
                    <h2>#{call.channelName}</h2>
                  </div>
                  <span className="ec-command-card__live"><i /> LIVE</span>
                </div>
                <p className="ec-command-card__context">{call.serverName} · {call.participantCount} в эфире{call.participantNames.length > 0 ? ` · ${call.participantNames.join(", ")}` : ""}</p>
                <div className="ec-command-card__actions">
                  <button
                    type="button"
                    className="ec-btn ec-btn--primary"
                    disabled={joiningCallId !== null}
                    onClick={async () => {
                      setJoiningCallId(call.channelId);
                      try {
                        await onJoinCall(call);
                      } finally {
                        setJoiningCallId(null);
                      }
                    }}
                  >
                    {joining ? "Подключаю…" : call.joined ? "Вернуться в эфир" : "Присоединиться"}
                  </button>
                </div>
              </article>
            );
          })}

          {digestItems.map((item) => {
            const command = commandFor(item);
            const busy = item.actionItemId ? actionBusyId === item.actionItemId : false;
            const iconKind = command.tone === "critical" ? "approval" : command.tone === "review" ? "review" : command.tone === "assign" ? "assign" : command.tone === "answer" ? "answer" : "risk";
            return (
              <article key={item.id} className={`ec-command-card is-${command.tone}`}>
                <div className="ec-command-card__top">
                  <span className="ec-command-card__icon"><CardIcon kind={iconKind} /></span>
                  <div>
                    <span className="ec-command-card__eyebrow">{command.eyebrow}</span>
                    <h2>{item.title}</h2>
                  </div>
                  <time dateTime={item.createdAt}>{relativeTime(item.createdAt)}</time>
                </div>
                <p className="ec-command-card__context">{item.serverName}{item.channelName ? ` · #${item.channelName}` : ""}</p>
                {item.detail && <p className="ec-command-card__detail">{item.detail}</p>}
                <div className="ec-command-card__actions">
                  <button
                    type="button"
                    className="ec-btn ec-btn--primary"
                    disabled={Boolean(actionBusyId)}
                    onClick={() => command.claim ? void onClaimItem(item) : onOpenItem(item)}
                  >
                    {busy ? "Назначаю…" : command.label}
                  </button>
                  {command.claim && <button type="button" className="ec-command-card__source" onClick={() => onOpenItem(item)}>Посмотреть задачу</button>}
                </div>
              </article>
            );
          })}
        </section>
      )}

      <footer className="ec-command-inbox__footer">
        <span>Здесь нет скрытого выполнения: каждое изменение требует вашего нажатия.</span>
        <button type="button" onClick={onOpenNotificationSettings}>Настроить уведомления</button>
      </footer>
    </main>
  );
}
