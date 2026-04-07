import type { OpenFoodFactsProduct } from '@/lib/openfoodfacts';

export type DietaryAnalysisItem = {
  key: string;
  label: string;
  tone: 'good' | 'warning' | 'neutral';
};

type GlutenDetection = {
  hasGluten: boolean;
  reason: string | null;
};

type PalmOilDetection = {
  hasPalmOil: boolean;
  reason: string | null;
};

function detectGluten(ingredientsText: string | null, allergens: string[] = []): GlutenDetection {
  const allergenHit = allergens.some((allergen) => {
    const normalized = allergen.toLowerCase().trim();
    if (normalized.includes('gluten free')) return false;
    return normalized === 'gluten' || /\bcontains gluten\b/.test(normalized);
  });
  if (allergenHit) return { hasGluten: true, reason: 'allergen tag indicates gluten' };
  if (!ingredientsText) return { hasGluten: false, reason: null };

  const text = ingredientsText.toLowerCase();
  const hasGlutenFreeClaim = /\bgluten[-\s]?free\b/.test(text);
  const hasDirectGlutenTerm = /\bgluten\b/.test(text);
  const hasGrainSource =
    /\bwheat\b/.test(text) ||
    /\bbarley\b/.test(text) ||
    /\brye\b/.test(text) ||
    /\btriticale\b/.test(text);
  const hasMaltGlutenSource =
    /\bbarley malt\b/.test(text) || /\bmalt extract\b/.test(text) || /\bmalt flour\b/.test(text);
  const hasOnlyMaltodextrinMaltSignal =
    /\bmaltodextrin\b/.test(text) &&
    !hasDirectGlutenTerm &&
    !hasGrainSource &&
    !hasMaltGlutenSource;
  const hasExplicitGlutenSource = hasDirectGlutenTerm || hasGrainSource || hasMaltGlutenSource;

  if (hasGlutenFreeClaim && !hasExplicitGlutenSource) {
    return { hasGluten: false, reason: null };
  }

  if (hasOnlyMaltodextrinMaltSignal) return { hasGluten: false, reason: null };
  if (hasDirectGlutenTerm) return { hasGluten: true, reason: 'ingredient text contains "gluten"' };
  if (hasGrainSource) {
    return { hasGluten: true, reason: 'ingredient text contains wheat/barley/rye/triticale' };
  }
  if (hasMaltGlutenSource) {
    return {
      hasGluten: true,
      reason: 'ingredient text contains barley malt/malt extract/malt flour',
    };
  }
  return { hasGluten: false, reason: null };
}

function detectPalmOil(ingredientsText: string | null): PalmOilDetection {
  if (!ingredientsText) return { hasPalmOil: false, reason: null };
  const text = ingredientsText.toLowerCase();
  const patterns: Array<{ pattern: RegExp; reason: string }> = [
    { pattern: /\bpalm oil\b/, reason: 'ingredient text contains "palm oil"' },
    { pattern: /\bpalm fat\b/, reason: 'ingredient text contains "palm fat"' },
    { pattern: /\bpalm kernel oil\b/, reason: 'ingredient text contains "palm kernel oil"' },
    { pattern: /\bpalm kernel fat\b/, reason: 'ingredient text contains "palm kernel fat"' },
    { pattern: /\bpalm olein\b/, reason: 'ingredient text contains "palm olein"' },
    { pattern: /\bpalm stearin\b/, reason: 'ingredient text contains "palm stearin"' },
    {
      pattern: /\bvegetable (?:oil|fat)s?\s*\((?:[^)]*\bpalm\b[^)]*)\)/,
      reason: 'ingredient text contains vegetable oil/fat blend with palm',
    },
    {
      pattern: /\bpalm(?:\s*and\/or\s*palm kernel)?\s*(?:oil|fat)\b/,
      reason: 'ingredient text contains palm-derived oil/fat',
    },
  ];

  const match = patterns.find(({ pattern }) => pattern.test(text));
  if (match) return { hasPalmOil: true, reason: match.reason };
  return { hasPalmOil: false, reason: null };
}

function getFlagSet(product: OpenFoodFactsProduct | null) {
  return new Set((product?.analysisFlags ?? []).map((flag) => flag.toLowerCase()));
}

export function getDietaryAnalysis(product: OpenFoodFactsProduct | null): DietaryAnalysisItem[] {
  if (!product) return [];

  const flags = getFlagSet(product);
  const gluten = detectGluten(product.ingredientsText ?? null, product.allergens ?? []);
  const palmOil = detectPalmOil(product.ingredientsText ?? null);

  const items: DietaryAnalysisItem[] = [];

  for (const allergen of product.allergens.slice(0, 4)) {
    items.push({
      key: `allergen-${allergen}`,
      label: allergen.replace(/\b\w/g, (char) => char.toUpperCase()),
      tone: 'warning',
    });
  }

  items.push({
    key: 'gluten',
    label: gluten.hasGluten ? 'Contains gluten' : 'No gluten detected',
    tone: gluten.hasGluten ? 'warning' : 'good',
  });

  items.push({
    key: 'palm-oil',
    label: palmOil.hasPalmOil ? 'Contains palm oil' : 'No palm oil detected',
    tone: palmOil.hasPalmOil ? 'warning' : 'good',
  });

  if (flags.has('en:vegan')) {
    items.push({
      key: 'vegan',
      label: 'Vegan',
      tone: 'good',
    });
  }

  if (flags.has('en:vegetarian')) {
    items.push({
      key: 'vegetarian',
      label: 'Vegetarian',
      tone: 'good',
    });
  }

  return items;
}
