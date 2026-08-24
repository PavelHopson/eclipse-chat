import { type FormEvent, useEffect, useMemo, useState } from "react";
import type { MemberRole } from "../../hooks/useMembers";
import { useOfficeEvents } from "../../hooks/useOfficeEvents";
import {
  type CreativeJobInput,
  type CreativeJobStatus,
  type CreativeJobView,
  useCreativeJobs,
} from "../../hooks/useCreativeJobs";
import { hasPermission } from "../../lib/memberRoles";
import "../../styles/creative-studio.css";

type Props = {
  serverId: string | null;
  serverName: string | null;
  currentRole: MemberRole | null;
  onOpenLanTransfer: () => void;
};

const STATUS: Record<CreativeJobStatus, string> = {
  awaiting_quote: "Нужна стоимость",
  awaiting_approval: "Нужно проверить",
  approved: "Готово к созданию",
  ready: "Файл готов",
  rejected: "Вернули на доработку",
  failed: "Не удалось выполнить",
};

const NEXT_STEP: Record<CreativeJobStatus, { title: string; detail: string }> = {
  awaiting_quote: {
    title: "Получите точную стоимость",
    detail: "Платный запуск недоступен, пока официальный провайдер не подтвердит цену. Деньги не списываются.",
  },
  awaiting_approval: {
    title: "Проверьте задание и подтвердите его",
    detail: "Отметьте три пункта справа: содержание, права на материалы и стоимость. После этого станет доступно создание.",
  },
  approved: {
    title: "Создайте проверочный пакет",
    detail: "Подтверждение получено. Нажмите кнопку справа — пакет будет собран без обращения к внешнему сервису.",
  },
  ready: {
    title: "Скачайте файл или передайте его рядом",
    detail: "Результат готов. Скачайте его на устройство или откройте безопасную передачу через LocalSend.",
  },
  rejected: {
    title: "Исправьте замечания и создайте новое задание",
    detail: "Причина возврата показана справа. Создайте новую версию через кнопку вверху.",
  },
  failed: {
    title: "Создайте новое задание",
    detail: "Автоматический повтор отключён. Проверьте данные и запустите новую версию вручную.",
  },
};

const EMPTY: CreativeJobInput = {
  title: "",
  objective: "",
  mediaType: "video",
  aspectRatio: "9:16",
  durationSeconds: 10,
  outputCount: 1,
  styleNotes: "",
  avoid: "",
  sourceUrls: [],
  providerMode: "preview",
};

function StudioIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M4 5.5h16v13H4z" /><path d="m9.5 9 5.5 3-5.5 3V9Z" /><path d="M7 2.5v3M17 2.5v3M7 18.5v3M17 18.5v3" /></svg>;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function JobRow({ item, selected, onSelect }: { item: CreativeJobView; selected: boolean; onSelect: () => void }) {
  return (
    <button type="button" className="ec-creative-row" data-selected={selected} data-status={item.status} onClick={onSelect}>
      <span className="ec-creative-row__signal" aria-hidden />
      <span><strong>{item.job.input.title}</strong><small>{item.job.input.mediaType === "video" ? "Видео" : "Изображение"} · {formatDate(item.createdAt)}</small></span>
      <em>{STATUS[item.status]}</em>
    </button>
  );
}

