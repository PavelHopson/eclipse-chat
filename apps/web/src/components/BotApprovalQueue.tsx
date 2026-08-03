import type { BotActionApproval } from "../hooks/useBotApprovals";

type Props = {
  approvals: BotActionApproval[];
  loading: boolean;
  error: string | null;
  busyId: string | null;
  onApprove: (approvalId: string) => Promise<boolean>;
  onReject: (approvalId: string) => Promise<boolean>;
  onReload: () => void;
};

function formatExpiry(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return "срок истёк";
  const hours = Math.floor(diff / 3_600_000);
  if (hours >= 1) return `ещё ${hours} ч`;
  const minutes = Math.max(1, Math.floor(diff / 60_000));
  return `ещё ${minutes} мин`;
}

export function BotApprovalQueue({
  approvals,
  loading,
  error,
  busyId,
  onApprove,
  onReject,
  onReload,
}: Props) {
  return (
    <section className="ec-approval-queue" aria-labelledby="bot-approval-title">
      <div className="ec-approval-queue__head">
        <div>
          <span className="ec-workbench-eyebrow">Контроль исполнения</span>
          <h4 id="bot-approval-title">Действия, требующие решения</h4>
          <p>Агент ничего не изменит в таблице, пока владелец явно не разрешит действие.</p>
        </div>
        <div className="ec-approval-queue__head-actions">
          <span className={`ec-approval-count${approvals.length > 0 ? " is-pending" : ""}`}>
            {approvals.length} ожидают
          </span>
          <button
            type="button"
            className="ec-btn ec-btn--sm"
            onClick={onReload}
            disabled={loading}
          >
            {loading ? "Обновляем…" : "Обновить очередь"}
          </button>
        </div>
      </div>

      {error && <div className="ec-bots-error" role="alert">{error}</div>}

      {!loading && approvals.length === 0 && (
        <div className="ec-approval-empty" role="status">
          <span className="ec-approval-empty__signal" aria-hidden />
          <div>
            <strong>Решения не требуются</strong>
            <span>Рискованные изменения остановятся здесь автоматически.</span>
          </div>
        </div>
      )}

      <div className="ec-approval-list">
        {approvals.map((approval) => {
          const busy = busyId === approval.id;
          return (
            <article key={approval.id} className="ec-approval-card">
              <div className="ec-approval-card__topline">
                <div>
                  <span className="ec-approval-card__agent">{approval.botName}</span>
                  <strong>Изменить таблицу «{approval.preview.tableName}»</strong>
                </div>
                <span className="ec-approval-card__expiry">{formatExpiry(approval.expiresAt)}</span>
              </div>
              <div className="ec-approval-card__context">
                <span>{approval.sourceChannelName ? `Комната #${approval.sourceChannelName}` : "Из рабочего контекста"}</span>
                <span>{approval.preview.totalUpdates} полей</span>
              </div>
              <div className="ec-approval-changes" aria-label="Запрошенные изменения">
                {approval.preview.updates.map((update, index) => (
                  <div key={`${update.fieldName}-${index}`} className="ec-approval-change">
                    <span>{update.fieldName}</span>
                    <code title={update.value}>{update.value || "(пустое значение)"}</code>
                  </div>
                ))}
              </div>
              <div className="ec-approval-card__actions">
                <button
                  type="button"
                  className="ec-btn ec-btn--primary ec-btn--sm"
                  onClick={() => void onApprove(approval.id)}
                  disabled={Boolean(busyId)}
                >
                  {busy ? "Выполняем…" : "Разрешить изменение"}
                </button>
                <button
                  type="button"
                  className="ec-btn ec-btn--ghost ec-btn--sm"
                  onClick={() => void onReject(approval.id)}
                  disabled={Boolean(busyId)}
                >
                  Отклонить
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
