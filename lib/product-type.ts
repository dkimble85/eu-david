export type ProductType = 'food' | 'beauty' | 'household' | 'unknown';

const BEAUTY_PREFIXES = [
  'en:face-',
  'en:eye-',
  'en:lip-',
  'en:hair-',
  'en:body-',
  'en:skin-',
  'en:nail-',
  'en:makeup',
  'en:cosmetics',
  'en:beauty-',
  'en:perfumes',
  'en:fragrances',
  'en:deodorants',
  'en:sunscreens',
  'en:shower-',
  'en:bath-',
  'en:toothpastes',
  'en:oral-',
  'en:soaps',
  'en:shampoos',
  'en:conditioners',
  'en:foundations',
  'en:mascaras',
  'en:blushes',
  'en:concealers',
  'en:moisturisers',
  'en:moisturizers',
];

const FOOD_PREFIXES = [
  'en:beverages',
  'en:snacks',
  'en:dairy',
  'en:dairies',
  'en:cereals',
  'en:breads',
  'en:sauces',
  'en:chocolates',
  'en:chips',
  'en:yogurts',
  'en:pasta',
  'en:groceries',
  'en:meals',
  'en:meats',
  'en:seafoods',
  'en:fruits',
  'en:vegetables',
  'en:sweets',
  'en:confectioneries',
  'en:plant-based-foods',
  'en:fermented-foods',
];

const HOUSEHOLD_PREFIXES = [
  'en:household-',
  'en:cleaners',
  'en:cleaning-products',
  'en:laundry',
  'en:detergents',
  'en:dishwashing',
  'en:dishwashing-products',
  'en:home-care',
  'en:air-fresheners',
  'en:surface-cleaners',
  'en:toilet-cleaners',
  'en:fabric-softeners',
];

export function classifyProductByCategories(categoriesTags: string[]): ProductType {
  for (const tag of categoriesTags) {
    const lower = tag.toLowerCase();
    if (BEAUTY_PREFIXES.some((p) => lower === p || lower.startsWith(p))) return 'beauty';
    if (FOOD_PREFIXES.some((p) => lower === p || lower.startsWith(p))) return 'food';
    if (HOUSEHOLD_PREFIXES.some((p) => lower === p || lower.startsWith(p))) return 'household';
  }
  return 'unknown';
}
