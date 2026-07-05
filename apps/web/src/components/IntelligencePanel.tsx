import { useState, type FormEvent } from "react";
import { MemberList } from "./MemberList";
import type { MemberRow } from "../hooks/useMembers";
import type {
  ChannelMemoryEntry,
  CreateMemoryEntryInput,
  MemoryKind,
} from "../hooks/useChannelMemory";
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
  /** v1.5.40 — activeServerId для per-server persisted member-role-group
   *  collapse state. Forward'ится в MemberList. */
  serverId?: string | null;
};


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
  serverId,
}: Props) {
  // Clean redesign: театральный ec-rail header («ТАКТИЧЕСКИЙ ВИД» + holo-edge +
  // tactical-иконка) убран. Панель = MemberList с его чистым header
  // («Участники N/M» + collapse + close).
  return (
    <MemberList
      members={members}
      loading={membersLoading}
      error={membersError}
      voiceChannelByUser={voiceChannelByUser}
      channelNameById={channelNameById}
      currentUserId={currentUserId}
      onOpenDm={onOpenDm}
      onClose={onClose}
      onCollapse={onCollapse}
      serverId={serverId}
    />
  );
}

/* ===== Inner views exported for ChannelInfoPanel ============= */

const MEMORY_KIND_META: Record<MemoryKind, { label: string; color: string }> = {
  NOTE: { label: "Заметка", color: "var(--ec-accent)" },
  DECISION: { label: "Решение", color: "var(--ec-status-ai)" },
  RISK: { label: "Риск", color: "var(--ec-status-danger)" },
  FACT: { label: "Факт", color: "var(--ec-status-exec)" },
  LINK: { label: "Ссылка", color: "var(--ec-status-warn)" },
  ACTION: { label: "Действие", color: "var(--ec-status-exec)" },
};

