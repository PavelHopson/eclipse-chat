import type { UserManualStatus } from "../hooks/useMembers";

/**
 * Общий маппинг присутствия собеседника ЛС (v1.6.64).
 *
 * Источник для ЛС — `manualStatus` из `DmOther` (live по socket), НЕ
 * server-members: `useMembers(null)` = [] в режиме ЛС → `onlineUserIds`
 * там пуст, и presence-точки в списке были бы всегда серыми. Поэтому
 * `manualStatus` — авторитетный сигнал; members-online лишь fallback
 * для случая, когда manualStatus не задан.
 *
 * Используется в шапке 1:1 ЛС (DmPeerHeader) и в строках списка ЛС
 * (DirectConversationList), чтобы цвета/лейблы статуса не расходились.
 *
 * Возвращает null когда manualStatus не задан — caller сам решает
 * fallback (показать members-online или ничего). `active` = «горящее»
 * присутствие (online/idle/dnd) → даёт glow; INVISIBLE → не active.
 */
export type DmStatusMeta = { color: string; label: string; active: boolean };

const META: Record<UserManualStatus, DmStatusMeta> = {
  ONLINE: { color: "var(--ec-presence-online)", label: "В сети", active: true },
  IDLE: { color: "var(--ec-presence-idle)", label: "Неактивен", active: true },
  DND: { color: "var(--ec-presence-dnd)", label: "Не беспокоить", active: true },
  INVISIBLE: { color: "var(--ec-presence-offline)", label: "Не в сети", active: false },
};

export function dmStatusMeta(manualStatus?: UserManualStatus): DmStatusMeta | null {
  return manualStatus ? META[manualStatus] : null;
}
