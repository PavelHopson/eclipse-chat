import { createHash, generateKeyPairSync } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  EcosystemIdentityError,
  EcosystemIdentityService,
} from "../src/security/ecosystemIdentity.js";

function createService(extra: NodeJS.ProcessEnv = {}) {
  const { privateKey } = generateKeyPairSync("ed25519");
  const privateDer = privateKey.export({ format: "der", type: "pkcs8" });
  return new EcosystemIdentityService({
    ECOSYSTEM_IDENTITY_PRIVATE_KEY_B64: privateDer.toString("base64"),
    ECOSYSTEM_IDENTITY_ISSUER: "https://chat.example.test/eclipse-chat",
    ECOSYSTEM_IDENTITY_KEY_ID: "test-key-v1",
    ECOSYSTEM_IDENTITY_REDIRECT_URIS: "https://dnd.example.test/",
    ...extra,
  });
}

function challenge(verifier: string) {
  return createHash("sha256").update(verifier, "ascii").digest("base64url");
}

describe("ecosystem identity issuer", () => {
  it("rejects duplicate key ids in the rotation set", () => {
    expect(() => new EcosystemIdentityService({
      ECOSYSTEM_IDENTITY_ISSUER: "https://chat.example.test/eclipse-chat",
      ECOSYSTEM_IDENTITY_KEY_ID: "current-key",
      ECOSYSTEM_IDENTITY_PREVIOUS_JWKS_JSON: JSON.stringify({
        keys: [
          { kty: "OKP", crv: "Ed25519", alg: "EdDSA", use: "sig", kid: "old-key", x: "x".repeat(43) },
          { kty: "OKP", crv: "Ed25519", alg: "EdDSA", use: "sig", kid: "old-key", x: "y".repeat(43) },
        ],
      }),
      ECOSYSTEM_IDENTITY_REDIRECT_URIS: "https://dnd.example.test/",
    })).toThrow(/unique Ed25519/i);
  });

  it("publishes only an Ed25519 public key and issues bounded audience tokens", () => {
    const service = createService();
    const verifier = "v".repeat(64);
    const issued = service.issueCode({
      clientId: "eclipse-dnd-forge",
      codeChallenge: challenge(verifier),
      displayName: "Dungeon Master",
      redirectUri: "https://dnd.example.test/",
      subject: "user-123",
    });
    const token = service.exchangeCode({
      clientId: "eclipse-dnd-forge",
      code: issued.code,
      codeVerifier: verifier,
      redirectUri: "https://dnd.example.test/",
    });

    const [headerPart, payloadPart] = token.access_token.split(".");
    const header = JSON.parse(Buffer.from(headerPart!, "base64url").toString("utf8"));
    const payload = JSON.parse(Buffer.from(payloadPart!, "base64url").toString("utf8"));
    expect(header).toEqual({ alg: "EdDSA", kid: "test-key-v1", typ: "JWT" });
    expect(payload).toMatchObject({
      iss: "https://chat.example.test/eclipse-chat",
      aud: "eclipse-dnd-forge",
      sub: "user-123",
      name: "Dungeon Master",
    });
    expect(payload.exp - payload.iat).toBe(300);
    expect(payload.jti).toMatch(/^[0-9a-f-]{36}$/);
    expect(service.jwks.keys).toHaveLength(1);
    expect(service.jwks.keys[0]).toMatchObject({
      alg: "EdDSA",
      crv: "Ed25519",
      kid: "test-key-v1",
      kty: "OKP",
      use: "sig",
    });
    expect(service.jwks.keys[0]).not.toHaveProperty("d");
  });

  it("binds a single-use code to PKCE, client and exact redirect URI", () => {
    const service = createService();
    const verifier = "a".repeat(64);
    const { code } = service.issueCode({
      clientId: "eclipse-dnd-forge",
      codeChallenge: challenge(verifier),
      displayName: "Pavel",
      redirectUri: "https://dnd.example.test/",
      subject: "user-1",
    });

    expect(() => service.exchangeCode({
      clientId: "eclipse-dnd-forge",
      code,
      codeVerifier: "b".repeat(64),
      redirectUri: "https://dnd.example.test/",
    })).toThrow(EcosystemIdentityError);

    expect(() => service.exchangeCode({
      clientId: "eclipse-dnd-forge",
      code,
      codeVerifier: verifier,
      redirectUri: "https://dnd.example.test/",
    })).toThrow(/invalid or expired/i);
  });

  it("stays fail-closed when no signing key is configured", () => {
    const service = new EcosystemIdentityService({
      ECOSYSTEM_IDENTITY_ISSUER: "https://chat.example.test/eclipse-chat",
      ECOSYSTEM_IDENTITY_REDIRECT_URIS: "https://dnd.example.test/",
    });
    expect(service.enabled).toBe(false);
    expect(service.jwks.keys).toEqual([]);
    expect(() => service.issueCode({
      clientId: "eclipse-dnd-forge",
      codeChallenge: "x".repeat(43),
      displayName: "Pavel",
      redirectUri: "https://dnd.example.test/",
      subject: "user-1",
    })).toThrow(/not configured/i);
  });
});


