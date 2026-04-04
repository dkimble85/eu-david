import { useState, useEffect } from 'react';
import { getAlternatives } from '@/lib/openfoodfacts';
import { runEuCheck, scoreProduct } from '@/lib/eu-check';
import type { EuCheckResult } from '@/lib/eu-check';
import type { OpenFoodFactsProduct } from '@/lib/openfoodfacts';

export type ScoredAlternative = {
  product: OpenFoodFactsProduct;
  result: EuCheckResult;
  score: number;
};

export function useAlternatives(
  currentBarcode: string,
  categoriesTags: string[],
  currentScore: number,
  glutenFree: boolean
) {
  const [alternatives, setAlternatives] = useState<ScoredAlternative[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // No point showing alternatives for a fully compliant product
    if (!categoriesTags.length || currentScore === 100) return;

    let cancelled = false;
    setAlternatives([]);
    setLoading(true);

    getAlternatives(currentBarcode, categoriesTags)
      .then((candidates) => {
        if (cancelled) return;

        const scored: ScoredAlternative[] = [];

        for (const product of candidates) {
          // Honour gluten-free filter
          if (glutenFree && product.allergens.includes('gluten')) continue;

          const result = runEuCheck(product.eNumbers, product.ingredientsText);

          // Skip candidates where every flagged additive is unknown —
          // we can't confidently say they're safe
          const knownFlagged =
            result.banned.length + result.restricted.length + result.warning.length;
          const hasOnlyUnknowns =
            knownFlagged === 0 && result.unknown.length > 0 && result.approved.length === 0;
          if (hasOnlyUnknowns) continue;

          const score = scoreProduct(result);

          // Only surface products that are meaningfully better
          if (score > currentScore) {
            scored.push({ product, result, score });
          }
        }

        scored.sort((a, b) => b.score - a.score);
        setAlternatives(scored.slice(0, 5));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [currentBarcode, categoriesTags, currentScore, glutenFree]);

  return { alternatives, loading };
}
