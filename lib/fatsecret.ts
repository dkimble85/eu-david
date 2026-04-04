/**
 * FatSecret API client.
 * Token exchange happens via /api/fatsecret (Vercel serverless function)
 * to keep credentials off the client.
 */

const API_BASE = '/api/fatsecret';

export type FatSecretNutrition = {
  calories: string | null;
  fat: string | null;
  carbohydrate: string | null;
  protein: string | null;
  sodium: string | null;
  fiber: string | null;
  sugar: string | null;
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
