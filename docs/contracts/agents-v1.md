# Eclipse Forge Agents v1

`agents.v1` is the first portable contract between Agent Office in Eclipse Chat and future executors in Eclipse AI Hub.

## Safety invariants

- Every run is scoped by `workspaceId` and `ownerId`; authorization must be checked server-side before reads, mutations, event streaming, or artifact access.
- A plan is reviewed before execution. External actions, budget increases, and artifact release require explicit approval records.
- Budget is fail-closed. Crossing cost, duration, or external-action limits stops execution instead of silently increasing the allowance.
- Retrieved content is untrusted data. It cannot grant permissions, change the plan, or override system policy.
- Tool metadata and descriptions are also untrusted. Capabilities are mapped from
  server-owned, version-pinned identifiers; a description can never grant a scope
  or introduce another tool call.
- URL-fetching capabilities must reject loopback, private-network, metadata-service,
  redirect-to-private, and non-HTTP(S) targets before any real executor is enabled.
- Remote MCP/tool endpoints require authenticated transport, tenant checks, an
  approved metadata hash, and re-approval after a tool definition changes.
- Events contain concise operational summaries and evidence references, never hidden chain-of-thought.
- Personal data and connected apps are denied by default. The initial fixture sets `publicOnly=true`, `allowPersonalData=false`, and `allowConnectedApps=false`.
- Idempotency, audit retention, cancellation semantics, and tenant-isolated storage are required before connecting a real executor.

The machine-readable source of truth is [`agents.v1.schema.json`](./agents.v1.schema.json).

## Initial lifecycle

`DRAFT → PLANNED → WAITING_START_APPROVAL → RUNNING → PAUSED | WAITING_ACTION_APPROVAL → COMPLETED | FAILED | CANCELLED`

The original Agent Office foundation was fixture-backed. In v1.7.39 the Growth template became a server-owned review surface for completed `growth.run.v1` imports; it still performs no model calls, OAuth actions, publications, payments, or production changes.
