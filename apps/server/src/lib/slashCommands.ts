/**
 * v1.2.14 — Slash-команды на бэкенде.
 *
 * Два типа handler'ов:
 *   - transform: модифицирует content, дальше идёт штатный flow создания
 *     сообщения (записывается в БД + emit message:new).
 *   - ephemeral: backend не пишет сообщение в БД, возвращает caller'у JSON
 *     с content; фронт показывает баннер «только вы видите» в композере.
 *
 * Парсер строгий: `^/<name>(?:\s+<args>)?$` — `<name>` это \w+ без слэшей.
 * Тогда «/path/to/file» НЕ распознается как команда (regex не матчит) и
 * улетит как обычное сообщение. Неизвестная команда (`/foo`) тоже не
 * матчит ни одного handler'а — возвращает unknown, caller решает: показать
 * ephemeral-ошибку или fall-through к нормальному post'у.
 */

export type SlashTransform = { kind: "transform"; content: string };
export type SlashEphemeral = { kind: "ephemeral"; content: string };
export type SlashUnknown = { kind: "unknown"; name: string };
export type SlashResult = SlashTransform | SlashEphemeral | SlashUnknown;

export type SlashContext = {
  userId: string;
  channelId: string;
  serverId: string | null;
  displayName: string;
  args: string;
};

type Handler = (ctx: SlashContext) => SlashTransform | SlashEphemeral;

/**
 * `/me <действие>` — IRC-классика. От 3-го лица курсивом:
 *   /me опаздывает  →  «_Pavel опаздывает_»
 * Без args — посылает только «*Pavel*» (degenerate, но не crash).
 */
const meHandler: Handler = (ctx) => {
  const action = ctx.args.trim();
  const content = action
    ? `_${ctx.displayName} ${action}_`
    : `_${ctx.displayName}_`;
  return { kind: "transform", content };
};

/** ASCII-арт-команды. Args (если есть) добавляются перед арт-фразой. */
function makeAsciiCommand(art: string): Handler {
  return (ctx) => {
    const prefix = ctx.args.trim();
    const content = prefix ? `${prefix} ${art}` : art;
    return { kind: "transform", content };
  };
}

const helpHandler: Handler = () => ({
  kind: "ephemeral",
  content: [
    "Доступные команды:",
    "/me <действие> — пишет от 3-го лица курсивом",
    "/shrug [текст] — ¯\\_(ツ)_/¯",
    "/tableflip [текст] — (╯°□°)╯︵ ┻━┻",
    "/unflip [текст] — ┬─┬ノ( º _ ºノ)",
    "/help — этот список",
  ].join("\n"),
});

const registry: Record<string, Handler> = {
  me: meHandler,
  shrug: makeAsciiCommand("¯\\_(ツ)_/¯"),
  tableflip: makeAsciiCommand("(╯°□°)╯︵ ┻━┻"),
  unflip: makeAsciiCommand("┬─┬ノ( º _ ºノ)"),
  help: helpHandler,
};

const SLASH_RE = /^\/(\w+)(?:\s+([\s\S]*))?$/;

/**
 * Распознаёт slash-команду в content. Возвращает null если не команда
 * (не начинается с /, или содержит / в имени — типа путь).
 */
export function parseSlashCommand(
  content: string,
): { name: string; args: string } | null {
  const trimmed = content.trimStart();
  if (!trimmed.startsWith("/")) return null;
  const m = SLASH_RE.exec(trimmed);
  if (!m) return null;
  return { name: m[1].toLowerCase(), args: m[2] ?? "" };
}

/**
 * Диспатчит распознанную команду. Возвращает unknown если name нет в
 * registry — caller решает что делать (показать ephemeral-ошибку или
 * пропустить как нормальное сообщение).
 */
export function dispatchSlashCommand(
  parsed: { name: string; args: string },
  ctx: Omit<SlashContext, "args">,
): SlashResult {
  const handler = registry[parsed.name];
  if (!handler) return { kind: "unknown", name: parsed.name };
  return handler({ ...ctx, args: parsed.args });
}

/**
 * Список доступных команд — для frontend autocomplete (если будем
 * добавлять UI hint в композере). Пока экспортируем для возможного
 * использования в /api/platform/* или служебных endpoint'ах.
 */
export function listSlashCommands(): string[] {
  return Object.keys(registry).sort();
}
