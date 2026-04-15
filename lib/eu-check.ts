import additivesDb from '../data/eu-additives.json';
import type { AdditiveStatus } from '../constants/theme';

type AdditiveRecord = {
  name: string;
  status: AdditiveStatus;
  category: string;
  notes?: string;
  bannedSince?: string;
  commonNames?: string[];
  searchTerms?: string[];
};

type AdditivesData = {
  additives: Record<string, AdditiveRecord>;
  nonEnumber: Record<string, AdditiveRecord & { searchTerms: string[] }>;
};

const db = additivesDb as unknown as AdditivesData;

export type CheckedIngredient = {
  key: string;
  name: string;
  status: AdditiveStatus;
  category: string;
  notes?: string;
  bannedSince?: string;
  annex?: string;
  isENumber: boolean;
};

export type EuCheckResult = {
  banned: CheckedIngredient[];
  restricted: CheckedIngredient[];
  warning: CheckedIngredient[];
  approved: CheckedIngredient[];
  unknown: CheckedIngredient[];
  totalFlagged: number;
  hasAnyIngredientData: boolean;
};

function canonicalIngredientIdentity(item: Pick<CheckedIngredient, 'key' | 'name'>): string {
  const normalizedName = item.name
    .toLowerCase()
    .replace(/[()]/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter(Boolean);

  if (normalizedName.length === 0) {
    return item.key.toLowerCase();
  }

  return Array.from(new Set(normalizedName)).sort().join(' ');
}

function shouldReplaceIngredient(current: CheckedIngredient, next: CheckedIngredient): boolean {
  if (current.isENumber !== next.isENumber) {
    return next.isENumber;
  }

  const currentHasMoreMetadata =
    Number(Boolean(current.notes)) + Number(Boolean(current.bannedSince));
  const nextHasMoreMetadata = Number(Boolean(next.notes)) + Number(Boolean(next.bannedSince));

  return nextHasMoreMetadata > currentHasMoreMetadata;
}

function checkENumbers(eNumbers: string[]): CheckedIngredient[] {
  return eNumbers.map((code) => {
    const record = db.additives[code];
    if (record) {
      return {
        key: code,
        name: record.name,
        status: record.status,
        category: record.category,
        notes: record.notes,
        bannedSince: record.bannedSince,
        isENumber: true,
      };
    }
    return {
      key: code,
      name: code.toUpperCase(),
      status: 'unknown' as AdditiveStatus,
      category: 'unknown',
      isENumber: true,
    };
  });
}

function checkIngredientText(text: string): CheckedIngredient[] {
  const lower = text.toLowerCase();
  const found: CheckedIngredient[] = [];
  const seen = new Set<string>();

  for (const [key, record] of Object.entries(db.nonEnumber)) {
    if (seen.has(key)) continue;
    const terms = record.searchTerms ?? [];
    if (terms.some((t) => lower.includes(t.toLowerCase()))) {
      seen.add(key);
      found.push({
        key,
        name: record.name,
        status: record.status,
        category: record.category,
        notes: record.notes,
        isENumber: false,
      });
    }
  }

  // Also check common name aliases in the main additives db
  for (const [key, record] of Object.entries(db.additives)) {
    if (seen.has(key)) continue;
    const aliases = record.commonNames ?? [];
    if (aliases.some((a) => lower.includes(a.toLowerCase()))) {
      seen.add(key);
      found.push({
        key,
        name: record.name,
        status: record.status,
        category: record.category,
        notes: record.notes,
        bannedSince: record.bannedSince,
        isENumber: true,
      });
    }
  }

  return found;
}

/**
 * Score a product 0–100 based on known additive statuses only.
 * Unknown additives are ignored (not penalised, not rewarded).
 */
export function scoreProduct(result: EuCheckResult): number {
  return Math.max(
    0,
    100 - result.banned.length * 40 - result.restricted.length * 20 - result.warning.length * 10
  );
}

export function runEuCheck(eNumbers: string[], ingredientsText: string | null): EuCheckResult {
  const hasAnyIngredientData =
    eNumbers.length > 0 || Boolean(ingredientsText && ingredientsText.trim().length > 0);
  const fromENumbers = checkENumbers(eNumbers);
  const fromText = ingredientsText ? checkIngredientText(ingredientsText) : [];

  // Merge, dedupe by canonical additive identity so variants like
  // "tert-Butylhydroquinone (TBHQ)" and "TBHQ (tert-Butylhydroquinone)"
  // collapse into a single finding.
  const allByIdentity = new Map<string, CheckedIngredient>();
  for (const item of [...fromENumbers, ...fromText]) {
    const identity = canonicalIngredientIdentity(item);
    const existing = allByIdentity.get(identity);

    if (!existing || shouldReplaceIngredient(existing, item)) {
      allByIdentity.set(identity, item);
    }
  }

  const all = Array.from(allByIdentity.values());

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
      notes: 'No ingredients text or additive tags were returned by the source.',
      isENumber: false,
    });
  }

  result.totalFlagged = result.banned.length + result.restricted.length + result.warning.length;

  return result;
}
