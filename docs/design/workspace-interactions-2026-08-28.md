# Eclipse Chat: interaction refinement

Status: local implementation and fixture QA complete; not released.

Evidence: [QA report](qa/workspace-interactions-2026-08-28.md). Live two-client/native verification remains a release gate.

## Scope
- Compact voice chrome; adaptive audio-only / video / screen-share layout.
- One library/queue scroll area, shared track labels and reliable playback clock.
- Viewport-safe hover previews; no duplicate native tooltip over a custom preview.
- Content-driven profile, preserving editing and full-size media viewing.
- Quiet pointer over controls, native cursors for text/media/resizing, opt-out.
- Local confirmation sounds for mic, deafen, camera, screen share and connection state.

## Motion contract
- Eclipse accents use existing gold/graphite tokens and icon family.
- Source changes: short opacity reveal, no remount of active media for decoration.
- Participants: bounded arrival, existing real speech-level corona, no fake activity.
- Controls: short confirmation accent after successful state changes; pending and errors stay visible.
- Menus/profile/player: short reveal without moving layout or hiding essential controls.
- Reduced motion removes displacement and continuous decoration; keep focus and state cues.
- No hover sounds, no push-to-talk sound spam, no mixing UI sounds into published media.

## Verification gate
- Desktop 1280/1366/1920, mobile, zoom-equivalent narrow layout.
- Long names, edge tooltips, keyboard/Escape, empty/error/loading states.
- Audio-only and screen sharing, single/multiple sources, repeated mode switching.
- Playback end, pause/resume/seek, stale session, denied autoplay, reconnect.
- Sound settings persistence, confirmed transitions, duplicate suppression and failure paths.
- Real multi-client/native audio verification is separate from local fixtures.

Tasks, server authorization, upload rules and logout behavior remain intact.
