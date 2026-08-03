import {
  createHash,
  createPrivateKey,
  createPublicKey,
  randomBytes,
  randomUUID,
  sign,
  timingSafeEqual,
  type JsonWebKey,
  type KeyObject,
} from "node:crypto";

const DEFAULT_CLIENT_ID = "eclipse-dnd-forge";
const DEFAULT_AUDIENCE = "eclipse-dnd-forge";
const DEFAULT_ISSUER = "https://app.star-crm.ru/eclipse-chat";
const DEFAULT_REDIRECT_URI = "https://dnd.eclipse-forge.ru/";
const CODE_TTL_MS = 2 * 60_000;
const TOKEN_TTL_SECONDS = 5 * 60;
const MAX_PENDING_CODES = 10_000;

type PendingCode = {
  audience: string;
  clientId: string;
  codeChallenge: string;
  displayName: string;
  expiresAt: number;
  redirectUri: string;
  subject: string;
};

export type EcosystemIdentityClient = {
  audience: string;
  id: string;
  redirectUris: ReadonlySet<string>;
};

export type EcosystemIdentityToken = {
  access_token: string;
  expires_in: number;
  token_type: "Bearer";
};

export class EcosystemIdentityError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "EcosystemIdentityError";
  }
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function normalizeIssuer(value: string | undefined): string {
  const url = new URL(value?.trim() || DEFAULT_ISSUER);
  if (url.protocol !== "https:" || url.username || url.password || url.hash || url.search) {
    throw new Error("ECOSYSTEM_IDENTITY_ISSUER must be an HTTPS URL without credentials, query or fragment");
  }
  return url.toString().replace(/\/$/, "");
}

function normalizeRedirectUri(value: string): string {
  const url = new URL(value.trim());
  const loopback = url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]";
  if ((url.protocol !== "https:" && !(url.protocol === "http:" && loopback)) || url.username || url.password || url.hash) {
    throw new Error("Ecosystem redirect URIs must use HTTPS (or loopback HTTP) and contain no credentials or fragment");
  }
  return url.toString();
}

function parseRedirectUris(value: string | undefined): ReadonlySet<string> {
  const entries = (value?.trim() || DEFAULT_REDIRECT_URI)
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map(normalizeRedirectUri);
  if (entries.length < 1 || entries.length > 8) {
    throw new Error("ECOSYSTEM_IDENTITY_REDIRECT_URIS must contain between 1 and 8 exact URIs");
  }
  return new Set(entries);
}

function parsePrivateKey(value: string | undefined): KeyObject | null {
  if (!value?.trim()) return null;
  let key: KeyObject;
  try {
    key = createPrivateKey({
      key: Buffer.from(value.trim(), "base64"),
      format: "der",
      type: "pkcs8",
    });
  } catch {
    throw new Error("ECOSYSTEM_IDENTITY_PRIVATE_KEY_B64 must be a base64 PKCS8 DER private key");
  }
  if (key.asymmetricKeyType !== "ed25519") {
    throw new Error("ECOSYSTEM_IDENTITY_PRIVATE_KEY_B64 must contain an Ed25519 key");
  }
  return key;
}

function publicJwk(privateKey: KeyObject, kid: string): JsonWebKey {
  const exported = createPublicKey(privateKey).export({ format: "jwk" });
  return {
    kty: "OKP",
    crv: "Ed25519",
    x: exported.x,
    use: "sig",
    alg: "EdDSA",
    kid,
  };
}

function parsePreviousJwks(value: string | undefined, currentKid: string): JsonWebKey[] {
  if (!value?.trim()) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error("ECOSYSTEM_IDENTITY_PREVIOUS_JWKS_JSON must be valid JSON");
  }
  const keys = (parsed as { keys?: unknown })?.keys;
  if (!Array.isArray(keys) || keys.length > 3) {
    throw new Error("ECOSYSTEM_IDENTITY_PREVIOUS_JWKS_JSON must contain at most 3 public keys");
  }
  const seenKids = new Set([currentKid]);
  return keys.map((candidate) => {
    const key = candidate as Record<string, unknown>;
    if (
      key.kty !== "OKP" ||
      key.crv !== "Ed25519" ||
      key.alg !== "EdDSA" ||
      key.use !== "sig" ||
      typeof key.kid !== "string" ||
      !/^[A-Za-z0-9._-]{1,64}$/.test(key.kid) ||
      typeof key.x !== "string" ||
      !/^[A-Za-z0-9_-]{43}$/.test(key.x) ||
      "d" in key ||
      "jku" in key ||
      "x5u" in key
    ) {
      throw new Error("Previous JWKS may contain only unique Ed25519 public signing keys");
    }
    if (seenKids.has(key.kid)) {
      throw new Error("Previous JWKS may contain only unique Ed25519 public signing keys");
    }
    seenKids.add(key.kid);
    return {
      kty: "OKP",
      crv: "Ed25519",
      x: key.x,
      use: "sig",
      alg: "EdDSA",
      kid: key.kid,
    } satisfies JsonWebKey;
  });
}

function codeHash(code: string): string {
  return createHash("sha256").update(code, "utf8").digest("base64url");
}

function pkceChallenge(verifier: string): string {
  return createHash("sha256").update(verifier, "ascii").digest("base64url");
}

function safeEqual(left: string, right: string): boolean {
  const leftBytes = Buffer.from(left, "ascii");
  const rightBytes = Buffer.from(right, "ascii");
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes);
}

