# Voice audio RC — 2026-10-07

## Dependency security 1.7.76 — locally verified, production unchanged (2026-10-08)

This supersedes the blocked state below. The official registry returned HTTP
200 and npm successfully resolved, downloaded and installed the patched graph.
No unofficial mirror, TLS bypass, audit suppression or force fix was used.
User authorization covers this fix/fast-forward push; production approval is
still separate. No new branch, DB schema/migration or runtime auth/API change.

Actual reviewed lock/installed versions:

| Component | Patched graph |
| --- | --- |
| sharp / actual runtime librsvg | 0.35.5 / 2.63.2 |
| Engine.IO | 6.6.11 |
| brace-expansion | 5.0.12 |
| source-map-js | 1.2.2 |
| Fastify / fast-uri | 5.12.5 / 3.1.8 and 4.2.1 |
| Vitest and companion packages | 4.1.11 |

Root/web/server/lock/SW are 1.7.76. The install/update selected newer compatible
Engine.IO and fast-uri patches than the initial draft. Ineffective draft
overrides were removed: the reviewed integrity-bearing lockfile and installed
version-floor/behavior regressions are the actual enforcement. Related Vitest
range resolution updates chai 6.2.2 to 6.3.0 and tinyrainbow 3.1.0 to 3.2.0.
Every resolved tarball remains on official registry.npmjs.org. No new package
identity or major upgrade was introduced. Installation used `--ignore-scripts`;
Prisma generation was run separately, without DB/migration access.

Checks on the patched graph:

- Focused dependency regressions 6/6: all locked/installed patch floors;
  bounded brace nesting/comma input; excessive/invalid source-map offsets;
  actual patched librsvg and safe normal/malformed/pixel-limited image fixtures;
  loopback Socket.IO rejects missing/EIO=3 polling and WebSocket upgrades for
  EIO=4 sessions, while a matching EIO=4 upgrade completes a probe; URI regression.
- The source-map positive fixture queried column 0 of an indexed section;
  existing library section lookup returns null there. Corrected the positive
  fixture to column 1 and checked sources. All negative offset assertions stay
  unchanged; no security control was relaxed.
- `npm test`: 135 root checks; 474 server tests, 6 skipped, 82 files.
- Typecheck and root production build pass, 520 web modules. Existing bootstrap,
  chunk-size and Prisma configuration warnings remain, not new failures.
- Security profile 22/22; fresh `npm audit --audit-level=high`: 0 vulnerabilities.
- CycloneDX 1.5 SBOM generated/parsed in memory: 332 components, 333 dependency
  entries. CI retains artifact generation. syft/grype/Gitleaks are not installed
  locally; no claim of those local scans. Narrow secret-pattern scan found no
  candidates; exact-SHA CI Gitleaks/CodeQL remain mandatory.
- Built Chromium AudioWorklet/RNNoise under production nginx CSP passed:
  deterministic synthetic raw RMS 0.017330, processed RMS 0.000090, muted RMS 0.
  This is not human speech, physical devices, SFU or CineMate acceptance.
- Diff check and version synchronization pass. Native desktop/Android unchanged.

Prior four High/four Moderate dependency findings are fixed locally. Production
risk remains open until an approved exact-SHA deployment and runtime acceptance.
Before push, remote master must remain an ancestor and live production required
reviewer must remain PavelHopson. Do not approve deployment in this task.
Remaining real-call/Windows loopback/CineMate limits below still apply.

## Dependency security follow-up — 2026-10-08 (blocked, unpublished)

Read-only recheck later on 2026-10-08: the blocker persists. Official registry
`curl -I` timed out at 10 s, and `npm view engine.io@6.6.10` with zero retries
and the dedicated local cache returned ECONNRESET. TLS was not disabled;
no mirror or audit bypass was used. Git root/remotes/dirty set were rechecked;
both local HEAD and live remote master remain `5d505b5`. The seven dirty files
are the existing security draft/status; lockfile and installed graph are still
1.7.75. Diff check and regression-script syntax check pass again. Full suites
were not rerun because the graph did not change; results below are the prior
local run, not new patched-package evidence. No new commit/push/deploy/migration.
CineMate was not changed or runtime-validated in this Chat dependency task;
its integration cannot be inferred from Chat's synthetic audio smoke.

