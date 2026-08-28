# Voice experience — 2026-08-28

Local implementation of the six agreed improvements after the first voice-room refinement. No commit, push, version bump or production deployment.

## Design and behavior

The Taste is applied contextually: quiet operator UI, existing Eclipse graphite/gold palette, existing typography and Phosphor family. Motion follows the accessible-animation and 60fps-animation guardrails: short participant arrival, speech-driven corona using transform/opacity, no idle rotation, static reduced-motion state.

1. The selected video source fits the available scene height. Camera/screen sources and audio-only participants remain in a horizontally scrollable filmstrip. A source can be pinned; unpin restores the screen-first default. Pinning is local and channel-scoped.
2. The room modes now read “Звонок и чат / Звонок / Чат”. Desktop call controls have short labels; mobile retains the same accessible actions as icons. Screen sharing has an explicit visible stop action. Account logout is unchanged.
3. Pre-join microphone selection and optional testing are inline, not an obligatory wizard. Capture starts only after the test button; no MediaRecorder, network send or speaker output is created. The test ends after 10 seconds, manual stop, tab hiding, device change, joining or unmount. Late permission grants are stopped and discarded.
4. Join with microphone off skips initial microphone publication and automatic settings reconfiguration. The ordinary join path stays unchanged. A later explicit microphone action or PTT press can enable capture.
5. Speech-level coronas use the existing authorized LiveKit participant audioLevel; no extra microphone stream is opened for the effect. Hidden/reduced-motion states stop the visual loop.
6. Hidden room chat keeps its reading position and counts incoming messages and direct mentions. Existing send/retry, message actions, threads and tasks are preserved.
7. Music filenames are normalized only for display; attachment data and URLs are unchanged. Optional speech ducking is off by default and scales only this listener's music element. Saved volume and manual mute changes are immediate; ducking/recovery ramps do not mutate stored volume, server queue or host state.

## Visual QA

Reference: the two original voice-room screenshots documented in voice-room-qa-2026-08-28.md, followed by the agreed six-point proposal. Private production messages are replaced with local fixtures. The small “Состояния звонка” disclosure is DEV-only.

CSS viewports: 1920 × 1003, then 1367 / 1025 / 768 / 390 / 320 × 844; density 1.

Full-view captures inspected:

- .codex-qa/voice-next-desktop-screen.jpg
- .codex-qa/voice-next-390-screen.jpg
- .codex-qa/voice-next-320-prejoin.jpg

Additional evidence:

- .codex-qa/voice-next-mic-denied.jpg
- .codex-qa/voice-next-mic-level.jpg
- .codex-qa/voice-next-participants-reduced.jpg
- .codex-qa/voice-next-unread.jpg
- .codex-qa/voice-next-1367-screen.jpg through voice-next-320-screen.jpg

Focused regions are readable in full captures: video bounds, filmstrip, call footer, pre-join device selector/test/checkbox/CTA. No separate crop required.

Iterations:

- P2: legacy call-button pseudo-elements crossed out the new labels. Disabled only in the refined call footer; desktop controls explicitly use row layout.
- P2: inherited video sizing made the actual video element taller than its parent despite the scene itself fitting. Bounded the video element, retained object-fit contain, and added desktop/mobile assertions against the actual video bounds.
- P3: shortened the voice composer placeholder to avoid a clipped wrapped channel name in a narrow chat pane.
- P2: initial and manual volume changes must not fade down from a louder value. They are immediate; only automatic ducking transitions are ramped. Hidden tabs complete volume transitions immediately.

## Verification

- 62 combined UI/security contracts passed, including 14 voice-room contracts.
- The real join callback is executed in a network-free mock test: muted join performs zero mic-publication calls; normal join still performs one.
- Web/server typecheck and production builds passed. Final web build repeated after audio refinements.
- Dependency audit: 0 vulnerabilities; no new dependencies.
- Five browser suites passed: original voice-room smoke, voice-next smoke, workspace navigation, conversation flow and task flow.
- New browser scenarios: zero capture on mount; permission denial; cancellation plus late grant cleanup; synthetic level meter; track cleanup; muted join; opt-in ducking and restoration; unchanged stored volume; speech corona; live reduced-motion switch; hidden chat counts/mentions/reading position; keyboard and pointer resizing; pin/unpin; actual decoded video frames and bounds; responsive 320–1920 px.
- The isolated browser blocks external hosts. Its microphone API is replaced with a synthetic oscillator-to-stream fixture, never the user's physical microphone. No real account, room, camera or screen share is used.
- A bounded 700 ms speech-animation sample verifies no per-frame layout churn (LayoutCount delta <= 1). This is not a universal 60-fps/native-device performance claim.
- No browser page errors. git diff --check passed. Production bundle excludes local preview routes and fixtures.

## Security and limits

The defensive API-security baseline was applied proportionally to microphone consent, cleanup, local preference handling and changed data flow. No backend authorization, API endpoints, credentials, socket events, upload processing or production settings changed. The client join options and its capture gate were extended; focused regression covers the muted path.

No new Critical/High/Medium/Low finding was identified in this slice. The pre-existing release CodeQL High findings remain unresolved and are not dismissed by these UI tests. See docs/security/v1.7.65-release-triage.md.

Still required before release: real multi-user WebRTC smoke, physical input/output device validation, native Tauri/WebView smoke and resolution of the separate release security blockers. Synthetic tests establish UI/resource behavior, not real call quality.

final result: passed
