import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getUserId, requireJwt } from "../auth/requireJwt.js";
import { getLinkPreview } from "../lib/linkPreview.js";

/**
 * v0.67: GET /api/embeds/preview?url=<encoded URL>
 *
 * Возвращает OG-preview для URL (cached 7d / failed 24h). Auth required —
 * только members получают preview, чтобы не превращать сервер в open
 * proxy для random'ов.
 *
 * Rate-limit: 30 req/min per JWT — preview обычно one-per-message и сам
 * cached, abuse рисует profile.
 *
 * Response shape для всех outcomes (frontend handles uniformly):
 *   { url, status: "OK" | "FAILED",
 *     title, description, image, siteName: string|null }
 */

const querySchema = z.object({
  url: z.string().url().max(2048),
});

export async function registerEmbedRoutes(app: FastifyInstance) {
  app.get(
    "/api/embeds/preview",
    {
      onRequest: [requireJwt],
      config: {
        rateLimit: {
          max: 30,
          timeWindow: "1 minute",
        },
      },
    },
    async (req, reply) => {
      const userId = getUserId(req);
      if (!userId) return reply.status(401).send({ error: "Unauthorized" });

      const parsed = querySchema.safeParse(req.query);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid url query param" });
      }

      try {
        const preview = await getLinkPreview(parsed.data.url);
        return preview;
      } catch (err) {
        // getLinkPreview сам wrap'ит fetch errors в FAILED cache — сюда
        // попадаем только если URL невалидный или DB-сбой. 422 = клиенту
        // не пытаться retry.
        const msg = err instanceof Error ? err.message : "Preview fetch failed";
        return reply.status(422).send({ error: msg });
      }
    },
  );
}
