import { createHash, randomBytes } from "node:crypto";
import { db } from "../db.js";

const MAX_AGE_MS = 8 * 60 * 60_000;
const hash = (token: string) => createHash("sha256").update(token).digest("hex");
const validToken = (token: string) => /^[A-Za-z0-9_-]{43}$/.test(token);

/** Server-to-server credentials only. Raw grants never enter the Chat database. */
export class EcosystemSessionService {
  constructor(private readonly database = db) {}

  async issue(binding: { sessionId: string; subject: string; clientId: string }) {
    return this.database.$transaction(async tx => {
      // Serialize issuance against refresh/revocation and bound the number of grants.
      await tx.$queryRaw`SELECT "id" FROM "RefreshToken" WHERE "id" = ${binding.sessionId} FOR UPDATE`;
      const session = await tx.refreshToken.findUnique({ where: { id: binding.sessionId }, include: { user: { select: { bannedAt: true, deletedAt: true } } } });
      const now = new Date();
      if (!session || session.userId !== binding.subject || session.expiresAt <= now || session.user.bannedAt || session.user.deletedAt) return null;
      await tx.ecosystemSession.deleteMany({ where: { refreshSessionId: session.id, expiresAt: { lte: now } } });
      const count = await tx.ecosystemSession.count({ where: { refreshSessionId: session.id, clientId: binding.clientId } });
      if (count >= 32) return null;
      const raw = randomBytes(32).toString("base64url");
      const expiresAt = new Date(Math.min(session.expiresAt.getTime(), now.getTime() + MAX_AGE_MS));
      await tx.ecosystemSession.create({ data: { tokenHash: hash(raw), clientId: binding.clientId, refreshSessionId: session.id, expiresAt } });
      return { token: raw, expiresAt: expiresAt.toISOString() };
    });
  }

  async inspect(clientId: string, token: string) {
    if (!validToken(token)) return { active: false as const };
    const grant = await this.database.ecosystemSession.findUnique({ where: { tokenHash: hash(token) }, include: {
      refreshSession: { include: { user: { select: { bannedAt: true, deletedAt: true } } } },
    } });
    const now = new Date();
    if (!grant || grant.clientId !== clientId || grant.expiresAt <= now || grant.refreshSession.expiresAt <= now || grant.refreshSession.user.bannedAt || grant.refreshSession.user.deletedAt) return { active: false as const };
    return { active: true as const, subject: grant.refreshSession.userId, clientId: grant.clientId,
      expiresAt: new Date(Math.min(grant.expiresAt.getTime(), grant.refreshSession.expiresAt.getTime())).toISOString() };
  }

  async revoke(clientId: string, token: string): Promise<string | null> {
    if (!validToken(token)) return null;
    return this.database.$transaction(async tx => {
      const grant = await tx.ecosystemSession.findUnique({ where: { tokenHash: hash(token) }, select: { clientId: true, expiresAt: true, refreshSessionId: true } });
      if (!grant || grant.clientId !== clientId || grant.expiresAt <= new Date()) return null;
      // The only deletable session is the one bound to this credential; no caller-supplied user/session id.
      const result = await tx.refreshToken.deleteMany({ where: { id: grant.refreshSessionId } });
      return result.count ? grant.refreshSessionId : null;
    });
  }
}