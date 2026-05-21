import type { CSSProperties } from "react";
import { useState } from "react";
import { apiJson } from "../lib/api";

/**
 * v0.86 #24 phase 2 — Invoices tab внутри AdminPanel.
 *
 * CRUD over /api/servers/:id/invoices + /api/invoices/:id и /api/invoices/:id/status.
 * Списки + inline create form + per-invoice status buttons + delete.
 *
 * Phase 2 ограничения:
 *   - Item editing после create — пока нет UI (API готов).
 *   - Number автогенерации нет — пользователь сам пишет (e.g. INV-2026-001).
 *
 * UI conventions:
 *   - Денежные суммы в копейках (Int). UI принимает major-units (рубли) и
 *     умножает на 100 на submit. Display форматирует через Intl.NumberFormat.
 */

export type AdminInvoiceItem = {
  id: string;
  position: number;
  title: string;
  amount: number;
};

export type AdminInvoice = {
  id: string;
  serverId: string;
  number: string;
  title: string;
  status: "DRAFT" | "SENT" | "PAID" | "CANCELLED";
  currency: string;
  amountTotal: number;
  issuedAt: string | null;
  dueAt: string | null;
  paidAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: { id: string; displayName: string; avatar: string | null } | null;
  items: AdminInvoiceItem[];
};

type Props = {
  serverId: string;
  invoices: AdminInvoice[] | null;
  loading: boolean;
  error: string | null;
  showCreate: boolean;
  onShowCreate: () => void;
  onHideCreate: () => void;
  onChange: (next: AdminInvoice[] | null) => void;
  onError: (msg: string | null) => void;
};

const STATUS_LABEL: Record<AdminInvoice["status"], string> = {
  DRAFT: "Черновик",
  SENT: "Выставлен",
  PAID: "Оплачен",
  CANCELLED: "Отменён",
};

const STATUS_TONE: Record<AdminInvoice["status"], string> = {
  DRAFT: "var(--ec-text-dim)",
  SENT: "var(--ec-warn)",
  PAID: "var(--ec-status-exec)",
  CANCELLED: "var(--ec-status-risk)",
};

function formatMoney(amountKopeks: number, currency: string): string {
  const major = amountKopeks / 100;
  try {
    return new Intl.NumberFormat("ru-RU", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(major);
  } catch {
    return `${major.toFixed(2)} ${currency}`;
  }
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("ru-RU", {
      day: "2-digit",
      month: "short",
      year: "2-digit",
    });
  } catch {
    return "—";
  }
}

const row: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(160px, 1.4fr) 1fr auto auto",
  alignItems: "center",
  gap: 12,
  padding: "var(--ec-space-3)",
  borderRadius: "var(--ec-radius-md)",
  background: "var(--ec-surface-sunken)",
  border: "1px solid var(--ec-border-subtle)",
};

const labelStyle: CSSProperties = {
  fontSize: "var(--ec-text-2xs)",
  fontWeight: 700,
  letterSpacing: "var(--ec-tracking-caps)",
  textTransform: "uppercase",
  color: "var(--ec-text-dim)",
  marginBottom: 4,
};

const muted: CSSProperties = {
  fontSize: "var(--ec-text-2xs)",
  color: "var(--ec-text-muted)",
};

const statusBadge = (tone: string): CSSProperties => ({
  display: "inline-flex",
  alignItems: "center",
  padding: "0.18rem 0.55rem",
  borderRadius: "var(--ec-radius-full)",
  background: tone.replace(")", " / 0.18)"),
  border: `1px solid ${tone.replace(")", " / 0.4)")}`,
  color: tone,
  fontSize: "var(--ec-text-2xs)",
  fontWeight: 700,
  letterSpacing: "var(--ec-tracking-wide)",
});

