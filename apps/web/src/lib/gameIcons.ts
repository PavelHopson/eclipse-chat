/**
 * v1.1.22 — game-icon asset helper.
 *
 * Кастомный icon-set (3D game-style PNG'и от Pavel'я) лежит в
 * `apps/web/public/game-icons/`. Раздаётся nginx'ом статикой по
 * `<BASE_URL>game-icons/<name>.png` — НЕ бандлится в JS/CSS.
 *
 * Использование: `<img src={gameIcon("owner_crown")} ... />`.
 */

/** Имена доступных game-иконок (apps/web/public/game-icons/). */
export type GameIconName =
  | "admin_rune"
  | "approved_signal"
  | "bot_eye"
  | "bug_core"
  | "chaos_spark"
  | "data_shard"
  | "denied_signal"
  | "deploy_arrow"
  | "eclipse_core"
  | "focus_ring"
  | "gold_orbit"
  | "mod_shield"
  | "music_wave"
  | "owner_crown"
  | "review_mark"
  | "system_error"
  | "system_online"
  | "system_warning"
  | "task_pin"
  | "thinking_orb"
  | "voice_node"
  | "void_signal";

/** Возвращает URL game-иконки с учётом BASE_URL (prod = /eclipse-chat/). */
export function gameIcon(name: GameIconName): string {
  return `${import.meta.env.BASE_URL}game-icons/${name}.png`;
}
