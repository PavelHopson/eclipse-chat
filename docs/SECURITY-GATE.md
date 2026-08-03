# Security Gate

Eclipse Chat treats authentication, realtime rooms, uploads, AI context and releases as separate trust boundaries. Every change receives the baseline gate; sensitive paths add focused controls automatically.

## Local check

```powershell
npm.cmd run security:profile:test
npm.cmd run security:profile -- --base origin/master --head HEAD
npm.cmd audit --audit-level=high
```

The selector reports the installed security playbooks that must be applied and the evidence expected from the review. It never replaces engineering judgement or the actual scanners.

## CI gates

- **Gitleaks 8.30.1** scans changed history with a checksum-verified binary. A detected credential blocks the workflow; rotate an exposed secret rather than only deleting it.
- **CodeQL security-extended** analyzes JavaScript and TypeScript data flows.
- **Dependency Review** blocks newly introduced High/Critical advisories in pull requests.
- **npm audit** blocks current High/Critical advisories on every master push and weekly run.
- **CycloneDX SBOM** records the resolved dependency inventory as a build artifact.

GitHub Actions are pinned to immutable commit SHAs. Scanner reports may contain file paths and secret fingerprints, so artifacts are retained for a limited period and must not be copied into public issues.

## Realtime boundary

Public workspace events use `server:<id>`. Internal client-room events use `server-internal:<id>` and are available only to roles with `ROOM_VIEW_INTERNAL`. Opening a channel, thread or voice room repeats the authorization check; knowing an object ID is never sufficient.

Membership, role, workspace-mode and channel-visibility changes reconcile active sockets immediately. Revoked users leave affected server, channel, thread and voice rooms without waiting for a reconnect.

## Release rule

Critical and High findings block release. The report must distinguish fixed findings from unresolved or accepted risk. Security controls must not be disabled to make CI green.
