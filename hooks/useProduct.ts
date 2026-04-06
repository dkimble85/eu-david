import { useQuery } from '@tanstack/react-query';
import { getProductByBarcode, searchOpenFoodFactsProducts } from '@/lib/openfoodfacts';
import { getFatSecretProduct } from '@/lib/fatsecret';
import { runEuCheck } from '@/lib/eu-check';
import { extractUsdaFdcId, getUsdaFoodById, normalizeUsdaIngredientsText } from '@/lib/usda';
import type { OpenFoodFactsProduct } from '@/lib/openfoodfacts';
import type { UsdaBrandedFood } from '@/lib/usda';

const OFF_MATCH_CACHE_TTL_MS = 30 * 60 * 1000;
const offMatchCache = new Map<
  string,
  { expiresAt: number; product: OpenFoodFactsProduct | null }
>();

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function scoreOffMatch(candidate: OpenFoodFactsProduct, food: UsdaBrandedFood): number {
  const candidateName = normalize(candidate.name);
  const targetName = normalize(food.description || '');
  const candidateBrand = normalize(candidate.brand ?? '');
  const targetBrand = normalize(food.brandOwner ?? '');

  let score = 0;
  if (!candidateName || !targetName) return score;

  if (candidateName === targetName) score += 220;
  if (candidateName.includes(targetName)) score += 130;
  if (targetName.includes(candidateName)) score += 90;

  const nameTokens = targetName.split(' ').filter((token) => token.length > 1);
  if (nameTokens.length > 0 && nameTokens.every((token) => candidateName.includes(token))) {
    score += 70;
  }

  if (targetBrand && candidateBrand === targetBrand) score += 120;
  else if (targetBrand && candidateBrand.includes(targetBrand)) score += 90;
  else if (targetBrand && targetBrand.includes(candidateBrand) && candidateBrand.length > 0)
    score += 50;

  if (candidate.ingredientsText) score += 35;
  if (candidate.barcode) score += 15;
  if (candidate.eNumbers.length > 0) score += 15;

  return score;
}

function dedupeOffCandidates(items: OpenFoodFactsProduct[]): OpenFoodFactsProduct[] {
  const seen = new Set<string>();
  const deduped: OpenFoodFactsProduct[] = [];

  for (const item of items) {
    const key = item.barcode ?? `${normalize(item.name)}::${normalize(item.brand ?? '')}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
  }

  return deduped;
}

async function resolveOffMatchForUsdaFood(
  food: UsdaBrandedFood
): Promise<OpenFoodFactsProduct | null> {
  const cacheKey = String(food.fdcId);
  const now = Date.now();
  const cached = offMatchCache.get(cacheKey);
  if (cached && cached.expiresAt > now) return cached.product;

  const nameQuery = (food.description ?? '').trim();
  const brandQuery = (food.brandOwner ?? '').trim();
  if (!nameQuery || nameQuery.length < 3) {
    offMatchCache.set(cacheKey, { expiresAt: now + OFF_MATCH_CACHE_TTL_MS, product: null });
    return null;
  }
  const combinedQuery = `${brandQuery} ${nameQuery}`.trim();
  const queries = [combinedQuery, nameQuery].filter((q) => q.length > 0);
  if (queries.length === 0) {
    offMatchCache.set(cacheKey, { expiresAt: now + OFF_MATCH_CACHE_TTL_MS, product: null });
    return null;
  }

  const usCandidates = (
    await Promise.all(
      queries.map((query) => searchOpenFoodFactsProducts(query, 'en:united-states', 25))
    )
  ).flat();
  const globalCandidates =
    usCandidates.length > 0
      ? []
      : (
          await Promise.all(queries.map((query) => searchOpenFoodFactsProducts(query, null, 25)))
        ).flat();

  const candidates = dedupeOffCandidates([...usCandidates, ...globalCandidates]);
  if (candidates.length === 0) {
    offMatchCache.set(cacheKey, { expiresAt: now + OFF_MATCH_CACHE_TTL_MS, product: null });
    return null;
  }

  const ranked = candidates
    .map((candidate) => ({ candidate, score: scoreOffMatch(candidate, food) }))
    .sort((a, b) => b.score - a.score);
  const best = ranked[0]?.candidate ?? null;
  const bestScore = ranked[0]?.score ?? 0;

  if (!best?.ingredientsText || bestScore < 180) {
    offMatchCache.set(cacheKey, { expiresAt: now + OFF_MATCH_CACHE_TTL_MS, product: null });
    return null;
  }
  offMatchCache.set(cacheKey, { expiresAt: now + OFF_MATCH_CACHE_TTL_MS, product: best });
  return best;
}

async function fetchProduct(barcode: string) {
  const usdaFdcId = extractUsdaFdcId(barcode);
  if (usdaFdcId) {
    const food = await getUsdaFoodById(usdaFdcId);
    if (!food) return null;

    const ingredientsText = food.ingredients
      ? normalizeUsdaIngredientsText(food.ingredients)
      : null;
    const matchedOff = await resolveOffMatchForUsdaFood(food);
    const off = matchedOff ?? {
      barcode,
      name: food.description || 'Unknown Product',
      brand: food.brandOwner || null,
      imageUrl: null,
      ingredientsText,
      eNumbers: [],
      allergens: [],
      analysisFlags: [],
      categoriesTags: [],
      stores: [],
    };
    const euResult = runEuCheck(off.eNumbers ?? [], off.ingredientsText ?? null);
    const fs = {
      foodId: String(food.fdcId),
      name: food.description || 'Unknown Product',
      brand: food.brandOwner || null,
      nutrition: food.nutrition ?? null,
    };
    return { off, fs, euResult };
  }

  const [off, fs] = await Promise.all([getProductByBarcode(barcode), getFatSecretProduct(barcode)]);
  if (!off && !fs) return null;
  const euResult = runEuCheck(off?.eNumbers ?? [], off?.ingredientsText ?? null);
  return { off, fs, euResult };
}

export function useProduct(barcode: string) {
  return useQuery({
    queryKey: ['product', barcode],
    queryFn: () => fetchProduct(barcode),
    staleTime: Infinity, // product ingredients don't change
    retry: 2,
    enabled: !!barcode,
  });
}
