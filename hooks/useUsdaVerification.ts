import { useQuery } from '@tanstack/react-query';
import { normalizeUsdaIngredientsText, searchUsdaBrandedFoods } from '@/lib/usda';
import { runEuCheck } from '@/lib/eu-check';
import type { EuCheckResult } from '@/lib/eu-check';
import type { UsdaBrandedFood } from '@/lib/usda';

export type UsdaVerificationData = {
  usdaFood: UsdaBrandedFood;
  ingredientsText: string | null;
  euResult: EuCheckResult;
};

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function scoreUsdaMatch(food: UsdaBrandedFood, productName: string, brand: string | null): number {
  const name = normalize(food.description);
  const target = normalize(productName);
  const brandTarget = normalize(brand ?? '');
  const foodBrand = normalize(food.brandOwner ?? '');

  let score = 0;
  if (name === target) score += 200;
  if (name.includes(target)) score += 120;
  if (target.split(' ').every((token) => token.length > 1 && name.includes(token))) score += 60;
  if (brandTarget && foodBrand.includes(brandTarget)) score += 80;
  if (brandTarget && name.includes(brandTarget)) score += 30;
  if (food.ingredients && food.ingredients.length > 0) score += 20;
  return score;
}

async function fetchUsdaVerification(
  productName: string,
  brand: string | null
): Promise<UsdaVerificationData | null> {
  const query = `${brand ?? ''} ${productName}`.trim();
  if (!query) return null;

  const candidates = await searchUsdaBrandedFoods(query, 25);
  if (candidates.length === 0) return null;

  const best = [...candidates]
    .sort((a, b) => scoreUsdaMatch(b, productName, brand) - scoreUsdaMatch(a, productName, brand))
    .find((item) => !!item.ingredients?.trim());

  if (!best) return null;

  const ingredientsText = best.ingredients ? normalizeUsdaIngredientsText(best.ingredients) : null;
  const euResult = runEuCheck([], ingredientsText);

  return {
    usdaFood: best,
    ingredientsText,
    euResult,
  };
}

export function useUsdaVerification(productName: string, brand: string | null) {
  return useUsdaVerificationEnabled(productName, brand, true);
}

export function useUsdaVerificationEnabled(
  productName: string,
  brand: string | null,
  enabled: boolean
) {
  return useQuery({
    queryKey: ['usda-verification', productName, brand],
    queryFn: () => fetchUsdaVerification(productName, brand),
    staleTime: 30 * 60 * 1000,
    retry: 1,
    enabled: enabled && !!productName,
  });
}
