import { useEffect, useId, useRef, useState } from "react";
import type { ActionItemPriority } from "../lib/socket";
import { MAX_ACTION_TEMPLATES, MAX_TEMPLATE_NAME, readActionTemplates, removeActionTemplate, saveActionTemplate } from "../lib/actionTemplates";
import type { ActionTemplatesWriteResult } from "../lib/actionTemplates";
import { EclipseUiIcon } from "./icons/EclipseUiIcon";

type Props = {
  userId: string;
  description: string;
  priority: ActionItemPriority;
  disabled: boolean;
  onApply: (description: string, priority: ActionItemPriority) => void;
};

const PRIORITY_LABELS: Record<ActionItemPriority, string> = {
  LOW: "Низкий", NORMAL: "Обычный", HIGH: "Высокий", URGENT: "Срочный",
};

export function ActionTemplateControls({ userId, description, priority, disabled, onApply }: Props) {
  const infoId = useId();
  const [snapshot, setSnapshot] = useState(() => readActionTemplates(userId));
  const [name, setName] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [notice, setNotice] = useState("");
  const [operationError, setOperationError] = useState("");
  const [pending, setPending] = useState(false);
  const operation = useRef(false);
  const generation = useRef(0);
  useEffect(() => () => { generation.current++; }, []);
  const selected = snapshot.templates.find(template => template.id === selectedId);
  const blocked = disabled || pending || !!snapshot.error;
  const error = snapshot.error || operationError;
  const refresh = () => {
    if (disabled || operation.current) return;
    const current = readActionTemplates(userId);
    setSnapshot(current);
    setSelectedId(previous => current.templates.some(template => template.id === previous) ? previous : "");
    setOperationError("");
    setNotice(current.error ? "" : "Список шаблонов обновлён.");
  };
  const mutate = async (run: () => Promise<ActionTemplatesWriteResult>, onSuccess: () => void, progress: string, success: string) => {
    if (blocked || operation.current) return;
    operation.current = true; setPending(true); setOperationError(""); setNotice(progress);
    const token = generation.current;
    try {
      const result = await run();
      if (token !== generation.current) return;
      if (!result.ok) {
        setNotice(""); setOperationError(result.error || "Не удалось изменить шаблоны.");
        if (["CONFLICT", "CORRUPT", "STORAGE_UNAVAILABLE", "LOCK_UNAVAILABLE"].includes(result.code || "")) setSnapshot(previous => ({ ...previous, error: result.error, code: result.code }));
        return;
      }
      setSnapshot({ templates: result.templates, raw: result.raw, error: null, code: null });
      onSuccess(); setNotice(success);
    } catch {
      if (token === generation.current) { setNotice(""); setOperationError("Не удалось изменить шаблоны. Перечитайте список и повторите действие."); }
    } finally {
      if (token === generation.current) { operation.current = false; setPending(false); }
    }
  };
  const save = () => mutate(
    () => saveActionTemplate(userId, { name, description, priority }, snapshot.raw),
    () => setName(""), "Сохраняю шаблон…", "Шаблон сохранён на этом устройстве.",
  );
  const apply = () => {
    if (blocked || operation.current || !selected) return;
    const changesDraft = description !== selected.description || priority !== selected.priority;
    if (changesDraft && (description.trim() || priority !== "NORMAL") && !window.confirm("Заменить описание и приоритет данными шаблона «" + selected.name + "»?")) return;
    onApply(selected.description, selected.priority);
    setOperationError(""); setNotice("Описание и приоритет заполнены. Проверьте задачу перед созданием.");
  };
  const remove = () => {
    if (blocked || operation.current || !selected || !window.confirm("Удалить шаблон «" + selected.name + "» с этого устройства?")) return;
    return mutate(
      () => removeActionTemplate(userId, selected.id, snapshot.raw),
      () => setSelectedId(""), "Удаляю шаблон…", "Шаблон удалён.",
    );
  };

  return <details className="ec-action-templates">
    <summary>Мои шаблоны<EclipseUiIcon name="chevron" size={14} /></summary>
    <div className="ec-action-templates__body" aria-busy={disabled || pending}>
      <p id={infoId}>Хранятся только на этом устройстве для вашего аккаунта. Без паролей и личных данных.</p>
      {!snapshot.error && snapshot.templates.length === 0 && <p>Шаблонов пока нет. Сохраните описание и приоритет текущей задачи.</p>}
      {snapshot.templates.length > 0 && <>
        <label>
          <span className="ec-field-label">Шаблон задачи</span>
          <select className="ec-field" value={selectedId} disabled={blocked} aria-label="Шаблон задачи" aria-describedby={infoId}
            onChange={event => { setSelectedId(event.target.value); setOperationError(""); setNotice(""); }}>
            <option value="">Выберите шаблон</option>
            {snapshot.templates.map(template => <option key={template.id} value={template.id}>{template.name}</option>)}
          </select>
        </label>
        {selected && <div className="ec-action-templates__preview" role="region" aria-label="Содержимое шаблона" tabIndex={0}>
          <p>Приоритет: {PRIORITY_LABELS[selected.priority]}</p><p>{selected.description}</p>
        </div>}
        <div className="ec-action-templates__actions">
          <button type="button" className="ec-btn ec-btn--secondary ec-btn--sm" disabled={blocked || !selected} onClick={apply}>Применить шаблон</button>
          <button type="button" className="ec-btn ec-btn--secondary ec-btn--sm" disabled={blocked || !selected} onClick={remove}>Удалить шаблон</button>
        </div>
      </>}
      <div className="ec-action-templates__save">
        <label>
          <span className="ec-field-label">Название шаблона</span>
          <input className="ec-field" value={name} maxLength={MAX_TEMPLATE_NAME} disabled={blocked}
            onChange={event => { setName(event.target.value); setOperationError(""); setNotice(""); }}
            onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); if (!event.nativeEvent.isComposing && name.trim() && description.trim() && snapshot.templates.length < MAX_ACTION_TEMPLATES) void save(); } }}
            placeholder="Например, проверка перед выпуском" autoComplete="off" />
        </label>
        <button type="button" className="ec-btn ec-btn--secondary ec-btn--sm" onClick={save}
          disabled={blocked || !name.trim() || !description.trim() || snapshot.templates.length >= MAX_ACTION_TEMPLATES}>Сохранить шаблон</button>
      </div>
      <p>{snapshot.templates.length} из {MAX_ACTION_TEMPLATES} шаблонов{snapshot.templates.length >= MAX_ACTION_TEMPLATES ? ". Чтобы сохранить новый, удалите ненужный." : !description.trim() ? ". Сначала заполните описание задачи." : "."}</p>
      {error && <p className="ec-action-templates__error" role="alert">{error}</p>}
      {notice && <p role="status" aria-live="polite">{notice}</p>}
      <button type="button" className="ec-btn ec-btn--secondary ec-btn--sm" disabled={disabled || pending} onClick={refresh}>Перечитать шаблоны</button>
    </div>
  </details>;
}
