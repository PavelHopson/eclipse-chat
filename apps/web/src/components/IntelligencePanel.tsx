import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { Avatar } from "./Avatar";
import { ChannelDigestPanel } from "./ChannelDigestPanel";
import { MemberList } from "./MemberList";
import type { ChannelDigest, DigestAiSummary } from "../hooks/useChannelDigest";
import type { MemberRow } from "../hooks/useMembers";
import type { useVoice as useVoiceHook } from "../hooks/useVoice";

/**
 * IntelligencePanel — правый rail Eclipse Chat как **context-aware
 * Intelligence Panel** (Фаза A operational redesign).
 *
 * Всегда видим в server-view (и voice, и chat). Tab-bar:
 *  - «Intelligence» — контекст текущего режима:
 *      · chat  → ChannelDigestPanel (задачи / решения / pinned / AI-резюме)
 *      · voice → live-roster эфира (кто говорит, mic/deafen, статус)
 *  - «Участники»   — MemberList сервера (online / offline).
 *
 * Thread / Incident панели по-прежнему перекрывают этот rail в AppShell —
 * IntelligencePanel это default-состояние правой колонки.
 */

type RightTab = "intelligence" | "memory" | "execution" | "files" | "members";

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
  status: "OPEN" | "DONE";
  dueAt: string | null;
  assignee: { displayName: string; avatar: string | null } | null;
};

type Props = {
  mode: "voice" | "chat";
  // ── Участники ─────────────────────────────────────────────
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
  // ── Intelligence: chat-режим (digest) ─────────────────────
  digest: ChannelDigest | null;
  digestLoading: boolean;
  digestError: string | null;
  onRefreshDigest: () => void;
  digestCompact?: boolean;
  aiSummary: DigestAiSummary | null;
  aiLoading: boolean;
  aiError: string | null;
  onRequestAiSummary: () => void;
  // ── Intelligence: voice-режим (live roster) ───────────────
  voice: ReturnType<typeof useVoiceHook>;
  /** id выбранного voice-канала (для определения «я в этой комнате?»). */
  voiceChannelId: string | null;
  voiceChannelName: string | null;
  /** Occupants выбранного voice-канала когда ты в него НЕ подключён. */
  voiceOccupants: MemberRow[];
  // ── Memory / Execution / Files (chat-режим, channel-scoped) ───────
  pinnedMessages: PinnedMessageBrief[];
  attachments: AttachmentBrief[];
  executionItems: ExecutionItemBrief[];
  onToggleExecutionStatus?: (id: string, status: "OPEN" | "DONE") => void;
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

const tabBar: CSSProperties = {
  display: "flex",
  alignItems: "stretch",
  gap: 2,
  padding: "var(--ec-space-2) var(--ec-space-2) 0",
  borderBottom: "1px solid var(--ec-border-subtle)",
  background: "var(--ec-surface-1)",
  flexShrink: 0,
};

function tabBtn(active: boolean): CSSProperties {
  return {
    flex: 1,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    padding: "0.5rem 0.5rem 0.55rem",
    background: "transparent",
    border: 0,
    borderBottom: active
      ? "2px solid var(--ec-accent)"
      : "2px solid transparent",
    color: active ? "var(--ec-text-strong)" : "var(--ec-text-muted)",
    fontSize: "var(--ec-text-2xs)",
    fontWeight: 700,
    letterSpacing: "var(--ec-tracking-caps)",
    textTransform: "uppercase",
    cursor: "pointer",
    transition:
      "color var(--ec-dur-fast) var(--ec-ease), border-color var(--ec-dur-fast) var(--ec-ease)",
  };
}

const countPill: CSSProperties = {
  fontSize: "0.6rem",
  fontWeight: 700,
  fontFeatureSettings: '"tnum"',
  padding: "0.05rem 0.32rem",
  borderRadius: "var(--ec-radius-full)",
  background: "var(--ec-surface-3)",
  color: "var(--ec-text-muted)",
};

const scrollArea: CSSProperties = {
  flex: 1,
  minHeight: 0,
  overflow: "auto",
  display: "flex",
  flexDirection: "column",
};

const voiceWrap: CSSProperties = {
  padding: "var(--ec-space-3)",
  display: "flex",
  flexDirection: "column",
  gap: "var(--ec-space-3)",
};

const voiceHeader: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
};

const voiceTitle: CSSProperties = {
  fontSize: "var(--ec-text-2xs)",
  fontWeight: 800,
  letterSpacing: "var(--ec-tracking-caps)",
  textTransform: "uppercase",
  color: "var(--ec-text-strong)",
  display: "flex",
  alignItems: "center",
  gap: 6,
};