export function InvoicesTabContent({
  serverId,
  invoices,
  loading,
  error,
  showCreate,
  onShowCreate,
  onHideCreate,
  onChange,
  onError,
}: Props) {
  const transition = async (
    invoiceId: string,
    next: AdminInvoice["status"],
  ) => {
    onError(null);
    try {
      const result = await apiJson<{ invoice: AdminInvoice }>(
        `/api/invoices/${encodeURIComponent(invoiceId)}/status`,
        {
          method: "POST",
          body: JSON.stringify({ status: next }),
        },
      );
      onChange(
        (invoices ?? []).map((i) => (i.id === result.invoice.id ? result.invoice : i)),
      );
    } catch (e) {
      onError(e instanceof Error ? e.message : "Не удалось изменить статус");
    }
  };

  const remove = async (invoiceId: string) => {
    if (!window.confirm("Удалить счёт навсегда?")) return;
    onError(null);
    try {
      await apiJson(`/api/invoices/${encodeURIComponent(invoiceId)}`, {
        method: "DELETE",
      });
      onChange((invoices ?? []).filter((i) => i.id !== invoiceId));
    } catch (e) {
      onError(e instanceof Error ? e.message : "Не удалось удалить");
    }
  };

  const handleCreate = async (input: CreateInvoiceInput) => {
    onError(null);
    try {
      const result = await apiJson<{ invoice: AdminInvoice }>(
        `/api/servers/${encodeURIComponent(serverId)}/invoices`,
        {
          method: "POST",
          body: JSON.stringify(input),
        },
      );
      onChange([result.invoice, ...(invoices ?? [])]);
      onHideCreate();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Не удалось создать счёт");
    }
  };

  if (loading) {
    return <p style={{ color: "var(--ec-text-dim)" }}>Загружаем счета…</p>;
  }
  if (error) {
    return <p style={{ color: "var(--ec-danger)" }}>{error}</p>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--ec-space-3)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <p style={muted}>
          Счета видны клиенту в портале со статусом «Выставлен» или «Оплачен». Черновики и отменённые
          скрыты.
        </p>
        {!showCreate && (
          <button
            type="button"
            onClick={onShowCreate}
            className="ec-btn ec-btn--primary ec-btn--sm"
          >
            Создать счёт
          </button>
        )}
      </div>

      {showCreate && (
        <CreateInvoiceForm onCancel={onHideCreate} onCreate={(input) => void handleCreate(input)} />
      )}

      {(invoices?.length ?? 0) === 0 && !showCreate && (
        <p style={muted}>Счетов ещё нет. Нажмите «Создать счёт» — поможем выставить первый.</p>
      )}

      {(invoices ?? []).map((inv) => (
        <div key={inv.id} style={row}>
          <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
            <span
              style={{
                fontSize: "var(--ec-text-sm)",
                fontWeight: 700,
                color: "var(--ec-text-strong)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {inv.number} · {inv.title}
            </span>
            <span style={muted}>
              {inv.items.length} позиций · {formatMoney(inv.amountTotal, inv.currency)}
              {inv.dueAt ? ` · срок ${formatDate(inv.dueAt)}` : ""}
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={statusBadge(STATUS_TONE[inv.status])}>{STATUS_LABEL[inv.status]}</span>
            <span style={muted}>создан {formatDate(inv.createdAt)}</span>
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            {inv.status === "DRAFT" && (
              <button
                type="button"
                onClick={() => void transition(inv.id, "SENT")}
                className="ec-btn ec-btn--primary ec-btn--sm"
              >
                Выставить
              </button>
            )}
            {inv.status === "SENT" && (
              <>
                <button
                  type="button"
                  onClick={() => void transition(inv.id, "PAID")}
                  className="ec-btn ec-btn--primary ec-btn--sm"
                >
                  Отметить оплачен
                </button>
                <button
                  type="button"
                  onClick={() => void transition(inv.id, "CANCELLED")}
                  className="ec-btn ec-btn--ghost ec-btn--sm"
                >
                  Отменить
                </button>
              </>
            )}
            {(inv.status === "PAID" || inv.status === "CANCELLED") && (
              <button
                type="button"
                onClick={() => void transition(inv.id, "DRAFT")}
                className="ec-btn ec-btn--ghost ec-btn--sm"
                title="Сбросить в черновик (issuedAt + paidAt очистятся)"
              >
                В черновик
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => void remove(inv.id)}
            className="ec-btn ec-btn--ghost ec-btn--sm ec-btn--danger"
            aria-label={`Удалить счёт ${inv.number}`}
            title="Удалить"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}

type CreateInvoiceInput = {
  number: string;
  title: string;
  currency: string;
  dueAt: string | null;
  notes: string | null;
  items: Array<{ title: string; amount: number }>;
};

function CreateInvoiceForm({
  onCancel,
  onCreate,
}: {
  onCancel: () => void;
  onCreate: (input: CreateInvoiceInput) => void;
}) {
  const [number, setNumber] = useState("");
  const [title, setTitle] = useState("");
  const [currency, setCurrency] = useState("RUB");
  const [dueAt, setDueAt] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<Array<{ title: string; amount: string }>>([
    { title: "", amount: "" },
  ]);

  const totalKopeks = items.reduce((sum, it) => {
    const parsed = parseFloat(it.amount.replace(",", "."));
    if (Number.isFinite(parsed) && parsed >= 0) {
      return sum + Math.round(parsed * 100);
    }
    return sum;
  }, 0);

  const canSubmit =
    number.trim().length > 0 &&
    title.trim().length > 0 &&
    items.length > 0 &&
    items.every((it) => it.title.trim() && parseFloat(it.amount.replace(",", ".")) >= 0);

  return (
    <div
      style={{
        ...row,
        gridTemplateColumns: "1fr",
        gap: "var(--ec-space-3)",
        padding: "var(--ec-space-4)",
      }}
    >
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--ec-space-3)" }}>
        <div>
          <div style={labelStyle}>Номер</div>
          <input
            className="ec-field"
            type="text"
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            placeholder="INV-2026-001"
            maxLength={64}
          />
        </div>
        <div>
          <div style={labelStyle}>Валюта</div>
          <input
            className="ec-field"
            type="text"
            value={currency}
            onChange={(e) => setCurrency(e.target.value.toUpperCase().slice(0, 3))}
            placeholder="RUB"
            maxLength={3}
          />
        </div>
      </div>
      <div>
        <div style={labelStyle}>Название</div>
        <input
          className="ec-field"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Услуги март 2026"
          maxLength={200}
        />
      </div>
      <div>
        <div style={labelStyle}>Срок оплаты (опционально)</div>
        <input
          className="ec-field"
          type="date"
          value={dueAt}
          onChange={(e) => setDueAt(e.target.value)}
        />
      </div>
      <div>
        <div style={labelStyle}>Позиции</div>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--ec-space-2)" }}>
          {items.map((it, idx) => (
            <div
              key={idx}
              style={{ display: "grid", gridTemplateColumns: "2fr 1fr auto", gap: 6 }}
            >
              <input
                className="ec-field"
                type="text"
                value={it.title}
                onChange={(e) =>
                  setItems((prev) =>
                    prev.map((p, i) => (i === idx ? { ...p, title: e.target.value } : p)),
                  )
                }
                placeholder="Дизайн логотипа"
                maxLength={200}
              />
              <input
                className="ec-field"
                type="text"
                inputMode="decimal"
                value={it.amount}
                onChange={(e) =>
                  setItems((prev) =>
                    prev.map((p, i) => (i === idx ? { ...p, amount: e.target.value } : p)),
                  )
                }
                placeholder="0.00"
              />
              <button
                type="button"
                onClick={() => setItems((prev) => prev.filter((_, i) => i !== idx))}
                className="ec-btn ec-btn--ghost ec-btn--sm"
                disabled={items.length <= 1}
                title="Убрать строку"
              >
                ✕
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setItems((prev) => [...prev, { title: "", amount: "" }])}
            className="ec-btn ec-btn--ghost ec-btn--sm"
            style={{ alignSelf: "flex-start" }}
          >
            + позиция
          </button>
        </div>
      </div>
      <div>
        <div style={labelStyle}>Примечание (опционально)</div>
        <textarea
          className="ec-field ec-field--textarea"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          maxLength={2000}
          placeholder="Видно клиенту в портале"
        />
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "var(--ec-space-3)",
        }}
      >
        <span style={{ fontSize: "var(--ec-text-md)", fontWeight: 700, color: "var(--ec-text-strong)" }}>
          Итого: {formatMoney(totalKopeks, currency || "RUB")}
        </span>
        <div style={{ display: "flex", gap: 6 }}>
          <button type="button" onClick={onCancel} className="ec-btn ec-btn--ghost ec-btn--sm">
            Отмена
          </button>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={() =>
              onCreate({
                number: number.trim(),
                title: title.trim(),
                currency: (currency || "RUB").trim(),
                dueAt: dueAt
                  ? new Date(dueAt + "T00:00:00Z").toISOString()
                  : null,
                notes: notes.trim() || null,
                items: items.map((it) => ({
                  title: it.title.trim(),
                  amount: Math.round(parseFloat(it.amount.replace(",", ".")) * 100),
                })),
              })
            }
            className="ec-btn ec-btn--primary ec-btn--sm"
          >
            Создать черновик
          </button>
        </div>
      </div>
    </div>
  );
}
