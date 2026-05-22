import { useEffect } from "react";
import { ChannelDigestPanel } from "./ChannelDigestPanel";
import {
  MemoryView,
  ExecutionView,
  FilesView,
} from "./IntelligencePanel";
import type {
  AttachmentBrief,
  ExecutionItemBrief,
  PinnedMessageBrief,
} from "./IntelligencePanel";
import type { ChannelDigest, DigestAiSummary } from "../hooks/useChannelDigest";

/**
 * ChannelInfoPanel — v0.96 UX refactor.
 *
 * Раньше Сводка / Память / Дела / Файлы жили в right rail (IntelligencePanel
 * 5 tabs). Pavel-ask 19.05: right rail должен показывать ТОЛЬКО участников.
 * Sub-функционал переносится в (i)-кнопку chat-header'а — она открывает
 * этот overlay-panel поверх MessageList с 4 inner tabs.
 *
 * Открывается toggle'ом из AppShell (`infoPanelOpen` state). Закрывается
 * через ✕ внутри или повторным кликом на (i) в header. Persist active tab
 * in localStorage (per-channel) для UX continuity.
 *
 * Позиционирование: absolute внутри chat-area, top: 0, под chat-header
 * (через padding-top); занимает 70% высоты chat-area max-height, MessageList
 * остаётся виден частично снизу с backdrop dim — calm не cluttered.
 */

export type ChannelInfoTab = "summary" | "memory" | "execution" | "files";

type Props = {
  channelId: string;
  open: boolean;
  onClose: () => void;
  activeTab: ChannelInfoTab;
  onTabChange: (tab: ChannelInfoTab) => void;
  // ── Сводка ─────────────────────────────────────────────────
  digest: ChannelDigest | null;
  digestLoading: boolean;
  digestError: string | null;
  onRefreshDigest: () => void;
  digestCompact?: boolean;
  aiSummary: DigestAiSummary | null;
  aiLoading: boolean;
  aiError: string | null;
  onRequestAiSummary: () => void;
  // ── Память / Дела / Файлы (channel-scoped) ─────────────────
  pinnedMessages: PinnedMessageBrief[];
  attachments: AttachmentBrief[];
  executionItems: ExecutionItemBrief[];
  onToggleExecutionStatus?: (
    id: string,
    status: import("../lib/socket").ActionItemStatus,
  ) => void;
  onOpenAction?: (actionItemId: string) => void;
  /** Client Mode: скрыть operator-tabs «Дела» и «Файлы». */
  clientMode?: boolean;
};

// v1.1.94 slice 5: inline-style консоли ChannelInfoPanel вынесены в
// классы .ec-channel-info-panel* / .ec-info-tab* (components.css).

function IconSummary() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 5h18M3 12h12M3 19h18" />
    </svg>
  );
}
function IconMemory() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
    </svg>
  );
}
function IconExecution() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="9 11 12 14 22 4" />
      <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
    </svg>
  );
}
function IconFiles() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z" />
      <polyline points="13 2 13 9 20 9" />
    </svg>
  );
}

export function ChannelInfoPanel({
  channelId: _channelId,
  open,
  onClose,
  activeTab,
  onTabChange,
  digest,
  digestLoading,
  digestError,
  onRefreshDigest,
  digestCompact,
  aiSummary,
  aiLoading,
  aiError,
  onRequestAiSummary,
  pinnedMessages,
  attachments,
  executionItems,
  onToggleExecutionStatus,
  onOpenAction,
  clientMode = false,
}: Props) {
  // ESC закрывает panel.
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Если в client mode, и активный tab — execution/files, switch на summary.
  useEffect(() => {
    if (clientMode && (activeTab === "execution" || activeTab === "files")) {
      onTabChange("summary");
    }
  }, [clientMode, activeTab, onTabChange]);

  if (!open) return null;

  return (
    <section
      className="ec-channel-info-panel ec-anim-reveal"
      role="region"
      aria-label="Информация о комнате"
    >
      <div className="ec-channel-info-panel__tabs" role="tablist">
          <button
            type="button"
            onClick={() => onTabChange("summary")}
            aria-selected={activeTab === "summary"}
            role="tab"
            className="ec-info-tab ec-hud-tab"
            title="Сводка комнаты"
          >
            <IconSummary />
            <span>Сводка</span>
          </button>
          <button
            type="button"
            onClick={() => onTabChange("memory")}
            aria-selected={activeTab === "memory"}
            role="tab"
            className="ec-info-tab ec-hud-tab"
            title="Закреплённое — память комнаты"
          >
            <IconMemory />
            <span>Память</span>
            {pinnedMessages.length > 0 && (
              <span className="ec-info-tab__count">{pinnedMessages.length}</span>
            )}
          </button>
          {!clientMode && (
            <button
              type="button"
              onClick={() => onTabChange("execution")}
              aria-selected={activeTab === "execution"}
              role="tab"
              className="ec-info-tab ec-hud-tab"
              title="Задачи / решения / follow-up комнаты"
            >
              <IconExecution />
              <span>Дела</span>
              {executionItems.length > 0 && (
                <span className="ec-info-tab__count">{executionItems.length}</span>
              )}
            </button>
          )}
          {!clientMode && (
            <button
              type="button"
              onClick={() => onTabChange("files")}
              aria-selected={activeTab === "files"}
              role="tab"
              className="ec-info-tab ec-hud-tab"
              title="Файлы комнаты"
            >
              <IconFiles />
              <span>Файлы</span>
              {attachments.length > 0 && (
                <span className="ec-info-tab__count">{attachments.length}</span>
              )}
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            title="Закрыть (Esc)"
            className="ec-channel-info-panel__close ec-icon-btn"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="ec-channel-info-panel__body">
          {activeTab === "summary" ? (
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
          ) : activeTab === "memory" ? (
            <MemoryView items={pinnedMessages} />
          ) : activeTab === "execution" ? (
            <ExecutionView
              items={executionItems}
              onToggle={onToggleExecutionStatus}
              onOpen={onOpenAction}
            />
          ) : (
            <FilesView items={attachments} />
          )}
        </div>
    </section>
  );
}