User explicitly authorized a separate dependency fix, tests/build and
fast-forward publication to existing master. Production approval remains
separate. Checkout is still detached at `5d505b5`; remote master matched it.
The previous publication update below is historical, not current readiness.

Prepared changes (not yet a release): minimum patched direct dependencies
Fastify 5.12.5, sharp 0.35.5 and Vitest 4.1.11; scoped overrides for Engine.IO
6.6.10, brace-expansion 5.0.12, source-map-js 1.2.2 and both existing fast-uri
major lines (3.1.8 / 4.1.5). No new major, provider or runtime dependency.
Root/web/server/SW version fields are prepared for 1.7.76, but **package-lock
and installed dependencies remain old**. Do not publish/deploy this dirty tree.

The official npm registry is unreachable from this Windows environment:
`ECONNRESET` / HTTPS timeout. A dedicated local cache, the actual DNS IPv4
addresses with TLS intact, IPv6 and the existing system proxy were checked;
the proxy is not listening. No system network setting, registry trust,
TLS validation or audit gate was changed. Both lockfile-only installation
attempts failed; no lifecycle install script was executed.

Regression checks now cover installed/locked patch floors, bounded nested
brace/comma parsing, indexed source-map invalid/excessive offsets, actual
librsvg version and safe image fixtures, and isolated Socket.IO polling/
WebSocket protocol mismatch. Parser fixtures run in subprocesses with a
128 MB heap/5 s deadline; network fixture binds only 127.0.0.1.

Checks actually run on the **old installed graph**:

- Dependency security: 1/6 passes, 5 expected failures. Brace nesting causes
  stack exhaustion in the bounded child; indexed map offsets are accepted;
  actual librsvg is 2.62.3, below required 2.63.2. Engine.IO mismatched polling
  does not reject before the fixture's 3 s abort; upgrade checks cannot advance.
  This is negative local evidence, not a passed regression on patched packages.
- Typecheck and root production build pass (520 web modules). They do not prove
  new dependency compatibility. Existing bootstrap/chunk-size warnings remain.
- Existing security profile: 22/22; server suite: 474 pass, 6 skipped (82 files),
  still running Vitest 4.1.10.
- Fresh `npm audit --audit-level=high` failed at the official advisory endpoint
  with ECONNRESET; it did not return a clean vulnerability report. Diff check
  and test-script syntax check pass. No schema/migration or auth change.

Remaining blocker: restore HTTPS access to official `registry.npmjs.org`,
regenerate/review lockfile, install and rerun focused/full/browser checks,
fresh audit/SBOM, then conventional commit and gated fast-forward push.
No new commit, push, production action or database migration in this follow-up.
All four High/four Moderate prior CI findings remain unresolved for release.
The previous audio acceptance/native Windows limitations still apply.

## Publication update — 2026-10-08

User explicitly approved publishing the audio commit to existing master.
Fast-forward push succeeded: `2a90bc3` →
`5d505b593fd1f7fdd18ed657cc01dd1f59313026`. Remote master was rechecked at that
exact SHA. No branch was created; no production approval, deploy or migration
was performed. This update supersedes the pre-publication state below.

The live production environment requires reviewer `PavelHopson`, confirmed
through the GitHub API before push. Automatic workflows started for the exact
SHA, but dependency audit blocked both CI and deployment validation:

- CI: https://github.com/PavelHopson/eclipse-chat/actions/runs/37744760294 —
  failed at audit; subsequent typecheck/tests skipped (local results below
  remain local evidence only).
- Security Gate: https://github.com/PavelHopson/eclipse-chat/actions/runs/37744760283 —
  failed at audit/SBOM job; Gitleaks, CodeQL and profile checks succeeded;
  dependency-review job skipped on push. SBOM artifact generation was skipped.
- Deploy: https://github.com/PavelHopson/eclipse-chat/actions/runs/37744760250 —
  validation failed; production job skipped. Do not deploy manually to bypass
  this gate.

The fresh CI npm audit reports **8 findings: 4 High and 4 Moderate**. The push
banner's initial 2 High/5 Moderate was stale, not the decisive result.
All affected versions were already in the base lockfile; the audio slice only
changed its version fields. Candidate patched versions from the advisories:

