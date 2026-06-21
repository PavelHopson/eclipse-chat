import { Avatar } from "./Avatar";
import type { DmOther } from "../hooks/useDirectConversations";

/**
 * DmPeerHeader (v1.6.63) — presence в шапке 1:1 ЛС (Telegram-паритет).
 *
 * Источник присутствия собеседника — `DmOther` (live-обновляется в
 * useDirectConversations через socket): `manualStatus` + кастом-статус
 * (`activityEmoji` / `activityText`). НЕ опираемся на server-members
 * (`onlineUserIds` пуст в режиме ЛС — `useMembers(null)` возвращает []).
 *
 * Безопасно: presence-точка и статус-лейбл показываются ТОЛЬКО когда
 * `manualStatus` задан; кастом-активность — когда задана. Ничего не
 * выдумываем при отсутствии данных (просто имя без подзаголовка).
 */

type StatusMeta = { color: string; label: string };

const STATUS_META: Record<NonNullable<DmOther["manualStatus"]>, StatusMeta> = {
  ONLINE: { color: "var(--ec-presence-online)", label: "В сети" },
  IDLE: { color: "var(--ec-presence-idle)", label: "Неактивен" },
  DND: { color: "var(--ec-presence-dnd)", label: "Не беспокоить" },
  INVISIBLE: { color: "var(--ec-presence-offline)", label: "Не в сети" },
};

export function DmPeerHeader({ other }: { other: DmOther }) {
  const meta = other.manualStatus ? STATUS_META[other.manualStatus] : null;

  // Кастом-статус (эмодзи + текст) приоритетнее статус-лейбла, как в Telegram.
  const activity =
    other.activityEmoji || other.activityText
      ? `${other.activityEmoji ? `${other.activityEmoji} ` : ""}${other.activityText ?? ""}`.trim()
      : null;
  const subtitle = activity ?? meta?.label ?? null;

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 9, minWidth: 0 }}>
      <span style={{ position: "relative", display: "inline-block", flexShrink: 0 }}>
        <Avatar url={other.avatar} name={other.displayName} size={26} />
        {meta && (
          <span
            aria-hidden
            style={{
              position: "absolute",
              bottom: -1,
              right: -1,
              width: 9,
              height: 9,
              borderRadius: "var(--ec-radius-full)",
              border: "2px solid var(--ec-surface-1)",
              background: meta.color,
            }}
          />
        )}
      </span>
      <span style={{ display: "flex", flexDirection: "column", minWidth: 0, lineHeight: 1.15 }}>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {other.displayName}
        </span>
        {subtitle && (
          <span
            style={{
              fontSize: "var(--ec-text-2xs)",
              fontWeight: 400,
              color: "var(--ec-text-dim)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {subtitle}
          </span>
        )}
      </span>
    </span>
  );
}
