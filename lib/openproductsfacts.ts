import type { OpenFoodFactsProduct } from './openfoodfacts';

const BASE_URL = 'https://world.openproductsfacts.org/api/v2';
const USER_AGENT = 'EUDavid/1.0 (personal project; contact@eudavid.app)';

const FIELDS = [
  'product_name',
  'brands',
  'image_url',
  'ingredients_text',
  'allergens_tags',
  'categories_tags',
  'labels_tags',
  'stores_tags',
  'code',
].join(',');

type RawHouseholdProduct = {
  code?: string;
  product_name?: string;
  brands?: string;
  image_url?: string;
  ingredients_text?: string;
  allergens_tags?: string[];
  categories_tags?: string[];
  labels_tags?: string[];
  stores_tags?: string[];
};

function parseAllergen(tag: string): string {
  return tag.replace(/^en:/, '').replace(/-/g, ' ');
}

function parseHouseholdProduct(
  product: RawHouseholdProduct,
  barcode?: string
): OpenFoodFactsProduct {
  return {
    barcode: barcode ?? product.code ?? null,
    name: product.product_name || 'Unknown Product',
    brand: product.brands || null,
    imageUrl: product.image_url || null,
    ingredientsText: product.ingredients_text || null,
    eNumbers: [],
    allergens: (product.allergens_tags || []).map(parseAllergen),
    analysisFlags: product.labels_tags || [],
    categoriesTags: product.categories_tags || [],
    stores: product.stores_tags || [],
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

export async function getHouseholdProductByBarcode(
  barcode: string
): Promise<OpenFoodFactsProduct | null> {
  try {
    const response = await fetch(`${BASE_URL}/product/${barcode}.json?fields=${FIELDS}`, {
      headers: { 'User-Agent': USER_AGENT },
    });

    if (response.status === 404) return null;
    if (!response.ok) return null;

    const data = await response.json();
    if (data.status === 0 || !data.product) return null;

    return parseHouseholdProduct(data.product, barcode);
  } catch {
    return null;
  }
}

export async function searchOpenProductsFactsProducts(
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

    const response = await fetch(`${BASE_URL}/search?${params}`, {
      headers: { 'User-Agent': USER_AGENT },
    });

    if (!response.ok) return [];

    const data = await response.json();
    return ((data.products ?? []) as RawHouseholdProduct[])
      .filter((product) => product.product_name)
      .map((product) => parseHouseholdProduct(product));
  } catch {
    return [];
  }
}
