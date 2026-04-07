/**
 * Vercel serverless function: /api/fatsecret
 * Proxies FatSecret requests server-side to keep credentials out of the browser.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';

const TOKEN_URL = 'https://oauth.fatsecret.com/connect/token';
const API_BASE = 'https://platform.fatsecret.com/rest';
const FETCH_TIMEOUT_MS = 8000;
const PRODUCT_CACHE_TTL_MS = 60 * 60 * 1000;
const NEGATIVE_CACHE_TTL_MS = 10 * 60 * 1000;

let cachedToken: { value: string; expiresAt: number } | null = null;
const productCache = new Map<string, { expiresAt: number; payload: unknown | null }>();

async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function getToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.value;
  }

  const clientId = process.env.FATSECRET_CLIENT_ID!;
  const clientSecret = process.env.FATSECRET_CLIENT_SECRET!;
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const res = await fetchWithTimeout(TOKEN_URL, {
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
  const res = await fetchWithTimeout(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return null;
  const data = await res.json();
  return data?.food_id?.value ?? data?.food_id ?? null;
}

async function getFoodDetails(foodId: string, token: string) {
  const url = `${API_BASE}/food/v5?food_id=${foodId}&format=json`;
  const res = await fetchWithTimeout(url, { headers: { Authorization: `Bearer ${token}` } });
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
          saturatedFat: serving.saturated_fat ?? null,
          metricServingAmountG:
            serving.metric_serving_unit === 'g' && serving.metric_serving_amount != null
              ? Number(serving.metric_serving_amount)
              : null,
        }
      : null,
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const barcode = String(req.query.barcode ?? '').trim();
  if (!barcode) {
    return res.status(400).json({ error: 'Missing barcode parameter' });
  }

  const now = Date.now();
  const cached = productCache.get(barcode);
  if (cached && cached.expiresAt > now) {
    if (cached.payload) {
      res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
      return res.status(200).json(cached.payload);
    }
    return res.status(404).json({ error: 'Product not found in FatSecret' });
  }

  try {
    const token = await getToken();
    const foodId = await findFoodIdByBarcode(barcode, token);
    if (!foodId) {
      productCache.set(barcode, { expiresAt: now + NEGATIVE_CACHE_TTL_MS, payload: null });
      return res.status(404).json({ error: 'Product not found in FatSecret' });
    }

    const details = await getFoodDetails(foodId, token);
    if (!details) {
      productCache.set(barcode, { expiresAt: now + NEGATIVE_CACHE_TTL_MS, payload: null });
      return res.status(404).json({ error: 'Could not retrieve food details' });
    }

    productCache.set(barcode, { expiresAt: now + PRODUCT_CACHE_TTL_MS, payload: details });
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
    return res.status(200).json(details);
  } catch (err) {
    console.error('FatSecret handler error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