| Package | Locked | Advisory severity | Candidate fix |
| --- | --- | --- | --- |
| sharp | 0.35.4 | High | 0.35.5 |
| engine.io | 6.6.9 | High | 6.6.10 |
| brace-expansion | 5.0.9 | High | 5.0.12 |
| source-map-js | 1.2.1 (development) | High | 1.2.2 |
| fast-uri | 3.1.7 / 4.1.4 | Moderate | 3.1.8 / 4.1.5 |
| fastify | 5.12.3 | Moderate | 5.12.5 |
| vitest / @vitest/mocker | 4.1.10 (development) | Moderate | 4.1.11 |

High risks are not closed: image decoding has a conditional memory/RCE
advisory on Linux; Engine.IO and brace/source-map parsers have denial-of-service
advisories. Actual application reachability of each advisory was not established
in this publication-only task; no live attack/reproduction was attempted.
References: https://github.com/advisories/GHSA-wq5f-xc86-pv6w and
https://github.com/advisories/GHSA-2gc4-cqfq-p2gv; exact remaining advisory IDs
are in the CI audit log linked above.

Next step requires a bounded dependency security fix, regression checks,
full tests/build and a fresh exact-SHA CI/security run. No audit bypass or
`npm audit fix --force`. Dependency changes/new commit/push have not been
performed under the authorization to publish `5d505b5`.

This status update is local and uncommitted; only the explicitly authorized
audio commit was published. Windows native loopback and real two-client audio
acceptance remain open as described below.

## Scope and state

User reports weak noise suppression and missing screen-share audio everywhere.
Checkout: `G:/eclipse-chat-screen-audio-rc`, detached HEAD from exact remote master
`2a90bc3741fd5549d30af4e868e1452e60f5dc2b`. Main and installer worktrees are dirty
and untouched. No branch, push, production mutation or database migration.
RC version: 1.7.75; native shell remains 1.0.9.

Public API read returned 1.7.74. That is not evidence for this RC or physical
audio delivery. No authenticated production audio reproduction was available.

## Confirmed defects and changes

- Aggressive mic processing had filters/compressor, not neural denoising.
  AGC could amplify residual background. Replace compressor with locally hosted
  pinned RNNoise WASM/mono 48 kHz and disable aggressive AGC. Standard/off stay
  compatible; user choice is preserved. Settings → Voice → «Усиленное» enables it.
- Mic check measured raw input rather than published DSP. It now uses the same
  enhancer, gain and capture constraints; visible startup/status/error and
  cancellation on mode/device/gain changes prevent stale claims.
- Remote track attachment attempted SDK playback before mounting and setting
  mute/volume. Configure/mount first, attach, reapply preferences and explicitly
  observe playback failure. Recovery restores deafen synchronously before await.
- Speech-oriented browser effects/DTX are unsuitable for shared media. Screen
  audio requests no AEC/NS/AGC and publishes at 128 kbit/s without DTX. The browser
  picker remains the consent boundary. No microphone substitute or silent fake
  audio track is added. Missing audio is a visible video-only state.
- RNNoise adapts 128-sample worklet blocks to 480-sample frames using a bounded
  queue. Mute clears queue/model tails; repeat mute does not recreate state.
  Initial capture/output remain disabled. DSP runtime failure locks both gates
  closed and reports failure, never automatically bypasses to raw microphone.

These are verified code defects; the exact cause of the user's live failure
still requires the two-endpoint production test below.

## Actual verification

- `npm test`: 131 root contracts, 474 server tests passed; 6 server tests skipped.
- `npm run typecheck`: web/server passed.
- `npm run build`: web/server passed; existing boot-preferences non-module and
  large-chunk warnings remain. RNNoise worklet is lazy and ~4.82 MB uncompressed.
- `npm run security:profile:test`: 22 passed.
- 8 new focused behavioral regressions: mount/mute/play and failed attachment
  cleanup, synchronous deafen recovery, PCM scaling/FIFO/mute tails, silent
  processor failure, constraints/AGC, permanent failure gates, explicit startup
  fallback, pinned original/vendor/SBOM hash integrity.
- `npm run test:voice:browser`: real built AudioWorklet/WASM under the exact nginx
  CSP. Synthetic white noise RMS ~0.0174 → ~0.000115, muted RMS 0. No human speech
  or physical mic was used; this is not a perceptual speech-quality benchmark.
