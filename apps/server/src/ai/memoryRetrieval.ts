export type MemorySearchCandidate = {
  id: string;
  title: string;
  content: string | null;
  tags: string[];
};

export type RankedMemoryCandidate<T extends MemorySearchCandidate> = T & {
  lexicalScore: number;
};

const MAX_QUERY_TOKENS = 8;

function normalize(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("ru-RU")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export function tokenizeRetrievalQuery(query: string): string[] {
  const tokens = normalize(query)
    .split(/\s+/)
    .filter((token) => token.length >= 2);
  return Array.from(new Set(tokens)).slice(0, MAX_QUERY_TOKENS);
}

export function parseMemoryTags(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 8);
  } catch {
    return [];
  }
}

export function scoreMemoryLexical(
  query: string,
  candidate: MemorySearchCandidate,
): number {
  const normalizedQuery = normalize(query);
  const tokens = tokenizeRetrievalQuery(query);
  if (!normalizedQuery || tokens.length === 0) return 0;

  const title = normalize(candidate.title);
  const tags = normalize(candidate.tags.join(" "));
  const content = normalize(candidate.content ?? "");

  let score = 0;
  if (title === normalizedQuery) score += 0.55;
  else if (title.includes(normalizedQuery)) score += 0.32;
  if (tags.includes(normalizedQuery)) score += 0.22;
  if (content.includes(normalizedQuery)) score += 0.12;

  let matchedWeight = 0;
  for (const token of tokens) {
    if (title.includes(token)) matchedWeight += 4;
    if (tags.includes(token)) matchedWeight += 3;
    if (content.includes(token)) matchedWeight += 1;
  }
  score += 0.38 * (matchedWeight / (tokens.length * 8));

  const covered = tokens.filter(
    (token) => title.includes(token) || tags.includes(token) || content.includes(token),
  ).length;
  score += 0.18 * (covered / tokens.length);

  return Math.min(1, Number(score.toFixed(6)));
}

export function rankMemoryLexical<T extends MemorySearchCandidate>(
  query: string,
  candidates: T[],
  limit: number,
): Array<RankedMemoryCandidate<T>> {
  return candidates
    .map((candidate) => ({
      ...candidate,
      lexicalScore: scoreMemoryLexical(query, candidate),
    }))
    .filter((candidate) => candidate.lexicalScore > 0)
    .sort((a, b) => b.lexicalScore - a.lexicalScore)
    .slice(0, Math.max(0, limit));
}

export function combineRetrievalScores(
  lexicalScore: number,
  semanticScore: number | null,
): { score: number; matchMode: "lexical" | "semantic" | "hybrid" } {
  const semantic = semanticScore && semanticScore > 0.1 ? semanticScore : 0;
  const lexical = Math.max(0, lexicalScore);
  if (semantic > 0 && lexical > 0) {
    return {
      score: Math.min(1, Number((semantic * 0.72 + lexical * 0.28).toFixed(6))),
      matchMode: "hybrid",
    };
  }
  if (semantic > 0) {
    return { score: Number(semantic.toFixed(6)), matchMode: "semantic" };
  }
  return { score: Number(lexical.toFixed(6)), matchMode: "lexical" };
}
