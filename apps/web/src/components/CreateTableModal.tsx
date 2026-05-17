import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { Modal } from "./Modal";
import {
  loadTableTemplates,
  type TableTemplateDescriptor,
} from "../hooks/useOperationalTables";

/**
 * Create-table modal (v0.70 phase 2.5a).
 *
 * Заменяет window.prompt: пользователь выбирает template (blank / tasks /
 * leads / ...) + указывает название. Templates загружаются один раз через
 * loadTableTemplates() — кэшируется в hook. Default — blank, который
 * эквивалентен legacy behavior'у.
 *
 * Submit → onCreate(templateId, name) — caller вызывает createTable или
 * createFromTemplate в зависимости от templateId === "blank".
 */

type Props = {
  onClose: () => void;
  onCreate: (templateId: string, name: string) => Promise<boolean>;
};

const templateCardBase: CSSProperties = {
  display: "block",
  width: "100%",
  textAlign: "left",
  padding: "var(--ec-space-3) var(--ec-space-4)",
  background: "var(--ec-surface-2)",
  border: "1px solid var(--ec-border-subtle)",
  borderRadius: "var(--ec-radius-md)",
  cursor: "pointer",
  transition:
    "border-color var(--ec-dur-fast) var(--ec-ease), background var(--ec-dur-fast) var(--ec-ease)",
};

const templateCardActive: CSSProperties = {
  borderColor: "var(--ec-accent)",
  background: "var(--ec-accent-soft)",
};

const cardLabel: CSSProperties = {
  fontWeight: 600,
  fontSize: "var(--ec-text-sm)",
  color: "var(--ec-text-strong)",
  marginBottom: 2,
};

const cardDesc: CSSProperties = {
  fontSize: "var(--ec-text-2xs)",
  color: "var(--ec-text-muted)",
  lineHeight: "var(--ec-leading-snug)",
};

const cardFields: CSSProperties = {
  marginTop: 4,
  fontSize: "0.65rem",
  color: "var(--ec-text-dim)",
  letterSpacing: "0.02em",
};

export function CreateTableModal({ onClose, onCreate }: Props) {
  const [templates, setTemplates] = useState<TableTemplateDescriptor[]>([]);
  const [templatesLoaded, setTemplatesLoaded] = useState(false);
  const [selectedId, setSelectedId] = useState<string>("blank");
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadTableTemplates().then((data) => {
      setTemplates(data);
      setTemplatesLoaded(true);
    });
  }, []);

  const selected = useMemo(
    () => templates.find((t) => t.id === selectedId) ?? null,
    [templates, selectedId],
  );

  // Auto-fill name when user switches template и поле ещё пустое или
  // совпадает с предыдущим default'ом.
  const [nameTouched, setNameTouched] = useState(false);
  useEffect(() => {
    if (!nameTouched && selected) {
      // Default name по template — frontend хранит только label; backend
      // подставит реальное при submit с пустым name. Здесь ставим
      // подсказку чтобы input не выглядел пустым.
      setName("");
    }
  }, [selectedId, selected, nameTouched]);

  const submit = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    const finalName = name.trim() || selected?.label || "Таблица";
    try {
      const ok = await onCreate(selectedId, finalName);
      if (ok) onClose();
      else setError("Не удалось создать таблицу");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title="Новая таблица"
      onClose={onClose}
      width={520}
      footer={
        <>
          <button type="button" onClick={onClose} className="ec-btn">
            Отмена
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={submitting}
            className="ec-btn ec-btn--primary"
          >
            {submitting ? "Создаём…" : "Создать"}
          </button>
        </>
      }
    >
      <p style={{ margin: 0, color: "var(--ec-text-muted)", fontSize: "var(--ec-text-sm)" }}>
        Выберите шаблон — поля будут созданы автоматически. Любой можно
        дополнить или удалить потом.
      </p>

      <div>
        <label className="ec-field-label">Название</label>
        <input
          className="ec-field"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setNameTouched(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void submit();
            }
          }}
          placeholder={selected?.label ?? "Например — Бэклог проекта"}
          maxLength={120}
          autoFocus
        />
      </div>

      <div>
        <label className="ec-field-label">Шаблон</label>
        {!templatesLoaded ? (
          <p style={{ color: "var(--ec-text-dim)", fontSize: "var(--ec-text-sm)" }}>
            Загружаем шаблоны…
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--ec-space-2)" }}>
            {templates.map((t) => {
              const active = t.id === selectedId;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSelectedId(t.id)}
                  style={{
                    ...templateCardBase,
                    ...(active ? templateCardActive : null),
                  }}
                  aria-pressed={active}
                >
                  <div style={cardLabel}>{t.label}</div>
                  <div style={cardDesc}>{t.description}</div>
                  {t.fieldNames.length > 0 && (
                    <div style={cardFields}>
                      {t.fieldCount} {pluralizeFields(t.fieldCount)}: {t.fieldNames.join(" · ")}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {error && (
        <p style={{ margin: 0, color: "var(--ec-danger)", fontSize: "var(--ec-text-sm)" }}>
          {error}
        </p>
      )}
    </Modal>
  );
}

function pluralizeFields(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return "полей";
  if (mod10 === 1) return "поле";
  if (mod10 >= 2 && mod10 <= 4) return "поля";
  return "полей";
}