function signJwt(
  privateKey: KeyObject,
  kid: string,
  claims: Record<string, unknown>,
): string {
  const encodedHeader = base64url(JSON.stringify({ alg: "EdDSA", kid, typ: "JWT" }));
  const encodedClaims = base64url(JSON.stringify(claims));
  const signingInput = `${encodedHeader}.${encodedClaims}`;
  const signature = sign(null, Buffer.from(signingInput, "ascii"), privateKey);
  return `${signingInput}.${signature.toString("base64url")}`;
}

export class EcosystemIdentityService {
  private readonly pendingCodes = new Map<string, PendingCode>();
  readonly client: EcosystemIdentityClient;
  readonly enabled: boolean;
  readonly issuer: string;
  readonly jwks: Readonly<{ keys: readonly JsonWebKey[] }>;
  private readonly kid: string;
  private readonly privateKey: KeyObject | null;

  constructor(env: NodeJS.ProcessEnv = process.env) {
    this.issuer = normalizeIssuer(env.ECOSYSTEM_IDENTITY_ISSUER);
    this.kid = env.ECOSYSTEM_IDENTITY_KEY_ID?.trim() || "eclipse-chat-identity-v1";
    if (!/^[A-Za-z0-9._-]{1,64}$/.test(this.kid)) {
      throw new Error("ECOSYSTEM_IDENTITY_KEY_ID must be a URL-safe value up to 64 characters");
    }
    this.privateKey = parsePrivateKey(env.ECOSYSTEM_IDENTITY_PRIVATE_KEY_B64);
    this.enabled = this.privateKey !== null;
    const currentKeys = this.privateKey ? [publicJwk(this.privateKey, this.kid)] : [];
    const previousKeys = parsePreviousJwks(env.ECOSYSTEM_IDENTITY_PREVIOUS_JWKS_JSON, this.kid);
    this.jwks = Object.freeze({ keys: Object.freeze([...currentKeys, ...previousKeys]) });
    this.client = Object.freeze({
      id: DEFAULT_CLIENT_ID,
      audience: DEFAULT_AUDIENCE,
      redirectUris: parseRedirectUris(env.ECOSYSTEM_IDENTITY_REDIRECT_URIS),
    });
  }

  private removeExpiredCodes(now = Date.now()): void {
    for (const [hash, pending] of this.pendingCodes) {
      if (pending.expiresAt <= now) this.pendingCodes.delete(hash);
    }
  }

  issueCode(input: {
    clientId: string;
    codeChallenge: string;
    displayName: string;
    redirectUri: string;
    subject: string;
  }): { code: string; expiresIn: number } {
    if (!this.privateKey) {
      throw new EcosystemIdentityError("identity_unavailable", "Ecosystem sign-in is not configured");
    }
    this.removeExpiredCodes();
    if (this.pendingCodes.size >= MAX_PENDING_CODES) {
      throw new EcosystemIdentityError("temporarily_unavailable", "Too many pending sign-in requests");
    }
    if (input.clientId !== this.client.id || !this.client.redirectUris.has(input.redirectUri)) {
      throw new EcosystemIdentityError("invalid_client", "Unknown client or redirect URI");
    }
    if (!/^[A-Za-z0-9_-]{43}$/.test(input.codeChallenge)) {
      throw new EcosystemIdentityError("invalid_request", "PKCE S256 code challenge is required");
    }
    const code = randomBytes(32).toString("base64url");
    this.pendingCodes.set(codeHash(code), {
      audience: this.client.audience,
      clientId: this.client.id,
      codeChallenge: input.codeChallenge,
      displayName: input.displayName.slice(0, 64),
      expiresAt: Date.now() + CODE_TTL_MS,
      redirectUri: input.redirectUri,
      subject: input.subject,
    });
    return { code, expiresIn: CODE_TTL_MS / 1000 };
  }

  exchangeCode(input: {
    clientId: string;
    code: string;
    codeVerifier: string;
    redirectUri: string;
  }): EcosystemIdentityToken {
    if (!this.privateKey) {
      throw new EcosystemIdentityError("identity_unavailable", "Ecosystem sign-in is not configured");
    }
    if (!/^[A-Za-z0-9_-]{43}$/.test(input.code)) {
      throw new EcosystemIdentityError("invalid_grant", "Authorization code is invalid or expired");
    }
    if (!/^[A-Za-z0-9\-._~]{43,128}$/.test(input.codeVerifier)) {
      throw new EcosystemIdentityError("invalid_grant", "Authorization code is invalid or expired");
    }
    this.removeExpiredCodes();
    const hash = codeHash(input.code);
    const pending = this.pendingCodes.get(hash);
    // One attempt consumes the code, including a wrong verifier. This prevents
    // online verifier guessing and makes replay fail closed.
    this.pendingCodes.delete(hash);
    if (
      !pending ||
      pending.expiresAt <= Date.now() ||
      pending.clientId !== input.clientId ||
      pending.redirectUri !== input.redirectUri ||
      !safeEqual(pkceChallenge(input.codeVerifier), pending.codeChallenge)
    ) {
      throw new EcosystemIdentityError("invalid_grant", "Authorization code is invalid or expired");
    }

    const now = Math.floor(Date.now() / 1000);
    const accessToken = signJwt(this.privateKey, this.kid, {
      iss: this.issuer,
      aud: pending.audience,
      sub: pending.subject,
      name: pending.displayName,
      iat: now,
      exp: now + TOKEN_TTL_SECONDS,
      jti: randomUUID(),
    });
    return {
      access_token: accessToken,
      expires_in: TOKEN_TTL_SECONDS,
      token_type: "Bearer",
    };
  }
}
