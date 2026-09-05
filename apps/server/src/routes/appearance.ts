import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../db.js";
import { getUserId, requireJwt } from "../auth/requireJwt.js";

const hex = z.string().regex(/^#[\da-f]{6}$/i).transform(value => value.toLowerCase());
// Same dark/contrast contract as the client; client validation is not a trust boundary.
function darkReadable(p: { background: string; surface: string; text: string }): boolean {
  const rgb = (color: string) => [1, 3, 5].map(i => parseInt(color.slice(i, i + 2), 16));
  const light = (channels: number[]) => channels.map(v => v / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
  const bg = light(rgb(p.background)), surface = light(rgb(p.surface)), text = light(rgb(p.text));
  const raised = light(rgb(p.surface).map((v, i) => Math.round(v * .88 + rgb(p.text)[i] * .12)));
  return bg <= .08 && surface <= .08 && [bg, surface, raised].every(value => (Math.max(value, text) + .05) / (Math.min(value, text) + .05) >= 4.5);
}
export const appearanceBody = z.object({
  palette: z.object({ accent: hex, secondary: hex, background: hex, surface: hex, text: hex, border: hex }).strict().refine(darkReadable).nullable(),
}).strict();

export async function registerAppearanceRoutes(app: FastifyInstance) {
  const options = { onRequest: [requireJwt], config: { rateLimit: { max: 30, timeWindow: 60_000 } } };
  app.get("/api/users/me/appearance", options, async (req, reply) => {
    const userId = getUserId(req);
    if (!userId) return reply.code(401).send({ error: "Unauthorized" });
    reply.header("Cache-Control", "private, no-store");
    const row = await db.userAppearance.findUnique({ where: { userId }, select: { palette: true } });
    let palette: unknown = null;
    try { palette = row?.palette ? JSON.parse(row.palette) : null; } catch { /* Legacy/corrupt settings use defaults. */ }
    const result = appearanceBody.safeParse({ palette });
    return { palette: result.success ? result.data.palette : null };
  });
  app.put("/api/users/me/appearance", { ...options, bodyLimit: 1024 }, async (req, reply) => {
    const userId = getUserId(req);
    if (!userId) return reply.code(401).send({ error: "Unauthorized" });
    const result = appearanceBody.safeParse(req.body);
    if (!result.success) return reply.code(400).send({ error: "Нужна палитра из шести HEX-цветов." });
    const { palette } = result.data;
    // The owner comes exclusively from the verified JWT, never from the body/URL.
    if (palette === null) await db.userAppearance.deleteMany({ where: { userId } });
    else await db.userAppearance.upsert({
      where: { userId }, create: { userId, palette: JSON.stringify(palette) },
      update: { palette: JSON.stringify(palette) },
    });
    reply.header("Cache-Control", "private, no-store");
    return { palette };
  });
}
