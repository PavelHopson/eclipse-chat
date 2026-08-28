import { randomBytes } from "node:crypto";

/** 24 random bytes produce exactly 32 base64url characters (192 bits). */
export function generateApiKey(): string {
  return "ecb_" + randomBytes(24).toString("base64url");
}
