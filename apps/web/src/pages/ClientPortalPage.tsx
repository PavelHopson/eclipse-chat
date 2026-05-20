import type { CSSProperties, ReactNode } from "react";
import { useMemo } from "react";
import { Avatar } from "../components/Avatar";
import { EmptyState } from "../components/EmptyState";
import { EmptyHomeIcon, EmptyBoardIcon, EmptyFilesIcon } from "../components/EmptyIcons";
import type {
  ClientPortalData,
  PortalActionItem,
  PortalActivity,
  PortalApproval,
  PortalError,
  PortalFile,
  PortalInvoice,
} from "../hooks/useClientPortal";

/**
 * v0.83 #24 phase 1 — ClientPortalPage.
 *
 * Full-page client-facing dashboard для CLIENT-mode workspace'ов. Замещает
 * AppShell когда URL = `#/portal/<serverId>`. Без topbar / left-nav /
 * right-rail — клиент видит чистый dashboard, не developer chrome.
 *
 * 4 секции (compact):
 *   - Progress: counts + top items
 *   - Approvals: pending queue + recent decisions
 *   - Files: recent attachments cross-channel
 *   - Recent activity: merged timeline
 *
 * Preview-indicator виден только OWNER/ADMIN (viewer.isPreview=true) —
 * клиент это не видит.
 */

type Props = {
  data: ClientPortalData | null;
  loading: boolean;
  error: PortalError;
  onReload: () => void;
  onExit: () => void;
};

const TYPE_LABEL: Record<PortalActionItem["type"], string> = {
  TASK: "задача",
  DECISION: "решение",
  FOLLOW_UP: "follow-up",
};

const STATUS_LABEL: Record<PortalActionItem["status"], string> = {
  OPEN: "Открыто",
  IN_PROGRESS: "В работе",
  REVIEW: "На ревью",
  DONE: "Завершено",
};

const PRIORITY_TONE: Record<PortalActionItem["priority"], string> = {
  LOW: "hsl(210 15% 65%)",
  NORMAL: "hsl(200 30% 60%)",
  HIGH: "hsl(36 80% 60%)",
  URGENT: "hsl(0 70% 62%)",
};

const PRIORITY_LABEL: Record<PortalActionItem["priority"], string> = {
  LOW: "Низкий",
  NORMAL: "Обычный",
  HIGH: "Высокий",
  URGENT: "Срочный",
};

const APPROVAL_TONE: Record<PortalApproval["approvalStatus"], string> = {
  PENDING: "hsl(36 70% 60%)",
  APPROVED: "hsl(150 50% 55%)",
  REJECTED: "hsl(0 65% 60%)",
};

const APPROVAL_LABEL: Record<PortalApproval["approvalStatus"], string> = {
  PENDING: "Ожидает решения",
  APPROVED: "Одобрено",
  REJECTED: "Отклонено",
};

const ACTIVITY_TONE: Record<PortalActivity["kind"], string> = {
  "task-done": "hsl(150 50% 55%)",
  approved: "hsl(200 60% 60%)",
  rejected: "hsl(0 65% 60%)",
};

const ACTIVITY_LABEL: Record<PortalActivity["kind"], string> = {
  "task-done": "Задача завершена",
  approved: "Одобрено",
  rejected: "Отклонено",
};

const shell: CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  flexDirection: "column",
  background: "var(--ec-bg)",
  color: "var(--ec-text)",
};

const topbar: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "var(--ec-space-3)",
  padding: "0.85rem var(--ec-space-6)",
  borderBottom: "1px solid var(--ec-border-subtle)",
  background: "var(--ec-surface-1)",
};

const brandRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "var(--ec-space-3)",
  minWidth: 0,
};

const brandMark: CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: "50%",
  background:
    "radial-gradient(circle at 35% 30%, hsl(258 60% 45% / 0.7), hsl(220 40% 12%) 70%)",
  boxShadow: "inset 0 0 0 1px hsl(258 60% 60% / 0.35)",
};

const brandText: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 2,
  minWidth: 0,
};

