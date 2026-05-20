import type { CSSProperties } from "react";
import { MemberList } from "./MemberList";
import type { MemberRow } from "../hooks/useMembers";
import { resolveAssetUrl } from "../lib/assets";

/**
 * IntelligencePanel — right rail Eclipse Chat'а.
 *
 * v0.96 UX refactor (Pavel-ask 19.05 «справа должны быть только
 * участники»): панель упрощена до MemberList'а. Сводка / Память / Дела /
 * Файлы переехали в новый ChannelInfoPanel (открывается через (i)-кнопку
 * в chat-header'е).
 *
 * Внутри файла остаются `MemoryView` / `ExecutionView` / `FilesView` как
 * экспорты — их использует ChannelInfoPanel. VoiceIntelligence (live voice
 * roster) удалён: для voice-каналов хватает основного voice-room UI.
 */

export type PinnedMessageBrief = {
  id: string;
  content: string;
  pinnedAt: string | null;
  user: { displayName: string; avatar: string | null };
};

export type AttachmentBrief = {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  url: string;
  thumbnailUrl: string | null;
};

export type ExecutionItemBrief = {
  id: string;
  title: string;
  type: "TASK" | "DECISION" | "FOLLOW_UP";
  status: import("../lib/socket").ActionItemStatus;
  dueAt: string | null;
  assignee: { displayName: string; avatar: string | null } | null;
};

type Props = {
  members: MemberRow[];
  membersLoading: boolean;
  membersError: string | null;
  voiceChannelByUser: Record<string, string>;
  channelNameById: (channelId: string) => string | undefined;
  currentUserId: string;
  onOpenDm: (userId: string) => void;
  /** Drawer-close (mobile/tablet). На desktop omitted. */
  onClose?: () => void;
  /** Collapse rail (desktop) — сворачивает панель чтобы не съедать ширину центра. */
  onCollapse?: () => void;
};

const wrap: CSSProperties = {
  width: "100%",
  height: "100%",
  background: "var(--ec-surface-1)",
  borderLeft: "1px solid var(--ec-border-subtle)",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
  minHeight: 0,
};

const headerStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "var(--ec-space-2)",
  padding: "var(--ec-space-3) var(--ec-space-3)",
  borderBottom: "1px solid var(--ec-border-subtle)",
  background: "hsl(210 25% 4% / 0.55)",
  // v1.1.10: position:relative для .ec-server-header-edge::after holographic
  // bottom line accent.
  position: "relative",
};

const headerLabel: CSSProperties = {
  fontSize: "0.62rem",
  fontWeight: 700,
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  color: "var(--ec-text-muted)",
  fontFamily: "var(--ec-font-mono, ui-monospace, monospace)",
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  minWidth: 0,
};

const headerCount: CSSProperties = {
  fontSize: "0.6rem",
  color: "var(--ec-accent-3)",
  fontWeight: 700,
  fontFeatureSettings: '"tnum"',
  letterSpacing: "0.08em",
  textTransform: "none",
  padding: "0.12rem 0.42rem",
  borderRadius: "var(--ec-radius-xs)",
  background: "var(--ec-accent-3-soft)",
  border: "1px solid hsl(252 70% 70% / 0.3)",
  fontFamily: "var(--ec-font-mono, ui-monospace, monospace)",
};

const utilBtn: CSSProperties = {
  width: 28,
  height: 28,
  padding: 0,
  flexShrink: 0,
  display: "grid",
  placeItems: "center",
};

const scrollArea: CSSProperties = {
  flex: 1,
  minHeight: 0,
  overflow: "auto",
  display: "flex",
  flexDirection: "column",
};

function IconMembers() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
    </svg>
  );
}

