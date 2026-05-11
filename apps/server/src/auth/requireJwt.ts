import type { FastifyReply, FastifyRequest } from "fastify";

export type JwtSub = { sub: string; email: string };

/** preHandler: 401 если access JWT отсутствует / невалиден / истёк. */
export async function requireJwt(req: FastifyRequest, reply: FastifyReply) {
  try {
    await req.jwtVerify();
  } catch {
    void reply.status(401).send({ error: "Unauthorized" });
  }
}

/** Достаёт subject (user id) из запроса. Должен вызываться ПОСЛЕ requireJwt. */
export function getUserId(req: FastifyRequest): string | null {
  const payload = req.user as JwtSub | undefined;
  return payload?.sub ?? null;
}
