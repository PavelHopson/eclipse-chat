# Eclipse Ecosystem Identity

`v1.7.30` adds the fail-closed identity issuer foundation for signing in from
Eclipse Chat to Eclipse DnD Forge. It is intentionally disabled until an
Ed25519 signing key is configured. This is not a general OAuth provider and it
currently serves one fixed client: `eclipse-dnd-forge`.

## Trust model

- Eclipse Chat authenticates the user and issues a short-lived authorization code.
- DnD Forge creates the PKCE verifier, keeps it on the initiating device and
  exchanges the one-time code for a five-minute, audience-bound JWT.
- The token contains only `sub`, `name`, `iss`, `aud`, `iat`, `exp` and `jti`.
  Email, password, Chat history and refresh tokens are never shared.
- Redirect URIs are compared against an exact server-owned allowlist. The client
  cannot supply another callback host.
- A failed code exchange consumes the code. Codes expire after two minutes.
- The public JWKS endpoint exposes only Ed25519 public keys. Private key material
  must remain in the server environment or secret manager.

## Server configuration

Generate a dedicated Ed25519 key outside the repository:

```bash
openssl genpkey -algorithm ED25519 -out ecosystem-identity-private.pem
openssl pkcs8 -topk8 -nocrypt -in ecosystem-identity-private.pem \
  -outform DER -out ecosystem-identity-private.der
base64 -w 0 ecosystem-identity-private.der
```

On PowerShell, encode the DER file with:

```powershell
[Convert]::ToBase64String(
  [IO.File]::ReadAllBytes("ecosystem-identity-private.der")
)
```

Store the resulting base64 value in the production secret store, not in Git:

```dotenv
ECOSYSTEM_IDENTITY_PRIVATE_KEY_B64=<base64-pkcs8-ed25519-private-key>
ECOSYSTEM_IDENTITY_KEY_ID=eclipse-chat-identity-v1
ECOSYSTEM_IDENTITY_ISSUER=https://app.star-crm.ru/eclipse-chat
ECOSYSTEM_IDENTITY_REDIRECT_URIS=https://dnd.eclipse-forge.ru/
ECOSYSTEM_IDENTITY_PREVIOUS_JWKS_JSON={"keys":[]}
```

After copying the secret, securely remove the temporary PEM and DER files. A
missing or invalid private key keeps issuance disabled and returns `503`.

## Authorization flow

DnD Forge generates a cryptographically random PKCE verifier and `state`, then
opens Eclipse Chat with the query before the hash route:

```text
https://app.star-crm.ru/eclipse-chat/?client_id=eclipse-dnd-forge&response_type=code&redirect_uri=https%3A%2F%2Fdnd.eclipse-forge.ru%2F&code_challenge=<S256_CHALLENGE>&code_challenge_method=S256&state=<RANDOM_STATE>#authorize
```

After the user confirms, Chat redirects to the exact allowlisted callback with
`code` and the original `state`. DnD Forge must reject a state mismatch before
exchanging the code:

```http
POST https://app.star-crm.ru/eclipse-chat/api/ecosystem/token
Content-Type: application/json

{
  "clientId": "eclipse-dnd-forge",
  "code": "<ONE_TIME_CODE>",
  "codeVerifier": "<ORIGINAL_PKCE_VERIFIER>",
  "grantType": "authorization_code",
  "redirectUri": "https://dnd.eclipse-forge.ru/"
}
```

DnD Forge validates the returned JWT using:

```text
GET https://app.star-crm.ru/eclipse-chat/api/ecosystem/.well-known/jwks.json
```

Validation must require `alg=EdDSA`, the expected issuer, audience
`eclipse-dnd-forge`, a known `kid`, a valid signature and current `exp`.

## Key rotation

1. Generate a new private key and choose a new unique `ECOSYSTEM_IDENTITY_KEY_ID`.
2. Put the previous public JWK in `ECOSYSTEM_IDENTITY_PREVIOUS_JWKS_JSON`.
3. Deploy the new private key and verify that JWKS publishes both public keys.
4. Wait longer than the maximum token lifetime plus clock skew.
5. Remove the previous public key in a later deployment.

Never place a private `d` value, `jku` or `x5u` in the previous-key set. The
server rejects duplicate key IDs and more than three previous keys.

## Production gate

The DnD consumer now implements tab-scoped PKCE/state, strict Ed25519/JWKS
verification, opaque HttpOnly sessions, logout and regression tests. Production
SSO still stays disabled until `api.dnd.eclipse-forge.ru` has its reviewed runtime,
DNS/TLS, root-owned secrets, scoped AI Hub client, rollback canary and 24-hour SLO
observation. Keep `ECOSYSTEM_IDENTITY_PRIVATE_KEY_B64` unset until those
infrastructure gates pass.