const brandName: CSSProperties = {
  fontSize: "var(--ec-text-md)",
  fontWeight: 700,
  letterSpacing: "var(--ec-tracking-tight)",
  color: "var(--ec-text-strong)",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const brandEyebrow: CSSProperties = {
  fontSize: "var(--ec-text-2xs)",
  fontWeight: 700,
  letterSpacing: "var(--ec-tracking-caps)",
  textTransform: "uppercase",
  color: "var(--ec-text-dim)",
};

const previewChip: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "0.2rem 0.6rem",
  borderRadius: "var(--ec-radius-full)",
  background: "hsl(36 70% 18%)",
  color: "hsl(36 80% 80%)",
  fontSize: "var(--ec-text-2xs)",
  fontWeight: 700,
  letterSpacing: "var(--ec-tracking-caps)",
  textTransform: "uppercase",
};

const exitBtn: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "0.42rem 0.85rem",
  border: "1px solid var(--ec-border-subtle)",
  borderRadius: "var(--ec-radius-full)",
  background: "transparent",
  color: "var(--ec-text-muted)",
  fontSize: "var(--ec-text-2xs)",
  fontWeight: 600,
  letterSpacing: "var(--ec-tracking-caps)",
  textTransform: "uppercase",
  cursor: "pointer",
};

const content: CSSProperties = {
  flex: 1,
  minHeight: 0,
  overflow: "auto",
  padding: "var(--ec-space-6) var(--ec-space-6) var(--ec-space-8)",
  display: "flex",
  flexDirection: "column",
  gap: "var(--ec-space-5)",
  maxWidth: 1080,
  width: "100%",
  margin: "0 auto",
};

const welcomeCard: CSSProperties = {
  padding: "var(--ec-space-4) var(--ec-space-5)",
  borderRadius: "var(--ec-radius-lg)",
  background:
    "linear-gradient(135deg, hsl(208 28% 11% / 0.85), hsl(220 30% 8% / 0.85))",
  border: "1px solid var(--ec-border-subtle)",
  fontSize: "var(--ec-text-sm)",
  color: "var(--ec-text)",
  lineHeight: 1.6,
};

const sectionHeader: CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  justifyContent: "space-between",
  gap: "var(--ec-space-3)",
};

const sectionTitle: CSSProperties = {
  fontSize: "var(--ec-text-md)",
  fontWeight: 700,
  letterSpacing: "var(--ec-tracking-tight)",
  color: "var(--ec-text-strong)",
  margin: 0,
};

const sectionEyebrow: CSSProperties = {
  fontSize: "var(--ec-text-2xs)",
  fontWeight: 800,
  letterSpacing: "var(--ec-tracking-caps)",
  textTransform: "uppercase",
  color: "var(--ec-text-dim)",
  margin: 0,
};

const sectionMuted: CSSProperties = {
  fontSize: "var(--ec-text-2xs)",
  color: "var(--ec-text-muted)",
};

const statGrid: CSSProperties = {
  display: "grid",
  // v0.95 Phase 1 density: 160 → 140 даёт лучшую упаковку на narrow
  // viewport'ах client portal (нет shell-rail'ов, но всё равно стандартный
  // width 920px max + padding). Совпадает с HomeToday паттерном.
  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
  gap: "var(--ec-space-3)",
};

function statCard(color: string): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    padding: "var(--ec-space-3) var(--ec-space-4)",
    borderRadius: "var(--ec-radius-lg)",
    background: "hsl(208 16% 10% / 0.6)",
    boxShadow: `inset 3px 0 0 0 ${color}, 0 8px 24px -16px hsl(210 40% 2% / 0.7)`,
  };
}

const statValue: CSSProperties = {
  fontSize: "var(--ec-text-2xl)",
  fontWeight: 700,
  fontFeatureSettings: '"tnum"',
  lineHeight: 1,
  color: "var(--ec-text-strong)",
};

const statLabel: CSSProperties = {
  fontSize: "var(--ec-text-2xs)",
  color: "var(--ec-text-muted)",
  textTransform: "uppercase",
  letterSpacing: "var(--ec-tracking-wide)",
};

const list: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "var(--ec-space-2)",
};

const itemRow: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "auto 1fr auto",
  alignItems: "center",
  gap: "var(--ec-space-3)",
  padding: "0.6rem 0.85rem",
  borderRadius: "var(--ec-radius-md)",
  background: "var(--ec-surface-2)",
  border: "1px solid var(--ec-border-subtle)",
};

