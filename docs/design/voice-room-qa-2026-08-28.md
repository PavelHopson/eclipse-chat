# Voice room refinement — 2026-08-28

## Scope and visual intent

Local improvement of the existing Eclipse Chat voice room, not a literal screenshot clone. The Taste was applied as a quiet operational UI: one obvious next action, fewer repeated surfaces, stable controls, more room for conversation and shared video. Existing Eclipse typography, gold/graphite tokens, avatars and Phosphor icon family are reused. No generated artwork or new dependencies.

Source screenshots:

- C:/Users/garaa/AppData/Local/Temp/codex-clipboard-6fd532f9-2134-4dfb-b1d3-0c884f3d0ff1.png — 1367 × 1035, disconnected room.
- C:/Users/garaa/AppData/Local/Temp/codex-clipboard-377ec386-3238-4df4-803f-d6a3a5cabed9.png — 1920 × 1026, connected room.

The screenshots include the native window title bar (approximately 31 and 23 px). Implementation captures use CSS viewports 1367 × 1003 and 1920 × 1003 at device density 1. Mobile captures use 390 × 844 and 320 × 844. User names, message content and media are normalized to local demo fixtures, not copied from private production conversations. A small DEV-only “Состояния звонка” disclosure is intentionally present only in the preview.

## Implementation

- The outer workspace header remains the single room title. The inner toolbar holds connection state, real participant count and layout choices.
- One real MusicMiniPlayer is passed from AppShell into the enabled voice room. The repeated music banner and music-bot participant card are removed. Expanded player and picker callbacks are preserved; the voice-disabled fallback still has its header player.
- One visible join action in each layout. Connected microphone, deafen, camera, screen and hangup controls live outside the stage/chat split and stay visible in chat-only mode.
- Volume, connection quality, diagnostics and device settings are progressively disclosed. Escape closes the disclosure and restores focus; outside pointer interaction closes it too.
- Layout responds to the available room width. Narrow rooms offer stage/chat instead of squeezing both panes; an automatic compact fallback does not overwrite the saved desktop preference.
- Participant and video data are scoped to the viewed active voice channel. Browsing another room does not show the current call's live tracks.
- Neutral participant cards, one speaking accent, no decorative outer glow. Camera/screen video keeps its proportions; the visual grid scrolls without overlapping the participant strip or persistent footer.
- Tasks, chat sending/retry, music callbacks, device permissions, call transport and logout handlers are not removed or replaced.

## Visual iterations and evidence

1. P2 — Repeated headings, music surfaces and join buttons competed for attention; fixed through component composition. The 1367 px split no longer forces the room chat outside the viewport.
2. P2 — Existing high-specificity CSS restored old violet glows, gradient buttons and fixed-width menu buttons. Scoped voice-room resets now produce the intended quiet surfaces and readable option rows without changing unrelated workspace controls.
3. P2 — Compact participant cards, two-row mobile music controls and the anchored options menu were refined after screenshot inspection at 390 and 320 px.
4. P2 — The visual grid could shrink while its tiles overflowed onto the participant strip. Its layout is now content-sized and top-aligned. The test fixture's Vite base-path URL was also corrected; the final test waits for an actual decoded video frame and asserts the strip is below the video grid.

Full-view captures inspected:

- .codex-qa/voice-1367-idle.jpg
- .codex-qa/voice-1367-connected.jpg
- .codex-qa/voice-1920-participants.jpg
- .codex-qa/voice-390-voice.jpg
- .codex-qa/voice-320-options.jpg
- .codex-qa/voice-1920-screen.jpg
- .codex-qa/voice-390-screen.jpg

Focused regions are readable in these captures: join CTA, music row, participant names/states, persistent controls, options menu, loaded video and chat composer. No separate crop was necessary. Additional automated captures cover 1280, 1025, 768, reconnecting/error states and compact chat mode.

Fidelity review:

- Typography: existing fonts and operational hierarchy retained; no oversized marketing headings added.
- Spacing/layout: repeated full-width banners removed; stage and chat can shrink correctly; the footer is stable.
- Color/surfaces: graphite base and gold interaction states; red is reserved for hangup/error. No new decorative palette.
- Assets: existing icon family and avatar components; the local test video is fixture-only, not a production asset.
- Copy: clear connection and recovery states; no fabricated participant count from the music bot, no unnecessary instructions for basic joining.

## Verification

- 55 combined UI/security contract tests passed, including 7 new voice-room tests.
- Web and server typecheck passed.
- Web and server production build passed; final web build repeated after visual fixes.
- Full dependency audit: 0 vulnerabilities.
- Browser suites passed: voice room, workspace navigation, conversation flow and task flow.
- Voice browser coverage: 320–1920 px, split/stage/chat, one transport, joining, mute/deafen, four participants, camera/screen presentation, decoded video frames, no strip overlap, other-room media scoping, drafts, send acknowledgement, reconnecting/error recovery, keyboard focus and reduced motion.
- No page errors in the isolated test browser. External requests and microphone/screen capture were blocked; fixtures never joined a backend room.
- Production output checked for WorkspaceVoicePreview, voice-preview and workspace-preview: no matches.
- git diff --check passed.

## Security and release boundary

The proportional pass used the installed defensive API-security baseline to review the changed surface. No auth, authorization, API endpoints, socket/LiveKit engine, upload processing, production secrets or dependency versions changed. No new unsafe HTML or sensitive logging was introduced. The CI/deploy workflow change only adds the new UI contract test; permissions, approval gates and deployment targets are unchanged.

No new Critical/High/Medium/Low security finding was identified in this UI slice. Existing CodeQL High findings from the separate v1.7.65 release triage remain unresolved; this UI work does not close them or authorize production approval. See docs/security/v1.7.65-release-triage.md.

Limitations: no real multi-user WebRTC call, microphone/audio-quality check, native Tauri/WebView runtime check or authenticated production smoke was performed. The preview proves web UI behavior with controlled local fixtures, not end-to-end call quality.

No commit, push or deploy was performed for this refinement. Production remains separately blocked on the existing release security review.

final result: passed
