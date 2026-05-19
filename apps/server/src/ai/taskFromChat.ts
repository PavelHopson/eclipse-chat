import type { FastifyBaseLogger } from "fastify";
import { db } from "../db.js";
import {
  emitActionItemCreated,
  emitBotTyping,
  emitMessageOnChannel,
  emitTableEvent,
} from "../realtime.js";
import { AINotConfiguredError, chat } from "./provider.js";
import { stripAiMention } from "./assistant.js";
import type { BotResponder } from "./assistant.js";
import { getSystemBotUserId } from "../lib/systemBot.js";
import { actionItemInclude, serializeActionItem } from "../actionItems.js";

/**
 * v0.93 #5 phase 2 + #4 — AI agent создаёт row в operational table по
 * запросу из чата.
 *
 * Trigger: AI mention (`@pm` / etc) + task-creation keywords. AI parsит
 * intent + maps к available tables + fields. Backend validates + creates
 * row + posts confirmation message от имени bot'а.
 *
 * Permissions: проверяется уже на уровне mention — sender является
 * member канала, агент имеет capabilities. Дополнительно: target table
 * должна быть в том же server'е.
 *
 * Fail modes (silent skip + log):
 *   - Intent !== create_row → caller fallback'нется на normal AI reply
 *   - AI вернул broken JSON → skip
 *   - Target table не найдена → reply «не вижу таблицы для добавления»
 *   - Validation failed (field/value) → drop bad cell, продолжить с others
 */

/**
 * Quick prescan на task-creation intent. Без AI call — экономит latency
 * для обычных AI replies. RU + EN keywords.
 */
const INTENT_KEYWORDS = [
  "добавь",
  "созда",
  "сохрани",
  "запиши",
  "внеси",
  "новая задача",
  "новую задачу",
  "новый таск",
  "add task",
  "create task",
  "new task",
  "new row",
  "add row",
];

export function hasTaskCreationIntent(content: string): boolean {
  const lower = content.toLowerCase();
  return INTENT_KEYWORDS.some((kw) => lower.includes(kw));
}

type TableSummary = {
  id: string;
  name: string;
  channelId: string | null;
  fields: Array<{
    id: string;
    name: string;
    type: string;
    options: string | null;
    position: number;
  }>;
};

type MemberSummary = {
  userId: string;
  displayName: string;
};

type AiTaskExtract = {
  intent: "create_row" | "none";
  table_id?: string;
  fields?: Array<{ name: string; value: string }>;
};

/**
 * Загружает server's tables + members для prompt context. Возвращает
 * только tables с хотя бы одним TEXT field (иначе бессмысленно — некуда
 * класть title).
 */
async function loadContext(
  serverId: string,
): Promise<{ tables: TableSummary[]; members: MemberSummary[] }> {
  const [tables, members] = await Promise.all([
    db.table.findMany({
      where: { serverId },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        name: true,
        channelId: true,
        fields: {
          select: {
            id: true,
            name: true,
            type: true,
            options: true,
            position: true,
          },
          orderBy: { position: "asc" },
        },
      },
    }),
    db.member.findMany({
      where: { serverId },
      select: {
        userId: true,
        user: { select: { displayName: true } },
      },
    }),
  ]);
  const filteredTables = tables.filter((t) =>
    t.fields.some((f) => f.type === "TEXT"),
  );
  return {
    tables: filteredTables,
    members: members.map((m) => ({
      userId: m.userId,
      displayName: m.user.displayName,
    })),
  };
}

/**
 * Format prompt: даём AI tables + fields + members + request.
 */