const itemTitle: CSSProperties = {
  fontSize: "var(--ec-text-sm)",
  fontWeight: 600,
  color: "var(--ec-text)",
  margin: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const itemMeta: CSSProperties = {
  fontSize: "var(--ec-text-2xs)",
  color: "var(--ec-text-dim)",
  display: "flex",
  alignItems: "center",
  gap: 6,
  flexWrap: "wrap",
};

const badge = (color: string): CSSProperties => ({
  display: "inline-flex",
  alignItems: "center",
  padding: "0.16rem 0.5rem",
  borderRadius: "var(--ec-radius-full)",
  background: `${color.replace(")", " / 0.18)").replace("hsl(", "hsl(")}`,
  border: `1px solid ${color.replace(")", " / 0.35)").replace("hsl(", "hsl(")}`,
  color,
  fontSize: "var(--ec-text-2xs)",
  fontWeight: 700,
  letterSpacing: "var(--ec-tracking-wide)",
});

function formatDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleDateString("ru-RU", {
      day: "2-digit",
      month: "short",
    });
  } catch {
    return null;
  }
}

function formatRelative(iso: string): string {
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return "—";
  const diffMs = Date.now() - ts;
  if (diffMs < 60_000) return "только что";
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 60) return `${diffMin} мин`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH} ч`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 30) return `${diffD} дн`;
  return formatDate(iso) ?? "—";
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** v0.86 #24 phase 2: формат денежной суммы из копеек в человеческий вид. */
function formatMoney(amountKopeks: number, currency: string): string {
  const major = amountKopeks / 100;
  // Локально-формат RU для RUB, fallback на ISO format.
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

const INVOICE_TONE: Record<PortalInvoice["status"], string> = {
  SENT: "hsl(36 70% 60%)",
  PAID: "hsl(150 50% 55%)",
};

const INVOICE_LABEL: Record<PortalInvoice["status"], string> = {
  SENT: "Ожидает оплаты",
  PAID: "Оплачен",
};

function InvoiceItem({ invoice }: { invoice: PortalInvoice }) {
  const tone = INVOICE_TONE[invoice.status];
  const dueOverdue =
    invoice.status === "SENT" &&
    invoice.dueAt &&
    new Date(invoice.dueAt).getTime() < Date.now();
  return (
    <div style={itemRow}>
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: dueOverdue ? "hsl(0 70% 62%)" : tone,
          boxShadow: `0 0 8px ${dueOverdue ? "hsl(0 70% 62%)" : tone}`,
        }}
        aria-hidden
      />
      <div style={{ minWidth: 0 }}>
        <div style={itemTitle}>
          {invoice.number} · {invoice.title}
        </div>
        <div style={itemMeta}>
          <span>{INVOICE_LABEL[invoice.status]}</span>
          {invoice.itemCount > 0 && (
            <>
              <span>·</span>
              <span>{invoice.itemCount} позиций</span>
            </>
          )}
          {invoice.issuedAt && (
            <>
              <span>·</span>
              <span>выставлен {formatDate(invoice.issuedAt)}</span>
            </>
          )}
          {invoice.dueAt && invoice.status === "SENT" && (
            <>
              <span>·</span>
              <span style={dueOverdue ? { color: "hsl(0 70% 70%)" } : undefined}>
                срок {formatDate(invoice.dueAt)}
                {dueOverdue ? " · просрочен" : ""}
              </span>
            </>
          )}
          {invoice.paidAt && (
            <>
              <span>·</span>
              <span>оплачен {formatDate(invoice.paidAt)}</span>
            </>
          )}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
        <span
          style={{
            fontSize: "var(--ec-text-md)",
            fontWeight: 700,
            color: "var(--ec-text-strong)",
            fontFeatureSettings: '"tnum"',
          }}
        >
          {formatMoney(invoice.amountTotal, invoice.currency)}
        </span>
        <span style={badge(tone)}>{INVOICE_LABEL[invoice.status]}</span>
      </div>
    </div>
  );
}

function ProgressItem({ item }: { item: PortalActionItem }) {
  return (
    <div style={itemRow}>
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: PRIORITY_TONE[item.priority],
          boxShadow: `0 0 8px ${PRIORITY_TONE[item.priority]}`,
        }}
        aria-hidden
      />
      <div style={{ minWidth: 0 }}>
        <div style={itemTitle}>{item.title}</div>
        <div style={itemMeta}>
          <span>{TYPE_LABEL[item.type]}</span>
          <span>·</span>
          <span>{STATUS_LABEL[item.status]}</span>
          {item.dueAt && (
            <>
              <span>·</span>
              <span>срок {formatDate(item.dueAt)}</span>
            </>
          )}
          <span>·</span>
          <span>#{item.channelName}</span>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={badge(PRIORITY_TONE[item.priority])}>
          {PRIORITY_LABEL[item.priority]}
        </span>
        {item.assignee && (
          <Avatar
            url={item.assignee.avatar}
            name={item.assignee.displayName}
            size={24}
          />
        )}
      </div>
    </div>
  );
}

function ApprovalItem({ item }: { item: PortalApproval }) {
  const tone = APPROVAL_TONE[item.approvalStatus];
  const isPending = item.approvalStatus === "PENDING";
  const timeIso = item.approvedAt ?? item.updatedAt;
  return (
    <div style={itemRow}>
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: tone,
          boxShadow: `0 0 8px ${tone}`,
        }}
        aria-hidden
      />
      <div style={{ minWidth: 0 }}>
        <div style={itemTitle}>{item.title}</div>
        <div style={itemMeta}>
          <span>{TYPE_LABEL[item.type]}</span>
          <span>·</span>
          <span>#{item.channelName}</span>
          {item.requestedBy && (
            <>
              <span>·</span>
              <span>от {item.requestedBy.displayName}</span>
            </>
          )}
          {!isPending && item.approver && (
            <>
              <span>·</span>
              <span>{item.approver.displayName}</span>
            </>
          )}
          <span>·</span>
          <span>{formatRelative(timeIso)}</span>
        </div>
        {item.approvalNote && (
          <div
            style={{
              marginTop: 4,
              fontSize: "var(--ec-text-2xs)",
              color: "var(--ec-text-muted)",
              fontStyle: "italic",
            }}
          >
            «{item.approvalNote}»
          </div>
        )}
      </div>
      <span style={badge(tone)}>{APPROVAL_LABEL[item.approvalStatus]}</span>
    </div>
  );
}

function FileItem({ file }: { file: PortalFile }) {
  const isImage = file.mimeType.startsWith("image/");
  return (
    <div style={itemRow}>
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: "var(--ec-radius-md)",
          background:
            "linear-gradient(135deg, hsl(210 25% 16%), hsl(220 30% 10%))",
          border: "1px solid var(--ec-border-subtle)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 10,
          fontWeight: 700,
          color: "var(--ec-text-muted)",
          letterSpacing: 0.5,
          overflow: "hidden",
        }}
      >
        {isImage && file.thumbnailUrl ? (
          <img
            src={file.thumbnailUrl}
            alt=""
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          (file.filename.split(".").pop()?.slice(0, 3) ?? "FILE").toUpperCase()
        )}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={itemTitle}>{file.filename}</div>
        <div style={itemMeta}>
          <span>{formatBytes(file.size)}</span>
          <span>·</span>
          <span>#{file.channelName}</span>
          {file.uploadedBy && (
            <>
              <span>·</span>
              <span>{file.uploadedBy.displayName}</span>
            </>
          )}
          <span>·</span>
          <span>{formatRelative(file.createdAt)}</span>
        </div>
      </div>
      <a
        href={file.url}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          fontSize: "var(--ec-text-2xs)",
          fontWeight: 700,
          letterSpacing: "var(--ec-tracking-caps)",
          textTransform: "uppercase",
          color: "var(--ec-accent-soft, hsl(258 60% 60%))",
          textDecoration: "none",
          padding: "0.3rem 0.6rem",
          borderRadius: "var(--ec-radius-md)",
          border: "1px solid hsl(258 60% 35% / 0.35)",
        }}
      >
        Скачать
      </a>
    </div>
  );
}

function ActivityItem({ event }: { event: PortalActivity }) {
  const tone = ACTIVITY_TONE[event.kind];
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "auto 1fr auto",
        alignItems: "center",
        gap: "var(--ec-space-3)",
        padding: "0.45rem 0.6rem",
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: tone,
        }}
        aria-hidden
      />
      <div style={{ minWidth: 0 }}>
        <div style={{ ...itemTitle, fontWeight: 500 }}>{event.title}</div>
        <div style={itemMeta}>
          <span>{ACTIVITY_LABEL[event.kind]}</span>
          <span>·</span>
          <span>#{event.channelName}</span>
          {event.actor && (
            <>
              <span>·</span>
              <span>{event.actor}</span>
            </>
          )}
        </div>
      </div>
      <span style={sectionMuted}>{formatRelative(event.timestamp)}</span>
    </div>
  );
}

export function ClientPortalPage({ data, loading, error, onReload, onExit }: Props) {
  const brandStyle = useMemo<CSSProperties>(() => {
    if (!data?.server.brandColor) return brandMark;
    return {
      ...brandMark,
      background: `radial-gradient(circle at 35% 30%, hsl(${data.server.brandColor} / 0.7), hsl(220 40% 12%) 70%)`,
      boxShadow: `inset 0 0 0 1px hsl(${data.server.brandColor} / 0.35)`,
    };
  }, [data?.server.brandColor]);

  let body: ReactNode;
  if (loading && !data) {
    body = (
      <div style={{ ...content, alignItems: "center", justifyContent: "center" }}>
        <span style={sectionMuted}>Загрузка портала…</span>
      </div>
    );
  } else if (error?.kind === "not-found") {
    body = (
      <div style={content}>
        <EmptyState
          icon={<EmptyHomeIcon />}
          title="Портал недоступен"
          hint="Этот пространство не в режиме «Клиент». Попросите владельца переключить режим в настройках сервера."
        />
      </div>
    );
  } else if (error?.kind === "forbidden") {
    body = (
      <div style={content}>
        <EmptyState
          icon={<EmptyHomeIcon />}
          title="Нет доступа"
          hint={error.message}
        />
      </div>
    );
  } else if (error?.kind === "network") {
    body = (
      <div style={content}>
        <EmptyState
          icon={<EmptyHomeIcon />}
          title="Не удалось загрузить портал"
          hint={error.message}
          action={
            <button type="button" style={exitBtn} onClick={onReload}>
              Повторить
            </button>
          }
        />
      </div>
    );
  } else if (!data) {
    body = (
      <div style={{ ...content, alignItems: "center", justifyContent: "center" }}>
        <span style={sectionMuted}>—</span>
      </div>
    );
  } else {
    body = (
      <div style={content}>
        {data.server.welcomeMessage && (
          <div style={welcomeCard}>{data.server.welcomeMessage}</div>
        )}

        {/* v0.86 #24 phase 2: AI summary */}
        {data.summary && (
          <section
            style={{
              padding: "var(--ec-space-4) var(--ec-space-5)",
              borderRadius: "var(--ec-radius-lg)",
              background:
                "linear-gradient(135deg, hsl(258 50% 12% / 0.65), hsl(208 30% 8% / 0.85))",
              border: "1px solid hsl(258 60% 35% / 0.3)",
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            <span
              style={{
                fontSize: "var(--ec-text-2xs)",
                fontWeight: 800,
                letterSpacing: "var(--ec-tracking-caps)",
                textTransform: "uppercase",
                color: "hsl(258 60% 70%)",
              }}
            >
              Сводка
            </span>
            <p
              style={{
                margin: 0,
                fontSize: "var(--ec-text-sm)",
                color: "var(--ec-text)",
                lineHeight: 1.6,
                whiteSpace: "pre-wrap",
              }}
            >
              {data.summary.text}
            </p>
          </section>
        )}

        {/* Progress */}
        <section style={{ display: "flex", flexDirection: "column", gap: "var(--ec-space-3)" }}>
          <div style={sectionHeader}>
            <h2 style={sectionTitle}>Прогресс проекта</h2>
            <span style={sectionMuted}>обновлено {formatRelative(data.generatedAt)}</span>
          </div>
          <div style={statGrid}>
            <div style={statCard("hsl(200 30% 60%)")}>
              <div style={statValue}>{data.progress.counts.open}</div>
              <div style={statLabel}>Открыто</div>
            </div>
            <div style={statCard("hsl(36 70% 60%)")}>
              <div style={statValue}>{data.progress.counts.inProgress}</div>
              <div style={statLabel}>В работе</div>
            </div>
            <div style={statCard("hsl(280 40% 65%)")}>
              <div style={statValue}>{data.progress.counts.review}</div>
              <div style={statLabel}>На ревью</div>
            </div>
            <div style={statCard("hsl(150 50% 55%)")}>
              <div style={statValue}>{data.progress.counts.done}</div>
              <div style={statLabel}>Завершено</div>
            </div>
          </div>
          {data.progress.items.length > 0 ? (
            <div style={list}>
              {data.progress.items.map((item) => (
                <ProgressItem key={item.id} item={item} />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<EmptyBoardIcon />}
              title="Открытых задач нет"
              hint="Все задачи проекта завершены или ещё не созданы."
            />
          )}
        </section>

        {/* Approvals */}
        <section style={{ display: "flex", flexDirection: "column", gap: "var(--ec-space-3)" }}>
          <div style={sectionHeader}>
            <h2 style={sectionTitle}>Одобрения</h2>
            <span style={sectionMuted}>
              {data.approvals.pending.length} ожидает · {data.approvals.recent.length} недавних
            </span>
          </div>
          <div>
            <p style={sectionEyebrow}>Ожидают решения</p>
            {data.approvals.pending.length > 0 ? (
              <div style={list}>
                {data.approvals.pending.map((a) => (
                  <ApprovalItem key={a.id} item={a} />
                ))}
              </div>
            ) : (
              <EmptyState
                icon={<EmptyBoardIcon />}
                title="Очередь пуста"
                hint="Нет вопросов, требующих вашего ответа."
              />
            )}
          </div>
          {data.approvals.recent.length > 0 && (
            <div>
              <p style={sectionEyebrow}>Недавние решения</p>
              <div style={list}>
                {data.approvals.recent.map((a) => (
                  <ApprovalItem key={a.id} item={a} />
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Files */}
        <section style={{ display: "flex", flexDirection: "column", gap: "var(--ec-space-3)" }}>
          <div style={sectionHeader}>
            <h2 style={sectionTitle}>Файлы</h2>
            <span style={sectionMuted}>{data.files.length} последних</span>
          </div>
          {data.files.length > 0 ? (
            <div style={list}>
              {data.files.map((f) => (
                <FileItem key={f.id} file={f} />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<EmptyFilesIcon />}
              title="Файлов пока нет"
              hint="Документы, которые опубликуют в каналах, появятся здесь."
            />
          )}
        </section>

        {/* v0.86 #24 phase 2: Invoices */}
        <section style={{ display: "flex", flexDirection: "column", gap: "var(--ec-space-3)" }}>
          <div style={sectionHeader}>
            <h2 style={sectionTitle}>Счета</h2>
            <span style={sectionMuted}>
              {data.invoices.invoices.length} {data.invoices.outstanding > 0
                ? `· к оплате ${formatMoney(data.invoices.outstanding, data.invoices.invoices.find((i) => i.status === "SENT")?.currency ?? "RUB")}`
                : ""}
            </span>
          </div>
          {data.invoices.invoices.length > 0 ? (
            <div style={list}>
              {data.invoices.invoices.map((inv) => (
                <InvoiceItem key={inv.id} invoice={inv} />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<EmptyHomeIcon />}
              title="Счетов пока нет"
              hint="Выставленные счета появятся здесь со ссылкой на детали."
            />
          )}
        </section>

        {/* Recent activity */}
        <section style={{ display: "flex", flexDirection: "column", gap: "var(--ec-space-3)" }}>
          <div style={sectionHeader}>
            <h2 style={sectionTitle}>Лента событий</h2>
            <span style={sectionMuted}>последние 30 дней</span>
          </div>
          {data.recentActivity.length > 0 ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 0,
                padding: "var(--ec-space-2) 0",
                background: "var(--ec-surface-2)",
                borderRadius: "var(--ec-radius-lg)",
                border: "1px solid var(--ec-border-subtle)",
              }}
            >
              {data.recentActivity.map((e, idx) => (
                <ActivityItem
                  key={`${e.kind}-${e.actionItemId}-${idx}`}
                  event={e}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<EmptyHomeIcon />}
              title="Тихо"
              hint="За последние 30 дней не было завершённых задач или решений."
            />
          )}
        </section>
      </div>
    );
  }

  return (
    <div style={shell}>
      <header style={topbar}>
        <div style={brandRow}>
          <div style={brandStyle} aria-hidden />
          <div style={brandText}>
            <div style={brandEyebrow}>Клиентский портал</div>
            <div style={brandName}>{data?.server.name ?? "Загрузка…"}</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--ec-space-3)" }}>
          {data?.viewer.isPreview && (
            <span style={previewChip}>Preview · {data.viewer.role}</span>
          )}
          <button type="button" style={exitBtn} onClick={onReload} aria-label="Обновить">
            Обновить
          </button>
          <button type="button" style={exitBtn} onClick={onExit}>
            ← В рабочее пространство
          </button>
        </div>
      </header>
      {body}
    </div>
  );
}
