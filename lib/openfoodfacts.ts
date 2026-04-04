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
].join(',');

export type OpenFoodFactsProduct = {
  name: string;
  brand: string | null;
  imageUrl: string | null;
  ingredientsText: string | null;
  eNumbers: string[];
  allergens: string[];
  analysisFlags: string[];
};

function parseENumber(tag: string): string {
  // Tags come as "en:e322" or "en:e322i" — strip the "en:" prefix
  return tag.replace(/^en:/, '').toLowerCase();
}

function parseAllergen(tag: string): string {
  return tag.replace(/^en:/, '').replace(/-/g, ' ');
}

export async function getProductByBarcode(
  barcode: string
): Promise<OpenFoodFactsProduct | null> {
  try {
    const res = await fetch(`${BASE_URL}/product/${barcode}.json?fields=${FIELDS}`, {
      headers: { 'User-Agent': USER_AGENT },
    });

    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`OpenFoodFacts error: ${res.status}`);

    const data = await res.json();
    if (data.status === 0 || !data.product) return null;

    const p = data.product;
    return {
      name: p.product_name || 'Unknown Product',
      brand: p.brands || null,
      imageUrl: p.image_url || null,
      ingredientsText: p.ingredients_text || null,
      eNumbers: (p.additives_tags || []).map(parseENumber),
      allergens: (p.allergens_tags || []).map(parseAllergen),
      analysisFlags: p.ingredients_analysis_tags || [],
    };
  } catch (err) {
    console.error('OpenFoodFacts fetch failed:', err);
    return null;
  }
}
