import type { CSSProperties } from "react";
import type { ActionItemStatus, MessageActionItem } from "../hooks/useMessages";

type Props = {
  items: MessageActionItem[];
  onToggleStatus?: (actionId: string, nextStatus: ActionItemStatus) => Promise<boolean>;
};

const wrap: CSSProperties = {
  borderBottom: "1px solid var(--ec-border-subtle)",
  background:
    "linear-gradient(180deg, color-mix(in srgb, var(--ec-accent) 7%, transparent), transparent)",
  padding: "var(--ec-space-3) var(--ec-space-5)",
};

const header: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "var(--ec-space-2)",
  marginBottom: "var(--ec-space-3)",
};

const rail: CSSProperties = {
  display: "flex",
  gap: "var(--ec-space-2)",
  overflowX: "auto",
  paddingBottom: 2,
};

const card: CSSProperties = {
  minWidth: 220,
  maxWidth: 280,
  padding: "var(--ec-space-3)",
  background: "var(--ec-surface-2)",
  border: "1px solid var(--ec-border-subtle)",
  borderRadius: "var(--ec-radius-lg)",
  boxShadow: "var(--ec-shadow-sm)",
  display: "flex",
  flexDirection: "column",
  gap: "var(--ec-space-2)",
};

function labelForType(type: MessageActionItem["type"]) {
  if (type === "DECISION") return "Decision";
  if (type === "FOLLOW_UP") return "Follow-up";
  return "Task";
}

function tintForType(type: MessageActionItem["type"]) {
  if (type === "DECISION") {
    return {
      bg: "hsl(47 85% 58% / 0.12)",
      fg: "hsl(47 88% 68%)",
      border: "hsl(47 72% 46% / 0.32)",
    };
  }
  if (type === "FOLLOW_UP") {
    return {
      bg: "hsl(170 70% 52% / 0.12)",
      fg: "hsl(170 74% 64%)",
      border: "hsl(170 64% 46% / 0.28)",
    };
  }
  return {
    bg: "var(--ec-accent-soft)",
    fg: "var(--ec-accent)",
    border: "var(--ec-border-accent)",
  };
}

export function ActionQueueBar({ items, onToggleStatus }: Props) {
  return (
    <div style={wrap}>
      <div style={header}>
        <span
          aria-hidden
          style={{
            width: 28,
            height: 28,
            borderRadius: "50%",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            background: "var(--ec-accent-soft)",
            color: "var(--ec-accent)",
            border: "1px solid var(--ec-border-accent)",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 11l3 3L22 4" />
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
          </svg>
        </span>
        <div style={{ minWidth: 0 }}>
          <div style={{ color: "var(--ec-text-strong)", fontSize: "var(--ec-text-sm)", fontWeight: 600 }}>
            Контур исполнения
          </div>
          <div style={{ color: "var(--ec-text-dim)", fontSize: "var(--ec-text-2xs)" }}>
            {items.length > 0
              ? `${items.length} открытых action items в этом канале`
              : "Превращай сообщения в задачи, решения и follow-up"}
          </div>
        </div>
      </div>

      {items.length > 0 ? (
        <div style={rail}>
          {items.map((item) => {
            const tint = tintForType(item.type);
            return (
              <article key={item.id} style={card}>
                <div style={{ display: "flex", alignItems: "center", gap: "var(--ec-space-2)" }}>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      padding: "0.2rem 0.5rem",
                      borderRadius: "var(--ec-radius-full)",
                      background: tint.bg,
                      color: tint.fg,
                      border: `1px solid ${tint.border}`,
                      fontSize: "var(--ec-text-2xs)",
                      letterSpacing: "var(--ec-tracking-wide)",
                      textTransform: "uppercase",
                      fontWeight: 700,
                    }}
                  >
                    {labelForType(item.type)}
                  </span>
                  <span style={{ marginLeft: "auto", color: "var(--ec-text-dim)", fontSize: "var(--ec-text-2xs)" }}>
                    {item.createdBy.displayName}
                  </span>
                </div>
                <div
                  style={{
                    color: "var(--ec-text)",
                    fontSize: "var(--ec-text-sm)",
                    lineHeight: "var(--ec-leading-normal)",
                    display: "-webkit-box",
                    WebkitBoxOrient: "vertical",
                    WebkitLineClamp: 3,
                    overflow: "hidden",
                  }}
                >
                  {item.title}
                </div>
                <button
                  type="button"
                  className="ec-btn ec-btn--sm"
                  onClick={() => void onToggleStatus?.(item.id, item.status === "OPEN" ? "DONE" : "OPEN")}
                  style={{
                    justifyContent: "center",
                    borderColor: "var(--ec-ok)",
                    color: "var(--ec-ok)",
                  }}
                >
                  Отметить выполненным
                </button>
              </article>
            );
          })}
        </div>
      ) : (
        <div
          style={{
            color: "var(--ec-text-muted)",
            fontSize: "var(--ec-text-sm)",
            padding: "var(--ec-space-3)",
            borderRadius: "var(--ec-radius-lg)",
            border: "1px dashed var(--ec-border-subtle)",
            background: "color-mix(in srgb, var(--ec-surface-2) 75%, transparent)",
          }}
        >
          Пока пусто. Любое важное сообщение можно сразу перевести в рабочий объект, а не терять его в потоке.
        </div>
      )}
    </div>
  );
}
