# Eclipse Chat — interaction QA, 2026-08-28

Status: implemented locally; not committed, pushed or deployed. Production remains v1.7.66.

## Implemented

- Voice status, view modes and focus share the channel header. Tasks remain accessible. The screen-share state lives in the header and its stop action stays in the call dock.
- Audio-only chat gets more room; visual calls prioritize the selected source. A single source no longer repeats in a redundant filmstrip.
- Music has separate Queue / Library tabs, search, visible actions, pending/error states and one scroll owner. Track labels are display-only; attachment IDs and filenames remain unchanged.
- Server clock anchor plus monotonic client time; reconnect/visibility refresh; duration-bounded clocks; host-only deduplicated end handling. Keyboard seeking supports arrows, Home and End.
- Hover previews use viewport collision handling and keyboard focus. Modal portals escape the isolated chat pane. Mobile navigation no longer covers these dialogs.
- Profile no longer reserves an empty cover or repeats the avatar in its gallery. Full-size media remains accessible, including keyboard containment and Escape.
- Existing control border shorthand/longhand conflict removed. Camera/screen pending state does not disable independent microphone/audio actions; leaving remains available.
- Local synthesized mic/audio/camera/screen/connection cues, separate volume and mute. PTT and unchanged state do not create cue spam; deafen does not duplicate the mic cue.
- Short Eclipse arrival/fade/confirmation effects; preference and OS reduced-motion support; decorative JS work stops while hidden. Native cursors remain on compact controls, text, menus, media and resize handles.

## Automated verification

| Check | Result |
| --- | --- |
| Workspace typecheck | Passed, web and server |
| UI / task / conversation / navigation contracts | 72 passed, including 11 interaction tests |
| Server tests | 378 passed, 6 skipped; 73 files |
| Security contracts | 22 passed |
| Web + server build | Passed; no new dependencies |
| Full and production-only npm audit | 0 known vulnerabilities |
| git diff --check | Passed |

The first fully parallel server run hit 5-second test timeouts and one downstream mock-state failure. Re-running the unchanged suite with `--maxWorkers=2` passed; no test assertions or timeout thresholds were relaxed.
Vite still reports the classic `boot-preferences.js` bundling notice. The external bootstrap was not changed. Large existing CSS bundles remain a future cleanup item, not a performance certification.

## Browser verification

Used real UI components with DEV-only local fixtures; no production account, microphone capture, camera capture or real desktop sharing.

- Desktop 1280×720, 1366×900, 1920×1080; mobile 390×844. No document horizontal overflow in measured states.
- 1 / 4 participants; audio-only; camera + screen source selection; single-source filmstrip removal; reconnect controls and call/chat modes.
- Mobile composer and call dock remain separate. Expanded player has one overflowing scroll area; transport remains visible.
- Queue of 13 / library of 39 long track names; search empty state disables playlist playback.
- Keyboard seek reaches exactly 0:05 / 0:05 in the five-second fixture; actual media end returns the fixture to paused state.
- Header preview ArrowDown focus and Escape return; profile lightbox Tab containment and Escape; profile remains open after closing the image.
- Animation opt-out produces `data-ec-motion=quiet` and stops the speaking corona. Preference restored after QA.
- No new browser errors in the final control/profile pass. Earlier HMR dependency-array diagnostics were not counted as runtime failures; the genuine border conflict they helped expose was fixed.

## Security and release boundaries

Proportional diff review: API authorization/rate limits, React escaping, existing asset URL resolution, local-only sound output, fixture isolation, dependencies and absence of new secrets/logging. No new Critical/High/Medium/Low security finding identified in this changed surface; this is not a full application penetration test.

Still required before a production release: real two-client LiveKit + desktop-wrapper smoke, denied device/autoplay permission scenarios, audible cue balance on actual headphones, production exact-bundle verification. Fixtures do not certify these runtime paths.

Unrelated dirty files, task functionality, logout behavior, upload rules and deployment configuration were preserved.
