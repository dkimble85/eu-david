import { parseProduct } from './openfoodfacts';
import { runEuCheck, scoreProduct } from './eu-check';
import type { OpenFoodFactsProduct } from './openfoodfacts';
import type { EuCheckResult } from './eu-check';

const BASE_URL = 'https://world.openfoodfacts.org/api/v2';
const USER_AGENT = 'EUDavid/1.0 (personal project; contact@eudavid.app)';
const FIELDS = [
  'code',
  'product_name',
  'brands',
  'image_url',
  'ingredients_text',
  'additives_tags',
  'allergens_tags',
  'ingredients_analysis_tags',
  'categories_tags',
  'stores_tags',
].join(',');

export type Category = {
  label: string;
  tag: string;
  emoji: string;
};

export const CATEGORIES: Category[] = [
  { label: 'Grocery', tag: 'en:groceries', emoji: '🧾' },
  { label: 'Snacks', tag: 'en:snacks', emoji: '🍿' },
  { label: 'Beverages', tag: 'en:beverages', emoji: '🥤' },
  { label: 'Dairy', tag: 'en:dairies', emoji: '🧀' },
  { label: 'Cereals', tag: 'en:cereals-and-potatoes', emoji: '🥣' },
  { label: 'Bread', tag: 'en:breads', emoji: '🍞' },
  { label: 'Sauces', tag: 'en:sauces', emoji: '🫙' },
  { label: 'Chocolate', tag: 'en:chocolates', emoji: '🍫' },
  { label: 'Chips', tag: 'en:chips-and-crisps', emoji: '🥔' },
  { label: 'Yogurts', tag: 'en:yogurts', emoji: '🥛' },
  { label: 'Pasta', tag: 'en:pasta', emoji: '🍝' },
];

export type Store = {
  label: string;
  tag: string;
  emoji: string;
  aliases?: string[];
};

export const US_STORES: Store[] = [
  { label: 'Target', tag: 'target', emoji: '🎯', aliases: ['target-stores'] },
  { label: 'Walmart', tag: 'walmart', emoji: '🛒', aliases: ['wal-mart'] },
  { label: 'Aldi', tag: 'aldi', emoji: '🏪', aliases: ['aldi-us', 'aldis'] },
  { label: 'Costco', tag: 'costco', emoji: '📦', aliases: ['costco-wholesale'] },
  { label: "Kohl's", tag: 'kohl-s', emoji: '🏬', aliases: ['kohls'] },
  { label: 'Fresh Thyme', tag: 'fresh-thyme-market', emoji: '🌿', aliases: ['fresh-thyme'] },
  { label: "Trader Joe's", tag: 'trader-joes', emoji: '🧺', aliases: ['trader-joe-s'] },
  { label: 'Schnucks', tag: 'schnucks', emoji: '🛍️' },
];

export type ScoreFilter = 'all' | 'good' | 'excellent' | 'perfect';

export const SCORE_FILTERS: { key: ScoreFilter; label: string; min: number }[] = [
  { key: 'all', label: 'All', min: 0 },
  { key: 'good', label: 'Good  60+', min: 60 },
  { key: 'excellent', label: 'Excellent 80+', min: 80 },
  { key: 'perfect', label: 'Perfect 100', min: 100 },
];

export type ScoredProduct = {
  product: OpenFoodFactsProduct;
  result: EuCheckResult;
  score: number;
};

type SearchResponseProduct = Parameters<typeof parseProduct>[0];

function normalizeStoreTag(tag: string): string {
  return tag
    .toLowerCase()
    .replace(/^[a-z]{2}:/, '')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function getStoreMatchers(store: Store): string[] {
  return [store.tag, ...(store.aliases ?? [])].map(normalizeStoreTag);
}

export function productMatchesStore(productStores: string[], storeTag: string): boolean {
  const store = US_STORES.find((entry) => entry.tag === storeTag);
  if (!store) return false;

  const productTags = productStores.map(normalizeStoreTag);
  const matchers = getStoreMatchers(store);

  return productTags.some((tag) =>
    matchers.some((matcher) => tag === matcher || tag.startsWith(`${matcher}-`))
  );
}

export function productMatchesAnyUsStore(productStores: string[]): boolean {
  return US_STORES.some((store) => productMatchesStore(productStores, store.tag));
}

export function getMatchingUsStore(productStores: string[]): Store | null {
  return US_STORES.find((store) => productMatchesStore(productStores, store.tag)) ?? null;
}

function productHasGlutenAllergen(product: OpenFoodFactsProduct): boolean {
  return product.allergens.some((allergen) => allergen.includes('gluten'));
}

export async function fetchRecommendations(
  categoryTag: string | null,
  searchQuery: string,
  scoreFilter: ScoreFilter,
  storeTag: string | null,
  glutenFreeOnly = false,
  countriesTag: string | null = 'en:united-states'
): Promise<ScoredProduct[]> {
  const params = new URLSearchParams({
    fields: FIELDS,
    page_size: '40',
    sort_by: 'unique_scans_n',
  });
  if (countriesTag) params.set('countries_tags', countriesTag);

  if (categoryTag) params.set('categories_tags', categoryTag);
  if (searchQuery.trim()) params.set('search_terms', searchQuery.trim());
  if (storeTag) params.set('stores_tags', storeTag);

  const res = await fetch(`${BASE_URL}/search?${params}`, {
    headers: { 'User-Agent': USER_AGENT },
  });
  if (!res.ok) throw new Error(`Recommendations search failed: ${res.status}`);

  const data = await res.json();
  const raw = (data.products ?? []) as SearchResponseProduct[];
  const minScore = SCORE_FILTERS.find((f) => f.key === scoreFilter)?.min ?? 0;

  const scored: ScoredProduct[] = [];

  for (const p of raw) {
    if (!p.product_name || !p.code) continue;

    const product = parseProduct(p);
    if (storeTag && !productMatchesStore(product.stores, storeTag)) continue;
    if (
      searchQuery.trim() &&
      !storeTag &&
      product.stores.length > 0 &&
      !productMatchesAnyUsStore(product.stores)
    ) {
      continue;
    }
    if (glutenFreeOnly && productHasGlutenAllergen(product)) continue;

    const result = runEuCheck(product.eNumbers, product.ingredientsText);

    const knownFlagged = result.banned.length + result.restricted.length + result.warning.length;
    const hasOnlyUnknowns =
      knownFlagged === 0 && result.unknown.length > 0 && result.approved.length === 0;
    if (categoryTag && hasOnlyUnknowns) continue;

    const score = scoreProduct(result);
    if (score < minScore) continue;

    scored.push({ product, result, score });
  }

  return scored.sort((a, b) => b.score - a.score);
}
