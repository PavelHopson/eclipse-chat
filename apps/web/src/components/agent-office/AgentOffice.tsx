import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import type { MemberRole } from "../../hooks/useMembers";
import {
  type GrowthReviewStatus,
  type GrowthRunInput,
  type GrowthRunView,
  type GrowthStepId,
  useGrowthRuns,
} from "../../hooks/useGrowthRuns";
import { hasPermission } from "../../lib/memberRoles";
import { DeckReviewRoom } from "./DeckReviewRoom";
import { BuilderReviewRoom } from "./BuilderReviewRoom";
import { SpecGateReviewRoom } from "./SpecGateReviewRoom";
import { AutomationAuditReviewRoom } from "./AutomationAuditReviewRoom";
import { EvidenceCardEditor, EvidenceCardSummary } from "./EvidenceCardEditor";
import { VoiceOpsRoom } from "./VoiceOpsRoom";

type AgentOfficeProps = {
  serverId: string | null;
  serverName: string | null;
  currentRole: MemberRole | null;
  workspaces: Array<{ id: string; name: string }>;
  onSelectWorkspace: (serverId: string) => void;
  onOpenLanTransfer: () => void;
};

const REVIEW_LABELS: Record<GrowthReviewStatus, string> = {
  PENDING: "Ждёт проверки",
  APPROVED: "Утверждено",
  REJECTED: "Нужна доработка",
};

const CHANNEL_LABELS = { telegram: "Telegram", linkedin: "LinkedIn", blog: "Блог" } as const;
const STEP_LABELS: Record<GrowthStepId, { role: string; action: string; result: string }> = {
  research: { role: "Исследователь", action: "Проверить факты", result: "Исследование" },
  strategy: { role: "Стратег", action: "Собрать стратегию", result: "Стратегия" },
  draft: { role: "Автор", action: "Написать черновик", result: "Черновик" },
  claims: { role: "Проверяющий фактов", action: "Проверить утверждения", result: "Аудит утверждений" },
  final: { role: "Редактор", action: "Подготовить финал", result: "Финальный материал" },
};
const STEP_ORDER = Object.keys(STEP_LABELS) as GrowthStepId[];

const EMPTY_INPUT: GrowthRunInput = {
  releaseName: "",
  releaseSummary: "",
  audience: "",
  channel: "telegram",
  sourceUrls: [],
  evidenceNotes: "",
};

function CommandRoomIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="12" cy="5" r="2.25" /><circle cx="5" cy="17" r="2.25" /><circle cx="19" cy="17" r="2.25" /><path d="M12 7.25v4.25M10.25 12.5 6.6 15M13.75 12.5 17.4 15" /></svg>;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function visibleStatus(item: GrowthRunView): string {
  if (item.executionState === "RUNNING") return "Выполняется";
  if (item.reviewStatus !== "PENDING") return REVIEW_LABELS[item.reviewStatus];
  if (item.run.status === "ready_for_approval") return "Готов к проверке";
  if (item.run.status === "draft") return "Новый черновик";
  return `${item.run.execution.completedRequests} из 5 этапов`;
}

function RunListItem({ item, selected, onSelect }: { item: GrowthRunView; selected: boolean; onSelect: () => void }) {
  return (
    <button type="button" className="ec-growth-run-row" data-selected={selected} data-status={item.reviewStatus} onClick={onSelect}>
      <span className="ec-growth-run-row__signal" aria-hidden />
      <span className="ec-growth-run-row__copy"><strong>{item.run.input.releaseName}</strong><small>{CHANNEL_LABELS[item.run.input.channel]} · {formatDate(item.createdAt)}</small></span>
      <span className="ec-growth-run-row__status">{visibleStatus(item)}</span>
    </button>
  );
}

