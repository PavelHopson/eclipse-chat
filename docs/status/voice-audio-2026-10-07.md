# Voice audio RC — 2026-10-07

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