export function CreativeStudioRoom({ serverId, serverName, currentRole, onOpenLanTransfer }: Props) {
  const studio = useCreativeJobs(serverId);
  const office = useOfficeEvents(serverId);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [input, setInput] = useState<CreativeJobInput>(EMPTY);
  const [sourceText, setSourceText] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [checks, setChecks] = useState({ brief: false, rights: false, cost: false });
  const selected = useMemo(
    () => studio.jobs.find((item) => item.id === selectedId) ?? studio.jobs[0] ?? null,
    [selectedId, studio.jobs],
  );
  const canCreate = currentRole != null && hasPermission(currentRole, "TASK_CREATE");
  const canReview = currentRole != null && hasPermission(currentRole, "TASK_APPROVE");
  const relevantEvents = selected
    ? office.events.filter((event) => event.subject.id === selected.id).slice(-5).reverse()
    : [];
  const nextStep = selected ? NEXT_STEP[selected.status] : null;

  useEffect(() => {
    if (!selectedId && studio.jobs[0]) setSelectedId(studio.jobs[0].id);
    if (selectedId && !studio.jobs.some((item) => item.id === selectedId)) setSelectedId(studio.jobs[0]?.id ?? null);
  }, [selectedId, studio.jobs]);

  useEffect(() => {
    setChecks({ brief: false, rights: false, cost: false });
    setNote(selected?.job.approval?.note ?? "");
  }, [selected?.id, selected?.job.approval?.note]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLocalError(null);
    studio.clearError();
    const rawUrls = sourceText.split(/\r?\n/).map((value) => value.trim()).filter(Boolean);
    if (rawUrls.length > 8) {
      setLocalError("Добавьте не больше 8 ссылок.");
      return;
    }
    const unsafe = rawUrls.some((value) => {
      try {
        const url = new URL(value);
        return url.protocol !== "https:" || Boolean(url.username || url.password);
      } catch { return true; }
    });
    if (unsafe) {
      setLocalError("Источники должны быть полными HTTPS-ссылками без логина и пароля.");
      return;
    }
    const created = await studio.createJob({ ...input, sourceUrls: rawUrls });
    if (created) {
      setSelectedId(created.id);
      setInput(EMPTY);
      setSourceText("");
      setCreateOpen(false);
    }
  };

  const decide = async (decision: "APPROVE" | "REJECT") => {
    if (!selected) return;
    await studio.reviewJob(selected.id, selected.version, {
      decision,
      humanConfirmed: decision === "APPROVE" ? checks.brief : undefined,
      rightsConfirmed: decision === "APPROVE" ? checks.rights : undefined,
      costConfirmed: decision === "APPROVE" ? checks.cost : undefined,
      note: note.trim() || undefined,
    });
  };

  const downloadAndOpenTransfer = async () => {
    if (!selected) return;
    if (await studio.downloadArtifact(selected)) onOpenLanTransfer();
  };

  if (!serverId) return null;

  return (
    <main className="ec-agent-office ec-creative" aria-labelledby="creative-studio-title" aria-busy={studio.loading}>
      <header className="ec-agent-office__header">
        <div className="ec-agent-office__identity">
          <span className="ec-agent-office__mark"><StudioIcon /></span>
          <div>
            <p className="ec-agent-office__eyebrow">{serverName ?? "Eclipse Forge"} · создание контента</p>
            <h1 id="creative-studio-title">Творческая студия</h1>
            <p>Опишите результат, проверьте стоимость, подтвердите запуск и получите готовый файл.</p>
          </div>
        </div>
        <div className="ec-agent-office__run-meta">
          <button type="button" className="ec-btn ec-btn--secondary ec-creative-help" aria-expanded={guideOpen} onClick={() => setGuideOpen((value) => !value)}>
            {guideOpen ? "Скрыть инструкцию" : "Как пользоваться"}
          </button>
          <span className="ec-agent-office__queue">Нужно проверить: {studio.jobs.filter((item) => item.status === "awaiting_approval").length}</span>
          <button type="button" className="ec-btn ec-btn--primary" disabled={!canCreate || studio.creating} onClick={() => setCreateOpen((value) => !value)}>
            {createOpen ? "Отменить создание" : "Создать задание"}
          </button>
        </div>
      </header>

      <section className="ec-agent-office__safety" aria-label="Правила безопасного создания">
        <strong>Безопасный режим</strong>
        <span>Ничего не запускается и не оплачивается без вашего отдельного подтверждения.</span>
        <span className="ec-growth-budget">Проверочный пакет: 0 кредитов</span>
      </section>

      {guideOpen && (
        <section className="ec-creative-guide" aria-labelledby="creative-guide-title">
          <header>
            <div><p className="ec-agent-office__section-label">Короткая инструкция</p><h2 id="creative-guide-title">От идеи до готового файла — четыре шага</h2></div>
            <button type="button" aria-label="Закрыть инструкцию" onClick={() => setGuideOpen(false)}>Закрыть</button>
          </header>
          <ol>
            <li><span>1</span><div><strong>Опишите результат</strong><small>Укажите задачу, формат и визуальное направление.</small></div></li>
            <li><span>2</span><div><strong>Проверьте стоимость</strong><small>Для первого запуска оставьте бесплатный проверочный пакет.</small></div></li>
            <li><span>3</span><div><strong>Подтвердите задание</strong><small>Проверьте содержание, права на материалы и цену.</small></div></li>
            <li><span>4</span><div><strong>Получите файл</strong><small>Скачайте результат или передайте его на другое устройство.</small></div></li>
          </ol>
          <p><strong>Быстрый старт:</strong> нажмите «Создать задание», заполните три обязательных поля и выберите «Проверочный пакет». Он создаёт файл для проверки и не тратит кредиты.</p>
        </section>
      )}

      {createOpen && (
        <form className="ec-creative-create" onSubmit={(event) => void submit(event)}>
          <div className="ec-creative-create__intro"><div><p className="ec-agent-office__section-label">Шаг 1 из 4</p><h2>Опишите результат</h2><p>Обязательны название, задача и визуальное направление. Остальное уже настроено безопасными значениями.</p></div><span>Черновик не расходует кредиты</span></div>
          <div className="ec-creative-create__grid">
            <label><span>Название задания</span><input required minLength={3} maxLength={120} value={input.title} placeholder="Например: ролик о новой функции" onChange={(event) => setInput({ ...input, title: event.target.value })} /><small>Видно только в вашей очереди.</small></label>
            <label><span>Что создаём</span><select value={input.mediaType} onChange={(event) => { const mediaType = event.target.value as CreativeJobInput["mediaType"]; setInput({ ...input, mediaType, durationSeconds: mediaType === "video" ? 10 : null }); }}><option value="video">Видео</option><option value="image">Изображение</option></select><small>Тип итогового файла.</small></label>
            <label className="ec-creative-create__wide"><span>Что должен понять зритель</span><textarea required minLength={20} maxLength={2000} value={input.objective} placeholder="Например: за 10 секунд показать, как функция экономит время команды" onChange={(event) => setInput({ ...input, objective: event.target.value })} /><small>Одна конкретная мысль работает лучше длинного описания.</small></label>
            <label><span>Формат</span><select value={input.aspectRatio} onChange={(event) => setInput({ ...input, aspectRatio: event.target.value as CreativeJobInput["aspectRatio"] })}><option value="9:16">9:16 · вертикальный</option><option value="16:9">16:9 · горизонтальный</option><option value="4:5">4:5 · пост</option><option value="1:1">1:1 · квадрат</option></select></label>
            {input.mediaType === "video" && <label><span>Длительность</span><select value={input.durationSeconds ?? 10} onChange={(event) => setInput({ ...input, durationSeconds: Number(event.target.value) })}><option value={5}>5 секунд</option><option value={10}>10 секунд</option><option value={15}>15 секунд</option><option value={20}>20 секунд</option><option value={30}>30 секунд</option></select></label>}
            <label><span>Варианты</span><select value={input.outputCount} onChange={(event) => setInput({ ...input, outputCount: Number(event.target.value) })}>{[1, 2, 3, 4].map((value) => <option value={value} key={value}>{value}</option>)}</select></label>
            <label className="ec-creative-create__wide"><span>Как это должно выглядеть</span><textarea required minLength={3} maxLength={2000} value={input.styleNotes} placeholder="Например: тёмная студия, мягкий боковой свет, медленное движение камеры, без текста в кадре" onChange={(event) => setInput({ ...input, styleNotes: event.target.value })} /><small>Опишите свет, композицию, камеру, материалы и темп обычными словами.</small></label>
            <label><span>Исключить</span><textarea minLength={3} maxLength={1000} value={input.avoid ?? ""} placeholder="Что не должно появиться" onChange={(event) => setInput({ ...input, avoid: event.target.value })} /></label>
            <label><span>Источники</span><textarea maxLength={16384} value={sourceText} placeholder="HTTPS-ссылки, по одной на строку" onChange={(event) => setSourceText(event.target.value)} /></label>
          </div>
          <fieldset className="ec-creative-mode">
            <legend>Шаг 2. Выберите способ создания</legend>
            <label data-selected={input.providerMode === "preview"}><input type="radio" name="creative-mode" value="preview" checked={input.providerMode === "preview"} onChange={() => setInput({ ...input, providerMode: "preview" })} /><span><strong>Проверочный пакет</strong><small>0 кредитов · создаёт JSON-задание для проверки и передачи</small></span></label>
            <label data-selected={input.providerMode === "higgsfield"}><input type="radio" name="creative-mode" value="higgsfield" checked={input.providerMode === "higgsfield"} onChange={() => setInput({ ...input, providerMode: "higgsfield" })} /><span><strong>Higgsfield</strong><small>Задание сохранится, запуск останется заблокирован до OAuth и точной оценки</small></span></label>
          </fieldset>
          <div className="ec-growth-create__actions"><p>Для первого запуска оставьте бесплатный проверочный пакет. Платный сервис можно подключить позже.</p><button type="submit" className="ec-btn ec-btn--primary" disabled={studio.creating}>{studio.creating ? "Сохраняем…" : "Сохранить и перейти к проверке"}</button></div>
        </form>
      )}

      {(localError || studio.error) && <div className="ec-growth-alert" role="alert"><span>{localError ?? studio.error}</span><div><button type="button" onClick={() => void studio.reload()}>Повторить</button><button type="button" onClick={() => { setLocalError(null); studio.clearError(); }}>Закрыть</button></div></div>}

      {studio.loading ? (
        <section className="ec-growth-loading" aria-label="Загрузка Creative Studio"><span /><span /><span /></section>
      ) : studio.jobs.length === 0 && !createOpen ? (
        <section className="ec-growth-empty"><span className="ec-agent-office__mark"><StudioIcon /></span><h2>Создайте первый проверочный пакет</h2><p>Это безопасный пробный запуск: вы заполните задание, подтвердите его и получите файл. Кредиты не списываются.</p><div className="ec-creative-empty__actions"><button type="button" className="ec-btn ec-btn--primary" disabled={!canCreate} onClick={() => setCreateOpen(true)}>Создать задание</button><button type="button" className="ec-btn ec-btn--secondary" onClick={() => setGuideOpen(true)}>Открыть инструкцию</button></div></section>
      ) : selected ? (
        <div className="ec-creative-workspace">
          <aside className="ec-creative-list" aria-label="Задания Creative Studio">
            <div className="ec-growth-panel-head"><div><p className="ec-agent-office__section-label">Очередь</p><h2>Задания</h2></div><span>{studio.jobs.length}</span></div>
            <div>{studio.jobs.map((item) => <JobRow key={item.id} item={item} selected={item.id === selected.id} onSelect={() => setSelectedId(item.id)} />)}</div>
          </aside>

          <section className="ec-creative-main">
            <div className="ec-agent-office__objective"><div><p className="ec-agent-office__section-label">{selected.job.input.mediaType === "video" ? "Видео" : "Изображение"} · {selected.job.input.aspectRatio}</p><h2>{selected.job.input.title}</h2><p>{selected.job.input.objective}</p></div><span className="ec-agent-office__status" data-status={selected.status}>{STATUS[selected.status]}</span></div>
            {nextStep && <section className="ec-creative-next" data-status={selected.status}><p className="ec-agent-office__section-label">Что делать сейчас</p><h2>{nextStep.title}</h2><p>{nextStep.detail}</p></section>}
            <div className="ec-creative-flow" aria-label="Ход работы">
              {["Задание", "Стоимость", "Подтверждение", "Выполнение", "Передача"].map((label, index) => {
                const completed = index === 0 || (index === 1 && selected.job.quote.state === "quoted") || (index === 2 && selected.job.approval?.decision === "approved") || (index === 3 && selected.status === "ready");
                const active = !completed && ((index === 1 && selected.status === "awaiting_quote") || (index === 2 && selected.status === "awaiting_approval") || (index === 3 && selected.status === "approved") || (index === 4 && selected.status === "ready"));
                return <span key={label} data-state={completed ? "done" : active ? "active" : "waiting"}><i>{completed ? "✓" : index + 1}</i><small>{label}</small></span>;
              })}
            </div>
            <dl className="ec-agent-office__guardrails"><div><dt>Режим</dt><dd>{selected.job.input.providerMode === "preview" ? "Проверочный пакет" : "Higgsfield"}</dd></div><div><dt>Результатов</dt><dd>{selected.job.input.outputCount}</dd></div><div><dt>Длительность</dt><dd>{selected.job.input.durationSeconds ? `${selected.job.input.durationSeconds} сек.` : "—"}</dd></div><div><dt>Публикация</dt><dd>Запрещена</dd></div></dl>

            <section className="ec-creative-brief"><p className="ec-agent-office__section-label">Техническое задание</p><h2>Визуальное направление</h2><p>{selected.job.input.styleNotes}</p>{selected.job.input.avoid && <div><strong>Исключить</strong><span>{selected.job.input.avoid}</span></div>}{selected.job.input.sourceUrls.length > 0 && <ul>{selected.job.input.sourceUrls.map((url) => <li key={url}><a href={url} target="_blank" rel="noopener noreferrer">{new URL(url).hostname}<span>Открыть источник</span></a></li>)}</ul>}</section>

            <section className="ec-creative-activity" aria-live="polite"><header><div><p className="ec-agent-office__section-label">История</p><h2>Что происходило с заданием</h2></div><span data-connected={office.connected}>{office.connected ? "Обновляется" : "Восстанавливаем связь…"}</span></header>{relevantEvents.length ? <ol>{relevantEvents.map((event) => <li key={event.id}><time dateTime={event.occurredAt}>{new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit" }).format(new Date(event.occurredAt))}</time><span>{event.summary}</span></li>)}</ol> : <p>Первое событие появится после сохранения задания.</p>}</section>
          </section>

          <aside className="ec-creative-side" id="creative-actions" aria-label="Действие и стоимость">
            <section className="ec-creative-quote" data-state={selected.job.quote.state}><p className="ec-agent-office__section-label">Стоимость</p>{selected.job.quote.state === "quoted" ? <><strong>{selected.job.quote.credits}</strong><h2>кредитов</h2><p>{selected.job.quote.statement}</p></> : <><h2>Нужна оценка</h2><p>{selected.job.quote.statement}</p><div className="ec-creative-blocked">Платный запуск заблокирован на сервере</div></>}</section>

            {selected.status === "awaiting_approval" && <section className="ec-creative-review"><p className="ec-agent-office__section-label">Ручное подтверждение · v{selected.version}</p><h2>Проверьте перед запуском</h2>{canReview ? <><label><input type="checkbox" checked={checks.brief} onChange={(event) => setChecks({ ...checks, brief: event.target.checked })} /><span>Задание и формат проверены</span></label><label><input type="checkbox" checked={checks.rights} onChange={(event) => setChecks({ ...checks, rights: event.target.checked })} /><span>Права на материалы подтверждены</span></label><label><input type="checkbox" checked={checks.cost} onChange={(event) => setChecks({ ...checks, cost: event.target.checked })} /><span>Стоимость {selected.job.quote.state === "quoted" ? `${selected.job.quote.credits} кредитов` : "не определена"} понятна</span></label><textarea value={note} maxLength={1000} placeholder="Комментарий или причина доработки" aria-label="Комментарий к Creative-заданию" onChange={(event) => setNote(event.target.value)} /><div><button type="button" className="ec-btn ec-btn--primary" disabled={!checks.brief || !checks.rights || !checks.cost || studio.reviewingId === selected.id} onClick={() => void decide("APPROVE")}>Подтвердить задание</button><button type="button" className="ec-btn ec-btn--danger" disabled={note.trim().length < 3 || studio.reviewingId === selected.id} onClick={() => void decide("REJECT")}>Вернуть на доработку</button></div></> : <p>Вы можете просматривать задание. Решение принимает участник с правом согласования.</p>}</section>}

            {selected.status === "awaiting_quote" && <section className="ec-creative-action"><p className="ec-agent-office__section-label">Следующий шаг</p><h2>Подключить Higgsfield</h2><p>{studio.policy?.higgsfield.reason}</p><a className="ec-btn ec-btn--secondary" href={studio.policy?.higgsfield.mcpUrl ?? "https://mcp.higgsfield.ai/mcp"} target="_blank" rel="noopener noreferrer">Открыть официальный MCP</a><small>Ссылка не передаёт данные задания и не запускает генерацию.</small></section>}

            {selected.status === "approved" && <section className="ec-creative-action"><p className="ec-agent-office__section-label">Подтверждено · v{selected.version}</p><h2>{selected.job.input.providerMode === "preview" ? "Создать проверочный пакет" : "Запустить Higgsfield"}</h2><p>{selected.job.input.providerMode === "preview" ? "Сервер соберёт JSON с заданием, подтверждением и квитанцией. Внешние сервисы не вызываются." : "Платный адаптер пока не настроен, поэтому кнопка остаётся заблокированной."}</p><button type="button" className="ec-btn ec-btn--primary" disabled={!canReview || studio.executingId === selected.id || selected.job.input.providerMode === "higgsfield"} onClick={() => void studio.executeJob(selected.id, selected.version)}>{studio.executingId === selected.id ? "Готовим…" : "Создать пакет"}</button></section>}

            {selected.status === "ready" && selected.job.execution && <section className="ec-creative-ready"><p className="ec-agent-office__section-label">Квитанция выполнения</p><h2>Пакет готов</h2><dl><div><dt>Исполнитель</dt><dd>{selected.job.execution.provider}</dd></div><div><dt>Списано</dt><dd>{selected.job.execution.chargedCredits} кредитов</dd></div><div><dt>Файл</dt><dd>{selected.job.artifact?.filename}</dd></div></dl><button type="button" className="ec-btn ec-btn--primary" disabled={studio.downloadingId === selected.id} onClick={() => void studio.downloadArtifact(selected)}>{studio.downloadingId === selected.id ? "Скачиваем…" : "Скачать пакет"}</button><button type="button" className="ec-btn ec-btn--secondary" disabled={studio.downloadingId === selected.id} onClick={() => void downloadAndOpenTransfer()}>Скачать и отправить рядом</button><small>После скачивания выберите этот файл в «Передаче рядом». Jarvis не получает путь к файлу и не подтверждает отправку за вас.</small></section>}

            {selected.status === "rejected" && <section className="ec-creative-action"><p className="ec-agent-office__section-label">Решение</p><h2>Нужна новая версия</h2><p>{selected.job.approval?.note ?? "Причина не указана"}</p></section>}
          </aside>
        </div>
      ) : null}
    </main>
  );
}
