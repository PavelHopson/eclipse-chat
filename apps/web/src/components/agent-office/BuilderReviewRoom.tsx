import { useEffect, useMemo, useRef, useState } from "react";
import type { MemberRole } from "../../hooks/useMembers";
import { type BuilderReviewStatus, type BuilderReviewView, useBuilderReviews } from "../../hooks/useBuilderReviews";
import { hasPermission } from "../../lib/memberRoles";

type Props = { serverId: string | null; serverName: string | null; currentRole: MemberRole | null };
const STATUS: Record<BuilderReviewStatus, string> = {
  PENDING: "Ждёт проверки",
  APPROVED: "План принят",
  REJECTED: "Нужна доработка",
};
const EMPTY_CHECKLIST = { requirementsConfirmed: false, securityBoundaryConfirmed: false, previewReviewed: false };

function BuilderIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z" /></svg>;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function ReviewRow({ item, selected, onSelect }: { item: BuilderReviewView; selected: boolean; onSelect: () => void }) {
  return <button type="button" className="ec-deck-row" data-selected={selected} data-status={item.reviewStatus} onClick={onSelect}><span aria-hidden /><div><strong>{item.project.input.name}</strong><small>{item.project.input.template} · {formatDate(item.createdAt)}</small></div><em>{STATUS[item.reviewStatus]}</em></button>;
}

