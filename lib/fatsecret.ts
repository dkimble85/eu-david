/**
 * FatSecret API client.
 * Token exchange happens via /api/fatsecret (Vercel serverless function)
 * to keep credentials off the client.
 *
 * Requires EXPO_PUBLIC_API_URL set to your deployed Vercel URL, e.g.:
 *   EXPO_PUBLIC_API_URL=https://eu-david.vercel.app
 */

const BASE = process.env.EXPO_PUBLIC_API_URL ?? '';
const API_BASE = `${BASE}/api/fatsecret`;

export type FatSecretNutrition = {
  calories: string | null;
  fat: string | null;
  carbohydrate: string | null;
  protein: string | null;
  sodium: string | null;
  fiber: string | null;
  sugar: string | null;
  saturatedFat: string | null;
  /** Serving size in grams (null when unit is not 'g' or missing) */
  metricServingAmountG: number | null;
};

export type FatSecretProduct = {
  foodId: string;
  name: string;
  brand: string | null;
  nutrition: FatSecretNutrition | null;
};

export async function getFatSecretProduct(barcode: string): Promise<FatSecretProduct | null> {
  try {
    const res = await fetch(`${API_BASE}?barcode=${encodeURIComponent(barcode)}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data as FatSecretProduct;
  } catch (err) {
    console.error('FatSecret fetch failed:', err);
    return null;
  }
}
