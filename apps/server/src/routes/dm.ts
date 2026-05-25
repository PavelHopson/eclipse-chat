import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../db.js";
import { serializeUser } from "../lib/userView.js";
import { notifyUsers } from "../lib/webPush.js";
import { getUserId, requireJwt } from "../auth/requireJwt.js";
import {
  emitDmConversationBumped,
  emitDmMessageDeleted,
  emitDmMessageNew,
  emitDmMessageUpdated,
} from "../realtime.js";
import {
  ATTACHMENTS_PER_MESSAGE,
  MESSAGE_BODY_LIMIT_WITH_ATTACHMENTS,
  kickoffTranscription,
  processAttachment,
  unlinkAttachmentFiles,
} from "../attachments.js";

/**
 * Direct Messages (DM) — 1-to-1 + group conversations.
 *
 * 1-to-1 routes (legacy path, userAId/userBId fields):
 *   GET    /api/dm/conversations                       — мои conversations sorted by lastMessageAt
 *   POST   /api/dm/saved                               — Saved Messages (self-conversation)
 *   POST   /api/dm/conversations/:userId               — get-or-create with given user
 *
 * Group DM routes (v0.52, ConversationParticipant join):
 *   POST   /api/dm/groups                              — create group with N participants
 *   PATCH  /api/dm/groups/:id                          — rename (host only)
 *   POST   /api/dm/groups/:id/participants             — add user (host only)
 *   DELETE /api/dm/groups/:id/participants/:userId     — remove user (host) or leave (self)
 *
 * Shared message routes (work for both 1-to-1 and group):
 *   GET    /api/dm/conversations/:id/messages          — paginated history
 *   POST   /api/dm/conversations/:id/messages          — send (content + attachments)
 *   PATCH  /api/dm/messages/:id                        — edit (author only)
 *   DELETE /api/dm/messages/:id                        — soft-delete (author only)
 *
 * Membership-check унифицирован через `loadConversationMembers()` — все
 * shared routes используют его независимо от того, 1-to-1 это или group.
 *
 * Socket rooms:
 *   `dm:${conversationId}` — все participants подписаны на message events.
 *   `user:${userId}` — для `dm:conversation:bumped` (sidebar list resort) —
 *   fan-out по всем participants при send.
 */

const attachmentInputSchema = z.object({
  filename: z.string().min(1).max(255),
  mimeType: z.string().min(3).max(80),
  dataBase64: z.string().min(1),
  // v0.66: см. comment в channels.ts.
  waveformPeaks: z.array(z.number().min(0).max(100)).min(32).max(256).optional().nullable(),
});

const sendMessageBody = z.object({
  content: z.string().max(8000).optional().default(""),
  attachments: z.array(attachmentInputSchema).max(ATTACHMENTS_PER_MESSAGE).optional(),
});

const editBody = z.object({
  content: z.string().min(1).max(8000),
});

const createGroupBody = z.object({
  /**
   * User-id'ы других участников (без меня — я добавляюсь автоматически как
   * creator). Минимум 2 (group из 3 человек), максимум 24 (group из 25
   * с host'ом). Дубликаты дедуплицируются на сервере; user-ids невалидные
   * либо несуществующие отклоняются 400.
   */
  memberUserIds: z.array(z.string().min(1)).min(2).max(24),
  /** Optional group title (max 80). Null = UI derive из participant names. */
  name: z.string().min(1).max(80).optional(),
});

const renameGroupBody = z.object({
  name: z.string().min(1).max(80),
});

const addParticipantBody = z.object({
  userId: z.string().min(1),
});

/**
 * Нормализуем пару user-id'ов в (userAId, userBId) где userA < userB
 * по string comparison. Гарантирует unique constraint работает —
 * иначе «A->B» и «B->A» создались бы как два разных conversation.
 */
