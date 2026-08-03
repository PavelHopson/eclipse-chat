import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const BASELINE = {
  id: "baseline",
  title: "Baseline supply-chain gate",
  skills: [
    "implementing-secret-scanning-with-gitleaks",
    "implementing-devsecops-security-scanning",
    "analyzing-sbom-for-supply-chain-vulnerabilities",
  ],
  checks: ["Gitleaks", "CodeQL", "npm audit (High+)", "CycloneDX SBOM"],
};

export const SECURITY_PROFILES = [
  {
    id: "identity-access",
    title: "Identity and access",
    patterns: [
      /apps\/server\/src\/auth(?:\/|\.tsx?$)/,
      /apps\/server\/src\/routes\/.*\.tsx?$/,
      /apps\/server\/src\/lib\/(permissions|realtimeAccess)/,
      /apps\/server\/prisma\//,
    ],
    skills: ["testing-api-for-broken-object-level-authorization"],
    checks: ["BOLA/IDOR", "role and workspace isolation", "session/JWT boundaries"],
  },
  {
    id: "realtime-voice",
    title: "Realtime and voice",
    patterns: [
      /apps\/server\/src\/(index|realtime|presence|voicePresence)\.ts$/,
      /apps\/server\/src\/routes\/(voice|threads|messages|personalDigest)\.ts$/,
      /apps\/web\/src\/(hooks\/useVoice|components\/VoiceRoom|lib\/socket)\.tsx?$/,
    ],
    skills: ["testing-websocket-api-security"],
    checks: ["Socket.IO room authorization", "cross-workspace event isolation", "voice presence privacy"],
  },
  {
    id: "uploads-media",
    title: "Uploads and media",
    patterns: [
      /apps\/server\/src\/(attachments|routes\/(attachments|voiceNotes|embeds))\.ts$/,
      /apps\/web\/src\/components\/(Attachments|Avatar|Media)/,
      /uploads|server-icons|server-banners/,
    ],
    skills: ["implementing-devsecops-security-scanning"],
    checks: ["MIME and magic bytes", "path traversal", "size limits and image decoding"],
  },
  {
    id: "ai-mcp",
    title: "AI, agents and MCP",
    patterns: [
      /apps\/server\/src\/ai\//,
      /apps\/server\/src\/routes\/(bots|memory|composio|integrations)(?:\/|\.tsx?$)/,
      /docs\/AI-/,
    ],
    skills: ["auditing-mcp-servers-for-tool-poisoning", "assessing-vector-and-embedding-weaknesses"],
    checks: ["prompt/tool boundary", "provider secret handling", "memory visibility and provenance"],
  },
  {
    id: "release-infrastructure",
    title: "Release and infrastructure",
    patterns: [
      /^\.github\/workflows\//,
      /^deploy\//,
      /(^|\/)package(-lock)?\.json$/,
      /Cargo\.(toml|lock)$/,
      /src-tauri|apps\/android/,
    ],
    skills: ["implementing-devsecops-security-scanning", "analyzing-sbom-for-supply-chain-vulnerabilities"],
    checks: ["pinned CI actions", "artifact integrity", "dependency and release provenance"],
  },
];

function normalizeFile(file) {
  return file.trim().replaceAll("\\", "/").replace(/^\.\//, "");
}

export function selectSecurityProfiles(files) {
  const normalized = [...new Set(files.map(normalizeFile).filter(Boolean))];
  const selected = SECURITY_PROFILES.filter((profile) =>
    normalized.some((file) => profile.patterns.some((pattern) => pattern.test(file))),
  );
  return { files: normalized, profiles: [BASELINE, ...selected] };
}

export function renderMarkdown(selection) {
  const lines = [
    "# Eclipse Chat security profile",
    "",
    `Changed files: **${selection.files.length}**`,
    "",
    "## Required profiles",
  ];
  for (const profile of selection.profiles) {
    lines.push(`- **${profile.title}** (\`${profile.id}\`)`);
  }
  lines.push("", "## Required skills", ...[
    ...new Set(selection.profiles.flatMap((profile) => profile.skills)),
  ].map((skill) => `- \`${skill}\``));
  lines.push("", "## Evidence required", ...[
    ...new Set(selection.profiles.flatMap((profile) => profile.checks)),
  ].map((check) => `- ${check}`));
  if (selection.files.length > 0) {
    lines.push("", "<details><summary>Changed files</summary>", "", ...selection.files.map((file) => `- \`${file}\``), "", "</details>");
  }
  return `${lines.join("\n")}\n`;
}

function assertGitRef(ref, label) {
  if (!/^[A-Za-z0-9._/@{}^~:+-]{1,200}$/.test(ref)) {
    throw new Error(`Invalid ${label} git ref`);
  }
  return ref;
}

function changedFiles(base, head) {
  const range = `${assertGitRef(base, "base")}...${assertGitRef(head, "head")}`;
  const output = execFileSync("git", ["diff", "--name-only", "--diff-filter=ACMRTUXB", range], {
    encoding: "utf8",
  });
  return output.split(/\r?\n/).filter(Boolean);
}

function parseArgs(argv) {
  const options = { files: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--file") options.files.push(argv[++index] ?? "");
    else if (arg === "--base") options.base = argv[++index];
    else if (arg === "--head") options.head = argv[++index];
    else if (arg === "--format") options.format = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const files = options.files.length > 0
    ? options.files
    : changedFiles(options.base ?? "HEAD^", options.head ?? "HEAD");
  const selection = selectSecurityProfiles(files);
  if (options.format === "json") process.stdout.write(`${JSON.stringify(selection, null, 2)}\n`);
  else process.stdout.write(renderMarkdown(selection));
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main();
}
