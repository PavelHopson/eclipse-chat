# Eclipse Chat Design System Reference

This document preserves the useful design-system direction that was temporarily placed in the
root `README.md`. The root README should describe the product; design rules live here and in the
canonical design docs.

## Canonical Sources

- `docs/design/design-brief-v2.md` — visual-language source of truth.
- `docs/design/surface-map.md` — inventory of real product surfaces.
- `apps/web/src/styles/` — production CSS tokens, components, effects and motion.
- `apps/web/src/components/icons/` — production icon language.
- `docs/design/concepts/` — concept SVGs for shell direction.
- `docs/design/effects/` — curated effect references.
- `docs/design/ia-reset/` — IA reset screenshots and verification references.

## Product Feel

Eclipse Chat should feel like a calm command center: private, structured, confident and
execution-first. The interface can be cinematic, but never theatrical at the cost of clarity.

The user should understand the next action without reading an instruction. If a state needs a
paragraph to explain, the screen is not finished.

## Content Rules

- Product copy is Russian-first.
- Labels must be honest: say `TLS`, not fake `E2E`; say what the system really does.
- Use short sentence-case copy for content.
- Use uppercase and letter-spacing only for short section labels.
- Emoji can appear as user content, not system UI labels.
- Empty states explain what happened and what action fills the state.

## Visual Rules

- Primary theme: dark VOID, with restrained violet as the main action/active signal.
- Secondary light theme: SOLAR, clean and crisp, not decorative.
- Gold is scarce and premium: ownership, brand moments, awards.
- Cyan/teal are status signals, not primary brand accents.
- Avoid rainbow gradients, cheap neon and thick borders.
- Prefer layered surfaces, hairline rings, soft shadows and restrained glow.
- One obvious primary CTA per screen.
- All motion must support action or feedback; ambient loops stay subtle and respect
  `prefers-reduced-motion`.

## Iconography

Use the real product icon systems before inventing new glyphs:

- inline SVG line icons from `EclipseIcons.tsx` and `ChannelCustomIcons.tsx`;
- custom 3D dark-glow PNGs for empty/status moments;
- minimal empty-state SVGs only when they fit the surface.

New icons must match the same stroke, radius, density and contrast. Do not mix random icon packs
inside the same surface.
