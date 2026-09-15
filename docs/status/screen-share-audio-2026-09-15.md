# Call reliability and screen-share audio release — 2026-09-15

## Scope

- Checkout: `G:\eclipse-chat-screen-audio-rc`
- Base: detached HEAD at `fcd225b63d3734bef94679bd3e835cd4a34c94f7` (`origin/master` at task start)
- Release candidate: `1.7.74`; root, web, server, lockfile workspace entries, and service-worker cache version are synchronized. Desktop and Android remain unchanged.
- No database schema or migration change.

## Decisions and implementation

- Screen sharing requests browser-consented audio with `systemAudio: "include"`. Unsupported browsers and window/screen surfaces may still return a valid video-only share; the UI reports the publication that actually exists.
- Camera and screen publication use bounded 720p/1080p capture and bitrate settings, remain restartable, and release late permission results after a room switch.
- Voice join checks centralized workspace/channel ACL, has a 20/minute authenticated-user rate limit, and issues a five-minute LiveKit token.
- Membership leave and role downgrade list each affected LiveKit room and remove every exact `userId` / `userId:sessionId` identity whose access is lost before committing the database mutation. The same fail-closed revoke covers workspace-mode and channel-visibility changes; channel/server deletion terminates the affected rooms. Prefix collisions are rejected. A configured but unavailable RoomService aborts the mutation with 503; a missing LiveKit configuration is a no-op because no RTC session can exist.
- Because self-hosted LiveKit join JWTs remain reusable until expiry, every `participant_joined` webhook now verifies the LiveKit HS256 issuer and exact raw-body SHA-256 before parsing. It strictly maps `eclipse-<channelId>` and `userId:<v4 session UUID>`, cross-checks participant metadata, reloads current channel/member/workspace ACL from the database, and removes the exact unauthorized session. Unknown room/identity states fail closed. The public endpoint has a 64 KiB body limit and a bounded request rate; signature failures never reach ACL or RoomService work.
- Voice token minting is limited per authenticated user rather than caller-controlled forwarding headers. Nginx replaces `X-Forwarded-For`, Fastify trusts only the loopback hop, and route limits, audit events, and session metadata use `request.ip`. Voice grants do not include the unused LiveKit data-publish capability.
- Manual mute intent is separate from the effective PTT/VAD gate. New capture and DSP-output tracks are disabled before LiveKit publication; the policy is recalculated after async capture/publish boundaries. VAD analyses the private, unpublished input and opens only the published output. The same fail-closed policy governs PTT, VAD, deafen, input-device restart, visibility changes, and track rebinding. Open-mic calls continue in the background; PTT/VAD close while the document is hidden.
- A late `getUserMedia` result in voice settings is generation-scoped. Old streams, audio contexts, RAF callbacks, and error paths release their resources.
- Remote audio subscription uses the current deafen ref, output routing, per-participant gain/mute, and an explicit browser-autoplay recovery button.
- Visual-track loading is announced with an accessible live status. The 320px call dock scrolls without clipping; call, device, and recovery actions retain 44px touch targets.
- Deploy validation now runs the selected security profile/contracts in addition to dependency audit, typecheck, tests, and production build. This migration-free release records an explicit skip; the deploy fails closed unless the previous production SHA is known and its exact Prisma schema/migration diff is empty. `release.json` is atomically advanced only after activation and smoke succeed, so a failed migration-enabled deploy cannot hide an unapplied Prisma diff from the next skip gate.
- Deploy also updates the mounted self-hosted LiveKit webhook section transactionally, requires a root-owned private config, recreates and health-checks the container, and exercises a signed `participant_joined` request through nginx, DB ACL and exact RoomService removal. Any later release failure restores both the previous application build and LiveKit config.

## Local verification

Dependencies were restored as a normal ignored directory copied from the verified
`E:\projects\eclipse-chat\node_modules` tree. No junction or dependency file is
tracked. The lockfile dependency graph is unchanged; its diff contains only the
four release-version fields.

- focused voice UI contracts: 29/29 passed;
- focused server voice/access/proxy/webhook regressions: 39/39 passed across 5 files;
- complete root contract suite: 123/123 passed;
- complete server suite: 474 passed, 6 skipped across 82 files;
- `npm run typecheck`: passed;
- `npm run build`: passed (existing Vite warnings for non-module `boot-preferences.js` and large chunks remain);
- `npm run security:profile:test`: 22/22 passed;
- selected local security profiles: baseline, identity/access, realtime/voice, release/infrastructure;
- `git diff --check`: passed;
- bounded diff secret-pattern scan: zero matches.

The final reviews found one High identity-mapping defect and Medium issues in
forwarded-IP limiting, mic policy/races, VAD input separation, mobile touch
targets, transactional release metadata, and cached LiveKit JWT reuse. These,
plus the accessibility/least-privilege/audit-IP Low findings, were fixed with
focused regression coverage before publication. No unresolved Critical, High,
or Medium finding remains in the reviewed release diff. Two bounded Low design
limits remain: the token limiter is per process, and a participant joining in
the narrow interval between a pre-mutation RoomService sweep and its database
commit can remain until that connection ends or another reconciliation removes it.

`npm audit --audit-level=high` was attempted read-only and failed before results
with `ECONNRESET` from the npm advisory endpoint. The first CI run identified
one High `sharp`/libheif advisory and a Moderate test-only Vitest advisory.
`sharp` and its platform/libvips lock graph were updated to 0.35.4/1.3.3; the
High is fixed. Repeated main-worktree and isolated-lock Vitest 4.1.11 installs,
plus direct registry metadata requests, were reset or stalled by the local
network. The Moderate dev dependency remains explicit and does not meet the
High/Critical release threshold. The next production workflow must supply the
authoritative audit, Gitleaks, CodeQL, and CycloneDX evidence before release.

## Manual and production gaps

- Automated mocks cannot prove audible two-user microphone, screen-share audio, speaker routing, or the browser's native picker.
- Required manual smoke: two authenticated Chrome/Edge clients; tab share with native audio enabled; video-only window share; mute/deafen; PTT/VAD; input/output switch; autoplay recovery; stop/restart; 320px layout.
- Publication, GitHub Actions, production approval, `/api/version`, health/database, service-worker freshness, and browser smoke are pending.