function GrowthCommandRoom({ serverId, serverName, currentRole }: AgentOfficeProps) {
  const {
    runs, policy, loading, importing, creating, executingId, cancellingId, reviewingId,
    error, clearError, reload, importRun, createRun, executeNext, cancelStep, reviewRun,
  } = useGrowthRuns(serverId);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [input, setInput] = useState<GrowthRunInput>(EMPTY_INPUT);
  const [sourceText, setSourceText] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [humanConfirmed, setHumanConfirmed] = useState(false);

  const selected = useMemo(() => runs.find((item) => item.id === selectedId) ?? runs[0] ?? null, [runs, selectedId]);
  const canReview = currentRole != null && hasPermission(currentRole, "TASK_APPROVE");
  const canCreate = currentRole != null && hasPermission(currentRole, "TASK_CREATE");
  const pendingCount = runs.filter((item) => item.reviewStatus === "PENDING" && item.run.status === "ready_for_approval").length;
  const nextStep = selected ? STEP_ORDER[selected.run.artifacts.length] ?? null : null;
  const isExecuting = Boolean(selected && (selected.executionState === "RUNNING" || executingId === selected.id));
  const sourceOptions = useMemo(() => {
    const normalized = sourceText.split(/\r?\n/).map((item) => item.trim()).filter(Boolean).flatMap((value) => {
      try {
        const url = new URL(value);
        if (url.protocol !== "https:" || url.username || url.password) return [];
        url.hash = "";
        return [url.toString()];
      } catch {
        return [];
      }
    });
    return [...new Set(normalized)];
  }, [sourceText]);

  useEffect(() => {
    if (!selectedId && runs[0]) setSelectedId(runs[0].id);
    if (selectedId && !runs.some((item) => item.id === selectedId)) setSelectedId(runs[0]?.id ?? null);
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
      setLocalError("Файл больше 96 КБ. Экспорт контент-команды должен быть компактным JSON.");
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

  const submitCreate = async (event: FormEvent) => {
    event.preventDefault();
    setLocalError(null);
    clearError();
    const sourceUrls = sourceText.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
    if (sourceUrls.length === 0) {
      setLocalError("Добавьте хотя бы одну официальную HTTPS-ссылку.");
      return;
    }
    if (sourceUrls.length > 8) {
      setLocalError("Добавьте не больше 8 официальных ссылок — по одной на строку.");
      return;
    }
    const hasUnsafeUrl = sourceUrls.some((value) => {
      try {
        const url = new URL(value);
        return url.protocol !== "https:" || Boolean(url.username || url.password);
      } catch {
        return true;
      }
    });
    if (hasUnsafeUrl) {
      setLocalError("Используйте только полные HTTPS-ссылки без логина и пароля.");
      return;
    }
    const invalidCard = input.evidenceCards?.find((card) =>
      (card.state === "verified" && !card.sourceUrl)
      || (card.sourceUrl !== null && !sourceOptions.includes(card.sourceUrl)),
    );
    if (invalidCard) {
      setLocalError(`Проверьте источник карточки доказательства ${invalidCard.id}.`);
      return;
    }
    const created = await createRun({ ...input, sourceUrls });
    if (created) {
      setSelectedId(created.id);
      setInput(EMPTY_INPUT);
      setSourceText("");
      setCreateOpen(false);
    }
  };

  const submitReview = async (decision: "APPROVE" | "REJECT") => {
    if (!selected) return;
    const updated = await reviewRun(selected.id, selected.version, decision, reviewNote, humanConfirmed);
    if (updated) setSelectedId(updated.id);
  };

  if (!serverId) {
    return <main className="ec-agent-office ec-agent-office--centered"><section className="ec-growth-empty"><span className="ec-agent-office__mark"><CommandRoomIcon /></span><h1>Выберите пространство</h1><p>Контент-команда хранит материалы внутри выбранного пространства и не смешивает доступ.</p></section></main>;
  }

  return (
    <main className="ec-agent-office" aria-labelledby="growth-room-title" aria-busy={loading}>
      <header className="ec-agent-office__header">
        <div className="ec-agent-office__identity"><span className="ec-agent-office__mark"><CommandRoomIcon /></span><div><p className="ec-agent-office__eyebrow">{serverName ?? "Eclipse Forge"} · AI-офис</p><h1 id="growth-room-title">Контент-команда</h1><p>Создайте материал, проведите его через пять изолированных AI-ролей и утвердите после ручной проверки.</p></div></div>
        <div className="ec-agent-office__run-meta">
          <span className="ec-agent-office__contract">growth.run.v1</span>
          <span className="ec-agent-office__queue">{pendingCount} на проверке</span>
          <button type="button" className="ec-btn ec-btn--primary" disabled={!canCreate || creating} onClick={() => setCreateOpen((value) => !value)}>{createOpen ? "Закрыть форму" : "Создать материал"}</button>
          <button type="button" className="ec-btn" disabled={importing} onClick={() => fileInputRef.current?.click()}>{importing ? "Импортируем…" : "Импорт JSON"}</button>
          <input ref={fileInputRef} className="ec-growth-file-input" type="file" accept="application/json,.json" aria-label="Выбрать growth.run.v1 JSON" onChange={(event) => void handleFile(event.target.files?.[0])} />
        </div>
      </header>

      <section className="ec-agent-office__safety" aria-label="Границы автоматизации"><strong>Контролируемая генерация</strong><span>Один клик запускает только одну роль. AI не открывает ссылки, не вызывает инструменты и ничего не публикует.</span><span className="ec-growth-budget">{policy ? `${policy.budget.remaining} из ${policy.budget.limit} запросов сегодня` : "Лимит загружается"}</span></section>

      {createOpen && (
        <form className="ec-growth-create" onSubmit={(event) => void submitCreate(event)}>
          <div className="ec-growth-panel-head"><div><p className="ec-agent-office__section-label">Новый запуск</p><h2>Что нужно рассказать аудитории?</h2></div><span>5 шагов · без публикации</span></div>
          <div className="ec-growth-create__grid">
            <label><span>Название релиза</span><input required minLength={3} maxLength={120} value={input.releaseName} placeholder="Например: Новый поиск Eclipse Library" onChange={(event) => setInput({ ...input, releaseName: event.target.value })} /></label>
            <label><span>Аудитория</span><input required minLength={3} maxLength={240} value={input.audience} placeholder="Для кого этот материал" onChange={(event) => setInput({ ...input, audience: event.target.value })} /></label>
            <label className="ec-growth-create__wide"><span>Что изменилось</span><textarea required minLength={20} maxLength={2000} value={input.releaseSummary} placeholder="Опишите результат простыми словами и без рекламных обещаний" onChange={(event) => setInput({ ...input, releaseSummary: event.target.value })} /></label>
            <label><span>Канал</span><select value={input.channel} onChange={(event) => setInput({ ...input, channel: event.target.value as GrowthRunInput["channel"] })}><option value="telegram">Telegram</option><option value="linkedin">LinkedIn</option><option value="blog">Блог</option></select></label>
            <label><span>Официальные ссылки</span><textarea required maxLength={16384} value={sourceText} placeholder={"До 8 HTTPS-ссылок, по одной на строку"} onChange={(event) => setSourceText(event.target.value)} /></label>
            <label className="ec-growth-create__wide"><span>Факты и доказательства</span><textarea required minLength={20} maxLength={12000} value={input.evidenceNotes} placeholder="Что проверено: тесты, цифры, ограничения, ссылки на релиз" onChange={(event) => setInput({ ...input, evidenceNotes: event.target.value })} /></label>
            <div className="ec-growth-create__wide"><EvidenceCardEditor cards={input.evidenceCards ?? []} sourceUrls={sourceOptions} onChange={(evidenceCards) => setInput({ ...input, evidenceCards: evidenceCards.length ? evidenceCards : undefined })} /></div>
          </div>
          <div className="ec-growth-create__actions"><p>Сначала будет доступен только исследователь. Каждый следующий этап вы запускаете сами.</p><button type="submit" className="ec-btn ec-btn--primary" disabled={creating}>{creating ? "Создаём…" : "Создать черновик"}</button></div>
        </form>
      )}

      {(error || localError) && <div className="ec-growth-alert" role="alert"><span>{localError ?? error}</span><div>{error && <button type="button" onClick={() => void reload()}>Повторить</button>}<button type="button" onClick={() => { setLocalError(null); clearError(); }}>Закрыть</button></div></div>}

      {loading ? (
        <section className="ec-growth-loading" aria-label="Загрузка запусков"><span /><span /><span /></section>
      ) : runs.length === 0 && !createOpen ? (
        <section className="ec-growth-empty"><span className="ec-agent-office__mark"><CommandRoomIcon /></span><h2>Создайте первый материал</h2><p>Укажите релиз, аудиторию и проверенные источники. Затем последовательно запустите пять ролей и проверьте финал.</p><button type="button" className="ec-btn ec-btn--primary" disabled={!canCreate} onClick={() => setCreateOpen(true)}>Создать материал</button></section>
      ) : selected ? (
        <div className="ec-agent-office__workspace">
          <aside className="ec-growth-runs" aria-label="Материалы команды"><div className="ec-growth-panel-head"><div><p className="ec-agent-office__section-label">Очередь</p><h2>Материалы</h2></div><span>{runs.length}</span></div><div className="ec-growth-runs__list">{runs.map((item) => <RunListItem key={item.id} item={item} selected={item.id === selected.id} onSelect={() => setSelectedId(item.id)} />)}</div><p className="ec-growth-runs__limit">До {policy?.maxPendingRunsPerOperator ?? 20} незакрытых материалов на участника.</p></aside>

          <section className="ec-agent-office__primary" aria-label="Рабочий материал">
            <div className="ec-agent-office__objective"><div><p className="ec-agent-office__section-label">{selected.origin === "chat" ? "Создано в Chat" : "Импорт из AI Hub"} · {CHANNEL_LABELS[selected.run.input.channel]}</p><h2>{selected.run.input.releaseName}</h2><p>{selected.run.input.releaseSummary}</p></div><span className="ec-agent-office__status" data-status={selected.reviewStatus}>{visibleStatus(selected)}</span></div>
            <div className="ec-growth-progress" aria-label={`${selected.run.artifacts.length} из 5 этапов завершено`}>{STEP_ORDER.map((step, index) => <span key={step} data-state={index < selected.run.artifacts.length ? "done" : index === selected.run.artifacts.length ? "next" : "waiting"}><i>{index < selected.run.artifacts.length ? "✓" : index + 1}</i><small>{STEP_LABELS[step].role}</small></span>)}</div>
            <dl className="ec-agent-office__guardrails"><div><dt>Аудитория</dt><dd>{selected.run.input.audience}</dd></div><div><dt>AI-запросы</dt><dd>{selected.run.execution.completedRequests} / {selected.run.execution.maxRequests}</dd></div><div><dt>Провайдер</dt><dd>{selected.run.execution.provider} · {selected.run.execution.model}</dd></div><div><dt>Внешние действия</dt><dd>Запрещены</dd></div></dl>

            {nextStep && selected.reviewStatus === "PENDING" && (
              <section className="ec-growth-next" aria-live="polite"><div><p className="ec-agent-office__section-label">Следующий этап · {selected.run.artifacts.length + 1} из 5</p><h2>{STEP_LABELS[nextStep].action}</h2><p>{STEP_LABELS[nextStep].role} получит исходные данные и уже готовые этапы. Результат сохранится только внутри этого материала.</p></div><div className="ec-growth-next__actions">{isExecuting ? <><span className="ec-growth-running"><i />{STEP_LABELS[selected.activeStep ?? nextStep].role} работает…</span><button type="button" className="ec-btn ec-btn--danger" disabled={cancellingId === selected.id} onClick={() => void cancelStep(selected.id)}>{cancellingId === selected.id ? "Останавливаем…" : "Остановить"}</button></> : <><small>{policy?.budget.remaining ?? 0} запросов осталось сегодня</small><button type="button" className="ec-btn ec-btn--primary" disabled={!canCreate || !policy?.executionEnabled || (policy?.budget.remaining ?? 0) < 1} onClick={() => void executeNext(selected.id, selected.version)}>{policy?.executionEnabled ? STEP_LABELS[nextStep].action : "Исполнитель не настроен"}</button></>}</div></section>
            )}

            <section className="ec-growth-evidence" aria-labelledby="growth-evidence-title"><div className="ec-growth-panel-head"><div><p className="ec-agent-office__section-label">Доказательства</p><h2 id="growth-evidence-title">Что проверить</h2></div><span>{selected.run.input.evidenceCards?.length ?? 0} карточек · {selected.run.input.sourceUrls.length} ссылок</span></div><p>{selected.run.input.evidenceNotes}</p><EvidenceCardSummary cards={selected.run.input.evidenceCards ?? []} /><ul>{selected.run.input.sourceUrls.map((url) => <li key={url}><a href={url} target="_blank" rel="noopener noreferrer">{new URL(url).hostname}<span>Открыть источник</span></a></li>)}</ul></section>

            <section className="ec-growth-artifacts" aria-labelledby="growth-artifacts-title"><div className="ec-growth-panel-head"><div><p className="ec-agent-office__section-label">История запуска</p><h2 id="growth-artifacts-title">Результаты ролей</h2></div><span>{selected.run.artifacts.length} / 5</span></div>{selected.run.artifacts.length === 0 ? <div className="ec-growth-artifacts__empty">Здесь появится результат исследователя после первого запуска.</div> : selected.run.artifacts.map((artifact) => <details key={artifact.step} open={artifact.step === selected.run.artifacts.at(-1)?.step}><summary><span>{STEP_LABELS[artifact.step].role}</span><strong>{STEP_LABELS[artifact.step].result}</strong></summary><div>{artifact.content}</div></details>)}</section>
          </section>

          <aside className="ec-agent-office__side" aria-label="Решение по материалу">
            {selected.run.status === "ready_for_approval" ? <section className="ec-growth-review" data-status={selected.reviewStatus}><p className="ec-agent-office__section-label">Ручное решение · v{selected.version}</p><h2>{REVIEW_LABELS[selected.reviewStatus]}</h2>{selected.reviewStatus === "PENDING" ? <><p>Проверьте финальный текст, ссылки и призыв к действию. Это решение не публикует материал.</p>{canReview ? <><label htmlFor="growth-review-note">Комментарий команды</label><textarea id="growth-review-note" value={reviewNote} maxLength={1000} placeholder="Что исправить или почему материал готов" onChange={(event) => setReviewNote(event.target.value)} /><label className="ec-growth-review__confirm"><input type="checkbox" checked={humanConfirmed} onChange={(event) => setHumanConfirmed(event.target.checked)} /><span>Я вручную проверил факты, ссылки и призыв к действию.</span></label><div className="ec-growth-review__actions"><button type="button" className="ec-btn ec-btn--primary" disabled={!humanConfirmed || reviewingId === selected.id} onClick={() => void submitReview("APPROVE")}>Утвердить материал</button><button type="button" className="ec-btn ec-btn--danger" disabled={reviewNote.trim().length < 3 || reviewingId === selected.id} onClick={() => void submitReview("REJECT")}>Вернуть на доработку</button></div></> : <div className="ec-growth-review__readonly">Вы можете читать материал. Решение фиксирует участник с правом согласования.</div>}</> : <><p>{selected.reviewStatus === "APPROVED" ? "Материал принят для дальнейшей ручной работы." : "Материал остановлен до новой версии."}</p>{selected.reviewNote && <blockquote>{selected.reviewNote}</blockquote>}</>}</section> : <section className="ec-growth-guide"><p className="ec-agent-office__section-label">Как это работает</p><h2>Вы управляете каждым шагом</h2><ol>{STEP_ORDER.map((step, index) => <li key={step} data-state={index < selected.run.artifacts.length ? "done" : index === selected.run.artifacts.length ? "next" : "waiting"}><span>{index < selected.run.artifacts.length ? "✓" : index + 1}</span><div><strong>{STEP_LABELS[step].role}</strong><small>{STEP_LABELS[step].action}</small></div></li>)}</ol><p>Остановка не удаляет уже готовые результаты. Повторный запуск всегда требует отдельного клика.</p></section>}
            <section><p className="ec-agent-office__section-label">Происхождение</p><dl className="ec-growth-provenance"><div><dt>Создал</dt><dd>{selected.importedBy?.displayName ?? "Удалённый участник"}</dd></div><div><dt>Исходный запуск</dt><dd title={selected.sourceRunId}>{selected.sourceRunId}</dd></div><div><dt>Контракт</dt><dd>{selected.schemaVersion}</dd></div><div><dt>Создано</dt><dd>{formatDate(selected.createdAt)}</dd></div></dl></section>
          </aside>
        </div>
      ) : null}
    </main>
  );
}
export function AgentOffice(props: AgentOfficeProps) {
  const [workspace, setWorkspace] = useState<"growth" | "audit" | "voice" | "deck" | "builder" | "spec">("growth");
  return (
    <div className="ec-office-surface">
      <header className="ec-agent-office-switcher">
        <div className="ec-agent-office-switcher__identity">
          <img src={`${import.meta.env.BASE_URL}brand-mark.svg`} alt="" aria-hidden />
          <div><strong>AI-офис</strong><span>Работа · проверка · решения</span></div>
        </div>
        <nav className="ec-agent-office-switcher__tabs" aria-label="Разделы AI-офиса">
          <button type="button" data-active={workspace === "growth"} aria-pressed={workspace === "growth"} onClick={() => setWorkspace("growth")}>Контент</button>
          <button type="button" data-active={workspace === "audit"} aria-pressed={workspace === "audit"} onClick={() => setWorkspace("audit")}>Аудит процессов</button>
          <button type="button" data-active={workspace === "voice"} aria-pressed={workspace === "voice"} onClick={() => setWorkspace("voice")}>Голосовые команды</button>
          <button type="button" aria-pressed="false" onClick={props.onOpenLanTransfer}>Передача рядом</button>
          <button type="button" data-active={workspace === "deck"} aria-pressed={workspace === "deck"} onClick={() => setWorkspace("deck")}>Презентации</button>
          <button type="button" data-active={workspace === "builder"} aria-pressed={workspace === "builder"} onClick={() => setWorkspace("builder")}>Сборка</button>
          <button type="button" data-active={workspace === "spec"} aria-pressed={workspace === "spec"} onClick={() => setWorkspace("spec")}>Требования</button>
        </nav>
        <label className="ec-agent-office-switcher__context">
          <span>Пространство</span>
          <select value={props.serverId ?? ""} onChange={(event) => event.target.value && props.onSelectWorkspace(event.target.value)}>
            <option value="">Выберите пространство</option>
            {props.workspaces.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
      </header>
      {!props.serverId ? (
        <main className="ec-office-picker" aria-labelledby="office-picker-title">
          <section className="ec-office-picker__intro">
            <span className="ec-office-picker__mark"><CommandRoomIcon /></span>
            <p>Контекст работы</p>
            <h1 id="office-picker-title">Выберите пространство</h1>
            <span>AI-офис изолирует материалы, права и решения каждой команды. Выбор применяется сразу и не подключает внешние действия.</span>
          </section>
          <div className="ec-office-picker__list" aria-label="Доступные пространства">
            {props.workspaces.length ? props.workspaces.map((item) => (
              <button key={item.id} type="button" onClick={() => props.onSelectWorkspace(item.id)}>
                <span aria-hidden>{item.name.trim().charAt(0).toUpperCase() || "E"}</span>
                <strong>{item.name}</strong>
                <small>Открыть AI-офис</small>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m9 18 6-6-6-6" /></svg>
              </button>
            )) : <p>Доступных пространств пока нет. Создайте первое пространство в основной навигации.</p>}
          </div>
        </main>
      ) : workspace === "growth" ? <GrowthCommandRoom {...props} /> : workspace === "audit" ? <AutomationAuditReviewRoom {...props} /> : workspace === "voice" ? <VoiceOpsRoom {...props} /> : workspace === "deck" ? <DeckReviewRoom {...props} /> : workspace === "builder" ? <BuilderReviewRoom {...props} /> : <SpecGateReviewRoom {...props} />}
    </div>
  );
}
