import "dotenv/config";
import { unlink } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { dbBase } from "../db.js";

const CONFIRMATION = "DELETE_NON_OWNER_SERVERS";

type Args = {
  ownerEmail: string | null;
  apply: boolean;
  confirmation: string | null;
};

function parseArgs(argv: string[]): Args {
  const value = (prefix: string) =>
    argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) ?? null;
  return {
    ownerEmail: value("--owner-email=")?.trim().toLowerCase() ?? null,
    apply: argv.includes("--apply"),
    confirmation: value("--confirm="),
  };
}

function collectUploadUrls(value: string | null, urls: Set<string>): void {
  if (!value) return;
  for (const match of value.matchAll(/\/uploads\/[A-Za-z0-9_./%+@-]+/g)) {
    urls.add(match[0]);
  }
}

export function resolveLocalUploadPath(uploadUrl: string, uploadsDir: string): string | null {
  const pathname = uploadUrl.split(/[?#]/, 1)[0];
  if (!pathname.startsWith("/uploads/")) return null;

  let relativePath: string;
  try {
    relativePath = decodeURIComponent(pathname.slice("/uploads/".length));
  } catch {
    return null;
  }
  if (!relativePath || relativePath.includes("\0")) return null;

  const root = path.resolve(uploadsDir);
  const candidate = path.resolve(root, relativePath);
  if (candidate === root || !candidate.startsWith(`${root}${path.sep}`)) return null;
  return candidate;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (!args.ownerEmail) {
    throw new Error("Required: --owner-email=<email>");
  }
  if (args.apply && args.confirmation !== CONFIRMATION) {
    throw new Error(`Apply requires --confirm=${CONFIRMATION}`);
  }

  const retainedOwner = await dbBase.user.findUnique({
    where: { email: args.ownerEmail },
    select: {
      id: true,
      email: true,
      displayName: true,
      isPlatformOwner: true,
      bannedAt: true,
      deletedAt: true,
    },
  });
  if (!retainedOwner) throw new Error(`User not found: ${args.ownerEmail}`);
  if (!retainedOwner.isPlatformOwner || retainedOwner.bannedAt || retainedOwner.deletedAt) {
    throw new Error("Retained account must be an active platform owner");
  }

  const [retainedServers, removedServers] = await Promise.all([
    dbBase.server.findMany({
      where: { ownerId: retainedOwner.id },
      select: { id: true, name: true, ownerId: true },
      orderBy: { createdAt: "asc" },
    }),
    dbBase.server.findMany({
      where: { ownerId: { not: retainedOwner.id } },
      select: {
        id: true,
        name: true,
        icon: true,
        banner: true,
        owner: { select: { email: true } },
        _count: { select: { members: true, channels: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);
  if (retainedServers.length === 0) {
    throw new Error("Refusing cleanup: retained owner has no server");
  }

  console.log(`Retained owner: ${retainedOwner.email} (${retainedOwner.displayName})`);
  console.log(`Retained servers (${retainedServers.length}):`);
  for (const server of retainedServers) console.log(`  KEEP ${server.id}  ${server.name}`);
  console.log(`Servers selected for deletion (${removedServers.length}):`);
  for (const server of removedServers) {
    console.log(
      `  DELETE ${server.id}  ${server.name}  owner=${server.owner.email}  members=${server._count.members} channels=${server._count.channels}`,
    );
  }
  if (removedServers.length === 0) {
    console.log("Nothing to delete.");
    return;
  }

  const removedIds = removedServers.map((server) => server.id);
  const [attachments, emojis, trainingVideos, tableCells] = await Promise.all([
    dbBase.attachment.findMany({
      where: { message: { channel: { serverId: { in: removedIds } } } },
      select: { url: true, thumbnailUrl: true },
    }),
    dbBase.emoji.findMany({
      where: { serverId: { in: removedIds } },
      select: { url: true },
    }),
    dbBase.trainingVideo.findMany({
      where: { serverId: { in: removedIds } },
      select: { url: true },
    }),
    dbBase.tableCell.findMany({
      where: { row: { table: { serverId: { in: removedIds } } } },
      select: { value: true },
    }),
  ]);

  const uploadUrls = new Set<string>();
  for (const server of removedServers) {
    collectUploadUrls(server.icon, uploadUrls);
    collectUploadUrls(server.banner, uploadUrls);
  }
  for (const attachment of attachments) {
    collectUploadUrls(attachment.url, uploadUrls);
    collectUploadUrls(attachment.thumbnailUrl, uploadUrls);
  }
  for (const emoji of emojis) collectUploadUrls(emoji.url, uploadUrls);
  for (const video of trainingVideos) collectUploadUrls(video.url, uploadUrls);
  for (const cell of tableCells) collectUploadUrls(cell.value, uploadUrls);

  const uploadsDir = process.env.UPLOADS_DIR ?? path.resolve(process.cwd(), "../../uploads");
  const uploadPaths = [...uploadUrls]
    .map((url) => resolveLocalUploadPath(url, uploadsDir))
    .filter((filePath): filePath is string => filePath !== null);
  console.log(`Server-scoped upload files selected: ${uploadPaths.length}`);

  if (!args.apply) {
    console.log(
      `DRY RUN only. Re-run with --apply --confirm=${CONFIRMATION} after a verified database backup.`,
    );
    return;
  }

  const result = await dbBase.$transaction(async (tx) => {
    const deleted = await tx.server.deleteMany({
      where: { id: { in: removedIds }, ownerId: { not: retainedOwner.id } },
    });
    if (deleted.count !== removedIds.length) {
      throw new Error(
        `Concurrent change detected: expected ${removedIds.length} deletes, got ${deleted.count}`,
      );
    }
    return deleted;
  });

  let removedFiles = 0;
  let missingFiles = 0;
  let failedFiles = 0;
  for (const filePath of uploadPaths) {
    try {
      await unlink(filePath);
      removedFiles += 1;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        missingFiles += 1;
        continue;
      }
      failedFiles += 1;
      console.error(`Failed to remove upload: ${filePath}`, error);
    }
  }
  console.log(
    `Cleanup complete: servers=${result.count}, uploadFiles=${removedFiles}, alreadyMissing=${missingFiles}, failedFiles=${failedFiles}`,
  );
  if (failedFiles > 0) {
    throw new Error(
      `Database cleanup succeeded, but ${failedFiles} upload file(s) still require manual removal`,
    );
  }
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  main()
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await dbBase.$disconnect();
    });
}
