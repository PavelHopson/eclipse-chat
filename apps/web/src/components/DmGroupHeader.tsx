import { GroupAvatar } from "./GroupAvatar";
import type { DmParticipant } from "../hooks/useDirectConversations";
import { dmStatusMeta } from "../lib/dmPresence";

/**
 * DmGroupHeader (v1.6.65) — шапка группового ЛС: аватар-стопка + название
 * + подзаголовок «N участников · M в сети» (Telegram-паритет, симметрично
 * 1:1 DmPeerHeader).
 *
 * `participants` включает текущего пользователя (deriveGroupTitle исключает
 * его при построении названия) → length = размер группы. «В сети» считается
 * по live `manualStatus` участников (active = ONLINE/IDLE/DND; общий хелпер
 * dmStatusMeta). Показывается только при M > 0 — ничего не выдумываем.
 */

/** RU-плюрализация «участник». */
function participantsWord(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "участник";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "участника";
  return "участников";
}

export function DmGroupHeader({
  title,
  participants,
  typingNames = [],
}: {
  title: string;
  participants: DmParticipant[];
  /** Кто сейчас печатает (displayName'ы) — замещает счётчик участников. */
  typingNames?: string[];
}) {
  const total = participants.length;
  const online = participants.filter((p) => dmStatusMeta(p.manualStatus)?.active).length;
  // v1.6.66 — «X печатает…» / «X, Y печатают…» замещает счётчик при наборе.
  const typing = typingNames.length > 0;
  const typingLabel = !typing
    ? null
    : typingNames.length === 1
      ? `${typingNames[0]} печатает…`
      : `${typingNames.slice(0, 2).join(", ")} печатают…`;
  const subtitle =
    typingLabel ?? `${total} ${participantsWord(total)}` + (online > 0 ? ` · ${online} в сети` : "");

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 9, minWidth: 0 }}>
      <span style={{ flexShrink: 0, display: "inline-flex" }}>
        <GroupAvatar participants={participants} size={26} />
      </span>
      <span style={{ display: "flex", flexDirection: "column", minWidth: 0, lineHeight: 1.15 }}>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {title}
        </span>
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
      </span>
    </span>
  );
}
