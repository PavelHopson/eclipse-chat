import type { FastifyInstance } from "fastify";
import {
  actionItemInclude,
  serializeActionItem,
} from "../actionItems.js";
import { AINotConfiguredError, chat } from "../ai/provider.js";
import { getUserId, requireJwt } from "../auth/requireJwt.js";
import { db } from "../db.js";
import { emitActionItemCreated } from "../realtime.js";

/**
 * v0.79 #22 phase 1: Live voice intelligence.
 *
 * Endpoint POST /api/attachments/:id/extract-actions:
 *   Берёт READY-transcript аудио-attachment'а, прогоняет через AI chat()
 *   с prompt'ом «извлеки задачи/решения/follow-up». Парсит JSON-результат,
 *   создаёт ActionItem'ы в исходный канал, связывает с source-message.
 *
 * Real-time live transcription через LiveKit Egress + Whisper streaming —
 * phase 2 slice (требует Docker compose update + Egress service). Phase 1
 * работает с existing v0.58 batch transcription pipeline: записал voice
 * message → автоматически транскрибировался → ткни «Извлечь задачи».
 *
 * Permissions: любой member server'а где attachment lives (через message →
 * channel → serverId). MEMBER может вызвать; результат уйдёт в общий feed,
 * extracted action items с createdByUserId = текущий user.
 */

type ExtractedAction = {
  type: "TASK" | "DECISION" | "FOLLOW_UP";
  title: string;
};

function buildSystem(): string {
  return [
    "Ты — operational ассистент Eclipse Chat. Твоя задача —",
    "выделить из транскрипта аудио (звонок / голосовое сообщение)",
    "конкретные операционные элементы:",
    "  • TASK — действие, которое кто-то должен выполнить",
    "  • DECISION — принятое решение / выбор",
    "  • FOLLOW_UP — что нужно уточнить / проверить позже",
    "",
    "Правила:",
    " 1. Выводи ТОЛЬКО валидный JSON-массив, без markdown, без preamble.",
    "    Формат: [{\"type\":\"TASK|DECISION|FOLLOW_UP\",\"title\":\"...\"}]",
    " 2. Каждый title — короткая повелительная формулировка (до 120 символов),",
    "    на русском. Без буллетов, без двоеточий.",
    " 3. Максимум 8 элементов — приоритезируй главные.",
    " 4. Если ничего конкретного не нашёл — верни пустой массив [].",
    " 5. Никаких general-purpose summaries — только actionable items.",
  ].join("\n");
}

function parseExtracted(text: string): ExtractedAction[] {
  const trimmed = text.trim();
  // Strip ``` fences if провайдер добавил вопреки prompt'у.
  const cleaned = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  let raw: unknown;
  try {
    raw = JSON.parse(cleaned);
  } catch {
    return [];
  }
  if (!Array.isArray(raw)) return [];
  const out: ExtractedAction[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const obj = item as { type?: unknown; title?: unknown };
    const type =
      obj.type === "TASK" || obj.type === "DECISION" || obj.type === "FOLLOW_UP"
        ? obj.type
        : null;
    const title =
      typeof obj.title === "string" ? obj.title.replace(/\s+/g, " ").trim() : "";
    if (!type || !title) continue;
    out.push({ type, title: title.slice(0, 160) });
    if (out.length >= 8) break;
  }
  return out;
}

export async function registerAttachmentRoutes(app: FastifyInstance) {
  app.post(
    "/api/attachments/:id/extract-actions",
    { onRequest: [requireJwt] },
    async (req, reply) => {
      const userId = getUserId(req);
      if (!userId) return reply.status(401).send({ error: "Unauthorized" });
      const { id: attachmentId } = req.params as { id: string };

      const attachment = await db.attachment.findUnique({
        where: { id: attachmentId },
        select: {
          id: true,
          mimeType: true,
          transcript: true,
          transcriptStatus: true,
          message: {
            select: {
              id: true,
              channelId: true,
              channel: {
                select: { id: true, serverId: true },
              },
            },
          },
        },
      });
      if (!attachment) {
        return reply.status(404).send({ error: "Attachment not found" });
      }
      if (!attachment.message?.channelId || !attachment.message.channel) {
        return reply
          .status(400)
          .send({ error: "Attachment is not in a server channel" });
      }
      const serverId = attachment.message.channel.serverId;
      const channelId = attachment.message.channelId;
      const sourceMessageId = attachment.message.id;

      const member = await db.member.findUnique({
        where: { userId_serverId: { userId, serverId } },
        select: { id: true },
      });
      if (!member) {
        return reply.status(403).send({ error: "Not a member of this server" });
      }

      if (
        attachment.transcriptStatus !== "READY" ||
        !attachment.transcript ||
        attachment.transcript.trim().length < 20
      ) {
        return reply
          .status(400)
          .send({ error: "Transcript is not ready or too short" });
      }

      let extracted: ExtractedAction[] = [];
      try {
        const result = await chat(
          [
            { role: "system", content: buildSystem() },
            {
              role: "user",
              content: `Транскрипт:\n${attachment.transcript.slice(0, 6000)}`,
            },
          ],
          { temperature: 0.2, maxTokens: 600 },
        );
        extracted = parseExtracted(result.text);
      } catch (err) {
        if (err instanceof AINotConfiguredError) {
          return reply
            .status(503)
            .send({ error: "AI provider не сконфигурирован" });
        }
        req.log.warn({ err, attachmentId }, "extract-actions chat failed");
        return reply
          .status(502)
          .send({ error: "AI провайдер недоступен; попробуй позже" });
      }

      if (extracted.length === 0) {
        return {
          attachmentId,
          extracted: [],
          createdActions: [],
          note: "Конкретных задач/решений из транскрипта не выделено.",
        };
      }

      // Create ActionItems — sequentially, чтобы P2002 (unique on
      // sourceMessageId+type) корректно фильтровал дубликаты. Existing
      // одного и того же type на этом message пропускаем тихо.
      const createdActions: Array<ReturnType<typeof serializeActionItem>> = [];
      for (const e of extracted) {
        try {
          const item = await db.actionItem.create({
            data: {
              title: e.title,
              type: e.type,
              serverId,
              channelId,
              sourceMessageId,
              createdByUserId: userId,
              activities: {
                create: {
                  userId,
                  type: "CREATED",
                  payload: JSON.stringify({
                    source: "voice-extract",
                    attachmentId,
                    type: e.type,
                  }),
                },
              },
            },
            include: actionItemInclude,
          });
          const payload = serializeActionItem(item);
          emitActionItemCreated(channelId, payload);
          createdActions.push(payload);
        } catch (err) {
          // P2002 — already exists для этого type на этом message; skip.
          if (
            err instanceof Error &&
            "code" in err &&
            (err as { code?: string }).code === "P2002"
          ) {
            continue;
          }
          throw err;
        }
      }

      return {
        attachmentId,
        extracted,
        createdActions,
        note: null,
      };
    },
  );
}