function buildPrompt(opts: {
  content: string;
  channelId: string;
  tables: TableSummary[];
  members: MemberSummary[];
  todayIso: string;
}): { system: string; user: string } {
  const memberLines = opts.members
    .slice(0, 50)
    .map((m) => `- ${m.displayName}`)
    .join("\n");

  const tableLines = opts.tables
    .map((t) => {
      const fields = t.fields
        .map((f) => {
          let extra = "";
          if (f.type === "STATUS" && f.options) {
            try {
              const opts = JSON.parse(f.options);
              if (Array.isArray(opts)) {
                extra = ` (options: ${opts.join(" | ")})`;
              }
            } catch {
              /* skip */
            }
          }
          return `    - "${f.name}" [${f.type}]${extra}`;
        })
        .join("\n");
      const channelMark = t.channelId === opts.channelId ? " ⬅ привязана к этому каналу" : "";
      return `* table "${t.name}" (id: ${t.id})${channelMark}\n${fields}`;
    })
    .join("\n");

  const system =
    "Ты — operational AI agent внутри Eclipse Chat. Пользователь упомянул тебя в канале " +
    "и хочет создать строку (задачу) в operational table. " +
    "Реши: это запрос на создание новой строки или просто вопрос/диалог. " +
    "Если создание — выбери ОДНУ таблицу из списка и извлеки значения для её полей. " +
    "Отвечай ТОЛЬКО валидным JSON, без markdown-блоков, без комментариев. " +
    "Формат:\n" +
    `{"intent":"create_row","table_id":"<table id из списка>","fields":[{"name":"<имя поля>","value":"<значение>"}]}\n` +
    `или\n` +
    `{"intent":"none"}\n\n` +
    "Правила:\n" +
    "- Если запрос явно про создание задачи/записи — intent=create_row. Иначе none.\n" +
    "- Используй ТОЛЬКО table_id из списка (не выдумывай).\n" +
    "- Используй ТОЛЬКО имена полей из выбранной table.\n" +
    "- TEXT: короткая суть задачи (заголовок), без лишних слов.\n" +
    "- USER: точное displayName из списка участников. Если не уверен — пропусти поле.\n" +
    `- DATE: ISO формат YYYY-MM-DD. Сегодня ${opts.todayIso}. «завтра», «пятница», «через 3 дня» — конвертируй.\n` +
    "- STATUS: одно из options ровно как написано.\n" +
    "- NUMBER: только число (без единиц).\n" +
    "- CHECKBOX: \"true\" или \"false\".\n" +
    "- Поля без надёжного значения — пропусти, не выдумывай.\n" +
    "- Приоритет таблицы: если есть привязанная к каналу — её. Иначе по имени из запроса. Иначе первая.";

  const user =
    `Доступные таблицы (только те у которых есть TEXT-поле):\n${tableLines || "(нет таблиц)"}` +
    `\n\nУчастники сервера:\n${memberLines || "(нет)"}` +
    `\n\nЗапрос пользователя: ${opts.content}\n\nJSON:`;

  return { system, user };
}

/**
 * Парсим AI response. AI иногда оборачивает в ```json ... ``` — strip.
 */
