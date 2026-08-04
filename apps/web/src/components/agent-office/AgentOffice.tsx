import { useEffect, useMemo, useRef, useState } from "react";
import type { MemberRole } from "../../hooks/useMembers";
import {
  type GrowthReviewStatus,
  type GrowthRunView,
  useGrowthRuns,
} from "../../hooks/useGrowthRuns";
import { hasPermission } from "../../lib/memberRoles";

type AgentOfficeProps = {
  serverId: string | null;
  serverName: string | null;
  currentRole: MemberRole | null;
};

const REVIEW_LABELS: Record<GrowthReviewStatus, string> = {
  PENDING: "Ждёт проверки",
  APPROVED: "Утверждено",
  REJECTED: "Нужна доработка",
};

const CHANNEL_LABELS = {
  telegram: "Telegram",
  linkedin: "LinkedIn",
  blog: "Блог",
} as const;

function CommandRoomIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="5" r="2.25" />
      <circle cx="5" cy="17" r="2.25" />
      <circle cx="19" cy="17" r="2.25" />
      <path d="M12 7.25v4.25M10.25 12.5 6.6 15M13.75 12.5 17.4 15" />
    </svg>
  );
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function RunListItem({
  item,
  selected,
  onSelect,
}: {
  item: GrowthRunView;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className="ec-growth-run-row"
      data-selected={selected}
      data-status={item.reviewStatus}
      onClick={onSelect}
    >
      <span className="ec-growth-run-row__signal" aria-hidden />
      <span className="ec-growth-run-row__copy">
        <strong>{item.run.input.releaseName}</strong>
        <small>{CHANNEL_LABELS[item.run.input.channel]} · {formatDate(item.createdAt)}</small>
      </span>
      <span className="ec-growth-run-row__status">{REVIEW_LABELS[item.reviewStatus]}</span>
    </button>
  );
}

