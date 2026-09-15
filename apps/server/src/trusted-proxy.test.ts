import { readFileSync } from "node:fs";
import Fastify from "fastify";
import { describe, expect, it } from "vitest";

describe("trusted proxy client identity", () => {
  it("uses the rightmost untrusted address and ignores caller-controlled XFF prefixes", async () => {
    const app = Fastify({ logger: false, trustProxy: "127.0.0.1" });
    app.get("/ip", request => ({ ip: request.ip }));
    try {
      const response = await app.inject({
        method: "GET",
        url: "/ip",
        remoteAddress: "127.0.0.1",
        headers: { "x-forwarded-for": "198.51.100.77, 203.0.113.9" },
      });
      expect(response.json()).toEqual({ ip: "203.0.113.9" });
    } finally {
      await app.close();
    }
  });

  it("keeps nginx replacement, loopback trust, and req.ip rate keys aligned", () => {
    const index = readFileSync(new URL("./index.ts", import.meta.url), "utf8");
    const auth = readFileSync(new URL("./routes/auth.ts", import.meta.url), "utf8");
    const audit = readFileSync(new URL("./security/audit.ts", import.meta.url), "utf8");
    const nginx = readFileSync(
      new URL("../../../deploy/nginx/eclipse-chat.conf", import.meta.url),
      "utf8",
    );
    expect(index).toContain('trustProxy: "127.0.0.1"');
    expect(index).toContain("keyGenerator: req => req.ip");
    expect(index).not.toContain('req.headers["x-forwarded-for"]');
    expect(auth).toContain("const ipAddress = req.ip || null");
    expect(auth).not.toContain('req.headers["x-forwarded-for"]');
    expect(audit).toContain("const ip = opts.req?.ip || null");
    expect(audit).not.toContain('opts.req.headers["x-forwarded-for"]');
    expect(nginx).toContain("proxy_set_header X-Forwarded-For $remote_addr;");
    expect(nginx).not.toContain("proxy_add_x_forwarded_for");
  });
});
