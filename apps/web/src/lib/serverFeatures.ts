export const MAX_SERVER_FEATURES = 5;
export const MAX_SERVER_FEATURE_LENGTH = 40;

export function cleanServerFeatures(features: string[]): string[] {
  return features
    .map((feature) => feature.trim())
    .filter(Boolean)
    .map((feature) => feature.slice(0, MAX_SERVER_FEATURE_LENGTH))
    .slice(0, MAX_SERVER_FEATURES);
}

export function encodeServerFeatures(features: string[]): string | null {
  const cleaned = cleanServerFeatures(features);
  return cleaned.length > 0 ? JSON.stringify(cleaned) : null;
}

export function parseServerFeatures(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return cleanServerFeatures(parsed.filter((item): item is string => typeof item === "string"));
  } catch {
    return [];
  }
}
