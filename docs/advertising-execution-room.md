# Advertising execution room

The `Реклама: аудит → согласование → проверка` preset creates a normal `EXECUTION` room. It is a
coordination surface, not an ad-network integration and not an authority to change an account.

Use the room for four visible stages:

1. **Evidence** — attach the read-only `ads.audit.v1` report and source period.
2. **Diff** — record the current budget/value, proposed value, reason and expected effect.
3. **Approval** — a named human accepts or rejects the exact diff. Silence is rejection.
4. **Verification / rollback** — after an external operator applies an approved change, compare
   spend and outcome with the baseline and keep a rollback task.

The room intentionally has no ad-platform token, publish action or budget mutation endpoint.
Credentials remain in a separately audited service. Reports and copied website content are
untrusted attachments; they cannot create approval or expand permissions.
