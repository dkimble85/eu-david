import foodDb from '@/data/eu-additives.json';
import cosmeticDb from '@/data/eu-cosmetic-restrictions.json';
import type { AdditiveStatus } from '@/constants/theme';

type FoodAdditiveRecord = {
  name: string;
  status: AdditiveStatus;
  category: string;
  notes?: string;
  bannedSince?: string;
};

type FoodNonEnumberRecord = {
  name: string;
  status: AdditiveStatus;
  category: string;
  notes?: string;
  searchTerms: string[];
};

type FoodDb = {
  additives: Record<string, FoodAdditiveRecord>;
  nonEnumber?: Record<string, FoodNonEnumberRecord>;
};

type CosmeticRecord = {
  name: string;
  status: AdditiveStatus;
  category: string;
  notes?: string;
  annex?: string | null;
};

type CosmeticDb = {
  ingredients: Record<string, CosmeticRecord>;
};

export type RegulatedIngredient = {
  id: string;
  name: string;
  status: AdditiveStatus;
  category: string;
  source: 'food' | 'cosmetic';
  euCode: string;
  notes: string | null;
  bannedSince: string | null;
};

const food = foodDb as unknown as FoodDb;
const cosmetic = cosmeticDb as unknown as CosmeticDb;

function titleizeCategory(value: string): string {
  return value
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

export function getRegulatedIngredients(): RegulatedIngredient[] {
  const foodAdditives: RegulatedIngredient[] = Object.entries(food.additives).map(([key, record]) => ({
    id: `food:${key}`,
    name: record.name,
    status: record.status,
    category: titleizeCategory(record.category),
    source: 'food',
    euCode: key.toUpperCase(),
    notes: record.notes ?? null,
    bannedSince: record.bannedSince ?? null,
  }));

  const foodNamedIngredients: RegulatedIngredient[] = Object.entries(food.nonEnumber ?? {}).map(
    ([key, record]) => ({
      id: `food-named:${key}`,
      name: record.name,
      status: record.status,
      category: titleizeCategory(record.category),
      source: 'food',
      euCode: 'No E-code',
      notes: record.notes ?? null,
      bannedSince: null,
    })
  );

  const cosmeticIngredients: RegulatedIngredient[] = Object.entries(cosmetic.ingredients).map(
    ([key, record]) => ({
      id: `cosmetic:${key}`,
      name: record.name,
      status: record.status,
      category: titleizeCategory(record.category),
      source: 'cosmetic',
      euCode: record.annex ? `Annex ${record.annex}` : 'No Annex',
      notes: record.notes ?? null,
      bannedSince: null,
    })
  );

  return [...foodAdditives, ...foodNamedIngredients, ...cosmeticIngredients].sort((a, b) => {
    if (a.status !== b.status) {
      const weight: Record<AdditiveStatus, number> = {
        banned: 0,
        restricted: 1,
        warning: 2,
        approved: 3,
        unknown: 4,
      };
      return weight[a.status] - weight[b.status];
    }
    return a.name.localeCompare(b.name);
  });
}
