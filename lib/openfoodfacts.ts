const BASE_URL = 'https://world.openfoodfacts.org/api/v2';
const USER_AGENT = 'EUDavid/1.0 (personal project; contact@eudavid.app)';

const FIELDS = [
  'product_name',
  'brands',
  'image_url',
  'ingredients_text',
  'additives_tags',
  'allergens_tags',
  'ingredients_analysis_tags',
  'categories_tags',
  'countries_tags',
  'stores_tags',
  'nutriscore_grade',
  'nutriscore_score',
  'nutrition_grades',
  'nova_group',
  'ecoscore_grade',
  'ecoscore_score',
  'nutriments',
  'nutrition_data_per',
  'serving_size',
  'code',
].join(',');

export type ProductMetaScores = {
  nutriScoreGrade: string | null;
  nutriScoreScore: number | null;
  ecoScoreGrade: string | null;
  ecoScoreScore: number | null;
  novaGroup: number | null;
};

export type ProductNutritionFacts = {
  basis: string | null;
  servingSize: string | null;
  calories: string | null;
  fat: string | null;
  saturatedFat: string | null;
  carbohydrate: string | null;
  sugar: string | null;
  fiber: string | null;
  protein: string | null;
  sodium: string | null;
};

export type OpenFoodFactsProduct = {
  barcode: string | null;
  name: string;
  brand: string | null;
  imageUrl: string | null;
  ingredientsText: string | null;
  eNumbers: string[];
  allergens: string[];
  analysisFlags: string[];
  categoriesTags: string[];
  stores: string[];
  metaScores: ProductMetaScores;
  nutritionFacts: ProductNutritionFacts | null;
};

type RawOpenFoodFactsProduct = {
  code?: string;
  product_name?: string;
  brands?: string;
  image_url?: string;
  ingredients_text?: string;
  additives_tags?: string[];
  allergens_tags?: string[];
  ingredients_analysis_tags?: string[];
  categories_tags?: string[];
  stores_tags?: string[];
  nutriscore_grade?: string;
  nutriscore_score?: number;
  nutrition_grades?: string;
  nova_group?: number;
  ecoscore_grade?: string;
  ecoscore_score?: number;
  nutrition_data_per?: string;
  serving_size?: string;
  nutriments?: Record<string, number | string | undefined>;
};

function parseENumber(tag: string): string {
  // Tags come as "en:e322" or "en:e322i" — strip the "en:" prefix
  return tag.replace(/^en:/, '').toLowerCase();
}

function parseAllergen(tag: string): string {
  return tag.replace(/^en:/, '').replace(/-/g, ' ');
}

function formatNutritionValue(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Number.isInteger(value) ? String(value) : value.toFixed(1);
  }
  if (typeof value === 'string' && value.trim()) return value.trim();
  return null;
}

function parseNutritionFacts(
  nutriments?: Record<string, number | string | undefined>,
  nutritionDataPer?: string,
  servingSize?: string
): ProductNutritionFacts | null {
  if (!nutriments) return null;

  const facts: ProductNutritionFacts = {
    basis: nutritionDataPer ?? null,
    servingSize: servingSize ?? null,
    calories: formatNutritionValue(nutriments['energy-kcal_100g'] ?? nutriments['energy-kcal']),
    fat: formatNutritionValue(nutriments.fat_100g ?? nutriments.fat),
    saturatedFat: formatNutritionValue(
      nutriments['saturated-fat_100g'] ?? nutriments['saturated-fat']
    ),
    carbohydrate: formatNutritionValue(
      nutriments.carbohydrates_100g ?? nutriments.carbohydrates
    ),
    sugar: formatNutritionValue(nutriments.sugars_100g ?? nutriments.sugars),
    fiber: formatNutritionValue(nutriments.fiber_100g ?? nutriments.fiber),
    protein: formatNutritionValue(nutriments.proteins_100g ?? nutriments.proteins),
    sodium: formatNutritionValue(nutriments.sodium_100g ?? nutriments.sodium),
  };

  const hasAnyValue = Object.values(facts).some((value) => value !== null);
  return hasAnyValue ? facts : null;
}

