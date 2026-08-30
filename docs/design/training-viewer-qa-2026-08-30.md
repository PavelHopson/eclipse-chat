# Training viewer visual QA — 2026-08-30

## Scope

- Source reference: `C:\Users\garaa\AppData\Local\Temp\codex-clipboard-f7239b5d-cdbe-4e99-bcd6-8851d62fc174.png`.
- Requested outcome: playback opens a dedicated viewing screen instead of replacing a small library card.
- Existing Eclipse Chat visual tokens, modal grammar, icon family, and media controls were preserved.

## Desktop comparison

- Viewport: 1294 × 679.
- Viewer geometry: 1258 × 651 at 18 × 14; no horizontal overflow (`scrollWidth` = `clientWidth` = 1256).
- The library remains visible behind a quiet modal backdrop.
- The title, close action, media stage, source metadata, external fallback, and previous/next actions form one clear hierarchy.
- The playing media owns the available stage; the card grid no longer contains active players.

## Mobile comparison

- Viewport: 390 × 844.
- Viewer geometry: 374 × 828 at 8 × 8; no horizontal overflow (`scrollWidth` = `clientWidth` = 374).
- Landscape video uses a contained stage with stable controls.
- Portrait video expands vertically without clipping.
- External source action and previous/next controls remain at least 44 px high.

## Interaction and state checks

- Clicking a file or YouTube preview opens the same viewer shell.
- Local files autoplay from the initiating user action and retain playback, seek, volume, speed, PiP, and fullscreen controls.
- Previous and next actions wrap through the active section.
- Escape closes the viewer and restores focus to the original preview.
- YouTube loading remains bounded: standard host, privacy host fallback, explicit error state, retry, and validated external YouTube action.
- Missing/invalid media presents an error state instead of an empty player.
- Reduced-motion behavior and the existing focus trap are preserved.

## Result

final result: passed

## Player redesign follow-up — 2026-08-30

### Evidence

- Source visual truth remains `C:\Users\garaa\AppData\Local\Temp\codex-clipboard-f7239b5d-cdbe-4e99-bcd6-8851d62fc174.png` (1893 × 941 px). It defines the library-to-viewer outcome; the control dock continues the established Eclipse media system rather than copying a separate mock-up.
- Browser-rendered implementation: `http://127.0.0.1:4322/?workspace-preview=1`; captures were emitted in the current QA run and were not added as raster files to the repository.
- Desktop OBSIDIAN/SOLAR: 1294 × 679 CSS px, density 1. Mobile OBSIDIAN: 390 × 844 CSS px, density 1.
- States: paused, playing, autohide, portrait, landscape, light theme, dark theme, keyboard focus.

### Full-view and focused comparison

- The viewer keeps one dominant media stage. The previous separate technical bar is now a floating dock with one border and a clear play/pause priority.
- The focused control region shows current time, seek track, duration, ±10 seconds, sound, speed, PiP where available, and fullscreen without competing card surfaces.
- At 390 px the dock has `scrollWidth = clientWidth = 341`; the 374 px dialog and all persistent controls remain inside the viewport.
- Outfit/Inter hierarchy and tabular time numerals remain consistent. The player canvas intentionally stays dark in SOLAR while modal chrome follows the light theme.
- Video stays `object-fit: contain`; portrait and landscape sources are neither cropped nor stretched. No new placeholder or approximate assets were introduced.
- App copy, media metadata, source action, section position, and viewer previous/next actions are unchanged.

### Iterations

- [P2, fixed] All controls previously had equal weight in a separate bottom strip. The transport is now grouped around a gold primary play/pause action, with volume and utilities separated visually.
- [P2, fixed] Mobile could become crowded. Duplicate viewer navigation, the volume slider, and PiP are hidden inside the mobile dock while the main actions remain at least 40 px high.
- [P3, accepted] Poster-backed videos may use an ambient backdrop. Files without a poster keep quiet black fields, preserving frame fidelity and reducing visual noise.
- Post-fix playback starts from both the frame and the explicit button; after 2.6 seconds of uninterrupted playback the dock reaches `opacity: 0` and returns on pointer or keyboard focus.
- Reduced-motion removes spatial dock/button transforms while retaining short opacity and focus feedback.
- Actionable P0/P1/P2 findings: none.

### Verification

- Web typecheck and production build passed.
- UI contracts: 86/86 passed. Security contracts: 22/22 passed. `npm audit --omit=dev --audit-level=high`: 0 vulnerabilities.
- No unsafe HTML, external URL expansion, API/auth/storage changes, or production mutation were introduced. Security findings: Critical 0, High 0, Medium 0, Low 0.

final result: passed