export function AgentOffice({ serverId, serverName, currentRole }: AgentOfficeProps) {
  const {
    runs,
    policy,
    loading,
    importing,
    reviewingId,
    error,
    clearError,
    reload,
    importRun,
    reviewRun,
  } = useGrowthRuns(serverId);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [humanConfirmed, setHumanConfirmed] = useState(false);

  const selected = useMemo(
    () => runs.find((item) => item.id === selectedId) ?? runs[0] ?? null,
    [runs, selectedId],
  );
  const canReview = currentRole != null && hasPermission(currentRole, "TASK_APPROVE");
  const pendingCount = runs.filter((item) => item.reviewStatus === "PENDING").length;

  useEffect(() => {
    if (!selectedId && runs[0]) setSelectedId(runs[0].id);
    if (selectedId && !runs.some((item) => item.id === selectedId)) {
      setSelectedId(runs[0]?.id ?? null);
    }
  }, [runs, selectedId]);

  useEffect(() => {
    setReviewNote(selected?.reviewNote ?? "");
    setHumanConfirmed(false);
  }, [selected?.id, selected?.reviewNote]);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setLocalError(null);
    clearError();
    if (file.size > 96 * 1024) {
      setLocalError("Файл больше 96 КБ. Экспорт Growth OS должен быть компактным JSON.");
      return;
    }
    try {
      const raw = JSON.parse(await file.text()) as unknown;
      const imported = await importRun(raw);
      if (imported) setSelectedId(imported.id);
    } catch (cause) {
      setLocalError(cause instanceof SyntaxError ? "Файл не является корректным JSON" : "Не удалось прочитать файл");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const submitReview = async (decision: "APPROVE" | "REJECT") => {
    if (!selected) return;
    const updated = await reviewRun(
      selected.id,
      selected.version,
      decision,
      reviewNote,
      humanConfirmed,
    );
    if (updated) setSelectedId(updated.id);
  };

  if (!serverId) {
    return (
      <main className="ec-agent-office ec-agent-office--centered">
        <section className="ec-growth-empty">
          <span className="ec-agent-office__mark"><CommandRoomIcon /></span>
          <h1>Выберите пространство</h1>
          <p>Growth Command Room хранит материалы внутри конкретной команды и не смешивает доступ между пространствами.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="ec-agent-office" aria-labelledby="growth-room-title" aria-busy={loading}>
      <header className="ec-agent-office__header">
        <div className="ec-agent-office__identity">
          <span className="ec-agent-office__mark"><CommandRoomIcon /></span>
          <div>
            <p className="ec-agent-office__eyebrow">{serverName ?? "Eclipse Forge"} · Agent Office</p>
            <h1 id="growth-room-title">Growth Command Room</h1>
            <p>Импортируйте готовый материал, проверьте доказательства и зафиксируйте решение команды.</p>
          </div>
        </div>
        <div className="ec-agent-office__run-meta">
          <span className="ec-agent-office__contract">growth.run.v1</span>
          <span className="ec-agent-office__queue">{pendingCount} на проверке</span>
          <button type="button" className="ec-btn ec-btn--primary" disabled={importing} onClick={() => fileInputRef.current?.click()}>
            {importing ? "Импортируем…" : "Импортировать JSON"}
          </button>
          <input
            ref={fileInputRef}
            className="ec-growth-file-input"
            type="file"
            accept="application/json,.json"
            aria-label="Выбрать growth.run.v1 JSON"
            onChange={(event) => void handleFile(event.target.files?.[0])}
          />
        </div>
      </header>

      <section className="ec-agent-office__safety" aria-label="Границы автоматизации">
        <strong>Без автопубликации</strong>
        <span>Chat не получает API-ключи provider'а, не запускает рекламу и не выполняет внешние действия. Approval относится только к текстовому артефакту.</span>
      </section>

      {(error || localError) && (
        <div className="ec-growth-alert" role="alert">
          <span>{localError ?? error}</span>
          <div>
            {error && <button type="button" onClick={() => void reload()}>Повторить</button>}
            <button type="button" onClick={() => { setLocalError(null); clearError(); }}>Закрыть</button>
          </div>
        </div>
      )}

      {loading ? (
        <section className="ec-growth-loading" aria-label="Загрузка запусков">
          <span /><span /><span />
        </section>
      ) : runs.length === 0 ? (
        <section className="ec-growth-empty">
          <span className="ec-agent-office__mark"><CommandRoomIcon /></span>
          <h2>Здесь появится первый материал</h2>
          <p>В AI Hub завершите пять шагов Growth OS, скачайте versioned JSON и импортируйте его сюда. Chat ещё раз потребует ручную проверку.</p>
          <button type="button" className="ec-btn ec-btn--primary" onClick={() => fileInputRef.current?.click()}>Выбрать JSON</button>
        </section>
      ) : selected ? (
        <div className="ec-agent-office__workspace">
          <aside className="ec-growth-runs" aria-label="Материалы команды">
            <div className="ec-growth-panel-head">
              <div><p className="ec-agent-office__section-label">Очередь</p><h2>Материалы</h2></div>
              <span>{runs.length}</span>
            </div>
            <div className="ec-growth-runs__list">
              {runs.map((item) => (
                <RunListItem key={item.id} item={item} selected={item.id === selected.id} onSelect={() => setSelectedId(item.id)} />
              ))}
            </div>
            <p className="ec-growth-runs__limit">До {policy?.maxPendingRunsPerOperator ?? 20} незакрытых импортов на участника.</p>
          </aside>

          <section className="ec-agent-office__primary" aria-label="Материал на проверке">
            <div className="ec-agent-office__objective">
              <div>
                <p className="ec-agent-office__section-label">Релиз · {CHANNEL_LABELS[selected.run.input.channel]}</p>
                <h2>{selected.run.input.releaseName}</h2>
                <p>{selected.run.input.releaseSummary}</p>
              </div>
              <span className="ec-agent-office__status" data-status={selected.reviewStatus}>{REVIEW_LABELS[selected.reviewStatus]}</span>
            </div>

            <dl className="ec-agent-office__guardrails">
              <div><dt>Аудитория</dt><dd>{selected.run.input.audience}</dd></div>
              <div><dt>AI-запросы</dt><dd>{selected.run.execution.completedRequests} / {selected.run.execution.maxRequests}</dd></div>
              <div><dt>Provider</dt><dd>{selected.run.execution.provider} · {selected.run.execution.model}</dd></div>
              <div><dt>Внешние действия</dt><dd>Запрещены</dd></div>
            </dl>

            <section className="ec-growth-evidence" aria-labelledby="growth-evidence-title">
              <div className="ec-growth-panel-head">
                <div><p className="ec-agent-office__section-label">Evidence</p><h2 id="growth-evidence-title">Что проверить</h2></div>
                <span>{selected.run.input.sourceUrls.length} ссылок</span>
              </div>
              <p>{selected.run.input.evidenceNotes}</p>
              <ul>
                {selected.run.input.sourceUrls.map((url) => (
                  <li key={url}><a href={url} target="_blank" rel="noopener noreferrer">{new URL(url).hostname}<span>Открыть источник</span></a></li>
                ))}
              </ul>
            </section>

            <section className="ec-growth-artifacts" aria-labelledby="growth-artifacts-title">
              <div className="ec-growth-panel-head">
                <div><p className="ec-agent-office__section-label">Run history</p><h2 id="growth-artifacts-title">Пять этапов</h2></div>
                <span>{selected.run.artifacts.length} / 5</span>
              </div>
              {selected.run.artifacts.map((artifact) => (
                <details key={artifact.step} open={artifact.step === "final"}>
                  <summary><span>{artifact.role}</span><strong>{artifact.step === "final" ? "Финальный материал" : "Показать результат"}</strong></summary>
                  <div>{artifact.content}</div>
                </details>
              ))}
            </section>
          </section>

          <aside className="ec-agent-office__side" aria-label="Решение по материалу">
            <section className="ec-growth-review" data-status={selected.reviewStatus}>
              <p className="ec-agent-office__section-label">Human gate · v{selected.version}</p>
              <h2>{REVIEW_LABELS[selected.reviewStatus]}</h2>
              {selected.reviewStatus === "PENDING" ? (
                <>
                  <p>Проверьте финальный текст, ссылки и CTA. Это решение не публикует материал.</p>
                  {canReview ? (
                    <>
                      <label htmlFor="growth-review-note">Комментарий команде</label>
                      <textarea id="growth-review-note" value={reviewNote} maxLength={1000} placeholder="Что исправить или почему материал готов" onChange={(event) => setReviewNote(event.target.value)} />
                      <label className="ec-growth-review__confirm">
                        <input type="checkbox" checked={humanConfirmed} onChange={(event) => setHumanConfirmed(event.target.checked)} />
                        <span>Я вручную проверил факты, ссылки и CTA.</span>
                      </label>
                      <div className="ec-growth-review__actions">
                        <button type="button" className="ec-btn ec-btn--primary" disabled={!humanConfirmed || reviewingId === selected.id} onClick={() => void submitReview("APPROVE")}>Утвердить артефакт</button>
                        <button type="button" className="ec-btn ec-btn--danger" disabled={reviewNote.trim().length < 3 || reviewingId === selected.id} onClick={() => void submitReview("REJECT")}>Вернуть на доработку</button>
                      </div>
                    </>
                  ) : (
                    <div className="ec-growth-review__readonly">Вы можете читать материалы. Решение фиксирует участник с правом approval.</div>
                  )}
                </>
              ) : (
                <>
                  <p>{selected.reviewStatus === "APPROVED" ? "Артефакт принят для дальнейшей ручной работы." : "Материал остановлен до новой версии из AI Hub."}</p>
                  {selected.reviewNote && <blockquote>{selected.reviewNote}</blockquote>}
                  <dl>
                    <div><dt>Решение</dt><dd>{selected.reviewedBy?.displayName ?? "Удалённый участник"}</dd></div>
                    <div><dt>Когда</dt><dd>{selected.reviewedAt ? formatDate(selected.reviewedAt) : "—"}</dd></div>
                  </dl>
                </>
              )}
            </section>

            <section>
              <p className="ec-agent-office__section-label">Provenance</p>
              <dl className="ec-growth-provenance">
                <div><dt>Импортировал</dt><dd>{selected.importedBy?.displayName ?? "Удалённый участник"}</dd></div>
                <div><dt>Source run</dt><dd title={selected.sourceRunId}>{selected.sourceRunId}</dd></div>
                <div><dt>Контракт</dt><dd>{selected.schemaVersion}</dd></div>
                <div><dt>Импорт</dt><dd>{formatDate(selected.createdAt)}</dd></div>
              </dl>
            </section>
          </aside>
        </div>
      ) : null}
    </main>
  );
}
