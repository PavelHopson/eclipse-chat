import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";
import { Modal } from "./Modal";
import type { ChannelType } from "../lib/socket";

/**
 * CreateChannelModal — v0.97 UX refactor.
 *
 * Раньше создание канала жило inline-composer'ом внизу sidebar (4 type-
 * buttons + input + send). Pavel-ask 19.05 «надо сделать отдельную
 * кнопку создания канала». Composer удалён, теперь отдельные «+»
 * triggers в section-headers + большая кнопка сверху Channels tab →
 * открывают этот modal.
 *
 * 4 типа: TEXT (текстовый) / BROADCAST (канал-вещание) / VOICE
 * (голосовой) / EXECUTION (kanban-комната). Pre-select через
 * initialType prop когда юзер кликает «+» рядом с конкретной group.
 */

type Props = {
  open: boolean;
  initialType?: ChannelType;
  onClose: () => void;
  onCreate: (name: string, type: ChannelType) => Promise<void>;
};

const typeOption: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "auto 1fr",
  gap: "var(--ec-space-2)",
  alignItems: "flex-start",
  padding: "var(--ec-space-3)",
  borderRadius: "var(--ec-radius-md)",
  background: "var(--ec-surface-1)",
  border: "1px solid var(--ec-border-default)",
  cursor: "pointer",
  textAlign: "left",
  transition:
    "background var(--ec-dur-fast) var(--ec-ease), border-color var(--ec-dur-fast) var(--ec-ease), box-shadow var(--ec-dur-fast) var(--ec-ease)",
};

function typeOptionActive(active: boolean): CSSProperties {
  return active
    ? {
        background: "var(--ec-accent-soft)",
        borderColor: "var(--ec-border-accent)",
        boxShadow:
          "0 0 0 1px var(--ec-accent), 0 0 12px -2px hsl(258 90% 66% / 0.3)",
      }
    : {};
}

const inputStyle: CSSProperties = {
  width: "100%",
  padding: "0.6rem 0.75rem",
  borderRadius: "var(--ec-radius-md)",
  border: "1px solid var(--ec-border-default)",
  background: "var(--ec-surface-1)",
  color: "var(--ec-text)",
  fontSize: "var(--ec-text-sm)",
  fontFamily: "inherit",
};

const fieldLabel: CSSProperties = {
  fontSize: "var(--ec-text-2xs)",
  fontWeight: 700,
  letterSpacing: "var(--ec-tracking-caps)",
  textTransform: "uppercase",
  color: "var(--ec-text-muted)",
  display: "block",
  marginBottom: "var(--ec-space-2)",
};

const fieldHint: CSSProperties = {
  fontSize: "var(--ec-text-2xs)",
  color: "var(--ec-text-dim)",
  lineHeight: 1.5,
  margin: "var(--ec-space-1) 0 0",
};

const TYPE_OPTIONS: Array<{
  id: ChannelType;
  title: string;
  desc: string;
  icon: React.ReactNode;
}> = [
  {
    id: "TEXT",
    title: "Текстовый",
    desc: "Обычный чат — сообщения, треды, файлы.",
    icon: (
      <span
        aria-hidden
        style={{
          fontSize: "1.1rem",
          lineHeight: 1,
          fontFamily: "var(--ec-font-mono)",
          color: "var(--ec-accent)",
          fontWeight: 600,
        }}
      >
        #
      </span>
    ),
  },
  {
    id: "BROADCAST",
    title: "Канал-вещание",
    desc: "Публикуют модераторы, читают все. Для анонсов.",
    icon: (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ color: "var(--ec-accent)" }}
        aria-hidden
      >
        <path d="M3 11l15-5v12L3 13v-2z" />
        <path d="M11.6 16.8a3 3 0 11-5.8-1.6" />
        <path d="M21 9v6" />
      </svg>
    ),
  },
  {
    id: "VOICE",
    title: "Голосовой",
    desc: "LiveKit-комната — voice + камера + screen share.",
    icon: (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ color: "var(--ec-accent)" }}
        aria-hidden
      >
        <path d="M11 5L6 9H2v6h4l5 4V5z" />
        <path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07" />
      </svg>
    ),
  },
  {
    id: "EXECUTION",
    title: "Канбан",
    desc: "Execution-комната — kanban-доска вместо чата.",
    icon: (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ color: "var(--ec-accent)" }}
        aria-hidden
      >
        <rect x="3" y="3" width="7" height="9" rx="1" />
        <rect x="14" y="3" width="7" height="5" rx="1" />
        <rect x="14" y="12" width="7" height="9" rx="1" />
        <rect x="3" y="16" width="7" height="5" rx="1" />
      </svg>
    ),
  },
];