const rosterRow: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "auto 1fr auto",
  alignItems: "center",
  gap: 8,
  padding: "0.4rem 0.5rem",
  borderRadius: "var(--ec-radius-sm)",
  border: "1px solid var(--ec-border-subtle)",
  background: "var(--ec-surface-2)",
  fontSize: "var(--ec-text-sm)",
};

type RosterEntry = {
  id: string;
  name: string;
  avatar: string | null;
  speaking: boolean;
  micMuted: boolean;
  deafened: boolean;
  isLocal: boolean;
};

function MicOffGlyph() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="1" y1="1" x2="23" y2="23" />
      <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
      <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
      <line x1="12" y1="19" x2="12" y2="23" />
    </svg>
  );
}

function DeafenedGlyph() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="1" y1="1" x2="23" y2="23" />
      <path d="M3 14v-3a9 9 0 0 1 14.31-7.24M21 13v1a2 2 0 0 1-.18.83" />
      <path d="M21 15a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3M3 14a2 2 0 0 1 2-2h1a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5" />
    </svg>
  );
}

function CloseButton({ onClose }: { onClose: () => void }) {
  return (
    <button
      type="button"
      onClick={onClose}
      className="ec-shell__members-close ec-btn ec-btn--ghost ec-btn--sm"
      aria-label="Закрыть"
      style={{ width: 28, height: 28, padding: 0, flexShrink: 0, alignSelf: "center" }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    </button>
  );
}

/** Voice-режим Intelligence: live-roster эфира + статус комнаты. */
function VoiceIntelligence({
  voice,
  voiceChannelId,
  voiceChannelName,
  voiceOccupants,
  members,
}: {
  voice: ReturnType<typeof useVoiceHook>;
  voiceChannelId: string | null;
  voiceChannelName: string | null;
  voiceOccupants: MemberRow[];
  members: MemberRow[];
}) {
  const joinedHere =
    voice.activeChannelId != null && voice.activeChannelId === voiceChannelId;

  const avatarFor = (userId: string): string | null =>
    members.find((m) => m.userId === userId)?.user.avatar ?? null;

  // Joined → live LiveKit участники. Не joined → socket-tracked occupants.
  const roster: RosterEntry[] = joinedHere
    ? voice.participants.map((p) => ({
        id: p.identity,
        name: p.name,
        avatar: avatarFor(p.identity),
        speaking: p.isSpeaking && !p.isMicMuted,
        micMuted: p.isMicMuted,
        deafened: p.isDeafened,
        isLocal: p.isLocal,
      }))
    : voiceOccupants.map((m) => ({
        id: m.userId,
        name: m.user.displayName,
        avatar: m.user.avatar,
        speaking: false,
        micMuted: false,
        deafened: false,
        isLocal: false,
      }));

  const statusLabel = joinedHere
    ? voice.state === "connected"
      ? "ты в эфире"
      : voice.state === "reconnecting"
      ? "переподключение"
      : voice.state === "connecting"
      ? "подключаемся"
      : "не в эфире"
    : roster.length > 0
    ? "идёт эфир"
    : "комната свободна";

  // Semantic status-цвет: live → exec green, connecting → warn amber,
  // свободная комната → idle blue.
  const statusColor =
    joinedHere && (voice.state === "connecting" || voice.state === "reconnecting")
      ? "var(--ec-status-warn)"
      : roster.length > 0
      ? "var(--ec-status-exec)"
      : "var(--ec-status-idle)";
  const sessionLive = roster.length > 0;

  return (
    <div
      style={voiceWrap}
      className={sessionLive ? "ec-telemetry-edge" : undefined}
    >
      <div style={voiceHeader}>
        <span style={voiceTitle}>
          <span aria-hidden style={{ color: "var(--ec-accent)" }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 5L6 9H2v6h4l5 4V5z" />
              <path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07" />
            </svg>
          </span>
          Эфир
        </span>
        <span
          style={{
            fontSize: "var(--ec-text-2xs)",
            color: "var(--ec-text-muted)",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <span
            className={sessionLive ? "ec-signal-dot" : undefined}
            style={{
              color: statusColor,
              ...(sessionLive
                ? {}
                : {
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: "currentColor",
                    display: "inline-block",
                    flexShrink: 0,
                  }),
            }}
            aria-hidden
          />
          {voiceChannelName ? `#${voiceChannelName} · ` : ""}
          {roster.length} {roster.length === 1 ? "участник" : "участников"} · {statusLabel}
        </span>
      </div>

      {roster.length === 0 ? (
        <p style={{ margin: 0, color: "var(--ec-text-dim)", fontSize: "var(--ec-text-sm)" }}>
          В этом голосовом канале сейчас никого. Зайди первым — другие увидят
          тебя в эфире.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {roster.map((r) => (
            <div
              key={r.id}
              style={{
                ...rosterRow,
                ...(r.speaking
                  ? {
                      borderColor: "var(--ec-accent)",
                      boxShadow: "0 0 0 1px var(--ec-accent), 0 0 16px -4px hsl(195 70% 60% / 0.5)",
                    }
                  : null),
              }}
              title={
                r.deafened
                  ? `${r.name} — звук выключен`
                  : r.micMuted
                  ? `${r.name} — микрофон выключен`
                  : r.speaking
                  ? `${r.name} — говорит`
                  : `${r.name} — в эфире`
              }
            >
              <span
                style={{
                  display: "inline-block",
                  borderRadius: "var(--ec-radius-full)",
                  boxShadow: r.speaking
                    ? "0 0 0 2px var(--ec-accent), 0 0 12px hsl(195 70% 60% / 0.6)"
                    : "none",
                  opacity: r.deafened || r.micMuted ? 0.65 : 1,
                  transition: "box-shadow 80ms linear",
                }}
              >
                <Avatar url={r.avatar} name={r.name} size={26} />
              </span>
              <span
                style={{
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  color: r.speaking ? "var(--ec-accent)" : "var(--ec-text)",
                  fontWeight: r.speaking ? 600 : 400,
                }}
              >
                {r.name}
                {r.isLocal && (
                  <span style={{ color: "var(--ec-text-dim)", fontWeight: 500, marginLeft: 4 }}>
                    (ты)
                  </span>
                )}
              </span>
              {(r.deafened || r.micMuted) && (
                <span aria-hidden style={{ display: "inline-grid", placeItems: "center", color: "var(--ec-danger)" }}>
                  {r.deafened ? <DeafenedGlyph /> : <MicOffGlyph />}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      <p
        style={{
          margin: 0,
          fontSize: "var(--ec-text-2xs)",
          color: "var(--ec-text-dim)",
          lineHeight: "var(--ec-leading-normal)",
        }}
      >
        Live AI-резюме эфира и action items появятся здесь — слой Intelligence
        в работе.
      </p>
    </div>
  );
}

export function IntelligencePanel({
  mode,
  members,
  membersLoading,
  membersError,
  voiceChannelByUser,
  channelNameById,
  currentUserId,
  onOpenDm,
  onClose,
  onCollapse,
  digest,
  digestLoading,
  digestError,
  onRefreshDigest,
  digestCompact,
  aiSummary,
  aiLoading,
  aiError,
  onRequestAiSummary,
  voice,
  voiceChannelId,
  voiceChannelName,
  voiceOccupants,
  pinnedMessages,
  attachments,
  executionItems,
  onToggleExecutionStatus,
}: Props) {
  // Default-вкладка зависит от режима: в чате контекст важнее (Intelligence),
  // в voice центр уже показывает участников плитками → дефолт «Участники».
  const [tab, setTab] = useState<RightTab>(
    mode === "voice" ? "members" : "intelligence",
  );

  // При смене режима (chat ↔ voice) сбрасываем на дефолт этого режима.
  useEffect(() => {
    setTab(mode === "voice" ? "members" : "intelligence");
  }, [mode]);

  const onlineCount = members.filter((m) => m.online).length;

  return (
    <aside style={wrap} aria-label="Intelligence-панель">
      <div style={tabBar}>
        <button
          type="button"
          style={tabBtn(tab === "intelligence")}
          onClick={() => setTab("intelligence")}
          aria-selected={tab === "intelligence"}
          role="tab"
          title="Сводка / контекст канала"
        >
          Сводка
        </button>
        {mode === "chat" && (
          <>
            <button
              type="button"
              style={tabBtn(tab === "memory")}
              onClick={() => setTab("memory")}
              aria-selected={tab === "memory"}
              role="tab"
              title="Закреплённое — память канала"
            >
              Память
              {pinnedMessages.length > 0 && (
                <span style={countPill}>{pinnedMessages.length}</span>
              )}
            </button>
            <button
              type="button"
              style={tabBtn(tab === "execution")}
              onClick={() => setTab("execution")}
              aria-selected={tab === "execution"}
              role="tab"
              title="Задачи / решения / follow-up канала"
            >
              Дела
              {executionItems.length > 0 && (
                <span style={countPill}>{executionItems.length}</span>
              )}
            </button>
            <button
              type="button"
              style={tabBtn(tab === "files")}
              onClick={() => setTab("files")}
              aria-selected={tab === "files"}
              role="tab"
              title="Файлы канала"
            >
              Файлы
              {attachments.length > 0 && (
                <span style={countPill}>{attachments.length}</span>
              )}
            </button>
          </>
        )}
        <button
          type="button"
          style={tabBtn(tab === "members")}
          onClick={() => setTab("members")}
          aria-selected={tab === "members"}
          role="tab"
          title={`Участники сервера · ${onlineCount}/${members.length}`}
        >
          Люди
        </button>
        {onCollapse && (
          <button
            type="button"
            onClick={onCollapse}
            aria-label="Свернуть панель"
            title="Свернуть панель"
            className="ec-btn ec-btn--ghost ec-btn--sm"
            style={{ width: 28, height: 28, padding: 0, flexShrink: 0, alignSelf: "center" }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M9 6l6 6-6 6" />
            </svg>
          </button>
        )}
        {onClose && <CloseButton onClose={onClose} />}
      </div>

      {tab === "members" ? (
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
      ) : tab === "memory" ? (
        <div style={{ ...scrollArea, padding: "var(--ec-space-3)" }}>
          <MemoryView items={pinnedMessages} />
        </div>
      ) : tab === "execution" ? (
        <div style={{ ...scrollArea, padding: "var(--ec-space-3)" }}>
          <ExecutionView items={executionItems} onToggle={onToggleExecutionStatus} />
        </div>
      ) : tab === "files" ? (
        <div style={{ ...scrollArea, padding: "var(--ec-space-3)" }}>
          <FilesView items={attachments} />
        </div>
      ) : mode === "voice" ? (
        <div style={scrollArea}>
          <VoiceIntelligence
            voice={voice}
            voiceChannelId={voiceChannelId}
            voiceChannelName={voiceChannelName}
            voiceOccupants={voiceOccupants}
            members={members}
          />
        </div>
      ) : (
        <div style={{ ...scrollArea, padding: "var(--ec-space-3)" }}>
          <ChannelDigestPanel
            digest={digest}
            loading={digestLoading}
            error={digestError}
            onRefresh={onRefreshDigest}
            compact={digestCompact}
            aiSummary={aiSummary}
            aiLoading={aiLoading}
            aiError={aiError}
            onRequestAiSummary={onRequestAiSummary}
          />
        </div>
      )}
    </aside>
  );
}

/* ===== Memory tab ========================================== */

function MemoryView({ items }: { items: PinnedMessageBrief[] }) {
  if (items.length === 0) {
    return (
      <p style={{ margin: 0, color: "var(--ec-text-dim)", fontSize: "var(--ec-text-sm)" }}>
        В этом канале ещё ничего не закреплено. Закрепи важное сообщение через
        hover-меню — оно появится здесь как «память» канала.
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

/* ===== Execution tab ======================================= */

function execTypeMeta(type: "TASK" | "DECISION" | "FOLLOW_UP") {
  if (type === "DECISION") return { glyph: "◆", color: "var(--ec-status-ai)" };
  if (type === "FOLLOW_UP") return { glyph: "↻", color: "var(--ec-status-warn)" };
  return { glyph: "□", color: "var(--ec-status-exec)" };
}

function ExecutionView({
  items,
  onToggle,
}: {
  items: ExecutionItemBrief[];
  onToggle?: (id: string, status: "OPEN" | "DONE") => void;
}) {
  if (items.length === 0) {
    return (
      <p style={{ margin: 0, color: "var(--ec-text-dim)", fontSize: "var(--ec-text-sm)" }}>
        Открытых задач, решений и follow-up в канале нет. Набери в композере
        «/task ...» / «/decision ...» / «/followup ...» — задача появится здесь
        и в общей доске сервера.
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
            style={{
              display: "grid",
              gridTemplateColumns: "auto 1fr",
              gap: 8,
              padding: "var(--ec-space-2) var(--ec-space-3)",
              borderRadius: "var(--ec-radius-md)",
              background: "var(--ec-surface-2)",
              border: "1px solid var(--ec-border-subtle)",
            }}
          >
            <button
              type="button"
              onClick={() => onToggle?.(a.id, done ? "OPEN" : "DONE")}
              style={{
                width: 16,
                height: 16,
                marginTop: 2,
                borderRadius: "var(--ec-radius-xs)",
                border: `1.5px solid ${done ? "var(--ec-status-exec)" : "var(--ec-border-emphasis)"}`,
                background: done ? "var(--ec-status-exec)" : "transparent",
                color: "#fff",
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

/* ===== Files tab =========================================== */

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function FilesView({ items }: { items: AttachmentBrief[] }) {
  if (items.length === 0) {
    return (
      <p style={{ margin: 0, color: "var(--ec-text-dim)", fontSize: "var(--ec-text-sm)" }}>
        Файлов в канале пока нет. Перетащи файл в композер или нажми скрепку —
        он окажется здесь.
      </p>
    );
  }
  const basePrefix = import.meta.env.BASE_URL.replace(/\/$/, "");
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
            href={`${basePrefix}${a.url}`}
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
                src={`${basePrefix}${thumb}`}
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