export function BuilderReviewRoom({ serverId, serverName, currentRole }: Props) {
  const { reviews, policy, loading, importing, reviewingId, error, clearError, reload, importProject, reviewProject } = useBuilderReviews(serverId, true);
  const fileRef = useRef<HTMLInputElement>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [checklist, setChecklist] = useState(EMPTY_CHECKLIST);
  const selected = useMemo(() => reviews.find((item) => item.id === selectedId) ?? reviews[0] ?? null, [reviews, selectedId]);
  const canCreate = currentRole != null && hasPermission(currentRole, "TASK_CREATE");
  const canReview = currentRole != null && hasPermission(currentRole, "TASK_APPROVE");
  const allChecked = checklist.requirementsConfirmed && checklist.securityBoundaryConfirmed && checklist.previewReviewed;

  useEffect(() => {
    if (!selectedId && reviews[0]) setSelectedId(reviews[0].id);
    if (selectedId && !reviews.some((item) => item.id === selectedId)) setSelectedId(reviews[0]?.id ?? null);
  }, [reviews, selectedId]);
  useEffect(() => {
    setChecklist(EMPTY_CHECKLIST);
    setNote(selected?.reviewNote ?? "");
  }, [selected?.id, selected?.reviewNote]);

  const handleFile = async (file?: File) => {
    if (!file) return;
    setLocalError(null);
    clearError();
    if (file.size > 128 * 1024) { setLocalError("Файл больше безопасного лимита 128 КБ."); return; }
    if (!file.name.toLowerCase().endsWith(".json")) { setLocalError("Выберите builder.project.v1 JSON."); return; }
    try {
      const imported = await importProject(JSON.parse(await file.text()) as unknown);
      if (imported) setSelectedId(imported.id);
    } catch (cause) {
      setLocalError(cause instanceof SyntaxError ? "Файл не является корректным JSON." : "Не удалось прочитать файл.");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const decide = async (decision: "APPROVE" | "REJECT") => {
    if (!selected) return;
    const updated = await reviewProject(selected.id, selected.version, decision, checklist, note);
    if (updated) setSelectedId(updated.id);
  };

  if (!serverId) {
    return <main className="ec-agent-office ec-agent-office--centered"><section className="ec-growth-empty"><span className="ec-agent-office__mark"><BuilderIcon /></span><h1>Выберите пространство</h1><p>Проекты хранятся и проверяются только внутри выбранной команды.</p></section></main>;
  }

  return <main className="ec-agent-office ec-deck-room" aria-labelledby="builder-room-title" aria-busy={loading}>
    <header className="ec-agent-office__header">
      <div className="ec-agent-office__identity"><span className="ec-agent-office__mark"><BuilderIcon /></span><div><p className="ec-agent-office__eyebrow">{serverName ?? "Eclipse Forge"} · Agent Office</p><h1 id="builder-room-title">Builder Review Room</h1><p>Импортируйте план из AI Hub, проверьте требования, интерфейс и границы безопасности, затем примите независимое решение команды.</p></div></div>
      <div className="ec-agent-office__run-meta"><span className="ec-agent-office__contract">builder.project.v1</span><span className="ec-agent-office__queue">{reviews.filter((item) => item.reviewStatus === "PENDING").length} на проверке</span><button type="button" className="ec-btn ec-btn--primary" disabled={!canCreate || importing} onClick={() => fileRef.current?.click()}>{importing ? "Импортируем…" : "Импорт Builder JSON"}</button><input ref={fileRef} className="ec-growth-file-input" type="file" accept="application/json,.json" aria-label="Выбрать builder.project.v1 JSON" onChange={(event) => void handleFile(event.target.files?.[0])} /></div>
    </header>
    <section className="ec-agent-office__safety" aria-label="Границы импорта"><strong>План без исполнения</strong><span>Approval и открытые build gates из файла сбрасываются. Chat не ставит зависимости, не запускает код, не подключает GitHub и не делает deploy.</span><span className="ec-growth-budget">до {policy?.maxPendingReviewsPerOperator ?? 20} в очереди</span></section>
    {(error || localError) && <div className="ec-growth-alert" role="alert"><span>{localError ?? error}</span><div>{error && <button type="button" onClick={() => void reload()}>Повторить</button>}<button type="button" onClick={() => { setLocalError(null); clearError(); }}>Закрыть</button></div></div>}

    {loading ? <section className="ec-growth-loading" aria-label="Загрузка проектов"><span /><span /><span /></section>
      : reviews.length === 0 ? <section className="ec-growth-empty"><span className="ec-agent-office__mark"><BuilderIcon /></span><h2>Добавьте первый план приложения</h2><p>Создайте и утвердите builder.project.v1 в Eclipse AI Hub. Здесь команда повторно проверит его перед любой разработкой.</p><button type="button" className="ec-btn ec-btn--primary" disabled={!canCreate} onClick={() => fileRef.current?.click()}>Импортировать JSON</button></section>
      : selected && <div className="ec-deck-workspace">
        <aside className="ec-deck-list"><div className="ec-growth-panel-head"><div><p className="ec-agent-office__section-label">Очередь</p><h2>Проекты</h2></div><span>{reviews.length}</span></div>{reviews.map((item) => <ReviewRow key={item.id} item={item} selected={item.id === selected.id} onSelect={() => setSelectedId(item.id)} />)}</aside>
        <section className="ec-deck-primary">
          <div className="ec-agent-office__objective"><div><p className="ec-agent-office__section-label">{selected.project.input.template} · {selected.project.blueprint.routes.length} routes</p><h2>{selected.project.input.name}</h2><p>{selected.project.input.problem}</p></div><span className="ec-agent-office__status" data-status={selected.reviewStatus}>{STATUS[selected.reviewStatus]}</span></div>
          <dl className="ec-agent-office__guardrails"><div><dt>Для кого</dt><dd>{selected.project.input.audience}</dd></div><div><dt>Главное действие</dt><dd>{selected.project.input.primaryAction}</dd></div><div><dt>Код</dt><dd>Не запускается</dd></div><div><dt>GitHub / deploy</dt><dd>Запрещены</dd></div></dl>
          <section className="ec-growth-evidence"><div className="ec-growth-panel-head"><div><p className="ec-agent-office__section-label">Preview</p><h2>{selected.project.preview.headline}</h2></div><span>{selected.project.preview.eyebrow}</span></div><p>{selected.project.preview.supportingText}</p><ul>{selected.project.preview.proofPoints.map((point) => <li key={point}><span>{point}</span></li>)}</ul></section>
          <div className="ec-deck-slides">{selected.project.blueprint.sections.map((section, index) => <article key={section.id}><header><span>{index + 1}</span><div><small>{section.id}</small><h3>{section.label}</h3></div></header><p>{section.purpose}</p></article>)}</div>
          <section className="ec-growth-artifacts"><div className="ec-growth-panel-head"><div><p className="ec-agent-office__section-label">Build queue</p><h2>Что будет дальше</h2></div><span>0 действий запущено</span></div>{selected.project.buildQueue.map((item) => <details key={item.id} open={item.id === "brief"}><summary><span>{item.status === "ready" ? "Готово к review" : "Заблокировано"}</span><strong>{item.title}</strong></summary><div>{item.outcome}{item.gate ? ` · ${item.gate}` : ""}</div></details>)}</section>
        </section>
        <aside className="ec-deck-review">
          <section data-status={selected.reviewStatus}><p className="ec-agent-office__section-label">Human gate · v{selected.version}</p><h2>{STATUS[selected.reviewStatus]}</h2>{selected.reviewStatus === "PENDING" ? canReview ? <><p>Проверьте план в контексте этой команды. Approval не запускает build или deploy.</p>{([ ["requirementsConfirmed", "Требования и аудитория понятны"], ["securityBoundaryConfirmed", "Границы безопасности приемлемы"], ["previewReviewed", "Preview и все состояния просмотрены"] ] as const).map(([key, label]) => <label key={key}><input type="checkbox" checked={checklist[key]} onChange={(event) => setChecklist({ ...checklist, [key]: event.target.checked })} /><span>{label}</span></label>)}<textarea value={note} maxLength={1000} placeholder="Комментарий или причина доработки" aria-label="Комментарий review" onChange={(event) => setNote(event.target.value)} /><div><button type="button" className="ec-btn ec-btn--primary" disabled={!allChecked || reviewingId === selected.id} onClick={() => void decide("APPROVE")}>Утвердить план</button><button type="button" className="ec-btn ec-btn--danger" disabled={note.trim().length < 3 || reviewingId === selected.id} onClick={() => void decide("REJECT")}>Вернуть на доработку</button></div></> : <p>Просмотр доступен, решение принимает участник с правом approval.</p> : <><p>{selected.reviewStatus === "APPROVED" ? "План принят для отдельного этапа разработки." : "Ожидается исправленная версия из AI Hub."}</p>{selected.reviewNote && <blockquote>{selected.reviewNote}</blockquote>}</>}</section>
          <section><p className="ec-agent-office__section-label">Provenance</p><dl className="ec-growth-provenance"><div><dt>Импортировал</dt><dd>{selected.importedBy?.displayName ?? "Удалённый участник"}</dd></div><div><dt>Source project</dt><dd title={selected.sourceProjectId}>{selected.sourceProjectId}</dd></div><div><dt>Контракт</dt><dd>{selected.schemaVersion}</dd></div><div><dt>Импорт</dt><dd>{formatDate(selected.createdAt)}</dd></div></dl></section>
        </aside>
      </div>}
  </main>;
}