export function CreateChannelModal({
  open,
  initialType = "TEXT",
  onClose,
  onCreate,
}: Props) {
  const [name, setName] = useState("");
  const [type, setType] = useState<ChannelType>(initialType);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset state + focus input на каждом open. Pre-select type через
  // initialType prop (когда user clicks «+» рядом с конкретной group).
  useEffect(() => {
    if (open) {
      setName("");
      setType(initialType);
      setError(null);
      // Wait for modal mount.
      const t = window.setTimeout(() => {
        inputRef.current?.focus();
      }, 80);
      return () => window.clearTimeout(t);
    }
  }, [open, initialType]);

  if (!open) return null;

  const trimmed = name.trim();
  const valid = trimmed.length >= 1 && trimmed.length <= 80;

  const handleSubmit = async () => {
    if (!valid || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await onCreate(trimmed, type);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось создать канал");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title="Создать комнату"
      onClose={onClose}
      width={520}
      footer={
        <>
          <button type="button" onClick={onClose} className="ec-btn ec-btn--ghost">
            Отмена
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={!valid || submitting}
            className="ec-btn ec-btn--primary"
          >
            {submitting ? "Создаём…" : "Создать"}
          </button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void handleSubmit();
        }}
      >
        <div style={{ marginBottom: "var(--ec-space-4)" }}>
          <span style={fieldLabel}>Тип комнаты</span>
          <div
            role="radiogroup"
            aria-label="Тип комнаты"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "var(--ec-space-2)",
            }}
          >
            {TYPE_OPTIONS.map((opt) => {
              const active = type === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setType(opt.id)}
                  style={{ ...typeOption, ...typeOptionActive(active) }}
                >
                  <span
                    style={{
                      display: "grid",
                      placeItems: "center",
                      width: 32,
                      height: 32,
                      borderRadius: "var(--ec-radius-sm)",
                      background: active
                        ? "color-mix(in srgb, var(--ec-accent) 18%, transparent)"
                        : "var(--ec-surface-3)",
                      flexShrink: 0,
                    }}
                  >
                    {opt.icon}
                  </span>
                  <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                    <span style={{ fontSize: "var(--ec-text-sm)", fontWeight: 600, color: "var(--ec-text-strong)" }}>
                      {opt.title}
                    </span>
                    <span style={{ fontSize: "var(--ec-text-2xs)", color: "var(--ec-text-muted)", lineHeight: 1.4 }}>
                      {opt.desc}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ marginBottom: "var(--ec-space-3)" }}>
          <label htmlFor="ec-create-channel-name" style={fieldLabel}>
            Название комнаты
          </label>
          <input
            id="ec-create-channel-name"
            ref={inputRef}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            placeholder={
              type === "VOICE"
                ? "обсуждение / 1-1 / sync"
                : type === "BROADCAST"
                ? "анонсы / релизы"
                : type === "EXECUTION"
                ? "спринт-23 / релиз-Q3"
                : "общий / задачи / sales"
            }
            style={{
              ...inputStyle,
              borderColor: valid || trimmed.length === 0 ? "var(--ec-border-default)" : "var(--ec-danger)",
            }}
            aria-invalid={!valid && trimmed.length > 0}
          />
          <p style={fieldHint}>
            1–80 символов. Имя видно всем участникам в sidebar.
            <span style={{ marginLeft: 6, color: "var(--ec-text-muted)" }}>
              {trimmed.length}/80
            </span>
          </p>
        </div>

        {error && (
          <p
            style={{
              margin: 0,
              padding: "var(--ec-space-2) var(--ec-space-3)",
              color: "var(--ec-danger)",
              background: "var(--ec-danger-soft)",
              borderRadius: "var(--ec-radius-md)",
              fontSize: "var(--ec-text-sm)",
            }}
          >
            {error}
          </p>
        )}
      </form>
    </Modal>
  );
}
