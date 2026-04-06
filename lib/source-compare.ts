import type { CheckedIngredient, EuCheckResult } from './eu-check';

export type VerificationConfidence = 'high' | 'medium' | 'low';

export type SourceComparison = {
  confidence: VerificationConfidence;
  overlapRatio: number;
  sharedFlagged: CheckedIngredient[];
  offOnlyFlagged: CheckedIngredient[];
  usdaOnlyFlagged: CheckedIngredient[];
  sharedIngredients: string[];
  offOnlyIngredients: string[];
  usdaOnlyIngredients: string[];
};

function normalizeIngredientToken(token: string): string {
  return token
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenizeIngredients(text: string | null): string[] {
  if (!text) return [];
  const cleaned = text
    .toLowerCase()
    .replace(/^ingredients?:\s*/i, '')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\[[^\]]*\]/g, ' ');

  const tokens = cleaned
    .split(/[,;:.]/)
    .map(normalizeIngredientToken)
    .filter((token) => token.length >= 3);

  return Array.from(new Set(tokens));
}

function flagged(result: EuCheckResult): CheckedIngredient[] {
  return [...result.banned, ...result.restricted, ...result.warning];
}

function ingredientKey(item: CheckedIngredient): string {
  return `${item.status}:${normalizeIngredientToken(item.name)}`;
}

function dedupeFlagged(items: CheckedIngredient[]): CheckedIngredient[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = ingredientKey(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function jaccard(a: string[], b: string[]): number {
  const aSet = new Set(a);
  const bSet = new Set(b);
  const union = new Set([...aSet, ...bSet]);
  if (union.size === 0) return 0;

  let intersection = 0;
  for (const item of aSet) {
    if (bSet.has(item)) intersection += 1;
  }
  return intersection / union.size;
}

export function compareSources(
  offIngredientsText: string | null,
  usdaIngredientsText: string | null,
  offResult: EuCheckResult,
  usdaResult: EuCheckResult
): SourceComparison {
  const offFlagged = dedupeFlagged(flagged(offResult));
  const usdaFlagged = dedupeFlagged(flagged(usdaResult));

  const usdaFlagKeys = new Set(usdaFlagged.map(ingredientKey));
  const offFlagKeys = new Set(offFlagged.map(ingredientKey));

  const sharedFlagged = offFlagged.filter((item) => usdaFlagKeys.has(ingredientKey(item)));
  const offOnlyFlagged = offFlagged.filter((item) => !usdaFlagKeys.has(ingredientKey(item)));
  const usdaOnlyFlagged = usdaFlagged.filter((item) => !offFlagKeys.has(ingredientKey(item)));

  const offIngredients = tokenizeIngredients(offIngredientsText);
  const usdaIngredients = tokenizeIngredients(usdaIngredientsText);

  const usdaIngredientsSet = new Set(usdaIngredients);
  const offIngredientsSet = new Set(offIngredients);

  const sharedIngredients = offIngredients.filter((item) => usdaIngredientsSet.has(item));
  const offOnlyIngredients = offIngredients.filter((item) => !usdaIngredientsSet.has(item));
  const usdaOnlyIngredients = usdaIngredients.filter((item) => !offIngredientsSet.has(item));

  const overlapRatio = jaccard(offIngredients, usdaIngredients);

  let confidence: VerificationConfidence = 'low';
  if (sharedFlagged.length >= 2 || overlapRatio >= 0.5) confidence = 'high';
  else if (sharedFlagged.length >= 1 || overlapRatio >= 0.25) confidence = 'medium';

  return {
    confidence,
    overlapRatio,
    sharedFlagged,
    offOnlyFlagged,
    usdaOnlyFlagged,
    sharedIngredients,
    offOnlyIngredients,
    usdaOnlyIngredients,
  };
}
