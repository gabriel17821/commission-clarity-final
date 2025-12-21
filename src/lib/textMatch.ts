export type MatchCandidate = { id: string; name: string };

export function normalizeText(input: string): string {
  return (input || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function tokens(s: string): string[] {
  const n = normalizeText(s);
  if (!n) return [];
  return n.split(" ").filter(Boolean);
}

function jaccard(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const A = new Set(a);
  const B = new Set(b);
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  const union = A.size + B.size - inter;
  return union === 0 ? 0 : inter / union;
}

function includesBonus(aNorm: string, bNorm: string): number {
  // bonus when one contains the other (helps with truncated names)
  if (!aNorm || !bNorm) return 0;
  if (aNorm === bNorm) return 0.5;
  if (aNorm.includes(bNorm) || bNorm.includes(aNorm)) return 0.25;
  return 0;
}

export function bestFuzzyMatch<T extends MatchCandidate>(
  input: string,
  candidates: T[],
  options?: {
    minScore?: number;
  }
): { match?: T; score: number } {
  const minScore = options?.minScore ?? 0.62;

  const inputNorm = normalizeText(input);
  const inputTokens = tokens(inputNorm);
  if (!inputNorm) return { match: undefined, score: 0 };

  let best: { match?: T; score: number } = { match: undefined, score: 0 };

  for (const c of candidates) {
    const cNorm = normalizeText(c.name);
    if (!cNorm) continue;

    // Base token overlap + substring bonus
    const score =
      jaccard(inputTokens, tokens(cNorm)) + includesBonus(inputNorm, cNorm);

    if (score > best.score) best = { match: c, score };
  }

  if (!best.match || best.score < minScore) return { match: undefined, score: best.score };
  return best;
}