function formatMemoryDate(value: string): string {
  return new Date(value).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function MemoryView({
  items,
  entries = [],
  loading = false,
  saving = false,
  error = null,
  onCreate,
  onArchive,
}: {
  items: PinnedMessageBrief[];
  entries?: ChannelMemoryEntry[];
  loading?: boolean;
  saving?: boolean;
  error?: string | null;
  onCreate?: (input: CreateMemoryEntryInput) => Promise<unknown>;
  onArchive?: (id: string) => Promise<unknown> | void;
}) {
  const [kind, setKind] = useState<MemoryKind>("NOTE");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tagText, setTagText] = useState("");

  const canCreate = Boolean(onCreate) && title.trim().length > 0 && !saving;
  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!canCreate || !onCreate) return;
    const tags = tagText
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
    const created = await onCreate({
      kind,
      title: title.trim(),
      content: content.trim() || null,
      tags,
    });
    if (created) {
      setKind("NOTE");
      setTitle("");
      setContent("");
      setTagText("");
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--ec-space-3)" }}>
      <form
        onSubmit={handleSubmit}
        style={{
          display: "grid",
          gap: "var(--ec-space-2)",
          padding: "var(--ec-space-3)",
          borderRadius: "var(--ec-radius-lg)",
          background:
            "linear-gradient(135deg, color-mix(in srgb, var(--ec-surface-2) 92%, transparent), color-mix(in srgb, var(--ec-accent) 8%, var(--ec-surface-1)))",
          border: "1px solid var(--ec-border-subtle)",
          boxShadow: "var(--ec-elev-1)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
          <div>
            <strong style={{ display: "block", fontSize: "var(--ec-text-sm)", color: "var(--ec-text)" }}>
              Запомнить для комнаты
            </strong>
            <span style={{ fontSize: "var(--ec-text-2xs)", color: "var(--ec-text-dim)" }}>
              Факт, решение или риск, который не должен потеряться в ленте.
            </span>
          </div>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as MemoryKind)}
            style={{
              borderRadius: "var(--ec-radius-md)",
              border: "1px solid var(--ec-border-subtle)",
              background: "var(--ec-surface-1)",
              color: "var(--ec-text)",
              padding: "0.45rem 0.55rem",
              fontSize: "var(--ec-text-sm)",
              minWidth: 112,
            }}
          >
            {Object.entries(MEMORY_KIND_META).map(([value, meta]) => (
              <option key={value} value={value}>
                {meta.label}
              </option>
            ))}
          </select>
        </div>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Коротко: что нужно помнить?"
          maxLength={180}
          style={{
            width: "100%",
            borderRadius: "var(--ec-radius-md)",
            border: "1px solid var(--ec-border-subtle)",
            background: "var(--ec-surface-1)",
            color: "var(--ec-text)",
            padding: "0.65rem 0.75rem",
            fontSize: "var(--ec-text-sm)",
            outline: "none",
          }}
        />
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Контекст, ограничения, почему это важно..."
          rows={3}
          maxLength={4000}
          style={{
            width: "100%",
            resize: "vertical",
            minHeight: 72,
            borderRadius: "var(--ec-radius-md)",
            border: "1px solid var(--ec-border-subtle)",
            background: "var(--ec-surface-1)",
            color: "var(--ec-text)",
            padding: "0.65rem 0.75rem",
            fontSize: "var(--ec-text-sm)",
            outline: "none",
          }}
        />
        <div style={{ display: "flex", gap: "var(--ec-space-2)", alignItems: "center" }}>
          <input
            value={tagText}
            onChange={(e) => setTagText(e.target.value)}
            placeholder="Теги через запятую: auth, client, risk"
            style={{
              flex: 1,
              minWidth: 0,
              borderRadius: "var(--ec-radius-md)",
              border: "1px solid var(--ec-border-subtle)",
              background: "var(--ec-surface-1)",
              color: "var(--ec-text)",
              padding: "0.55rem 0.7rem",
              fontSize: "var(--ec-text-xs)",
              outline: "none",
            }}
          />
          <button
            type="submit"
            disabled={!canCreate}
            style={{
              borderRadius: "var(--ec-radius-md)",
              border: "1px solid var(--ec-border-accent)",
              background: canCreate ? "var(--ec-accent)" : "var(--ec-surface-2)",
              color: canCreate ? "var(--ec-accent-text)" : "var(--ec-text-dim)",
              padding: "0.55rem 0.85rem",
              fontSize: "var(--ec-text-xs)",
              fontWeight: 700,
              cursor: canCreate ? "pointer" : "not-allowed",
              whiteSpace: "nowrap",
            }}
          >
            {saving ? "Сохраняю..." : "Сохранить"}
          </button>
        </div>
        {error && (
          <span style={{ color: "var(--ec-status-danger)", fontSize: "var(--ec-text-xs)" }}>
            {error}
          </span>
        )}
      </form>

      {loading ? (
        <p style={{ margin: 0, color: "var(--ec-text-dim)", fontSize: "var(--ec-text-sm)" }}>
          Загружаю память комнаты...
        </p>
      ) : entries.length === 0 && items.length === 0 ? (
        <p style={{ margin: 0, color: "var(--ec-text-dim)", fontSize: "var(--ec-text-sm)" }}>
          Здесь пока пусто. Сохрани решение, риск или факт — и комната начнёт помнить не шум, а смысл.
        </p>
      ) : null}

      {entries.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--ec-space-2)" }}>
          {entries.map((entry) => {
            const meta = MEMORY_KIND_META[entry.kind];
            return (
              <article
                key={entry.id}
                style={{
                  padding: "var(--ec-space-3)",
                  borderRadius: "var(--ec-radius-md)",
                  background: "var(--ec-surface-2)",
                  border: "1px solid var(--ec-border-subtle)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
                    <span
                      style={{
                        display: "inline-flex",
                        width: "fit-content",
                        borderRadius: "var(--ec-radius-full)",
                        border: `1px solid ${meta.color}`,
                        color: meta.color,
                        padding: "0.1rem 0.45rem",
                        fontSize: "var(--ec-text-2xs)",
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                      }}
                    >
                      {meta.label}
                    </span>
                    <strong style={{ color: "var(--ec-text)", fontSize: "var(--ec-text-sm)" }}>
                      {entry.title}
                    </strong>
                  </div>
                  {onArchive && (
                    <button
                      type="button"
                      onClick={() => void onArchive(entry.id)}
                      title="Убрать из памяти"
                      style={{
                        border: "1px solid var(--ec-border-subtle)",
                        background: "transparent",
                        color: "var(--ec-text-dim)",
                        borderRadius: "var(--ec-radius-sm)",
                        padding: "0.25rem 0.45rem",
                        cursor: "pointer",
                        fontSize: "var(--ec-text-2xs)",
                      }}
                    >
                      Архив
                    </button>
                  )}
                </div>
                {entry.content && (
                  <p style={{ margin: 0, color: "var(--ec-text-muted)", fontSize: "var(--ec-text-sm)", whiteSpace: "pre-wrap" }}>
                    {entry.content}
                  </p>
                )}
                {entry.tags.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {entry.tags.map((tag) => (
                      <span
                        key={tag}
                        style={{
                          borderRadius: "var(--ec-radius-full)",
                          background: "var(--ec-surface-1)",
                          color: "var(--ec-text-dim)",
                          padding: "0.12rem 0.45rem",
                          fontSize: "var(--ec-text-2xs)",
                        }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
                <span style={{ color: "var(--ec-text-dim)", fontSize: "var(--ec-text-2xs)" }}>
                  {entry.createdBy.displayName} · {formatMemoryDate(entry.createdAt)}
                </span>
              </article>
            );
          })}
        </div>
      )}

      {items.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--ec-space-2)" }}>
          <strong style={{ color: "var(--ec-text-muted)", fontSize: "var(--ec-text-xs)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Закреплённые якоря
          </strong>
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
                <span aria-hidden style={{ color: "var(--ec-accent)" }}>pin</span>
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
      )}
    </div>
  );
}

export function LegacyMemoryView({ items }: { items: PinnedMessageBrief[] }) {
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
