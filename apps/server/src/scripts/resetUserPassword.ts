import "dotenv/config";
import bcrypt from "bcryptjs";
import { dbBase } from "../db.js";
import {
  generateTemporaryPassword,
  PASSWORD_HASH_COST,
} from "../security/temporaryPassword.js";

type CliOptions = {
  email: string | null;
  apply: boolean;
};

function readOptions(argv: string[]): CliOptions {
  const emailIndex = argv.indexOf("--email");
  const email =
    emailIndex >= 0 ? argv[emailIndex + 1]?.trim().toLowerCase() : null;
  return { email: email || null, apply: argv.includes("--apply") };
}

function printUsage(): void {
  console.log(
    "Usage: npm run password:reset -- --email user@example.com [--apply]",
  );
  console.log("Without --apply the command only verifies the account.");
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
      deletedAt: true,
      deletedReason: true,
    },
  });

  if (!user) {
    console.error(`Account not found: ${options.email}`);
    process.exitCode = 3;
    return;
  }

  console.log(`Account: ${user.displayName} <${user.email}>`);
  console.log(`Admin ban: ${user.bannedAt ? "yes" : "no"}`);

  if (user.deletedAt) {
    console.error(
      `Refusing password reset: account was deleted${
        user.deletedReason ? ` (${user.deletedReason})` : ""
      }. Review the deletion audit trail first.`,
    );
    process.exitCode = 4;
    return;
  }

  if (user.bannedAt) {
    console.error(
      "Refusing password reset while the account is banned. Restore access first.",
    );
    process.exitCode = 5;
    return;
  }

  if (!options.apply) {
    console.log("Dry run only. Re-run with --apply to generate a new password.");
    return;
  }

  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await bcrypt.hash(
    temporaryPassword,
    PASSWORD_HASH_COST,
  );

  await dbBase.$transaction([
    dbBase.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        failedLoginAttempts: 0,
        lockoutUntil: null,
      },
    }),
    dbBase.refreshToken.deleteMany({ where: { userId: user.id } }),
    dbBase.auditLog.create({
      data: {
        type: "PLATFORM_USER_PASSWORD_RESET",
        userId: null,
        metadata: JSON.stringify({
          targetUserId: user.id,
          source: "maintenance_script",
          sessionsRevoked: true,
        }),
      },
    }),
  ]);

  console.log("Password reset completed. This temporary password is shown once:");
  console.log(temporaryPassword);
  console.log("Sign in and replace it immediately in profile settings.");
}

main()
  .catch((error: unknown) => {
    console.error("Password reset failed.", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await dbBase.$disconnect();
  });
