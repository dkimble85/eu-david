/**
 * Vercel serverless function: /api/fatsecret
 * Proxies FatSecret requests server-side to keep credentials out of the browser.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';

const TOKEN_URL = 'https://oauth.fatsecret.com/connect/token';
const API_BASE = 'https://platform.fatsecret.com/rest';

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.value;
  }

  const clientId = process.env.FATSECRET_CLIENT_ID!;
  const clientSecret = process.env.FATSECRET_CLIENT_SECRET!;
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials&scope=basic',
  });

  if (!res.ok) throw new Error(`FatSecret token error: ${res.status}`);

  const data = await res.json();
  cachedToken = {
    value: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };
  return cachedToken.value;
}

async function findFoodIdByBarcode(barcode: string, token: string): Promise<string | null> {
  const gtin13 = barcode.padStart(13, '0');
  const url = `${API_BASE}/food/barcode/find-by-id/v1?barcode=${gtin13}&format=json`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return null;
  const data = await res.json();
  return data?.food_id?.value ?? data?.food_id ?? null;
}

async function getFoodDetails(foodId: string, token: string) {
  const url = `${API_BASE}/food/v5?food_id=${foodId}&format=json`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return null;
  const data = await res.json();
  const food = data?.food;
  if (!food) return null;

  const serving = Array.isArray(food.servings?.serving)
    ? food.servings.serving[0]
    : food.servings?.serving;

  return {
    foodId: String(food.food_id),
    name: food.food_name ?? 'Unknown',
    brand: food.brand_name ?? null,
    nutrition: serving
      ? {
          calories: serving.calories ?? null,
          fat: serving.fat ?? null,
          carbohydrate: serving.carbohydrate ?? null,
          protein: serving.protein ?? null,
          sodium: serving.sodium ?? null,
          fiber: serving.fiber ?? null,
          sugar: serving.sugar ?? null,
        }
      : null,
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const barcode = String(req.query.barcode ?? '').trim();
  if (!barcode) {
    return res.status(400).json({ error: 'Missing barcode parameter' });
  }

  try {
    const token = await getToken();
    const foodId = await findFoodIdByBarcode(barcode, token);
    if (!foodId) {
      return res.status(404).json({ error: 'Product not found in FatSecret' });
    }

    const details = await getFoodDetails(foodId, token);
    if (!details) {
      return res.status(404).json({ error: 'Could not retrieve food details' });
    }

    res.setHeader('Cache-Control', 's-maxage=3600');
    return res.status(200).json(details);
  } catch (err) {
    console.error('FatSecret handler error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
