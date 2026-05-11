import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "../db.js";
import {
  deleteAllUserRefresh,
  findValidRefreshTokenRow,
  makeRefreshTokenPair,
  storeRefreshToken,
} from "../auth/refresh.js";

const registerBody = z.object({
  email: z.string().email().max(320),
  password: z.string().min(8).max(128),
  displayName: z.string().min(1).max(64),
});

const loginBody = z.object({
  email: z.string().email(),
  password: z.string(),
});

const refreshBody = z.object({
  refreshToken: z.string().min(10),
});

const ACCESS_TTL = "15m";

function publicUser(u: { id: string; email: string; displayName: string; createdAt: Date }) {
  return {
    id: u.id,
    email: u.email,
    displayName: u.displayName,
    createdAt: u.createdAt.toISOString(),
  };
}

export type AuthResponseBody = {
  accessToken: string;
  refreshToken: string;
  /** Совместимость: короткоживущий access, как раньше поле `token` */
  token: string;
  user: ReturnType<typeof publicUser>;
};

async function requireJwt(req: FastifyRequest, reply: FastifyReply) {
  try {
    await req.jwtVerify();
  } catch {
    void reply.status(401).send({ error: "Unauthorized" });
  }
}

async function issueSession(
  reply: FastifyReply,
  user: { id: string; email: string; displayName: string; createdAt: Date },
): Promise<AuthResponseBody> {
  const accessToken = await reply.jwtSign(
    { sub: user.id, email: user.email },
    { expiresIn: ACCESS_TTL },
  );
  const { raw: refreshToken, hash } = makeRefreshTokenPair();
  await storeRefreshToken(user.id, hash);
  return {
    accessToken,
    refreshToken,
    token: accessToken,
    user: publicUser(user),
  };
}

export async function registerAuthRoutes(app: FastifyInstance) {
  app.post("/api/auth/register", async (req, reply) => {
    const parsed = registerBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid body", details: parsed.error.flatten() });
    }
    const { email, password, displayName } = parsed.data;
    const exists = await db.user.findUnique({ where: { email } });
    if (exists) {
      return reply.status(409).send({ error: "Email already registered" });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await db.user.create({
      data: { email, passwordHash, displayName },
    });
    return await issueSession(reply, user);
  });

  app.post("/api/auth/login", async (req, reply) => {
    const parsed = loginBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid body" });
    }
    const { email, password } = parsed.data;
    const user = await db.user.findUnique({ where: { email } });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return reply.status(401).send({ error: "Invalid email or password" });
    }
    await deleteAllUserRefresh(user.id);
    return await issueSession(reply, user);
  });

  app.post("/api/auth/refresh", async (req, reply) => {
    const parsed = refreshBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid body" });
    }
    const row = await findValidRefreshTokenRow(parsed.data.refreshToken);
    if (!row) {
      return reply.status(401).send({ error: "Invalid refresh token" });
    }
    const user = await db.user.findUnique({ where: { id: row.userId } });
    if (!user) {
      await db.refreshToken.delete({ where: { id: row.id } });
      return reply.status(401).send({ error: "User not found" });
    }
    await db.refreshToken.delete({ where: { id: row.id } });
    const { raw: refreshToken, hash } = makeRefreshTokenPair();
    await storeRefreshToken(user.id, hash);
    const accessToken = await reply.jwtSign(
      { sub: user.id, email: user.email },
      { expiresIn: ACCESS_TTL },
    );
    return {
      accessToken,
      refreshToken,
      token: accessToken,
    };
  });

  app.post(
    "/api/auth/logout",
    { onRequest: [requireJwt] },
    async (req) => {
      const payload = req.user as { sub: string; email: string } | undefined;
      const sub = payload?.sub;
      if (sub) {
        await deleteAllUserRefresh(sub);
      }
      return { ok: true as const };
    },
  );

  app.get(
    "/api/auth/me",
    { onRequest: [requireJwt] },
    async (req) => {
      const payload = req.user as { sub: string; email: string } | undefined;
      const sub = payload?.sub;
      if (!sub) {
        return { user: null as null };
      }
      const user = await db.user.findUnique({ where: { id: sub } });
      if (!user) {
        return { user: null as null };
      }
      return { user: publicUser(user) };
    },
  );
}