function sortIds(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

/** Кратко-форматированный preview content (для sidebar list). */
function previewContent(content: string, attachmentCount: number): string {
  if (content) {
    return content.length > 80 ? content.slice(0, 77) + "…" : content;
  }
  if (attachmentCount > 0) {
    return `📎 ${attachmentCount} ${attachmentCount === 1 ? "файл" : "файла"}`;
  }
  return "";
}

/**
 * Загружает all participant user-id'ы для conversation. Работает для обоих
 * типов:
 *   - 1-to-1: возвращает [userAId, userBId] (или [userAId] если self-saved).
 *   - group:  возвращает userIds из ConversationParticipant rows.
 *
 * Возвращает null если conversation не существует. Используется для
 * membership-check и для fan-out socket events ("кому слать bumped").
 */
async function loadConversationMembers(conversationId: string): Promise<{
  conversationId: string;
  isGroup: boolean;
  memberUserIds: string[];
  createdByUserId: string | null;
} | null> {
  const convo = await db.directConversation.findUnique({
    where: { id: conversationId },
    select: {
      id: true,
      userAId: true,
      userBId: true,
      isGroup: true,
      createdByUserId: true,
      participants: { select: { userId: true } },
    },
  });
  if (!convo) return null;
  const memberUserIds = convo.isGroup
    ? convo.participants.map((p) => p.userId)
    : [convo.userAId, convo.userBId].filter((v): v is string => v !== null);
  // Self-conversation (Saved Messages) — один и тот же userId дважды;
  // unique-set гарантирует фан-аут на 1 user-room, не 2.
  return {
    conversationId: convo.id,
    isGroup: convo.isGroup,
    memberUserIds: Array.from(new Set(memberUserIds)),
    createdByUserId: convo.createdByUserId,
  };
}

/** Проверяет, является ли user участником conversation (любого типа). */
function isMember(members: { memberUserIds: string[] }, userId: string): boolean {
  return members.memberUserIds.includes(userId);
}

/**
 * Сериализатор participant info (для GET /api/dm/conversations group rows).
 * Не возвращаем email или другие приватные поля — только то, что нужно UI.
 */
type ParticipantDto = {
  id: string;
  displayName: string;
  avatar: string | null;
  manualStatus: "ONLINE" | "IDLE" | "DND" | "INVISIBLE";
};

export async function registerDmRoutes(app: FastifyInstance) {
  /**
   * GET /api/dm/conversations — список моих conversations (1-to-1 + group),
   * sort по lastMessageAt desc.
   */
  app.get("/api/dm/conversations", { onRequest: [requireJwt] }, async (req, reply) => {
    const userId = getUserId(req);
    if (!userId) {
      return reply.status(401).send({ error: "Unauthorized" });
    }
    const list = await db.directConversation.findMany({
      where: {
        OR: [
          { userAId: userId },
          { userBId: userId },
          // Group DMs — through participant join.
          { participants: { some: { userId } } },
        ],
      },
      orderBy: { lastMessageAt: "desc" },
      include: {
        userA: { select: { id: true, displayName: true, avatar: true, status: true } },
        userB: { select: { id: true, displayName: true, avatar: true, status: true } },
        participants: {
          select: {
            user: { select: { id: true, displayName: true, avatar: true, status: true } },
          },
        },
        messages: {
          take: 1,
          // v1.2.9 — last-message preview берём только из не-удалённых.
          where: { deletedAt: null },
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            content: true,
            createdAt: true,
            userId: true,
            deletedAt: true,
            attachments: { select: { id: true } },
          },
        },
      },
    });
    return {
      // Self-conversation (Saved Messages) исключаем из обычного списка —
      // она отдаётся отдельно через POST /api/dm/saved и пинится в UI сверху.
      // Group DMs остаются — они отображаются вместе с 1-to-1, но render'ятся
      // через composite avatar + group name.
      conversations: list
        .filter((c) => c.isGroup || c.userAId !== c.userBId)
        .map((c) => {
          const last = c.messages[0];
          const lastMessage = last
            ? {
                id: last.id,
                content: last.deletedAt
                  ? "[сообщение удалено]"
                  : previewContent(last.content, last.attachments.length),
                createdAt: last.createdAt.toISOString(),
                userId: last.userId,
                mine: last.userId === userId,
              }
            : null;
          if (c.isGroup) {
            return {
              id: c.id,
              isGroup: true,
              name: c.name,
              createdByUserId: c.createdByUserId,
              participants: c.participants.map(
                (p): ParticipantDto => ({
                  id: p.user.id,
                  displayName: p.user.displayName,
                  avatar: p.user.avatar,
                  manualStatus: p.user.status,
                }),
              ),
              createdAt: c.createdAt.toISOString(),
              lastMessageAt: c.lastMessageAt.toISOString(),
              lastMessage,
            };
          }
          // Legacy 1-to-1 path.
          const other = c.userAId === userId ? c.userB : c.userA;
          if (!other) {
            // Не должно случиться (1-to-1 должен иметь userA + userB), но
            // защитимся от corrupted row.
            return null;
          }
          return {
            id: c.id,
            isGroup: false,
            other: {
              id: other.id,
              displayName: other.displayName,
              avatar: other.avatar,
              manualStatus: other.status,
            },
            createdAt: c.createdAt.toISOString(),
            lastMessageAt: c.lastMessageAt.toISOString(),
            lastMessage,
          };
        })
        .filter((c): c is NonNullable<typeof c> => c !== null),
    };
  });

  /**
   * POST /api/dm/saved — get-or-create «Избранное» (Saved Messages):
   * self-conversation где userAId === userBId === me. Telegram-killer:
   * личный буфер для заметок / ссылок / файлов. Переиспользует всю DM-инфру
   * (send/edit/delete/react/attachments) — participant-check проходит т.к.
   * оба участника = я.
   */
  app.post("/api/dm/saved", { onRequest: [requireJwt] }, async (req, reply) => {
    const me = getUserId(req);
    if (!me) {
      return reply.status(401).send({ error: "Unauthorized" });
    }
    const user = await db.user.findUnique({
      where: { id: me },
      select: { id: true, displayName: true, avatar: true, status: true },
    });
    if (!user) {
      return reply.status(401).send({ error: "User not found" });
    }
    const convo = await db.directConversation.upsert({
      where: { userAId_userBId: { userAId: me, userBId: me } },
      update: {},
      create: { userAId: me, userBId: me },
      select: {
        id: true,
        createdAt: true,
        lastMessageAt: true,
        messages: {
          take: 1,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            content: true,
            createdAt: true,
            userId: true,
            deletedAt: true,
            attachments: { select: { id: true } },
          },
          // v1.2.9 — last-message preview берём только из не-удалённых.
          where: { deletedAt: null },
        },
      },
    });
    const last = convo.messages[0];
    return {
      conversation: {
        id: convo.id,
        saved: true,
        isGroup: false,
        other: {
          id: user.id,
          displayName: user.displayName,
          avatar: user.avatar,
          manualStatus: user.status,
        },
        createdAt: convo.createdAt.toISOString(),
        lastMessageAt: convo.lastMessageAt.toISOString(),
        lastMessage: last
          ? {
              id: last.id,
              content: last.deletedAt
                ? "[сообщение удалено]"
                : previewContent(last.content, last.attachments.length),
              createdAt: last.createdAt.toISOString(),
              userId: last.userId,
              mine: true,
            }
          : null,
      },
    };
  });

  /**
   * POST /api/dm/conversations/:userId — get-or-create 1-to-1 conversation с given user.
   * Idempotent: если уже существует — вернёт существующий.
   * Auto-subscribes socket рrooms.
   */
  app.post(
    "/api/dm/conversations/:userId",
    { onRequest: [requireJwt] },
    async (req, reply) => {
      const me = getUserId(req);
      const { userId: otherId } = req.params as { userId: string };
      if (!me) {
        return reply.status(401).send({ error: "Unauthorized" });
      }
      if (me === otherId) {
        return reply.status(400).send({ error: "Cannot DM yourself" });
      }
      const other = await db.user.findUnique({
        where: { id: otherId },
        select: { id: true, displayName: true, avatar: true, status: true },
      });
      if (!other) {
        return reply.status(404).send({ error: "User not found" });
      }
      const [userAId, userBId] = sortIds(me, otherId);
      const convo = await db.directConversation.upsert({
        where: { userAId_userBId: { userAId, userBId } },
        update: {},
        create: { userAId, userBId },
        select: { id: true, createdAt: true, lastMessageAt: true },
      });
      return {
        conversation: {
          id: convo.id,
          isGroup: false,
          createdAt: convo.createdAt.toISOString(),
          lastMessageAt: convo.lastMessageAt.toISOString(),
          other: {
            id: other.id,
            displayName: other.displayName,
            avatar: other.avatar,
            manualStatus: other.status,
          },
        },
      };
    },
  );

  /**
   * POST /api/dm/groups — создать новый group DM (v0.52).
   *
   * Body: { memberUserIds: string[] (2..24), name?: string }
   *
   * Creator (me) добавляется как участник + помечается createdByUserId.
   * Member-ids валидируются: must exist + не должно быть дубликатов / self.
   * Идемпотентности нет — каждый запрос создаёт новую group (в отличие от
   * 1-to-1 upsert).
   */
  app.post("/api/dm/groups", { onRequest: [requireJwt] }, async (req, reply) => {
    const me = getUserId(req);
    if (!me) {
      return reply.status(401).send({ error: "Unauthorized" });
    }
    const parsed = createGroupBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid body", detail: parsed.error.format() });
    }
    // Дедуплицируем и убираем self из member-ids (creator добавится автоматом).
    const memberSet = new Set<string>(parsed.data.memberUserIds.filter((id) => id !== me));
    if (memberSet.size < 2) {
      return reply.status(400).send({
        error: "Group must have at least 2 other participants (3 including you)",
      });
    }
    // Проверим что все memberUserIds существуют — иначе FK violation на insert.
    const memberIds = Array.from(memberSet);
    const found = await db.user.findMany({
      where: { id: { in: memberIds } },
      select: { id: true },
    });
    if (found.length !== memberIds.length) {
      const foundSet = new Set(found.map((u) => u.id));
      const missing = memberIds.filter((id) => !foundSet.has(id));
      return reply.status(400).send({ error: "Unknown user(s)", missing });
    }
    // Все participants — я + memberIds. createdBy = me.
    const allParticipantIds = [me, ...memberIds];
    const convo = await db.directConversation.create({
      data: {
        isGroup: true,
        name: parsed.data.name ?? null,
        createdByUserId: me,
        // 1-to-1 fields остаются NULL для group.
        userAId: null,
        userBId: null,
        participants: {
          create: allParticipantIds.map((userId) => ({ userId })),
        },
      },
      include: {
        participants: {
          select: {
            user: { select: { id: true, displayName: true, avatar: true, status: true } },
          },
        },
      },
    });
    return {
      conversation: {
        id: convo.id,
        isGroup: true,
        name: convo.name,
        createdByUserId: convo.createdByUserId,
        participants: convo.participants.map(
          (p): ParticipantDto => ({
            id: p.user.id,
            displayName: p.user.displayName,
            avatar: p.user.avatar,
            manualStatus: p.user.status,
          }),
        ),
        createdAt: convo.createdAt.toISOString(),
        lastMessageAt: convo.lastMessageAt.toISOString(),
        lastMessage: null,
      },
    };
  });

  /**
   * PATCH /api/dm/groups/:id — переименовать group. Host (createdBy) only.
   */
  app.patch(
    "/api/dm/groups/:id",
    { onRequest: [requireJwt] },
    async (req, reply) => {
      const me = getUserId(req);
      const { id } = req.params as { id: string };
      if (!me) {
        return reply.status(401).send({ error: "Unauthorized" });
      }
      const parsed = renameGroupBody.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid body" });
      }
      const members = await loadConversationMembers(id);
      if (!members || !members.isGroup) {
        return reply.status(404).send({ error: "Group not found" });
      }
      if (members.createdByUserId !== me) {
        return reply.status(403).send({ error: "Only group host can rename" });
      }
      const updated = await db.directConversation.update({
        where: { id },
        data: { name: parsed.data.name },
        select: { id: true, name: true },
      });
      return { conversation: { id: updated.id, name: updated.name } };
    },
  );

  /**
   * POST /api/dm/groups/:id/participants — add user. Host only.
   */
  app.post(
    "/api/dm/groups/:id/participants",
    { onRequest: [requireJwt] },
    async (req, reply) => {
      const me = getUserId(req);
      const { id } = req.params as { id: string };
      if (!me) {
        return reply.status(401).send({ error: "Unauthorized" });
      }
      const parsed = addParticipantBody.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid body" });
      }
      const members = await loadConversationMembers(id);
      if (!members || !members.isGroup) {
        return reply.status(404).send({ error: "Group not found" });
      }
      if (members.createdByUserId !== me) {
        return reply.status(403).send({ error: "Only group host can add participants" });
      }
      if (members.memberUserIds.includes(parsed.data.userId)) {
        return reply.status(409).send({ error: "Already a participant" });
      }
      const user = await db.user.findUnique({
        where: { id: parsed.data.userId },
        select: { id: true, displayName: true, avatar: true, status: true },
      });
      if (!user) {
        return reply.status(404).send({ error: "User not found" });
      }
      await db.conversationParticipant.create({
        data: { conversationId: id, userId: user.id },
      });
      return {
        participant: {
          id: user.id,
          displayName: user.displayName,
          avatar: user.avatar,
          manualStatus: user.status,
        },
      };
    },
  );

  /**
   * DELETE /api/dm/groups/:id/participants/:userId — remove participant.
   *   - Host может удалить любого (kick).
   *   - Non-host может удалить только себя (leave group).
   *   - Host не может удалить себя (нужно сначала transfer ownership;
   *     v1 ограничение, ownership-transfer = future feature).
   */
  app.delete(
    "/api/dm/groups/:id/participants/:userId",
    { onRequest: [requireJwt] },
    async (req, reply) => {
      const me = getUserId(req);
      const { id, userId: targetUserId } = req.params as { id: string; userId: string };
      if (!me) {
        return reply.status(401).send({ error: "Unauthorized" });
      }
      const members = await loadConversationMembers(id);
      if (!members || !members.isGroup) {
        return reply.status(404).send({ error: "Group not found" });
      }
      if (!members.memberUserIds.includes(targetUserId)) {
        return reply.status(404).send({ error: "Not a participant" });
      }
      const isHost = members.createdByUserId === me;
      const isSelfLeave = targetUserId === me;
      if (!isHost && !isSelfLeave) {
        return reply.status(403).send({ error: "Cannot remove other participants" });
      }
      if (isHost && targetUserId === me) {
        return reply
          .status(400)
          .send({ error: "Host cannot leave own group (transfer ownership first)" });
      }
      await db.conversationParticipant.delete({
        where: { conversationId_userId: { conversationId: id, userId: targetUserId } },
      });
      return { ok: true, removed: targetUserId };
    },
  );

  /**
   * GET /api/dm/conversations/:id/messages — пагинация take=N.
   * Работает для 1-to-1 и group conversations через unified membership check.
   */
  app.get(
    "/api/dm/conversations/:id/messages",
    { onRequest: [requireJwt] },
    async (req, reply) => {
      const me = getUserId(req);
      const { id: conversationId } = req.params as { id: string };
      if (!me) {
        return reply.status(401).send({ error: "Unauthorized" });
      }
      const members = await loadConversationMembers(conversationId);
      if (!members) {
        return reply.status(404).send({ error: "Conversation not found" });
      }
      if (!isMember(members, me)) {
        return reply.status(403).send({ error: "Not a participant" });
      }
      const take = Math.min(
        100,
        Math.max(1, Number((req.query as { take?: string }).take) || 50),
      );
      const messages = await db.message.findMany({
        // v1.2.9 — удалённые DM-сообщения не показываем в истории.
        where: { conversationId, deletedAt: null },
        take,
        orderBy: { createdAt: "desc" },
        include: {
          user: {
            select: {
              id: true,
              displayName: true,
              avatar: true,
              // botProfile relation для UI isBot badge + botRole.
              botProfile: { select: { id: true, role: true } },
              // email — для детекции system AI bot (не отдаётся фронту).
              email: true,
            },
          },
          reactions: { select: { emoji: true, userId: true } },
          attachments: {
            select: {
              id: true,
              filename: true,
              mimeType: true,
              size: true,
              url: true,
              width: true,
              height: true,
              thumbnailUrl: true,
              position: true,
              transcript: true,
              transcriptStatus: true,
              transcriptError: true,
              waveformPeaks: true,
            },
            orderBy: { position: "asc" },
          },
        },
      });
      return {
        conversationId,
        messages: messages.reverse().map((m) => {
          const grouped = new Map<string, { count: number; mine: boolean }>();
          for (const r of m.reactions) {
            const cur = grouped.get(r.emoji) ?? { count: 0, mine: false };
            cur.count += 1;
            if (r.userId === me) cur.mine = true;
            grouped.set(r.emoji, cur);
          }
          const reactions = Array.from(grouped.entries()).map(([emoji, agg]) => ({
            emoji,
            count: agg.count,
            mine: agg.mine,
          }));
          return {
            id: m.id,
            content: m.deletedAt ? "" : m.content,
            createdAt: m.createdAt.toISOString(),
            editedAt: m.editedAt?.toISOString() ?? null,
            deletedAt: m.deletedAt?.toISOString() ?? null,
            user: serializeUser(m.user),
            reactions,
            attachments: m.deletedAt ? [] : m.attachments,
          };
        }),
      };
    },
  );

  /**
   * POST /api/dm/conversations/:id/messages — отправка.
   * Обновляет conversation.lastMessageAt в транзакции с insert message.
   * Работает для 1-to-1 и group; bumped-event fan-out по всем participants.
   */
  app.post(
    "/api/dm/conversations/:id/messages",
    {
      onRequest: [requireJwt],
      bodyLimit: MESSAGE_BODY_LIMIT_WITH_ATTACHMENTS,
    },
    async (req, reply) => {
      const me = getUserId(req);
      const { id: conversationId } = req.params as { id: string };
      if (!me) {
        return reply.status(401).send({ error: "Unauthorized" });
      }
      const parsed = sendMessageBody.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid body" });
      }
      const trimmed = parsed.data.content.trim();
      const attachInputs = parsed.data.attachments ?? [];
      if (trimmed === "" && attachInputs.length === 0) {
        return reply
          .status(400)
          .send({ error: "Message must have content or attachments" });
      }
      const members = await loadConversationMembers(conversationId);
      if (!members) {
        return reply.status(404).send({ error: "Conversation not found" });
      }
      if (!isMember(members, me)) {
        return reply.status(403).send({ error: "Not a participant" });
      }
      const user = await db.user.findUnique({
        where: { id: me },
        select: { id: true, displayName: true, avatar: true },
      });
      if (!user) {
        return reply.status(401).send({ error: "User not found" });
      }
      // Create message + bump lastMessageAt в одной транзакции (consistency).
      const now = new Date();
      const m = await db.$transaction(async (tx) => {
        const created = await tx.message.create({
          data: {
            content: trimmed,
            userId: me,
            conversationId,
            createdAt: now,
          },
        });
        await tx.directConversation.update({
          where: { id: conversationId },
          data: { lastMessageAt: now },
        });
        return created;
      });
      // Attachments processing — outside transaction (FS I/O slow)
      const processedAttachments = [];
      for (let i = 0; i < attachInputs.length; i++) {
        try {
          const proc = await processAttachment(attachInputs[i], m.id, i);
          const created = await db.attachment.create({
            data: {
              messageId: m.id,
              filename: proc.filename,
              mimeType: proc.mimeType,
              size: proc.size,
              url: proc.url,
              width: proc.width,
              height: proc.height,
              thumbnailUrl: proc.thumbnailUrl,
              position: proc.position,
              waveformPeaks: proc.waveformPeaks ?? undefined,
            },
          });
          processedAttachments.push(created);
          // v0.58: fire-and-forget транскрипция аудио в DM. Контекст —
          // conversationId (не channelId), socket emit пойдёт в dm-room.
          kickoffTranscription(created.id, proc.audioBuffer, proc.mimeType, proc.filename, {
            conversationId,
          });
        } catch (err) {
          // Откатим message при provoke attachment failure
          await db.message.delete({ where: { id: m.id } });
          const msg = err instanceof Error ? err.message : "Attachment processing failed";
          return reply.status(400).send({ error: msg });
        }
      }
      const payload = {
        messageId: m.id,
        conversationId,
        userId: me,
        displayName: user.displayName,
        avatar: user.avatar,
        // POST DM через requireJwt = human user; bot не пишет в DM (бот не имеет inbox).
        isBot: false,
        content: m.content,
        createdAt: m.createdAt.toISOString(),
        attachments: processedAttachments.map((a) => ({
          id: a.id,
          filename: a.filename,
          mimeType: a.mimeType,
          size: a.size,
          url: a.url,
          width: a.width,
          height: a.height,
          thumbnailUrl: a.thumbnailUrl,
          position: a.position,
          waveformPeaks: (a.waveformPeaks as number[] | null) ?? null,
        })),
      };
      emitDmMessageNew(conversationId, payload);
      // Bump conversation в sidebar всех participants (1-to-1 = 2, group = N).
      const preview = previewContent(m.content, processedAttachments.length);
      const bumpPayload = {
        conversationId,
        lastMessageAt: now.toISOString(),
        lastMessagePreview: preview,
        lastSenderUserId: me,
      };
      for (const participantId of members.memberUserIds) {
        emitDmConversationBumped(participantId, bumpPayload);
      }
      // v0.84 #27 phase 3: push DM recipients (все кроме отправителя).
      // Saved Messages (1-to-1 со собой) — skip.
      const recipients = members.memberUserIds.filter((id) => id !== me);
      if (recipients.length > 0) {
        const body = m.content.trim() || `📎 ${processedAttachments.length} файл(ов)`;
        void notifyUsers(
          recipients,
          "dm",
          {
            title: `Сообщение от ${user.displayName}`,
            body,
            url: `/eclipse-chat/`,
            tag: `dm-${conversationId}`,
          },
          req.log,
        );
      }
      return { message: payload };
    },
  );

  /**
   * PATCH /api/dm/messages/:id — edit (author only).
   * Membership check унифицирован через loadConversationMembers.
   */
  app.patch(
    "/api/dm/messages/:id",
    { onRequest: [requireJwt] },
    async (req, reply) => {
      const me = getUserId(req);
      const { id: messageId } = req.params as { id: string };
      if (!me) {
        return reply.status(401).send({ error: "Unauthorized" });
      }
      const parsed = editBody.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid body" });
      }
      const m = await db.message.findUnique({
        where: { id: messageId },
        select: {
          id: true,
          userId: true,
          conversationId: true,
          deletedAt: true,
        },
      });
      if (!m || !m.conversationId) {
        return reply.status(404).send({ error: "DM message not found" });
      }
      const members = await loadConversationMembers(m.conversationId);
      if (!members) {
        return reply.status(404).send({ error: "Conversation not found" });
      }
      if (!isMember(members, me)) {
        return reply.status(403).send({ error: "Not a participant" });
      }
      if (m.userId !== me) {
        return reply.status(403).send({ error: "Only author can edit" });
      }
      if (m.deletedAt) {
        return reply.status(410).send({ error: "Cannot edit deleted message" });
      }
      // v1.5.25 — DM edit history. Same pattern как PATCH /api/messages/:id:
      // snapshot previous content в MessageEdit перед перезаписью, всё в
      // одной транзакции чтобы UPDATE-fail не оставил orphan snapshot.
      const current = await db.message.findUnique({
        where: { id: messageId },
        select: { content: true, editedAt: true, createdAt: true },
      });
      const editedAt = new Date();
      const [, updated] = await db.$transaction([
        db.messageEdit.create({
          data: {
            messageId,
            previousContent: current?.content ?? "",
            editedAt: current?.editedAt ?? current?.createdAt ?? editedAt,
          },
        }),
        db.message.update({
          where: { id: messageId },
          data: { content: parsed.data.content, editedAt },
        }),
      ]);
      emitDmMessageUpdated(m.conversationId, {
        messageId,
        conversationId: m.conversationId,
        content: updated.content,
        editedAt: editedAt.toISOString(),
      });
      return {
        message: {
          id: updated.id,
          content: updated.content,
          editedAt: editedAt.toISOString(),
        },
      };
    },
  );

  /**
   * v1.5.25 — GET /api/dm/messages/:id/edits — previous content snapshots
   * для DM сообщения. Participant-only (loadConversationMembers + isMember).
   * Newest-first. Зеркалит /api/messages/:id/edits но для DM-сообщений.
   */
  app.get(
    "/api/dm/messages/:id/edits",
    { onRequest: [requireJwt] },
    async (req, reply) => {
      const me = getUserId(req);
      const { id: messageId } = req.params as { id: string };
      if (!me) {
        return reply.status(401).send({ error: "Unauthorized" });
      }
      const m = await db.message.findUnique({
        where: { id: messageId },
        select: { id: true, conversationId: true },
      });
      if (!m || !m.conversationId) {
        return reply.status(404).send({ error: "DM message not found" });
      }
      const members = await loadConversationMembers(m.conversationId);
      if (!members) {
        return reply.status(404).send({ error: "Conversation not found" });
      }
      if (!isMember(members, me)) {
        return reply.status(403).send({ error: "Not a participant" });
      }
      const edits = await db.messageEdit.findMany({
        where: { messageId },
        orderBy: { editedAt: "desc" },
        select: { id: true, previousContent: true, editedAt: true },
      });
      return {
        edits: edits.map((e) => ({
          id: e.id,
          previousContent: e.previousContent,
          editedAt: e.editedAt.toISOString(),
        })),
      };
    },
  );

  /**
   * DELETE /api/dm/messages/:id — soft-delete. Author only (нет ролей в DM).
   * Membership check унифицирован.
   */
  app.delete(
    "/api/dm/messages/:id",
    { onRequest: [requireJwt] },
    async (req, reply) => {
      const me = getUserId(req);
      const { id: messageId } = req.params as { id: string };
      if (!me) {
        return reply.status(401).send({ error: "Unauthorized" });
      }
      const m = await db.message.findUnique({
        where: { id: messageId },
        select: {
          id: true,
          userId: true,
          conversationId: true,
          deletedAt: true,
        },
      });
      if (!m || !m.conversationId) {
        return reply.status(404).send({ error: "DM message not found" });
      }
      const members = await loadConversationMembers(m.conversationId);
      if (!members) {
        return reply.status(404).send({ error: "Conversation not found" });
      }
      if (!isMember(members, me)) {
        return reply.status(403).send({ error: "Not a participant" });
      }
      if (m.userId !== me) {
        return reply.status(403).send({ error: "Only author can delete own message" });
      }
      if (m.deletedAt) {
        return { ok: true, alreadyDeleted: true };
      }
      const deletedAt = new Date();
      await db.message.update({
        where: { id: messageId },
        data: { deletedAt },
      });
      // Cleanup attachments (best-effort fs)
      const attachments = await db.attachment.findMany({
        where: { messageId },
        select: { url: true, thumbnailUrl: true },
      });
      if (attachments.length > 0) {
        const urls = attachments.flatMap((a) => [a.url, a.thumbnailUrl]);
        await db.attachment.deleteMany({ where: { messageId } });
        void unlinkAttachmentFiles(urls);
      }
      emitDmMessageDeleted(m.conversationId, {
        messageId,
        conversationId: m.conversationId,
        deletedAt: deletedAt.toISOString(),
      });
      return { ok: true, deletedAt: deletedAt.toISOString() };
    },
  );
}

/**
 * Экспортируем helper'ы для unit-тестов и для других модулей, которым
 * нужен membership-check (например, future reactions route в DM).
 */
export { isMember as isDmMember, loadConversationMembers };
