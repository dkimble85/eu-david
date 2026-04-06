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
  'code',
].join(',');

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
};

function parseENumber(tag: string): string {
  // Tags come as "en:e322" or "en:e322i" — strip the "en:" prefix
  return tag.replace(/^en:/, '').toLowerCase();
}

function parseAllergen(tag: string): string {
  return tag.replace(/^en:/, '').replace(/-/g, ' ');
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
