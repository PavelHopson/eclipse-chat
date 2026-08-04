import { useEffect, useMemo, useRef, useState } from "react";
import type { MemberRole } from "../../hooks/useMembers";
import { type DeckReviewStatus, type DeckReviewView, useDeckReviews } from "../../hooks/useDeckReviews";
import { hasPermission } from "../../lib/memberRoles";

type Props = {
  serverId: string | null;
  serverName: string | null;
  currentRole: MemberRole | null;
};

const STATUS: Record<DeckReviewStatus, string> = {
  PENDING: "Ждёт проверки",
  APPROVED: "Утверждено",
  REJECTED: "Нужна доработка",
};
const EMPTY_CHECKLIST = { claimsVerified: false, rightsConfirmed: false, finalReviewComplete: false };

function DeckIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="3" y="4" width="18" height="13" rx="2" /><path d="M8 21h8M12 17v4M7 9h10M7 12h6" /></svg>;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function ReviewRow({ item, selected, onSelect }: { item: DeckReviewView; selected: boolean; onSelect: () => void }) {
  return <button type="button" className="ec-deck-row" data-selected={selected} data-status={item.reviewStatus} onClick={onSelect}><span aria-hidden /><div><strong>{item.job.input.title}</strong><small>{item.job.slides.length} слайдов · {formatDate(item.createdAt)}</small></div><em>{STATUS[item.reviewStatus]}</em></button>;
}