- `npm run test:voice:dev`: real enhancer outputs non-silent modulated synthetic
  input, starts closed, mutes and ends both tracks, survives double destroy.
  Two local RTCPeerConnections deliver synthetic audio to the real LiveKit
  RemoteAudioTrack + production attachment helpers, retain initial mute/volume
  and play non-silent received audio. This bypasses SFU, not a real LiveKit room.
- Actual VoiceSettingsModal with synthetic mic: no horizontal overflow at
  1280/320/360/390/412 px; screenshots inspected at desktop/mobile. Artifacts are
  ignored in `.codex-artifacts/voice-audio`, not committed.
- `git diff --check`: passed; bounded changed-file secret-pattern scan: 0 matches.
- `npm audit --fetch-timeout=15000 --fetch-retries=0`: failed with ECONNRESET
  before results. Do not report 0 vulnerabilities. No npm dependencies added.
- Gitleaks/CodeQL/Linux CI not run here. Syft/Grype unavailable, not installed.

Browser runners require an existing Playwright/browser installation (no auto
install). Set `ECLIPSE_PLAYWRIGHT_PATH` to its module path. Build first for the
CSP runner. Dev runner expects web Vite at `127.0.0.1:5187`:

```powershell
npm.cmd run dev -w @eclipse-chat/web -- --host 127.0.0.1 --port 5187
```

Then in a second Windows PowerShell terminal:

```powershell
$env:ECLIPSE_PLAYWRIGHT_PATH = 'C:/Users/garaa/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'
npm.cmd run test:voice:dev
npm.cmd run test:voice:browser
```

## Security review and residual risks

Applied the installed SBOM/supply-chain security skill to the vendored surface:
source/release hashes, licenses, pinned native source, no runtime network/eval
primitives, dedicated CycloneDX component graph and artifact inclusion. See
`apps/web/src/vendor/rnnoise/README.md` for exact provenance. npm audit alone does
not cover this vendor WASM. The asset was not independently rebuilt/scanned.

- No Critical/High finding identified in this reviewed diff; not a blanket
  security clearance. Existing server auth, room/workspace ACL, webhook,
  approval/canary/budget/privacy gates are unchanged.
- Medium, mitigated locally: autoplay recovery/attachment could transiently
  ignore deafen. Synchronous preference restore and regression added.
- Medium, open release gate: fresh advisories/CI unavailable locally, vendor
  supply-chain assurance and real physical/SFU/native acceptance incomplete.
- Low, open performance risk: lazy 4.82 MB worklet and CPU cost need weak-device
  profiling. Fallback is explicit, never mislabelled RNNoise.
- CSP adds only `wasm-unsafe-eval` for self-hosted WASM. `unsafe-eval`, inline JS,
  third-party script origins and native privileges remain prohibited. Nginx
  sync is necessary for RNNoise; a web-only deploy with old CSP falls back.
- Mic test neither records nor publishes. Worklet messages are status/controls,
  never PCM. No provider calls, new secrets, native capture permission bypass,
  unsafe URLs, file processing or additional server endpoints.

Official screen-audio limits/reference:
https://docs.livekit.io/transport/media/screenshare/ . Absence of published
advisories on upstream security pages is not evidence of vulnerability absence.

## Remaining acceptance — not complete everywhere

1. Approved publication → exact-SHA CI/Security and deployment with backups,
   no migration, and `sync-nginx.sh` (required CSP update); do not waive audit.
2. Verify active asset hashes/SW version, API/health/database/uploads/login.
3. Two real clients: Chrome/Edge tab with native «Поделиться звуком» checkbox,
   audio-playing source, receiver selected sink and volume; pause/resume,
   mute/deafen, reconnect/refresh, switch room and stop/restart sharing.
4. Real noisy microphone: speech, keyboard/fan/music, headphones vs speakers,
   gain, PTT/VAD/manual mute, denied permission, fallback, device change and
   runtime failure. Compare original and processed sound with user consent.
5. Windows desktop and Android runtime/hardware validation. Existing Rust shell
   has no native loopback bridge; where WebView2 supplies no screen audio,
   native system-audio capture + explicit consent/IPC/cleanup and a signed
   desktop release remain unimplemented. Do not claim this fixes that case.

No production deploy was performed; don't run `git pull/build` expecting this
local detached commit to already exist on master.