export function IntelligencePanel({
  members,
  membersLoading,
  membersError,
  voiceChannelByUser,
  channelNameById,
  currentUserId,
  onOpenDm,
  onClose,
  onCollapse,
}: Props) {
  const onlineCount = members.filter((m) => m.online).length;

  return (
    <aside style={wrap} aria-label="Участники">
      <header className="ec-server-header-edge" style={headerStyle}>
        <span style={headerLabel}>
          <span aria-hidden style={{ color: "var(--ec-accent-3)" }}>
            <IconMembers />
          </span>
          <span>ТАКТИЧЕСКИЙ ВИД</span>
        </span>
        <span style={headerCount}>
          {onlineCount}/{members.length}
        </span>
        <div style={{ marginLeft: "auto", display: "inline-flex", gap: 2 }}>
          {onCollapse && (
            <button
              type="button"
              onClick={onCollapse}
              aria-label="Свернуть панель"
              title="Свернуть панель"
              className="ec-btn ec-btn--ghost ec-btn--sm"
              style={utilBtn}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M9 6l6 6-6 6" />
              </svg>
            </button>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Закрыть"
              title="Закрыть"
              className="ec-shell__members-close ec-btn ec-btn--ghost ec-btn--sm"
              style={utilBtn}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>
      </header>

      <div style={scrollArea}>
        <MemberList
          members={members}
          loading={membersLoading}
          error={membersError}
          voiceChannelByUser={voiceChannelByUser}
          channelNameById={channelNameById}
          currentUserId={currentUserId}
          onOpenDm={onOpenDm}
          hideHeader
        />
      </div>
    </aside>
  );
}

/* ===== Inner views exported for ChannelInfoPanel ============= */

export function MemoryView({ items }: { items: PinnedMessageBrief[] }) {
  if (items.length === 0) {
    return (
      <p style={{ margin: 0, color: "var(--ec-text-dim)", fontSize: "var(--ec-text-sm)" }}>
        В этой комнате ещё ничего не закреплено. Закрепи важное сообщение через
        hover-меню — оно появится здесь как «память» комнаты.
      </p>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--ec-space-2)" }}>
      {items.map((m) => (
        <div
          key={m.id}
          style={{
            padding: "var(--ec-space-2) var(--ec-space-3)",
            borderRadius: "var(--ec-radius-md)",
            background: "var(--ec-surface-2)",
            border: "1px solid var(--ec-border-subtle)",
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          <span
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: "var(--ec-text-2xs)",
              color: "var(--ec-text-dim)",
            }}
          >
            <span aria-hidden style={{ color: "var(--ec-accent)" }}>📌</span>
            {m.user.displayName}
          </span>
          <p
            style={{
              margin: 0,
              fontSize: "var(--ec-text-sm)",
              color: "var(--ec-text)",
              whiteSpace: "pre-wrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              display: "-webkit-box",
              WebkitLineClamp: 3,
              WebkitBoxOrient: "vertical",
            }}
          >
            {m.content || "[без текста — вложение]"}
          </p>
        </div>
      ))}
    </div>
  );
}

function execTypeMeta(type: "TASK" | "DECISION" | "FOLLOW_UP") {
  if (type === "DECISION") return { glyph: "◆", color: "var(--ec-status-ai)" };
  if (type === "FOLLOW_UP") return { glyph: "↻", color: "var(--ec-status-warn)" };
  return { glyph: "□", color: "var(--ec-status-exec)" };
}

export function ExecutionView({
  items,
  onToggle,
  onOpen,
}: {
  items: ExecutionItemBrief[];
  onToggle?: (id: string, status: import("../lib/socket").ActionItemStatus) => void;
  onOpen?: (actionItemId: string) => void;
}) {
  if (items.length === 0) {
    return (
      <p style={{ margin: 0, color: "var(--ec-text-dim)", fontSize: "var(--ec-text-sm)" }}>
        Открытых задач, решений и follow-up в комнате нет. Набери в композере
        «/task ...» / «/decision ...» / «/followup ...» — задача появится здесь
        и в общей доске пространства.
      </p>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--ec-space-2)" }}>
      {items.map((a) => {
        const meta = execTypeMeta(a.type);
        const done = a.status === "DONE";
        return (
          <div
            key={a.id}
            onClick={() => onOpen?.(a.id)}
            style={{
              display: "grid",
              gridTemplateColumns: "auto 1fr",
              gap: 8,
              padding: "var(--ec-space-2) var(--ec-space-3)",
              borderRadius: "var(--ec-radius-md)",
              background: "var(--ec-surface-2)",
              border: "1px solid var(--ec-border-subtle)",
              cursor: onOpen ? "pointer" : "default",
            }}
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggle?.(a.id, done ? "OPEN" : "DONE");
              }}
              style={{
                width: 16,
                height: 16,
                marginTop: 2,
                borderRadius: "var(--ec-radius-xs)",
                border: `1.5px solid ${done ? "var(--ec-status-exec)" : "var(--ec-border-emphasis)"}`,
                background: done ? "var(--ec-status-exec)" : "transparent",
                color: "var(--ec-accent-text)",
                cursor: onToggle ? "pointer" : "default",
                display: "grid",
                placeItems: "center",
              }}
              aria-label={done ? "Открыть заново" : "Отметить выполненным"}
            >
              {done && (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </button>
            <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
              <span
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: 6,
                  fontSize: "var(--ec-text-sm)",
                  color: done ? "var(--ec-text-dim)" : "var(--ec-text)",
                  textDecoration: done ? "line-through" : "none",
                }}
              >
                <span aria-hidden style={{ color: meta.color, fontFamily: "var(--ec-font-mono)" }}>
                  {meta.glyph}
                </span>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                  {a.title}
                </span>
              </span>
              {(a.assignee || a.dueAt) && (
                <span style={{ fontSize: "var(--ec-text-2xs)", color: "var(--ec-text-dim)" }}>
                  {a.assignee?.displayName ?? "без ответственного"}
                  {a.dueAt
                    ? ` · до ${new Date(a.dueAt).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}`
                    : ""}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function FilesView({ items }: { items: AttachmentBrief[] }) {
  if (items.length === 0) {
    return (
      <p style={{ margin: 0, color: "var(--ec-text-dim)", fontSize: "var(--ec-text-sm)" }}>
        Файлов в комнате пока нет. Перетащи файл в композер или нажми скрепку —
        он окажется здесь.
      </p>
    );
  }
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(86px, 1fr))",
        gap: "var(--ec-space-2)",
      }}
    >
      {items.map((a) => {
        const isImage = a.mimeType.startsWith("image/");
        const thumb = a.thumbnailUrl ?? (isImage ? a.url : null);
        return (
          <a
            key={a.id}
            href={resolveAssetUrl(a.url) ?? ""}
            target="_blank"
            rel="noreferrer"
            title={`${a.filename} · ${humanSize(a.size)}`}
            style={{
              position: "relative",
              display: "block",
              aspectRatio: "1",
              borderRadius: "var(--ec-radius-md)",
              overflow: "hidden",
              background: "var(--ec-surface-2)",
              border: "1px solid var(--ec-border-subtle)",
              textDecoration: "none",
              color: "var(--ec-text-muted)",
            }}
          >
            {thumb ? (
              <img
                src={resolveAssetUrl(thumb) ?? ""}
                alt={a.filename}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
                loading="lazy"
              />
            ) : (
              <span
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "grid",
                  placeItems: "center",
                  fontSize: "0.6rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  textAlign: "center",
                  padding: 4,
                }}
              >
                {a.mimeType.split("/")[1]?.slice(0, 6) ?? "file"}
              </span>
            )}
            <span
              style={{
                position: "absolute",
                inset: "auto 0 0",
                padding: "2px 4px",
                background: "linear-gradient(180deg, transparent, hsl(210 12% 6% / 0.92))",
                color: "var(--ec-text)",
                fontSize: "0.58rem",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {a.filename}
            </span>
          </a>
        );
      })}
    </div>
  );
}