function parseExtract(raw: string): AiTaskExtract | null {
  if (!raw) return null;
  let trimmed = raw.trim();
  // Strip markdown fence.
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) trimmed = fenceMatch[1].trim();
  // Find first { and last }.
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start < 0 || end < 0 || end <= start) return null;
  const slice = trimmed.slice(start, end + 1);
  try {
    const parsed = JSON.parse(slice);
    if (parsed?.intent === "create_row" || parsed?.intent === "none") {
      return parsed as AiTaskExtract;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Heuristic: если AI не дал table_id, fallback на channel-bound таблицу.
 */
function pickFallbackTable(
  tables: TableSummary[],
  channelId: string,
): TableSummary | null {
  const bound = tables.find((t) => t.channelId === channelId);
  if (bound) return bound;
  return tables[0] ?? null;
}

/**
 * Validate + coerce cell value по типу поля. Returns null если значение
 * нельзя принять (caller skip'ает поле).
 */
function coerceCellValue(
  field: TableSummary["fields"][number],
  value: string,
  memberMap: Map<string, string>, // displayName(lower) → userId
): string | null {
  const v = value.trim();
  if (!v) return null;
  switch (field.type) {
    case "TEXT":
      return v.slice(0, 4000);
    case "NUMBER": {
      const n = parseFloat(v.replace(",", "."));
      return Number.isFinite(n) ? String(n) : null;
    }
    case "STATUS": {
      const opts = field.options ? safeArray(field.options) : [];
      if (!opts.length) return v.slice(0, 200);
      const exact = opts.find((o) => o === v);
      if (exact) return exact;
      const ci = opts.find((o) => o.toLowerCase() === v.toLowerCase());
      return ci ?? null;
    }
    case "DATE":
      if (/^\d{4}-\d{2}-\d{2}/.test(v)) {
        const d = new Date(v);
        return Number.isNaN(d.getTime()) ? null : v.slice(0, 30);
      }
      return null;
    case "CHECKBOX":
      if (v === "true" || v === "false") return v;
      return null;
    case "USER": {
      const uid = memberMap.get(v.toLowerCase());
      return uid ?? null;
    }
    case "RELATION":
    case "FILE":
      // Phase 2: AI не угадает id'шник. Skip.
      return null;
    default:
      return null;
  }
}

function safeArray(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((v) => typeof v === "string")
      : [];
  } catch {
    return [];
  }
}

/**
 * Forms «✓ Added to table X» reply. Markdown for chat rendering.
 */
function formatConfirmationMessage(
  tableName: string,
  rowPosition: number,
  applied: Array<{ fieldName: string; displayValue: string }>,
  linkedActionId: string | null,
): string {
  const lines = applied.map((a) => `  • **${a.fieldName}**: ${a.displayValue}`);
  const taskNote = linkedActionId
    ? `\n_Привязана задача — ищи в доске задач (Status Board)._`
    : "";
  return (
    `✓ Добавил в таблицу **«${tableName}»** строку #${rowPosition + 1}:\n` +
    lines.join("\n") +
    taskNote
  );
}

/**
 * Main entry point. Caller (maybeReplyToMention) вызывает ДО executeChannelBotReply.
 * Если возвращает true → caller skip'ает normal reply.
 */
export async function attemptCreateRowFromMention(params: {
  channelId: string;
  serverId: string;
  senderUserId: string;
  content: string;
  responder: BotResponder;
  log: FastifyBaseLogger;
}): Promise<boolean> {
  const { channelId, serverId, senderUserId, content, responder, log } = params;
  if (!hasTaskCreationIntent(content)) return false;
  void senderUserId;

  let ctx: { tables: TableSummary[]; members: MemberSummary[] };
  try {
    ctx = await loadContext(serverId);
  } catch (err) {
    log.warn({ err }, "AI taskCreator: loadContext failed");
    return false;
  }
  if (ctx.tables.length === 0) {
    // Нет таблиц — fallback на normal reply
    return false;
  }

  // Emit typing indicator (UI feedback).
  emitBotTyping(channelId, {
    channelId,
    userId: responder.userId,
    displayName: responder.displayName,
    botRole: responder.role,
  });

  const stripped = stripAiMention(content);
  const today = new Date().toISOString().slice(0, 10);
  const prompt = buildPrompt({
    content: stripped,
    channelId,
    tables: ctx.tables,
    members: ctx.members,
    todayIso: today,
  });

  let aiText: string;
  try {
    const result = await chat(
      [
        { role: "system", content: prompt.system },
        { role: "user", content: prompt.user },
      ],
      { temperature: 0.2, maxTokens: 400 },
    );
    aiText = result.text;
  } catch (err) {
    if (err instanceof AINotConfiguredError) return false;
    log.warn({ err }, "AI taskCreator chat() failed");
    return false;
  }

  const extract = parseExtract(aiText);
  if (!extract || extract.intent !== "create_row") {
    // AI решил что это не запрос на создание задачи — fall through на normal reply.
    return false;
  }

  // Resolve target table.
  let table = extract.table_id
    ? ctx.tables.find((t) => t.id === extract.table_id) ?? null
    : null;
  if (!table) {
    table = pickFallbackTable(ctx.tables, channelId);
  }
  if (!table) {
    log.info("AI taskCreator: no target table");
    return false;
  }

  // Build member lookup (lowercase displayName).
  const memberMap = new Map<string, string>();
  for (const m of ctx.members) {
    memberMap.set(m.displayName.toLowerCase(), m.userId);
  }

  // Validate + collect cells.
  const fieldByName = new Map<string, TableSummary["fields"][number]>();
  for (const f of table.fields) {
    fieldByName.set(f.name.toLowerCase(), f);
  }

  const cellsToCreate: Array<{ fieldId: string; value: string }> = [];
  const applied: Array<{ fieldName: string; displayValue: string }> = [];
  const aiFields = Array.isArray(extract.fields) ? extract.fields : [];

  for (const entry of aiFields) {
    if (!entry?.name || entry.value === undefined) continue;
    const field = fieldByName.get(entry.name.toLowerCase());
    if (!field) continue;
    const coerced = coerceCellValue(field, String(entry.value), memberMap);
    if (coerced === null) continue;
    cellsToCreate.push({ fieldId: field.id, value: coerced });
    // For USER display: lookup displayName by userId.
    let displayValue = coerced;
    if (field.type === "USER") {
      const m = ctx.members.find((m) => m.userId === coerced);
      displayValue = m ? m.displayName : coerced;
    }
    applied.push({
      fieldName: field.name,
      displayValue,
    });
  }

  // Если AI не дал ни одного валидного cell — skip (probably не таск).
  if (cellsToCreate.length === 0) {
    log.info({ tableId: table.id }, "AI taskCreator: no valid cells");
    return false;
  }

  // Гарантируем что есть title-like cell (хотя бы один TEXT). Иначе
  // создавать row смысла нет.
  const hasText = cellsToCreate.some((c) => {
    const f = table!.fields.find((f) => f.id === c.fieldId);
    return f?.type === "TEXT" && c.value.length > 0;
  });
  if (!hasText) {
    log.info("AI taskCreator: no TEXT cell extracted");
    return false;
  }

  // Resolve position (после последней).
  const lastRow = await db.tableRow.findFirst({
    where: { tableId: table.id },
    orderBy: { position: "desc" },
    select: { position: true },
  });
  const newPosition = (lastRow?.position ?? -1) + 1;

  // Derive title for ActionItem (если будет создан) — value первого TEXT cell.
  const textField = table.fields.find((f) => f.type === "TEXT");
  let actionTitle = "";
  if (textField) {
    const titleCell = cellsToCreate.find((c) => c.fieldId === textField.id);
    if (titleCell?.value) {
      actionTitle = titleCell.value.trim().slice(0, 160);
    }
  }

  // Create row + cells в transaction. v0.94 #10 phase 4b: если table
  // привязана к каналу + есть title — auto-create ActionItem и link.
  let createdRowId: string;
  let linkedActionId: string | null = null;
  try {
    const created = await db.$transaction(async (tx) => {
      const row = await tx.tableRow.create({
        data: {
          tableId: table!.id,
          position: newPosition,
          cells: {
            create: cellsToCreate.map((c) => ({
              fieldId: c.fieldId,
              value: c.value,
            })),
          },
        },
        include: { cells: true },
      });
      return row;
    });
    createdRowId = created.id;

    emitTableEvent(serverId, "table:row:added", {
      tableId: table.id,
      row: {
        id: created.id,
        position: created.position,
        createdAt: created.createdAt.toISOString(),
        updatedAt: created.updatedAt.toISOString(),
        actionItemId: null,
        cells: created.cells.map((c) => ({
          fieldId: c.fieldId,
          value: c.value,
        })),
      },
    });

    // v0.94 #10 phase 4b: auto-link ActionItem if table has channel.
    // ActionItem.channelId = table.channelId. Check channel type — VOICE
    // не годится (нет места для source-message). Если что-то сломалось —
    // не блокируем row, просто skip linking.
    if (table.channelId && actionTitle) {
      try {
        const channel = await db.channel.findUnique({
          where: { id: table.channelId },
          select: { id: true, serverId: true, type: true },
        });
        if (channel && channel.serverId === serverId && channel.type !== "VOICE") {
          const systemUserId = await getSystemBotUserId();
          const provenanceText =
            `📋 Задача создана AI-агентом из таблицы **«${table.name}»** ` +
            `(строка #${newPosition + 1}): ${actionTitle}`;
          const linked = await db.$transaction(async (tx) => {
            const message = await tx.message.create({
              data: {
                content: provenanceText,
                userId: systemUserId,
                channelId: channel.id,
              },
              include: {
                user: { select: { id: true, displayName: true, avatar: true } },
              },
            });
            const action = await tx.actionItem.create({
              data: {
                title: actionTitle,
                type: "TASK",
                serverId,
                channelId: channel.id,
                sourceMessageId: message.id,
                createdByUserId: senderUserId,
                // v0.94: copy assignee/dueAt из cells если есть.
                assigneeUserId:
                  cellsToCreate.find(
                    (c) =>
                      table!.fields.find((f) => f.id === c.fieldId)?.type ===
                      "USER",
                  )?.value || null,
                dueAt: (() => {
                  const dateCell = cellsToCreate.find(
                    (c) =>
                      table!.fields.find((f) => f.id === c.fieldId)?.type ===
                      "DATE",
                  );
                  if (
                    dateCell?.value &&
                    /^\d{4}-\d{2}-\d{2}/.test(dateCell.value)
                  ) {
                    const d = new Date(dateCell.value);
                    return Number.isNaN(d.getTime()) ? null : d;
                  }
                  return null;
                })(),
                activities: {
                  create: {
                    userId: senderUserId,
                    type: "CREATED",
                    payload: JSON.stringify({
                      source: "ai-chat-taskcreator",
                      tableId: table!.id,
                      rowId: createdRowId,
                    }),
                  },
                },
              },
              include: actionItemInclude,
            });
            await tx.tableRow.update({
              where: { id: createdRowId },
              data: { actionItemId: action.id },
            });
            return { message, action };
          });
          linkedActionId = linked.action.id;
          emitMessageOnChannel(channel.id, {
            messageId: linked.message.id,
            content: linked.message.content,
            channelId: channel.id,
            userId: linked.message.userId!,
            displayName: linked.message.user?.displayName ?? "System",
            avatar: linked.message.user?.avatar ?? null,
            isBot: true,
            createdAt: linked.message.createdAt.toISOString(),
            attachments: [],
          });
          emitActionItemCreated(channel.id, serializeActionItem(linked.action));
          // Re-emit row с обновлённым actionItemId.
          emitTableEvent(serverId, "table:row:updated", {
            tableId: table.id,
            row: {
              id: createdRowId,
              position: newPosition,
              createdAt: created.createdAt.toISOString(),
              updatedAt: new Date().toISOString(),
              actionItemId: linkedActionId,
              cells: created.cells.map((c) => ({
                fieldId: c.fieldId,
                value: c.value,
              })),
            },
          });
        }
      } catch (err) {
        log.warn(
          { err, tableId: table.id, rowId: createdRowId },
          "AI taskCreator: auto-link ActionItem failed (row создан, action нет)",
        );
      }
    }
  } catch (err) {
    log.warn({ err, tableId: table.id }, "AI taskCreator: row create failed");
    return false;
  }

  // Post confirmation в chat от имени bot'а.
  const reply = formatConfirmationMessage(
    table.name,
    newPosition,
    applied,
    linkedActionId,
  );
  const botUser = await db.user.findUnique({
    where: { id: responder.userId },
    select: { id: true, displayName: true, avatar: true },
  });
  if (!botUser) {
    log.warn("AI taskCreator: bot user not found, skipping confirmation message");
    return true; // row создан, но reply не отправлен
  }

  const msg = await db.message.create({
    data: {
      content: reply,
      userId: responder.userId,
      channelId,
    },
  });

  emitMessageOnChannel(channelId, {
    messageId: msg.id,
    content: msg.content,
    channelId,
    userId: botUser.id,
    displayName: botUser.displayName,
    avatar: botUser.avatar,
    isBot: true,
    botRole: responder.role,
    createdAt: msg.createdAt.toISOString(),
  });

  log.info(
    {
      tableId: table.id,
      rowId: createdRowId,
      cellsCount: cellsToCreate.length,
    },
    "AI taskCreator: row created from chat mention",
  );

  return true;
}