describe("isolated project identity clients", () => {
  const redirectUri = "https://library.example.test/editor-api/api/editor/identity/callback";
  const configured = () => createService({ ECOSYSTEM_IDENTITY_CLIENTS_JSON: JSON.stringify([{id:"eclipse-library",redirectUris:[redirectUri]}]) });
  const request = {clientId:"eclipse-library",redirectUri,subject:"editor-123",displayName:"Editor",codeChallenge:challenge("v".repeat(64))};
  it("keeps new clients disabled until explicitly configured", () => {
    expect(() => createService().issueCode(request)).toThrow(/Unknown client/);
  });
  it("uses the project id as audience and does not inherit DnD redirects", () => {
    const service=configured();
    expect(() => service.issueCode({...request,redirectUri:"https://dnd.example.test/"})).toThrow(/Unknown client/);
    const issued=service.issueCode(request);
    const result=service.exchangeCode({clientId:request.clientId,redirectUri,code:issued.code,codeVerifier:"v".repeat(64)});
    const payload=JSON.parse(Buffer.from(result.access_token.split(".")[1]!,"base64url").toString());
    expect(payload.aud).toBe("eclipse-library");
    expect(payload).not.toHaveProperty("role");
    expect(() => service.exchangeCode({clientId:request.clientId,redirectUri,code:issued.code,codeVerifier:"v".repeat(64)})).toThrow(/invalid or expired/);
  });
  it("rejects using a Library code as a DnD code", () => {
    const service=configured(); const issued=service.issueCode(request);
    expect(() => service.exchangeCode({clientId:"eclipse-dnd-forge",redirectUri,code:issued.code,codeVerifier:"v".repeat(64)})).toThrow(/invalid or expired/);
  });
  it.each(["https://library.example.test.evil.test/",redirectUri+"?next=https://evil.test",redirectUri+"/", "http://library.example.test/"])("rejects non-exact redirect %s", uri => {
    expect(() => configured().issueCode({...request,redirectUri:uri})).toThrow(/Unknown client/);
  });
  it.each([
    [{id:"eclipse-dnd-forge",redirectUris:[redirectUri]}],
    [{id:"eclipse-library",redirectUris:["javascript:alert(1)"]}],
    [{id:"eclipse-library",redirectUris:[]}],
    [{id:"eclipse-library",redirectUris:[redirectUri]},{id:"eclipse-library",redirectUris:[redirectUri]}],
  ])("rejects invalid client configuration", entries => {
    expect(() => createService({ECOSYSTEM_IDENTITY_CLIENTS_JSON:JSON.stringify(entries)})).toThrow();
  });
});
