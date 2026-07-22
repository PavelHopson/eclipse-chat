import "dotenv/config";
import { dbBase } from "../db.js";

type CliOptions = {
  email: string | null;
  apply: boolean;
};

function readOptions(argv: string[]): CliOptions {
  const emailIndex = argv.indexOf("--email");
  const email = emailIndex >= 0 ? argv[emailIndex + 1]?.trim().toLowerCase() : null;
  return { email: email || null, apply: argv.includes("--apply") };
}

function printUsage(): void {
  console.log(
    "Usage: npm run access:restore -- --email user@example.com [--apply]",
  );
  console.log("Without --apply the command only diagnoses the account state.");
}

async function main(): Promise<void> {
  const options = readOptions(process.argv.slice(2));
  if (!options.email) {
    printUsage();
    process.exitCode = 2;
    return;
  }

  const user = await dbBase.user.findFirst({
    where: { email: { equals: options.email, mode: "insensitive" } },
    select: {
      id: true,
      email: true,
      displayName: true,
      bannedAt: true,
      bannedReason: true,
      deletedAt: true,
      deletedReason: true,
      failedLoginAttempts: true,
      lockoutUntil: true,
    },
  });

  if (!user) {
    console.error(`Account not found: ${options.email}`);
    process.exitCode = 3;
    return;
  }

  console.log(`Account: ${user.displayName} <${user.email}>`);
  console.log(`Admin ban: ${user.bannedAt ? "yes" : "no"}`);
  console.log(`Failed login attempts: ${user.failedLoginAttempts}`);
  console.log(
    `Login lock: ${user.lockoutUntil ? user.lockoutUntil.toISOString() : "none"}`,
  );

  if (user.deletedAt) {
    console.error(
      `Refusing automatic recovery: account was deleted${
        user.deletedReason ? ` (${user.deletedReason})` : ""
      }. Review the deletion audit trail first.`,
    );
    process.exitCode = 4;
    return;
  }

  const hasBan = user.bannedAt !== null;
  const hasLoginRestriction =
    user.failedLoginAttempts > 0 || user.lockoutUntil !== null;

  if (!hasBan && !hasLoginRestriction) {
    console.log("Access is already active. No changes are required.");
    return;
  }

  if (!options.apply) {
    console.log("Dry run only. Re-run with --apply to restore access.");
    return;
  }

  await dbBase.$transaction([
    dbBase.user.update({
      where: { id: user.id },
      data: {
        bannedAt: null,
        bannedReason: null,
        bannedByUserId: null,
        failedLoginAttempts: 0,
        lockoutUntil: null,
      },
    }),
    dbBase.refreshToken.deleteMany({ where: { userId: user.id } }),
    dbBase.auditLog.create({
      data: {
        type: "PLATFORM_USER_UNBANNED",
        userId: null,
        metadata: JSON.stringify({
          targetUserId: user.id,
          source: "maintenance_script",
          clearedAdminBan: hasBan,
          clearedLoginRestriction: hasLoginRestriction,
          previousFailedLoginAttempts: user.failedLoginAttempts,
        }),
      },
    }),
  ]);

  console.log("Access restored. Existing refresh sessions were revoked.");
}

main()
  .catch((error: unknown) => {
    console.error("Access recovery failed.", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await dbBase.$disconnect();
  });
