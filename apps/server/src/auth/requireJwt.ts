import type { FastifyReply, FastifyRequest } from "fastify";
import { sendProtocolGateError, verifyRequestJwt } from "./protocolGate.js";

export type JwtSub = { sub: string; email: string };

/** preHandler: 401 если access JWT отсутствует / невалиден / истёк. */
export async function requireJwt(req: FastifyRequest, reply: FastifyReply) {
  const result = await verifyRequestJwt(req);
  if (result !== "ok") return sendProtocolGateError(reply, result, req);
}

/** Достаёт subject (user id) из запроса. Должен вызываться ПОСЛЕ requireJwt. */
export function getUserId(req: FastifyRequest): string | null {
  const payload = req.user as JwtSub | undefined;
  return payload?.sub ?? null;
}
