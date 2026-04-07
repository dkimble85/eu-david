import type { OpenFoodFactsProduct } from './openfoodfacts';

const BASE_URL = 'https://world.openbeautyfacts.org/api/v2';
const USER_AGENT = 'EUDavid/1.0 (personal project; contact@eudavid.app)';

const FIELDS = [
  'product_name',
  'brands',
  'image_url',
  'ingredients_text',
  'allergens_tags',
  'categories_tags',
  'labels_tags',
  'code',
].join(',');

type RawBeautyProduct = {
  code?: string;
  product_name?: string;
  brands?: string;
  image_url?: string;
  ingredients_text?: string;
  allergens_tags?: string[];
  categories_tags?: string[];
  labels_tags?: string[];
};

function parseAllergen(tag: string): string {
  return tag.replace(/^en:/, '').replace(/-/g, ' ');
}

function parseBeautyProduct(p: RawBeautyProduct, barcode?: string): OpenFoodFactsProduct {
  return {
    barcode: barcode ?? p.code ?? null,
    name: p.product_name || 'Unknown Product',
    brand: p.brands || null,
    imageUrl: p.image_url || null,
    ingredientsText: p.ingredients_text || null,
    eNumbers: [],
    allergens: (p.allergens_tags || []).map(parseAllergen),
    analysisFlags: p.labels_tags || [],
    categoriesTags: p.categories_tags || [],
    stores: [],
    metaScores: {
      nutriScoreGrade: null,
      nutriScoreScore: null,
      ecoScoreGrade: null,
      ecoScoreScore: null,
      novaGroup: null,
    },
    nutritionFacts: null,
  };
}

export async function getBeautyProductByBarcode(
  barcode: string
): Promise<OpenFoodFactsProduct | null> {
  try {
    const res = await fetch(`${BASE_URL}/product/${barcode}.json?fields=${FIELDS}`, {
      headers: { 'User-Agent': USER_AGENT },
    });

    if (res.status === 404) return null;
    if (!res.ok) return null;

    const data = await res.json();
    if (data.status === 0 || !data.product) return null;

    return parseBeautyProduct(data.product, barcode);
  } catch {
    return null;
  }
}

export async function searchOpenBeautyFactsProducts(
  searchTerms: string,
  pageSize = 15
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

    const res = await fetch(`${BASE_URL}/search?${params}`, {
      headers: { 'User-Agent': USER_AGENT },
    });
    if (!res.ok) return [];

    const data = await res.json();
    return ((data.products ?? []) as RawBeautyProduct[])
      .filter((p) => p.product_name)
      .map((p) => parseBeautyProduct(p));
  } catch {
    return [];
  }
}
