import { Avatar } from "./Avatar";
import type { DmOther } from "../hooks/useDirectConversations";
import { dmStatusMeta } from "../lib/dmPresence";

/**
 * DmPeerHeader (v1.6.63) — presence в шапке 1:1 ЛС (Telegram-паритет).
 *
 * Источник присутствия собеседника — `DmOther` (live-обновляется в
 * useDirectConversations через socket): `manualStatus` + кастом-статус
 * (`activityEmoji` / `activityText`). НЕ опираемся на server-members
 * (`onlineUserIds` пуст в режиме ЛС — `useMembers(null)` возвращает []).
 * Маппинг статуса → цвет/лейбл — общий `dmStatusMeta` (v1.6.64), тот же
 * что в списке ЛС (DirectConversationList).
 *
 * Безопасно: presence-точка и статус-лейбл показываются ТОЛЬКО когда
 * `manualStatus` задан; кастом-активность — когда задана. Ничего не
 * выдумываем при отсутствии данных (просто имя без подзаголовка).
 */
export function DmPeerHeader({
  other,
  typing = false,
  onOpenProfile,
}: {
  other: DmOther;
  typing?: boolean;
  onOpenProfile?: (userId: string) => void;
}) {
  const meta = dmStatusMeta(other.manualStatus);

  // Кастом-статус (эмодзи + текст) приоритетнее статус-лейбла, как в Telegram.
  const activity =
    other.activityEmoji || other.activityText
      ? `${other.activityEmoji ? `${other.activityEmoji} ` : ""}${other.activityText ?? ""}`.trim()
      : null;
  // v1.6.66 — «печатает…» замещает статус, пока собеседник набирает (Telegram).
  const subtitle = typing ? "печатает…" : activity ?? meta?.label ?? null;

  return (
    <button
      type="button"
      className="ec-dm-peer-header"
      onClick={() => onOpenProfile?.(other.id)}
      disabled={!onOpenProfile}
      aria-label={`Открыть профиль: ${other.displayName}`}
    >
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
              color: typing ? "var(--ec-accent)" : "var(--ec-text-dim)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {subtitle}
          </span>
        )}
      </span>
    </button>
  );
}
