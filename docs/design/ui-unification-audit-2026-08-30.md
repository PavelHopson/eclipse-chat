# Eclipse Chat — UI unification and account sessions audit

Date: 2026-08-30
Scope: web application, desktop wrapper shared UI, authentication session behavior
Design variance: 4/10
Motion intensity: 5/10
Visual density: 8/10

## Outcome

The product UI now uses one Eclipse operational language across the workspace shell, settings, profile/status menu, dialogs, voice/media surfaces, server administration, AI Office, authentication, and system states. The change is intentionally a shared layer rather than a decorative rewrite of every feature: existing task flows, data density, permissions, and the authored logout control remain intact.

The source inventory contains 53 explicit `Page`, `View`, `Panel`, `Modal`, and `Section` modules, plus the shell, voice room, media players, task surfaces, composer, sidebar, status menu, and AI Office surfaces. These groups were checked against the same token, icon, focus, motion, theme, and overflow contract.

## Visual contract

- Operational screens remain quiet, dense, and task-first. Accent color indicates state or the next action; it is not used as general decoration.
- Phosphor-based `EclipseUiIcon` remains the primary icon family. Settings navigation, status actions, profile editing, sidebar controls, and legacy feature icons now share event-driven motion recipes.
- The Eclipse mark gets a one-shot arrival plus a restrained 4.2-second eclipse/corona cycle that runs without hover. It uses only transform/opacity and stops when interface motion is disabled or `prefers-reduced-motion` is active.
- Action icons use clearly visible 430 ms gestures instead of the previous 1 px shift: generic signal, orbit, bell and forward motion families. Sidebar icons also receive a short gold focus halo.
- Cursor behavior is semantic: action, precision, drag, and danger states differ without obscuring native text, form, video, iframe, or disabled-control cursors.
- Borders define structure only. Nested cards do not receive arbitrary frames, elevation, or repeated radii.
- Keyboard focus remains visible in both themes. Reduced motion disables authored transitions and cursor choreography while preserving state feedback.

## Screen matrix

| Surface group | Included surfaces | Status |
| --- | --- | --- |
| Workspace | rail, server navigation, channels, conversations, composer, search, threads | unified |
| Work management | tasks, action items, memory, command brief, intelligence | unified; task behavior preserved |
| Voice and media | voice room, shared audio/video players, music picker, screen share | unified; media black stage is intentional |
| Administration | workspace settings, platform admin, members, channels and roles, audit | unified; destructive actions retain explicit confirmation |
| Account | profile, security, sessions, notifications, appearance, integrations, hotkeys | unified; multi-account section added |
| Social | direct messages, friends, groups, member/profile dialogs | unified |
| AI Office | office shell, studio, approvals, governance surfaces | unified through shared icon/motion/theme layer |
| Entry/system | landing, auth, authorization, 404, loading/empty/error/disabled states | covered by established Eclipse tokens |

Intentional exceptions are limited to semantic media black, QR-code white, avatar fallback colors, and content thumbnails. These are content or readability constraints rather than separate design systems.

## Theme and accessibility QA

- SOLAR: white page background, `rgb(247, 248, 250)` settings dialog, no horizontal overflow at 1280 × 720.
- OBSIDIAN: OLED-black page background, `rgb(12, 17, 23)` settings dialog, no horizontal overflow at 1280 × 720.
- Settings dialog geometry: 1120 × 672 at 1280 × 720; navigation and content scroll independently without clipping.
- The status/account menu is portalled to `document.body`, clamped to the viewport, and scrolls internally when needed.
- Close controls, settings navigation, account actions, and form fields retain semantic names and keyboard focus.
- `prefers-reduced-motion`, the in-product motion switch, coarse pointer, native input cursor, disabled controls, and cleanup are covered by automated contracts.
- Existing responsive contracts and prior 390/320 px workspace/voice captures remain valid because the shared layer does not alter breakpoint ownership or core grid columns.

## Multi-account and session architecture

- A local account vault stores separate access/refresh-token slots and public account metadata. Passwords are never stored.
- Adding an account happens in a modal and preserves the current workspace until the new login succeeds.
- Account switching is available from the status menu and Settings → Accounts on this device.
- Removing an inactive account removes only its local slot. Logging out of the active account revokes only that account's current refresh session and activates the next stored account when available.
- Ordinary login no longer revokes every refresh session for the user. A desktop app login therefore does not terminate a web login, and vice versa.
- Password change and account recovery still revoke all user refresh sessions by design.

## Security review

### Fixed

- **Medium — cross-device session availability:** ordinary login previously deleted every refresh session for the user, and ordinary logout invalidated all device sessions. Both operations are now session-scoped; targeted regression tests cover concurrent web/desktop sessions.
- **Low — stale refresh-token logout:** a token rotation during logout could make the request revoke the previous token. Logout now retries after a scoped refresh and submits the current refresh token.
- Refresh tokens remain hashed server-side, authentication routes preserve validation/rate-limit boundaries, and no passwords or new secrets are logged or persisted.

### Residual / accepted for this iteration

- **Medium — browser storage exposure:** multiple refresh tokens are stored in `localStorage`, matching the existing single-account architecture but increasing the impact of a successful same-origin XSS. A future hardening pass should move web refresh credentials to `HttpOnly; Secure; SameSite` cookies and desktop credentials to the OS keychain. This is not represented as encrypted storage.
- Removing an inactive account locally does not immediately revoke that server session. Users can revoke it from Sessions and devices; password changes continue to revoke every session.
- Native desktop window integration and a real multi-device backend session were not exercised in this local UI fixture; server isolation is covered by automated route tests.

## Verification

- `npm run typecheck --workspaces --if-present` — passed.
- UI/product/security contracts — 85/85 passed.
- Server suite, sequential runner — 75/75 files; 404 passed, 6 skipped.
- `npm run build` — web and server passed.
- `npm audit --omit=dev --audit-level=low` — 0 vulnerabilities.
- `git diff --check` — passed; line-ending warnings only.
- Live browser QA — SOLAR and OBSIDIAN settings/account screens, keyboard focus, portal geometry, and horizontal overflow passed at 1280 × 720.

Result: passed
