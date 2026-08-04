# Eclipse Growth Run v1

`growth.run.v1` is the portable hand-off from Eclipse AI Hub to the Growth Command Room in Eclipse Chat.
It carries one completed five-role content workflow, not provider credentials or an instruction to publish.

## Import contract

- `schemaVersion` must equal `growth.run.v1`.
- Status must be `ready_for_approval` or `approved`; all five ordered artifacts are required:
  Researcher, Strategist, Writer, Claim Auditor and Editor.
- The execution budget is fixed at five completed requests. Cost remains `provider-dependent` because
  the current browser BYOK runtime does not provide normalized billing telemetry.
- `externalActions`, `publishAllowed` and `toolsAllowed` must all be `false`.
- One to eight HTTPS evidence links are accepted. Credentials in URLs, non-HTTPS schemes and unknown
  fields are rejected.
- The complete JSON is limited to 96 KB; each artifact is plain text and limited to 16,000 characters.

## Chat-owned review

An approval claim inside the imported file is treated only as source metadata and is discarded. Chat creates
a new `PENDING` review record. A workspace member with `TASK_APPROVE` may then approve or reject the exact
stored version. Mutations use optimistic `version` checks, so two reviewers cannot silently overwrite each
other.

The import endpoint requires `Idempotency-Key`. Reusing a source run or key with identical content returns the
existing record; reusing it with different content returns `409`.

## Access and data boundary

- Every list, import and review endpoint requires JWT and workspace membership.
- Run lookups always include `serverId`; a run identifier from another workspace is not sufficient for access.
- Import and review are rate-limited. One operator may hold at most 20 pending imports per workspace.
- Audit records contain identifiers, decision and version only. They do not contain prompts, artifacts,
  evidence notes, credentials or personal data.
- Chat stores no provider key and performs no model call, OAuth action, publication, outreach, Ads API request,
  payment or production change in this slice.

## Endpoints

- `GET /api/servers/:id/growth-runs`
- `POST /api/servers/:id/growth-runs/import`
- `PATCH /api/servers/:id/growth-runs/:runId/review`

The next contract revision should add a scoped Chat-to-AI-Hub service client, cancellation/timeouts and
aggregate execution telemetry before Chat can start a run directly.