export function DeckReviewRoom({ serverId, serverName, currentRole }: Props) {
  const { reviews, policy, loading, importing, reviewingId, error, clearError, reload, importJob, reviewJob } = useDeckReviews(serverId, true);
  const fileRef = useRef<HTMLInputElement>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [checklist, setChecklist] = useState(EMPTY_CHECKLIST);
  const selected = useMemo(() => reviews.find((item) => item.id === selectedId) ?? reviews[0] ?? null, [reviews, selectedId]);
  const canCreate = currentRole != null && hasPermission(currentRole, "TASK_CREATE");
  const canReview = currentRole != null && hasPermission(currentRole, "TASK_APPROVE");
  const allChecked = checklist.claimsVerified && checklist.rightsConfirmed && checklist.finalReviewComplete;

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
    if (!file.name.toLowerCase().endsWith(".json")) { setLocalError("Выберите deck.job.v1 JSON."); return; }
    try {
      const imported = await importJob(JSON.parse(await file.text()) as unknown);
      if (imported) setSelectedId(imported.id);
    } catch (cause) {
      setLocalError(cause instanceof SyntaxError ? "Файл не является корректным JSON." : "Не удалось прочитать файл.");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const decide = async (decision: "APPROVE" | "REJECT") => {
    if (!selected) return;
    const updated = await reviewJob(selected.id, selected.version, decision, checklist, note);
    if (updated) setSelectedId(updated.id);
  };

  if (!serverId) {
    return <main className="ec-agent-office ec-agent-office--centered"><section className="ec-growth-empty"><span className="ec-agent-office__mark"><DeckIcon /></span><h1>Выберите пространство</h1><p>Презентации из разных команд не смешиваются.</p></section></main>;
  }

  return <main className="ec-agent-office ec-deck-room" aria-labelledby="deck-room-title" aria-busy={loading}>
    <header className="ec-agent-office__header">
      <div className="ec-agent-office__identity"><span className="ec-agent-office__mark"><DeckIcon /></span><div><p className="ec-agent-office__eyebrow">{serverName ?? "Eclipse Forge"} · Agent Office</p><h1 id="deck-room-title">Deck Review Room</h1><p>Импортируйте утверждённую структуру из AI Hub, проверьте каждый слайд и примите независимое решение команды.</p></div></div>
      <div className="ec-agent-office__run-meta"><span className="ec-agent-office__contract">deck.job.v1</span><span className="ec-agent-office__queue">{reviews.filter((item) => item.reviewStatus === "PENDING").length} на проверке</span><button type="button" className="ec-btn ec-btn--primary" disabled={!canCreate || importing} onClick={() => fileRef.current?.click()}>{importing ? "Импортируем…" : "Импорт Deck JSON"}</button><input ref={fileRef} className="ec-growth-file-input" type="file" accept="application/json,.json" aria-label="Выбрать deck.job.v1 JSON" onChange={(event) => void handleFile(event.target.files?.[0])} /></div>
    </header>
    <section className="ec-agent-office__safety" aria-label="Границы импорта"><strong>Независимый review</strong><span>Approval из файла сбрасывается. Chat не запускает tools, не публикует материалы и пока не создаёт PPTX.</span><span className="ec-growth-budget">до {policy?.maxPendingReviewsPerOperator ?? 20} в очереди</span></section>
    {(error || localError) && <div className="ec-growth-alert" role="alert"><span>{localError ?? error}</span><div>{error && <button type="button" onClick={() => void reload()}>Повторить</button>}<button type="button" onClick={() => { setLocalError(null); clearError(); }}>Закрыть</button></div></div>}

    {loading ? <section className="ec-growth-loading" aria-label="Загрузка презентаций"><span /><span /><span /></section>
      : reviews.length === 0 ? <section className="ec-growth-empty"><span className="ec-agent-office__mark"><DeckIcon /></span><h2>Добавьте первую презентацию</h2><p>Сначала создайте и утвердите deck.job.v1 в Eclipse AI Hub, затем импортируйте JSON сюда для командного review.</p><button type="button" className="ec-btn ec-btn--primary" disabled={!canCreate} onClick={() => fileRef.current?.click()}>Импортировать JSON</button></section>
      : selected && <div className="ec-deck-workspace">
        <aside className="ec-deck-list"><div className="ec-growth-panel-head"><div><p className="ec-agent-office__section-label">Очередь</p><h2>Презентации</h2></div><span>{reviews.length}</span></div>{reviews.map((item) => <ReviewRow key={item.id} item={item} selected={item.id === selected.id} onSelect={() => setSelectedId(item.id)} />)}</aside>
        <section className="ec-deck-primary">
          <div className="ec-agent-office__objective"><div><p className="ec-agent-office__section-label">{selected.job.input.format} · {selected.job.slides.length} слайдов</p><h2>{selected.job.input.title}</h2><p>{selected.job.input.objective}</p></div><span className="ec-agent-office__status" data-status={selected.reviewStatus}>{STATUS[selected.reviewStatus]}</span></div>
          <dl className="ec-agent-office__guardrails"><div><dt>Аудитория</dt><dd>{selected.job.input.audience}</dd></div><div><dt>Инструменты</dt><dd>Запрещены</dd></div><div><dt>Автопубликация</dt><dd>Запрещена</dd></div><div><dt>PPTX</dt><dd>Ещё не создан</dd></div></dl>
          <div className="ec-deck-slides">{selected.job.slides.map((slide, index) => <article key={slide.id}><header><span>{index + 1}</span><div><small>{slide.kind}</small><h3>{slide.title}</h3></div></header><ul>{slide.bullets.map((bullet, bulletIndex) => <li key={slide.id + "-" + bulletIndex}>{bullet}</li>)}</ul>{slide.speakerNotes && <p><strong>Заметки:</strong> {slide.speakerNotes}</p>}</article>)}</div>
          {selected.job.input.evidenceUrls.length > 0 && <section className="ec-growth-evidence"><div className="ec-growth-panel-head"><div><p className="ec-agent-office__section-label">Evidence</p><h2>Источники</h2></div><span>{selected.job.input.evidenceUrls.length}</span></div><ul>{selected.job.input.evidenceUrls.map((url) => <li key={url}><a href={url} target="_blank" rel="noopener noreferrer">{new URL(url).hostname}<span>Открыть источник</span></a></li>)}</ul></section>}
        </section>
        <aside className="ec-deck-review">
          <section data-status={selected.reviewStatus}><p className="ec-agent-office__section-label">Human gate · v{selected.version}</p><h2>{STATUS[selected.reviewStatus]}</h2>{selected.reviewStatus === "PENDING" ? canReview ? <><p>Проверьте презентацию в контексте этой команды. Это решение не публикует материал.</p>{([["claimsVerified", "Факты и ссылки проверены"], ["rightsConfirmed", "Права на материалы подтверждены"], ["finalReviewComplete", "Все слайды и notes просмотрены"]] as const).map(([key, label]) => <label key={key}><input type="checkbox" checked={checklist[key]} onChange={(event) => setChecklist({ ...checklist, [key]: event.target.checked })} /><span>{label}</span></label>)}<textarea value={note} maxLength={1000} placeholder="Комментарий или причина доработки" aria-label="Комментарий review" onChange={(event) => setNote(event.target.value)} /><div><button type="button" className="ec-btn ec-btn--primary" disabled={!allChecked || reviewingId === selected.id} onClick={() => void decide("APPROVE")}>Утвердить структуру</button><button type="button" className="ec-btn ec-btn--danger" disabled={note.trim().length < 3 || reviewingId === selected.id} onClick={() => void decide("REJECT")}>Вернуть на доработку</button></div></> : <p>Просмотр доступен, решение принимает участник с правом approval.</p> : <><p>{selected.reviewStatus === "APPROVED" ? "Структура принята для следующего ручного этапа." : "Ожидается новая версия из AI Hub."}</p>{selected.reviewNote && <blockquote>{selected.reviewNote}</blockquote>}</>}</section>
          <section><p className="ec-agent-office__section-label">Provenance</p><dl className="ec-growth-provenance"><div><dt>Импортировал</dt><dd>{selected.importedBy?.displayName ?? "Удалённый участник"}</dd></div><div><dt>Source job</dt><dd title={selected.sourceJobId}>{selected.sourceJobId}</dd></div><div><dt>Контракт</dt><dd>{selected.schemaVersion}</dd></div><div><dt>Импорт</dt><dd>{formatDate(selected.createdAt)}</dd></div></dl></section>
        </aside>
      </div>}
  </main>;
}
