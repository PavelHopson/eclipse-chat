# Eclipse Chat UI profile

## Product character

Eclipse Chat is a Russian-first operational collaboration platform: communication, execution, voice, tasks, approvals, AI, and workspace memory. The interface should feel like a calm, dense command center, not a Discord clone, gamer HUD, generic SaaS dashboard, or marketing page.

The next action, current location, system state, and result of an action should be understandable without instructions.

## Visual system to preserve

- Primary accent: violet `#8B5CF6`; premium/owner accent: gold `#D4AF37`.
- Cyan/teal are status-only, not the primary accent. Do not restore warm orange branding, rainbow gradients, neon noise, or generic AI gradients.
- Preserve both `VOID` and `SOLAR`; every new surface must work in both themes.
- Use the existing Geist/Geist Mono typography and Eclipse icon family. Do not introduce fonts or replacement icon systems.
- Keep chrome quiet and content prominent. Use existing depth, surface, edge, focus, and semantic status tokens.
- Reuse `.ec-btn`, `.ec-icon-btn`, `.ec-field`, and current CSS layers before creating another primitive.

## Implementation constraints

- Production web UI is React/Vite/TypeScript under `apps/web` with vanilla CSS layers. Do not migrate frameworks or add Tailwind.
- Eclipse Chat currently keeps motion CSS-only. Do not add a JavaScript motion dependency for this skill. Use existing transitions/keyframes, and omit physics that the current stack cannot express safely.
- Static presentation belongs in classes; inline styles are only for actual dynamic values. Do not add JavaScript hover mutations or new `!important` conflicts.
- Functional feedback is short and restrained. Ambient loops are limited to meaningful live/AI/brand states and must honor `prefers-reduced-motion`.
- Preserve Russian-first copy, honest system labels, keyboard focus, screen-reader behavior, responsive 320/360/390/412 layouts, safe areas, and touch targets of at least 44 by 44 pixels.

## Product-state rules

- A pressed state is feedback, not authorization. Tasks, approvals, messages, uploads, voice controls, and destructive actions keep their established server/runtime confirmation.
- Never animate over permission, reconnect, offline, no-access, pending approval, failed upload, or voice/media error states.
- Do not change authentication, workspace/room permissions, LiveKit behavior, notification behavior, or execution approval semantics as part of a visual craft pass.

## Next small pilot — not implemented here

Audit `apps/web/src/components/StatusMenu.tsx` as one bounded slice: replace remaining static inline presentation with existing classes/tokens, preserve its portal geometry, account actions, outside-click and Escape behavior, add immediate non-committing press feedback, and verify focus plus reduced motion. Do not combine this pilot with navigation, authentication, or account-session changes.

## Sources inside this repository

- `Agents.md`
- `docs/design/design-brief-v2.md`
- `docs/design/surface-map.md`
- `docs/design/workspace-interactions-2026-08-28.md`
- `design-qa.md`
