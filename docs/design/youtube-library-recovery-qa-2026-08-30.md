# YouTube library recovery QA — 2026-08-30

## Scope

- Source captures: `codex-clipboard-08030f73-adcb-4bd4-8e64-1fa9f51e3a71.png`, `codex-clipboard-9f4b1436-9a6a-4d2b-9fb8-00fc94f9fc90.png`, and `codex-clipboard-af17c5ef-4284-43e9-bd01-d0fcd45c2456.png`.
- Defect state: YouTube cards had no poster, the embedded player could remain on “Подключаем плеер”, and desktop links could appear inert.
- Existing local-file cards, native video controls, titles, sections, tasks, and management behavior remain in place.

## Result

- The standard `youtube.com` embed is attempted first; the privacy host is a bounded fallback.
- Player readiness comes from validated YouTube postMessage events instead of treating any iframe load as success.
- Both failed hosts converge to an explicit error state after bounded timeouts; no indefinite loading state remains.
- When poster access is unavailable, the primary recovery action opens a canonical HTTPS YouTube URL. Owners can replace the same library item with an uploaded file without opening the destructive management mode.
- The desktop bridge opens only an exact allowlist of official HTTPS YouTube hosts in the system browser. No broad shell permission was granted.
- Card-level container queries keep the recovery controls inside narrow cards and remove nonessential copy before controls wrap.

## Visual and interaction evidence

- Local browser QA at 1294 × 679 used the real library component with one valid YouTube fixture and a forced thumbnail-provider failure.
- Verified states: provider unavailable, direct external action, first embed attempt, fallback embed attempt, terminal player error, retry, return to poster, and file replacement affordance.
- The reference captures and the final local capture were inspected at original size. The recovery controls do not overlap titles or adjacent cards.
- Reduced-motion behavior and the existing two-column mobile library contract remain unchanged; the new narrow-card layout is governed by component width rather than a desktop-only viewport breakpoint.

## Verification

- Web TypeScript: passed.
- Production web/server build: passed.
- UI contracts: 86/86 passed.
- Server tests: 76/76 files; 409 passed, 6 skipped (serialized confirmation after a resource-bound parallel run).
- Desktop `cargo check`: passed; only existing vendored LocalSend warnings remain.
- `npm audit --omit=dev --audit-level=high`: 0 vulnerabilities.
- `git diff --check`: passed.

## Security review

- Critical: none.
- High: none.
- Medium: none introduced.
- Low: external playback still depends on the user’s access to YouTube; an owner-uploaded file is the deterministic in-app fallback.
- URL parsing rejects credentials, non-HTTPS desktop targets, suffix lookalikes, and hosts outside the explicit YouTube allowlist.

final result: passed
