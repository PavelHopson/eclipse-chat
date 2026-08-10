# Eclipse Growth Run v1

`growth.run.v1` is the server-owned state shared by Eclipse Chat and the bounded Eclipse AI Hub Growth executor.
It can represent a draft, an in-progress run or a completed five-role workflow. It never carries provider
credentials or an instruction to publish.

## Import contract

- `schemaVersion` must equal `growth.run.v1`.
- Status must be `ready_for_approval` or `approved`; all five ordered artifacts are required:
  Researcher, Strategist, Writer, Claim Auditor and Editor.
- The execution budget is fixed at five completed requests. Cost remains `provider-dependent` because
  the current browser BYOK runtime does not provide normalized billing telemetry.
- `externalActions`, `publishAllowed` and `toolsAllowed` must all be `false`.
- One to eight HTTPS evidence links are accepted. Credentials in URLs, non-HTTPS schemes and unknown
  fields are rejected.
- `evidenceCards` is optional for legacy compatibility. When present it contains 1–20 strict cards:
  unique ID, exact claim, state, source URL or `null`, and evidence boundary. A verified card requires
  an HTTPS URL already present in `sourceUrls`; duplicate IDs and unlisted URLs are rejected.
- The complete JSON is limited to 96 KB; each artifact is plain text and limited to 16,000 characters.

## Chat-owned review

An approval claim inside the imported file is treated only as source metadata and is discarded. Chat creates
a new `PENDING` review record. A workspace member with `TASK_APPROVE` may then approve or reject the exact
stored version. Mutations use optimistic `version` checks, so two reviewers cannot silently overwrite each
other.

The import endpoint requires `Idempotency-Key`. Reusing a source run or key with identical content returns the
existing record; reusing it with different content returns `409`.

## Direct execution contract

- Chat creates a `draft` with zero artifacts and changes it to `in_progress` one role at a time.
- One request executes only the next fixed role. The server rejects skipped or reordered steps.
- The dedicated `eclipse-chat-growth` service identity has only `growth:execute`; it cannot call generic chat,
  models or telemetry endpoints.
- Every step uses optimistic `version` plus `Idempotency-Key`. A completed retry returns the stored version.
- The default per-user budget is 25 attempted requests per UTC day. Failed and cancelled provider calls still
  consume one request, preventing retry loops from bypassing the limit.
- A 65-second Chat timeout and explicit cancel propagate an abort toward AI Hub. Existing artifacts are kept.
- Prompts and artifacts never enter audit or aggregate telemetry. Audit retains IDs, role, version and token totals only.
- Chat forwards Evidence Cards unchanged to AI Hub. Card-enabled Researcher and Claim Auditor responses
  must use `growth.research.v2` / `growth.claims.v2`; other roles remain v1. Chat rechecks the expected
  schema marker before storing a direct-execution artifact. Historical completed prose imports remain readable.

This release adds server/API compatibility only. The existing create form still produces legacy runs without
cards; a reviewed Evidence Card editor is a separate UX slice. No v4 model run is implied by this contract.

## Access and data boundary

- Every list, create, execute, cancel, import and review endpoint requires JWT and workspace membership.
- Create and execute additionally require `TASK_CREATE`; review requires `TASK_APPROVE`.
- Run lookups always include `serverId`; a run identifier from another workspace is not sufficient for access.
- Import and review are rate-limited. One operator may hold at most 20 pending imports per workspace.
- Growth-specific audit metadata contains identifiers, decision, role, aggregate token counts and version only.
  Standard security fields (user ID, IP and user agent) are still recorded; prompts, artifacts, evidence notes
  and credentials are not.
- Chat stores only a root-owned scoped AI Hub service token, never an upstream provider key. It performs no OAuth
  action, publication, outreach, Ads API request, payment or production change in this slice.

## Endpoints

- `GET /api/servers/:id/growth-runs`
- `POST /api/servers/:id/growth-runs`
- `POST /api/servers/:id/growth-runs/:runId/steps`
- `POST /api/servers/:id/growth-runs/:runId/cancel`
- `POST /api/servers/:id/growth-runs/import`
- `PATCH /api/servers/:id/growth-runs/:runId/review`
