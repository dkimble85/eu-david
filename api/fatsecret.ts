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
const PRODUCT_CACHE_MAX_ENTRIES = 500;
const productCache = new Map<string, { expiresAt: number; payload: unknown | null }>();

// Barcodes: EAN-8, UPC-A (12), EAN-13, GTIN-14 -> digits only, 8-14 long.
const BARCODE_RE = /^\d{8,14}$/;
const FOOD_ID_RE = /^\d{1,20}$/;

// Simple per-IP fixed-window rate limit. In-memory => per serverless instance only
// (not shared across instances/cold starts), so it is a best-effort brake, not a hard quota.
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 30;
const RATE_LIMIT_MAX_TRACKED_IPS = 5000;
const rateBuckets = new Map<string, { windowStart: number; count: number }>();

function isRateLimited(ip: string, now: number): boolean {
  const bucket = rateBuckets.get(ip);
  if (!bucket || now - bucket.windowStart >= RATE_LIMIT_WINDOW_MS) {
    if (rateBuckets.size >= RATE_LIMIT_MAX_TRACKED_IPS) {
      for (const [key, b] of rateBuckets) {
        if (now - b.windowStart >= RATE_LIMIT_WINDOW_MS) rateBuckets.delete(key);
      }
      if (rateBuckets.size >= RATE_LIMIT_MAX_TRACKED_IPS) {
        const oldest = rateBuckets.keys().next().value;
        if (oldest !== undefined) rateBuckets.delete(oldest);
      }
    }
    rateBuckets.set(ip, { windowStart: now, count: 1 });
    return false;
  }
  bucket.count += 1;
  return bucket.count > RATE_LIMIT_MAX_REQUESTS;
}

function clientIp(req: VercelRequest): string {
  const fwd = req.headers['x-forwarded-for'];
  const first = (Array.isArray(fwd) ? fwd[0] : fwd)?.split(',')[0]?.trim();
  return first || req.socket?.remoteAddress || 'unknown';
}

function cacheSet(key: string, value: { expiresAt: number; payload: unknown | null }, now: number) {
  if (productCache.size >= PRODUCT_CACHE_MAX_ENTRIES) {
    for (const [k, v] of productCache) {
      if (v.expiresAt <= now) productCache.delete(k);
    }
    while (productCache.size >= PRODUCT_CACHE_MAX_ENTRIES) {
      const oldest = productCache.keys().next().value; // Map keeps insertion order
      if (oldest === undefined) break;
      productCache.delete(oldest);
    }
  }
  productCache.delete(key);
  productCache.set(key, value);
}

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
  const url = `${API_BASE}/food/barcode/find-by-id/v1?barcode=${encodeURIComponent(gtin13)}&format=json`;
  const res = await fetchWithTimeout(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return null;
  const data = await res.json();
  const id = String(data?.food_id?.value ?? data?.food_id ?? '');
  return FOOD_ID_RE.test(id) ? id : null;
}

async function getFoodDetails(foodId: string, token: string) {
  const url = `${API_BASE}/food/v5?food_id=${encodeURIComponent(foodId)}&format=json`;
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
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const now = Date.now();
  if (isRateLimited(clientIp(req), now)) {
    res.setHeader('Retry-After', String(Math.ceil(RATE_LIMIT_WINDOW_MS / 1000)));
    return res.status(429).json({ error: 'Too many requests' });
  }

  const rawBarcode = req.query.barcode;
  const barcode = typeof rawBarcode === 'string' ? rawBarcode.trim() : '';
  if (!BARCODE_RE.test(barcode)) {
    return res.status(400).json({ error: 'Invalid barcode parameter' });
  }

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
      cacheSet(barcode, { expiresAt: now + NEGATIVE_CACHE_TTL_MS, payload: null }, now);
      return res.status(404).json({ error: 'Product not found in FatSecret' });
    }

    const details = await getFoodDetails(foodId, token);
    if (!details) {
      cacheSet(barcode, { expiresAt: now + NEGATIVE_CACHE_TTL_MS, payload: null }, now);
      return res.status(404).json({ error: 'Could not retrieve food details' });
    }

    cacheSet(barcode, { expiresAt: now + PRODUCT_CACHE_TTL_MS, payload: details }, now);
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
    return res.status(200).json(details);
  } catch (err) {
    console.error('FatSecret handler error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
