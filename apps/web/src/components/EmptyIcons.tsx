/**
 * EmptyIcons — icon-set для EmptyState.
 *
 * v1.1.22: line-art SVG заменены на кастомные game-style 3D иконки
 * (PNG, Pavel'я набор в public/game-icons/). Detailed 3D-иконки
 * отлично смотрятся в крупном empty-state circle (84px). Каждая
 * функция возвращает `<img>` с `.ec-game-icon` классом.
 *
 * Использование:
 *   <EmptyState icon={<EmptyChannelIcon />} title="..." hint="..." />
 */

import { gameIcon, type GameIconName } from "../lib/gameIcons";

function Icon({ name, alt }: { name: GameIconName; alt: string }) {
  return (
    <img
      className="ec-game-icon"
      src={gameIcon(name)}
      alt={alt}
      width={72}
      height={72}
      loading="lazy"
      draggable={false}
    />
  );
}

/** Канал без сообщений — затухший сигнал. */
export function EmptyChannelIcon() {
  return <Icon name="void_signal" alt="" />;
}

/** Пустой DM-разговор. */
export function EmptyDmIcon() {
  return <Icon name="data_shard" alt="" />;
}

/** Home «СЕГОДНЯ» без событий — eclipse core. */
export function EmptyHomeIcon() {
  return <Icon name="eclipse_core" alt="" />;
}

/** Status Board пуст — task pin. */
export function EmptyBoardIcon() {
  return <Icon name="task_pin" alt="" />;
}

/** Search без результатов — void signal. */
export function EmptySearchIcon() {
  return <Icon name="void_signal" alt="" />;
}

/** Team Health когда нечего считать — focus ring. */
export function EmptyHealthIcon() {
  return <Icon name="focus_ring" alt="" />;
}

/** Incident timeline без событий — bug core (idle). */
export function EmptyIncidentIcon() {
  return <Icon name="bug_core" alt="" />;
}

/** Files tab без attachments — data shard. */
export function EmptyFilesIcon() {
  return <Icon name="data_shard" alt="" />;
}

/** Bots без созданных — bot eye. */
export function EmptyBotsIcon() {
  return <Icon name="bot_eye" alt="" />;
}

/** Members без участников — gold orbit. */
export function EmptyMembersIcon() {
  return <Icon name="gold_orbit" alt="" />;
}
