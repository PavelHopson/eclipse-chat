# Eclipse Chat — agent entrypoint

Claude Code / Codex reads this file at the start of a project session. Keep it as the
navigation layer for agent context, not as a changelog.

@Persona.md
@Agents.md
@Context.md
@Memory.md
@Skills.md

---

## Start Here

- `ROADMAP.md` is the source of truth for versions, completed work, active tasks and changelog.
- `docs/discord-parity-roadmap.md` is the long-term Discord-parity / operational platform map.
- `docs/design/design-brief-v2.md` and `docs/design/surface-map.md` are required before UI work.
- `docs/NETWORK-GATEWAY.md` is required only for network gateway / proxy / WireGuard work.

Do not duplicate project state here. Update `ROADMAP.md` for status and changelog changes.

## Language

- User-facing communication: Russian.
- Product copy: Russian-first.
- Code, identifiers, commits, telemetry labels: English.

## Product UX Principle

Design as if the user will not read instructions, is in a hurry, and may click by intuition.
The interface must lead them through the correct path by itself.

Every screen must answer in 3 seconds:

- where am I?
- what is the main action?
- what can I do next?
- what happens after I click?

Primary CTA must be visually obvious. Button labels must describe the action, not use generic
words like `OK`, `Next`, or `Apply`. Empty, loading, error, success, no-access and no-data states
must be designed explicitly. Destructive actions need confirmation, logging and recovery when
possible.

Good Eclipse Chat UI feels like a calm command center: clear, forgiving, operational, and
focused on execution instead of instruction-reading.
