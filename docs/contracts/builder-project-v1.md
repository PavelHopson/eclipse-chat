# Builder Project v1 import boundary

`builder.project.v1` enters Eclipse Chat only as a compact JSON document produced and approved in
Eclipse AI Hub. Chat treats the entire file as untrusted input and creates a server-owned review copy.

## Import rules

- Bearer JWT, active server membership and `TASK_CREATE` are required.
- The body is capped at 128 KB and validated with a strict schema; unknown fields fail closed.
- Only an upstream `approved` project with all policy flags fixed to `false` is accepted.
- High-confidence API keys, tokens and private-key markers are rejected before persistence.
- Source approval is removed, status becomes `ready_for_review`, and every build step except the
  brief is blocked again. Upstream approval never becomes a Chat decision.
- `(serverId, sourceProjectId)` and `(serverId, idempotencyKey)` are unique. A repeated key with a
  different normalized payload returns `409`.
- Audit logs contain only IDs, decision, version and bounded counts; brief, preview and requirements
  are not copied into audit metadata.

## Review rules

- All reads and writes include `serverId`; an ID from another workspace is not a valid object.
- `TASK_APPROVE` is required to approve or reject.
- Approval requires explicit confirmation of requirements, security boundaries and preview review.
- Rejection requires a reason of at least three characters.
- The client sends the current positive `version`; the update succeeds only for a pending row with
  the same version. A concurrent decision returns `409` and the current status/version.

Approval only records a team decision. Chat does not materialize files, install dependencies,
execute generated code, connect GitHub, take payments or deploy.

## Endpoints

- `GET /api/servers/:id/builder-reviews`
- `POST /api/servers/:id/builder-reviews/import` with `Idempotency-Key`
- `PATCH /api/servers/:id/builder-reviews/:reviewId`
