/**
 * Nutri-Score 2023 algorithm for general food products.
 * Reference: https://www.santepubliquefrance.fr/en/nutri-score
 *
 * Inputs must be per 100g. Does not apply to beverages, fats/oils, or cheese
 * (different algorithms). When product type is unknown, general food is used.
 */

export type NutriScoreInputs = {
  energyKj100g: number | null;
  saturatedFat100g: number | null;
  sugars100g: number | null;
  sodium100g: number | null;
  fiber100g: number | null;
  protein100g: number | null;
};

function pointsAbove(value: number, thresholds: number[]): number {
  let pts = 0;
  for (const t of thresholds) {
    if (value > t) pts++;
    else break;
  }
  return pts;
}

function energyPoints(kj: number): number {
  return pointsAbove(kj, [335, 670, 1005, 1340, 1675, 2010, 2345, 2680, 3015, 3350]);
}

function saturatedFatPoints(g: number): number {
  return pointsAbove(g, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
}

function sugarsPoints(g: number): number {
  return pointsAbove(g, [4.5, 9, 13.5, 18, 22.5, 27, 31, 36, 40, 45]);
}

function sodiumPoints(mg: number): number {
  return pointsAbove(mg, [90, 180, 270, 360, 450, 540, 630, 720, 810, 900]);
}

function fiberPoints(g: number): number {
  return pointsAbove(g, [0.9, 1.9, 2.9, 3.9, 4.9]);
}

function proteinPoints(g: number): number {
  return pointsAbove(g, [1.6, 3.2, 4.8, 6.4, 8.0, 9.6, 11.2]);
}

function gradeFromScore(score: number): string {
  if (score <= -1) return 'a';
  if (score <= 2) return 'b';
  if (score <= 10) return 'c';
  if (score <= 18) return 'd';
  return 'f';
}

export type NutriScoreResult = {
  grade: string;
  score: number;
  /** true when at least energy + one macro were available to compute */
  isEstimate: boolean;
};

/**
 * Calculate Nutri-Score from per-100g nutrition inputs.
 * Returns null if there's not enough data to make a meaningful calculation.
 */
export function calculateNutriScore(inputs: NutriScoreInputs): NutriScoreResult | null {
  const { energyKj100g, saturatedFat100g, sugars100g, sodium100g, fiber100g, protein100g } = inputs;

  // Need at minimum energy to compute any score
  if (energyKj100g == null) return null;

  const nPoints =
    energyPoints(energyKj100g) +
    saturatedFatPoints(saturatedFat100g ?? 0) +
    sugarsPoints(sugars100g ?? 0) +
    sodiumPoints(sodium100g ?? 0);

  const pPoints = fiberPoints(fiber100g ?? 0) + proteinPoints(protein100g ?? 0);

  const score = nPoints - pPoints;
  const grade = gradeFromScore(score);

  // Consider it an estimate if any input was missing (defaulted to 0)
  const isEstimate =
    saturatedFat100g == null || sugars100g == null || sodium100g == null || fiber100g == null;

  return { grade, score, isEstimate };
}

/**
 * Normalize FatSecret per-serving values to per-100g using the serving gram weight.
 * Returns null if serving amount in grams is not available.
 */
export function fatSecretTo100gInputs(nutrition: {
  calories: string | null;
  saturatedFat: string | null;
  sugar: string | null;
  sodium: string | null;
  fiber: string | null;
  protein: string | null;
  metricServingAmountG: number | null;
}): NutriScoreInputs | null {
  const servingG = nutrition.metricServingAmountG;
  if (!servingG || servingG <= 0) return null;

  const factor = 100 / servingG;

  function scale(val: string | null): number | null {
    const n = val != null ? parseFloat(val) : NaN;
    if (Number.isNaN(n)) return null;
    return n * factor;
  }

  const kcal = scale(nutrition.calories);
  if (kcal == null) return null;

  return {
    energyKj100g: Math.round(kcal * 4.184),
    saturatedFat100g: scale(nutrition.saturatedFat),
    sugars100g: scale(nutrition.sugar),
    sodium100g: scale(nutrition.sodium),
    fiber100g: scale(nutrition.fiber),
    protein100g: scale(nutrition.protein),
  };
}
