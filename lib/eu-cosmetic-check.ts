import cosmeticDb from '../data/eu-cosmetic-restrictions.json';
import type { AdditiveStatus } from '../constants/theme';
import type { CheckedIngredient, EuCheckResult } from './eu-check';

type CosmeticIngredientRecord = {
  name: string;
  status: AdditiveStatus;
  category: string;
  annex: string | null;
  notes?: string;
  searchTerms: string[];
};

type CosmeticDb = {
  ingredients: Record<string, CosmeticIngredientRecord>;
};

const db = cosmeticDb as unknown as CosmeticDb;

function checkInciText(text: string): CheckedIngredient[] {
  const lower = text.toLowerCase();
  const found: CheckedIngredient[] = [];
  const seen = new Set<string>();

  for (const [key, record] of Object.entries(db.ingredients)) {
    if (seen.has(key)) continue;
    if (record.searchTerms.some((t) => lower.includes(t.toLowerCase()))) {
      seen.add(key);
      found.push({
        key,
        name: record.name,
        status: record.status,
        category: record.category,
        notes: record.notes,
        annex: record.annex ?? undefined,
        isENumber: false,
      });
    }
  }

  return found;
}

export function runEuCosmeticCheck(ingredientsText: string | null): EuCheckResult {
  const hasAnyIngredientData = Boolean(ingredientsText && ingredientsText.trim().length > 0);
  const all = ingredientsText ? checkInciText(ingredientsText) : [];

  const result: EuCheckResult = {
    banned: all.filter((i) => i.status === 'banned'),
    restricted: all.filter((i) => i.status === 'restricted'),
    warning: all.filter((i) => i.status === 'warning'),
    approved: all.filter((i) => i.status === 'approved'),
    unknown: all.filter((i) => i.status === 'unknown'),
    totalFlagged: 0,
    hasAnyIngredientData,
  };

  if (!hasAnyIngredientData) {
    result.unknown.push({
      key: 'ingredients_unavailable',
      name: 'Ingredients could not be found',
      status: 'unknown' as AdditiveStatus,
      category: 'metadata',
      notes: 'No INCI ingredient list was returned by the source.',
      isENumber: false,
    });
  }

  result.totalFlagged = result.banned.length + result.restricted.length + result.warning.length;

  return result;
}

export function scoreCosmeticProduct(result: EuCheckResult): number {
  return Math.max(
    0,
    100 - result.banned.length * 40 - result.restricted.length * 20 - result.warning.length * 10
  );
}
