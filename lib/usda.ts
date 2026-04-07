const USDA_BASE_URL = 'https://api.nal.usda.gov/fdc/v1';
export const USDA_BARCODE_PREFIX = 'usda-';

export type UsdaNutrition = {
  calories: string | null;
  fat: string | null;
  carbohydrate: string | null;
  protein: string | null;
  sodium: string | null;
  fiber: string | null;
  sugar: string | null;
};

export type UsdaNutriScoreInputs = {
  energyKj100g: number | null;
  saturatedFat100g: number | null;
  sugars100g: number | null;
  sodium100g: number | null;
  fiber100g: number | null;
  protein100g: number | null;
};

export type UsdaBrandedFood = {
  fdcId: number;
  description: string;
  brandOwner?: string;
  ingredients?: string;
  nutrition?: UsdaNutrition | null;
  nutriScoreInputs100g?: UsdaNutriScoreInputs | null;
};

type UsdaSearchResponse = {
  foods?: UsdaBrandedFood[];
};

type UsdaFoodResponse = {
  fdcId: number;
  description?: string;
  brandOwner?: string;
  ingredients?: string;
  labelNutrients?: {
    calories?: { value?: number };
    fat?: { value?: number };
    carbohydrates?: { value?: number };
    protein?: { value?: number };
    sodium?: { value?: number };
    fiber?: { value?: number };
    sugars?: { value?: number };
  };
  foodNutrients?: Array<{
    nutrient?: {
      id?: number;
      number?: string;
      name?: string;
      unitName?: string;
    };
    amount?: number;
  }>;
};

function formatNutrientValue(value: number | undefined): string | null {
  if (typeof value !== 'number' || Number.isNaN(value)) return null;
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function findFoodNutrientAmount(
  nutrients: NonNullable<UsdaFoodResponse['foodNutrients']>,
  options: { id?: number; number?: string; includesName?: string }
): number | undefined {
  const numberLower = options.number?.toLowerCase();
  const nameLower = options.includesName?.toLowerCase();

  for (const nutrient of nutrients) {
    const id = nutrient.nutrient?.id;
    const number = nutrient.nutrient?.number?.toLowerCase();
    const name = nutrient.nutrient?.name?.toLowerCase();

    if (options.id && id === options.id) return nutrient.amount;
    if (numberLower && number === numberLower) return nutrient.amount;
    if (nameLower && name?.includes(nameLower)) return nutrient.amount;
  }

  return undefined;
}

function extractNutrition(food: UsdaFoodResponse): UsdaNutrition | null {
  const label = food.labelNutrients;
  const nutrients = food.foodNutrients ?? [];

  const calories =
    label?.calories?.value ?? findFoodNutrientAmount(nutrients, { id: 1008, number: '208' });
  const fat = label?.fat?.value ?? findFoodNutrientAmount(nutrients, { id: 1004, number: '204' });
  const carbohydrate =
    label?.carbohydrates?.value ?? findFoodNutrientAmount(nutrients, { id: 1005, number: '205' });
  const protein =
    label?.protein?.value ?? findFoodNutrientAmount(nutrients, { id: 1003, number: '203' });
  const sodium =
    label?.sodium?.value ??
    findFoodNutrientAmount(nutrients, { id: 1093, number: '307', includesName: 'sodium' });
  const fiber =
    label?.fiber?.value ??
    findFoodNutrientAmount(nutrients, { id: 1079, number: '291', includesName: 'fiber' });
  const sugar =
    label?.sugars?.value ??
    findFoodNutrientAmount(nutrients, { id: 2000, number: '269', includesName: 'sugar' });

  const parsed: UsdaNutrition = {
    calories: formatNutrientValue(calories),
    fat: formatNutrientValue(fat),
    carbohydrate: formatNutrientValue(carbohydrate),
    protein: formatNutrientValue(protein),
    sodium: formatNutrientValue(sodium),
    fiber: formatNutrientValue(fiber),
    sugar: formatNutrientValue(sugar),
  };

  const hasAnyValue = Object.values(parsed).some((value) => value !== null);
  return hasAnyValue ? parsed : null;
}

/**
 * Extract per-100g nutrient values from foodNutrients for Nutri-Score calculation.
 * For USDA Branded Foods, foodNutrients amounts are per 100g.
 */
function extractNutriScoreInputs100g(food: UsdaFoodResponse): UsdaNutriScoreInputs | null {
  const nutrients = food.foodNutrients ?? [];

  const kcal = findFoodNutrientAmount(nutrients, { id: 1008, number: '208' });
  const saturatedFat = findFoodNutrientAmount(nutrients, { id: 1258, number: '606' });
  const sugars = findFoodNutrientAmount(nutrients, { id: 2000, number: '269', includesName: 'sugar' });
  const sodium = findFoodNutrientAmount(nutrients, { id: 1093, number: '307', includesName: 'sodium' });
  const fiber = findFoodNutrientAmount(nutrients, { id: 1079, number: '291', includesName: 'fiber' });
  const protein = findFoodNutrientAmount(nutrients, { id: 1003, number: '203' });

  if (kcal == null && saturatedFat == null) return null;

  return {
    energyKj100g: typeof kcal === 'number' ? Math.round(kcal * 4.184) : null,
    saturatedFat100g: saturatedFat ?? null,
    sugars100g: sugars ?? null,
    sodium100g: sodium ?? null,
    fiber100g: fiber ?? null,
    protein100g: protein ?? null,
  };
}

export async function searchUsdaBrandedFoods(
  query: string,
  pageSize = 25
): Promise<UsdaBrandedFood[]> {
  const apiKey = process.env.EXPO_PUBLIC_USDA_API_KEY;
  if (!apiKey || !query.trim()) return [];

  const url = `${USDA_BASE_URL}/foods/search?api_key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: query.trim(),
      dataType: ['Branded'],
      pageSize,
    }),
  });

  if (!res.ok) {
    throw new Error(`USDA search failed: ${res.status}`);
  }

  const data = (await res.json()) as UsdaSearchResponse;
  return data.foods ?? [];
}

export function normalizeUsdaIngredientsText(text: string): string {
  return text.replace(/^ingredients?:\s*/i, '').trim();
}

export function toUsdaBarcode(fdcId: number): string {
  return `${USDA_BARCODE_PREFIX}${fdcId}`;
}

export function extractUsdaFdcId(barcode: string): number | null {
  if (!barcode.startsWith(USDA_BARCODE_PREFIX)) return null;
  const raw = barcode.slice(USDA_BARCODE_PREFIX.length);
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export async function getUsdaFoodById(fdcId: number): Promise<UsdaBrandedFood | null> {
  const apiKey = process.env.EXPO_PUBLIC_USDA_API_KEY;
  if (!apiKey || !Number.isInteger(fdcId) || fdcId <= 0) return null;

  const url = `${USDA_BASE_URL}/food/${fdcId}?api_key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`USDA food lookup failed: ${res.status}`);

  const food = (await res.json()) as UsdaFoodResponse;
  return {
    fdcId: food.fdcId,
    description: food.description ?? 'Unknown Product',
    brandOwner: food.brandOwner,
    ingredients: food.ingredients,
    nutrition: extractNutrition(food),
    nutriScoreInputs100g: extractNutriScoreInputs100g(food),
  };
}
