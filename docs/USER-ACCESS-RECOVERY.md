# User access recovery

Use this maintenance command when a known account cannot log in because of an
admin ban or the brute-force protection lockout.

The command is a dry run by default:

```bash
cd /var/www/eclipse-chat/apps/server
npm run access:restore -- --email user@example.com
```

Apply the recovery only after checking the reported state:

```bash
npm run access:restore -- --email user@example.com --apply
```

The apply step clears `bannedAt`, `bannedReason`, `bannedByUserId`,
`failedLoginAttempts` and `lockoutUntil`. Existing refresh sessions are revoked
and a `PLATFORM_USER_UNBANNED` audit entry is created without storing the email,
password or tokens in metadata.

The command refuses to restore a soft-deleted account. Deletion recovery needs
a separate audit review because it may affect owned workspaces and user data.