export async function getProductByBarcode(barcode: string): Promise<OpenFoodFactsProduct | null> {
  const res = await fetch(`${BASE_URL}/product/${barcode}.json?fields=${FIELDS}`, {
    headers: { 'User-Agent': USER_AGENT },
  });

  // Genuine not-found — not an error
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`OpenFoodFacts responded with ${res.status}`);

  const data = await res.json();
  if (data.status === 0 || !data.product) return null;

  const p = data.product;
  return {
    barcode,
    name: p.product_name || 'Unknown Product',
    brand: p.brands || null,
    imageUrl: p.image_url || null,
    ingredientsText: p.ingredients_text || null,
    eNumbers: (p.additives_tags || []).map(parseENumber),
    allergens: (p.allergens_tags || []).map(parseAllergen),
    analysisFlags: p.ingredients_analysis_tags || [],
    categoriesTags: p.categories_tags || [],
    stores: p.stores_tags || [],
    metaScores: {
      nutriScoreGrade: p.nutriscore_grade ?? p.nutrition_grades ?? null,
      nutriScoreScore:
        typeof p.nutriscore_score === 'number' ? p.nutriscore_score : null,
      ecoScoreGrade: p.ecoscore_grade ?? null,
      ecoScoreScore: typeof p.ecoscore_score === 'number' ? p.ecoscore_score : null,
      novaGroup: typeof p.nova_group === 'number' ? p.nova_group : null,
    },
    nutritionFacts: parseNutritionFacts(p.nutriments, p.nutrition_data_per, p.serving_size),
  };
}

export function parseProduct(p: RawOpenFoodFactsProduct): OpenFoodFactsProduct {
  return {
    barcode: p.code || null,
    name: p.product_name || 'Unknown Product',
    brand: p.brands || null,
    imageUrl: p.image_url || null,
    ingredientsText: p.ingredients_text || null,
    eNumbers: (p.additives_tags || []).map(parseENumber),
    allergens: (p.allergens_tags || []).map(parseAllergen),
    analysisFlags: p.ingredients_analysis_tags || [],
    categoriesTags: p.categories_tags || [],
    stores: p.stores_tags || [],
    metaScores: {
      nutriScoreGrade: p.nutriscore_grade ?? p.nutrition_grades ?? null,
      nutriScoreScore:
        typeof p.nutriscore_score === 'number' ? p.nutriscore_score : null,
      ecoScoreGrade: p.ecoscore_grade ?? null,
      ecoScoreScore: typeof p.ecoscore_score === 'number' ? p.ecoscore_score : null,
      novaGroup: typeof p.nova_group === 'number' ? p.nova_group : null,
    },
    nutritionFacts: parseNutritionFacts(p.nutriments, p.nutrition_data_per, p.serving_size),
  };
}

export async function getAlternatives(
  currentBarcode: string,
  categoriesTags: string[]
): Promise<OpenFoodFactsProduct[]> {
  // Pick the most specific English category tag
  const category = [...categoriesTags].reverse().find((t) => t.startsWith('en:'));
  if (!category) return [];

  try {
    const params = new URLSearchParams({
      categories_tags: category,
      fields: FIELDS,
      page_size: '20',
      sort_by: 'unique_scans_n',
    });
    const res = await fetch(`${BASE_URL}/search?${params}`, {
      headers: { 'User-Agent': USER_AGENT },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return ((data.products ?? []) as RawOpenFoodFactsProduct[])
      .filter((p) => p.code !== currentBarcode && p.product_name)
      .map(parseProduct);
  } catch (err) {
    console.error('getAlternatives failed:', err);
    return [];
  }
}

export async function searchOpenFoodFactsProducts(
  searchTerms: string,
  countriesTag: string | null = 'en:united-states',
  pageSize = 25
): Promise<OpenFoodFactsProduct[]> {
  const terms = searchTerms.trim();
  if (!terms) return [];

  try {
    const params = new URLSearchParams({
      search_terms: terms,
      fields: FIELDS,
      page_size: String(pageSize),
      sort_by: 'unique_scans_n',
    });
    if (countriesTag) params.set('countries_tags', countriesTag);

    const res = await fetch(`${BASE_URL}/search?${params}`, {
      headers: { 'User-Agent': USER_AGENT },
    });
    if (!res.ok) return [];

    const data = await res.json();
    return ((data.products ?? []) as RawOpenFoodFactsProduct[])
      .filter((p) => p.product_name)
      .map(parseProduct);
  } catch {
    return [];
  }
}
