import { normalizeGitHubRepository } from "./github.js";
import { decryptSecret } from "../../security/twoFactor.js";

export type GitHubIntegrationConfig = { repository: string | null };

export function parseStoredIntegrationJson(
  value: string,
): Record<string, unknown> | null {
  const candidates = [value];
  try {
    candidates.push(decryptSecret(value));
  } catch {
    // Plaintext legacy rows are handled by the first candidate.
  }

  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      const parsed = JSON.parse(candidate) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // Try the next supported storage format.
    }
  }
  return null;
}

/** Returns only the public repository identifier, never the stored config. */
export function parseGitHubIntegrationConfig(
  value: string,
): GitHubIntegrationConfig {
  const parsed = parseStoredIntegrationJson(value);
  return { repository: normalizeGitHubRepository(parsed?.repository) };
}
