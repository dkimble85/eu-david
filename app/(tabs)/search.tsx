import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  TextInput,
  Image,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Search as SearchIcon, ScanBarcode } from 'lucide-react-native';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { getMatchingUsStore } from '@/lib/recommendations';
import { runEuCheck, scoreProduct } from '@/lib/eu-check';
import { runEuCosmeticCheck, scoreCosmeticProduct } from '@/lib/eu-cosmetic-check';
import { getBeautyProductByBarcode, searchOpenBeautyFactsProducts } from '@/lib/openbeautyfacts';
import {
  getHouseholdProductByBarcode,
  searchOpenProductsFactsProducts,
} from '@/lib/openproductsfacts';
import { classifyProductByCategories } from '@/lib/product-type';
import { normalizeUsdaIngredientsText, searchUsdaBrandedFoods, toUsdaBarcode } from '@/lib/usda';
import { submitProductReport } from '@/lib/reports';
import { loadFavoriteBarcodes, toggleFavorite } from '@/lib/user-product-data';
import { getDietaryAnalysis } from '@/lib/dietary-analysis';
import { useAuth } from '@/hooks/useAuth';
import ReportIssueModal from '@/components/ReportIssueModal';
import { supabase } from '@/lib/supabase';
import type { ScoredProduct } from '@/lib/recommendations';
import { getProductByBarcode, searchOpenFoodFactsProducts } from '@/lib/openfoodfacts';
import type { OpenFoodFactsProduct } from '@/lib/openfoodfacts';
import type { UsdaBrandedFood } from '@/lib/usda';
import type { ProductReportIssueType } from '@/lib/reports';

const SEARCH_CACHE_TTL_MS = 5 * 60 * 1000;
const REPORT_COUNT_CACHE_TTL_MS = 5 * 60 * 1000;
const searchCache = new Map<string, { expiresAt: number; data: ScoredProduct[] }>();
const reportCountCache = new Map<string, { expiresAt: number; count: number }>();

export default function SearchScreen() {
  const { user, loading: authLoading } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [showBarcodeInput, setShowBarcodeInput] = useState(false);
  const [reportTarget, setReportTarget] = useState<{ barcode: string | null; name: string } | null>(
    null
  );
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportStatus, setReportStatus] = useState<string | null>(null);
  const [missingIngredientsCounts, setMissingIngredientsCounts] = useState<Record<string, number>>(
    {}
  );
  const [favoriteBarcodes, setFavoriteBarcodes] = useState<Set<string>>(new Set());

  const { data, isLoading, isError, refetch } = useSearch(submittedQuery, Boolean(user) && !authLoading);

  const handleSearch = useCallback(() => {
    if (authLoading) return;
    if (!user) {
      router.push('/(auth)/login');
      return;
    }
    setSubmittedQuery(searchQuery.trim());
  }, [authLoading, searchQuery, user]);

  const handleBarcodeSubmit = useCallback(() => {
    if (authLoading) return;
    if (!user) {
      router.push('/(auth)/login');
      return;
    }
    const cleaned = barcodeInput.trim().replace(/[^0-9]/g, '');
    if (cleaned.length >= 8) {
      router.push(`/product/${cleaned}?from=search`);
      setBarcodeInput('');
      setShowBarcodeInput(false);
    }
  }, [authLoading, barcodeInput, user]);

  const hasQuery = !!submittedQuery;

  React.useEffect(() => {
    if (!user) {
      setFavoriteBarcodes(new Set());
      return;
    }

    loadFavoriteBarcodes(user.id).then((barcodes) => {
      setFavoriteBarcodes(barcodes);
    });
  }, [user]);

  React.useEffect(() => {
    if (!user) {
      setMissingIngredientsCounts({});
      return;
    }

    async function loadMissingIngredientReportCounts() {
      const barcodes = Array.from(
        new Set(
          (data ?? [])
            .map((item) => item.product.barcode)
            .filter((value): value is string => !!value)
        )
      );
      if (barcodes.length === 0) {
        setMissingIngredientsCounts({});
        return;
      }

      const now = Date.now();
      const counts: Record<string, number> = {};
      const pendingBarcodes: string[] = [];
      for (const barcode of barcodes) {
        const cached = reportCountCache.get(barcode);
        if (cached && cached.expiresAt > now) {
          counts[barcode] = cached.count;
        } else {
          pendingBarcodes.push(barcode);
        }
      }

      if (pendingBarcodes.length === 0) {
        setMissingIngredientsCounts(counts);
        return;
      }

      const { data: rows, error } = await supabase
        .from('product_reports')
        .select('barcode')
        .eq('issue_type', 'missing_ingredients')
        .in('barcode', pendingBarcodes);

      if (error || !rows) {
        setMissingIngredientsCounts(counts);
        return;
      }

      for (const row of rows as Array<{ barcode: string | null }>) {
        if (!row.barcode) continue;
        counts[row.barcode] = (counts[row.barcode] ?? 0) + 1;
      }
      for (const barcode of pendingBarcodes) {
        reportCountCache.set(barcode, {
          expiresAt: now + REPORT_COUNT_CACHE_TTL_MS,
          count: counts[barcode] ?? 0,
        });
      }
      setMissingIngredientsCounts(counts);
    }

    loadMissingIngredientReportCounts().catch(() => {
      setMissingIngredientsCounts({});
    });
  }, [data, user]);

  async function handleSubmitReport(issueType: ProductReportIssueType, details: string) {
    if (!reportTarget) return;

    setReportSubmitting(true);
    setReportStatus(null);

    const response = await submitProductReport({
      userId: user?.id ?? null,
      barcode: reportTarget.barcode,
      productName: reportTarget.name,
      issueType,
      details,
      sourceScreen: 'search',
    });

    if (!response.ok) {
      setReportStatus(
        response.errorMessage ?? 'Could not submit report right now. Please try again.'
      );
      setReportSubmitting(false);
      return;
    }

    setReportStatus('Thanks for reporting. We will review this item.');
    if (issueType === 'missing_ingredients' && reportTarget.barcode) {
      const barcodeKey = reportTarget.barcode;
      const nextCount = (missingIngredientsCounts[barcodeKey] ?? 0) + 1;
      setMissingIngredientsCounts((prev) => ({
        ...prev,
        [barcodeKey]: (prev[barcodeKey] ?? 0) + 1,
      }));
      reportCountCache.set(barcodeKey, {
        expiresAt: Date.now() + REPORT_COUNT_CACHE_TTL_MS,
        count: nextCount,
      });
    }
    setReportSubmitting(false);
    setTimeout(() => {
      setReportTarget(null);
      setReportStatus(null);
    }, 900);
  }

  async function handleToggleFavorite(payload: {
    barcode: string;
    name: string;
    productType: 'food' | 'beauty' | 'household' | 'unknown';
  }) {
    if (!user) {
      router.push('/(auth)/login');
      return;
    }

    const currentlyFavorite = favoriteBarcodes.has(payload.barcode);
    const response = await toggleFavorite({
      userId: user.id,
      barcode: payload.barcode,
      productName: payload.name,
      productType: payload.productType,
      currentlyFavorite,
    });
    if (!response.ok) return;

    setFavoriteBarcodes((prev) => {
      const next = new Set(prev);
      if (response.isFavorite) next.add(payload.barcode);
      else next.delete(payload.barcode);
      return next;
    });
  }

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Search</Text>
        <Text style={styles.subtitle}>Find food, beauty, and household products by name or barcode</Text>
      </View>

      {authLoading ? (
        <View style={styles.empty}>
          <ActivityIndicator size="large" color={colors.euGold} />
          <Text style={styles.emptyBody}>Checking account...</Text>
        </View>
      ) : !user ? (
        <View style={styles.empty}>
          <SearchIcon size={48} color={colors.textMuted} />
          <Text style={styles.emptyTitle}>Sign in required</Text>
          <Text style={styles.emptyBody}>Please sign in to search products and check ingredients.</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => router.push('/(auth)/login')}>
            <Text style={styles.retryText}>Go to Sign In</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {/* Search bar */}
          <View style={styles.searchRow}>
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={handleSearch}
              placeholder="Search by product name..."
              placeholderTextColor={colors.textMuted}
              returnKeyType="search"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity style={styles.searchButton} onPress={handleSearch}>
              <SearchIcon size={20} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Barcode quick-entry toggle */}
          <View style={styles.barcodeRow}>
            <TouchableOpacity
              style={styles.barcodeToggle}
              onPress={() => setShowBarcodeInput(!showBarcodeInput)}
            >
              <ScanBarcode size={16} color={colors.euGold} />
              <Text style={styles.barcodeToggleText}>Enter barcode manually</Text>
            </TouchableOpacity>
          </View>

          {showBarcodeInput && (
            <View style={styles.barcodeInputRow}>
              <TextInput
                style={styles.barcodeInput}
                value={barcodeInput}
                onChangeText={setBarcodeInput}
                onSubmitEditing={handleBarcodeSubmit}
                placeholder="Enter barcode number..."
                placeholderTextColor={colors.textMuted}
                keyboardType="number-pad"
                returnKeyType="go"
                autoCapitalize="none"
              />
              <TouchableOpacity style={styles.searchButton} onPress={handleBarcodeSubmit}>
                <Text style={styles.searchButtonText}>Go</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Results */}
          {!hasQuery ? (
            <View style={styles.empty}>
              <SearchIcon size={48} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>Search for products</Text>
              <Text style={styles.emptyBody}>
                Enter a product name to search food, beauty, and household products.
              </Text>
            </View>
          ) : isLoading ? (
            <View style={styles.empty}>
              <ActivityIndicator size="large" color={colors.euGold} />
              <Text style={styles.emptyBody}>Searching...</Text>
            </View>
          ) : isError ? (
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>⚠️</Text>
              <Text style={styles.emptyTitle}>Something went wrong</Text>
              <Text style={styles.emptyBody}>Check your connection and try again.</Text>
              <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
                <Text style={styles.retryText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : !data || data.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>🔍</Text>
              <Text style={styles.emptyTitle}>No products found</Text>
              <Text style={styles.emptyBody}>Try a different search term.</Text>
            </View>
          ) : (
            <FlatList
              data={data}
              keyExtractor={(item, i) => item.product.barcode ?? `${i}`}
              contentContainerStyle={styles.list}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => (
                <ProductRow
                  item={item}
                  missingIngredientsReportCount={
                    item.product.barcode ? (missingIngredientsCounts[item.product.barcode] ?? 0) : 0
                  }
                  isFavorite={
                    item.product.barcode ? favoriteBarcodes.has(item.product.barcode) : false
                  }
                  onReport={(payload) => {
                    setReportStatus(null);
                    setReportTarget(payload);
                  }}
                  onToggleFavorite={handleToggleFavorite}
                />
              )}
            />
          )}
          <ReportIssueModal
            visible={Boolean(reportTarget)}
            productName={reportTarget?.name ?? ''}
            submitting={reportSubmitting}
            statusMessage={reportStatus}
            onClose={() => {
              if (reportSubmitting) return;
              setReportTarget(null);
              setReportStatus(null);
            }}
            onSubmit={handleSubmitReport}
          />
        </>
      )}
    </SafeAreaView>
  );
}

function useSearch(searchQuery: string, enabled: boolean) {
  const [data, setData] = useState<ScoredProduct[] | undefined>();
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  React.useEffect(() => {
    if (!enabled) {
      setData(undefined);
      setIsLoading(false);
      setIsError(false);
      return;
    }

    const query = searchQuery.trim();
    if (!query) {
      setData(undefined);
      setIsLoading(false);
      setIsError(false);
      return;
    }

    const cacheKey = normalizeForSearch(query);
    const cached = searchCache.get(cacheKey);
    const now = Date.now();
    if (cached && cached.expiresAt > now) {
      setData(cached.data);
      setIsLoading(false);
      setIsError(false);
      return;
    }

    let isActive = true;
    setIsLoading(true);
    setIsError(false);

    searchWithFallbacks(query)
      .then((results) => {
        if (!isActive) return;
        searchCache.set(cacheKey, {
          expiresAt: Date.now() + SEARCH_CACHE_TTL_MS,
          data: results,
        });
        setData(results);
      })
      .catch(() => {
        if (!isActive) return;
        setIsError(true);
      })
      .finally(() => {
        if (!isActive) return;
        setIsLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [enabled, searchQuery, reloadKey]);

  return {
    data,
    isLoading,
    isError,
    refetch: () => {
      const key = normalizeForSearch(searchQuery.trim());
      if (key) searchCache.delete(key);
      setReloadKey((prev) => prev + 1);
    },
  };
}

async function searchWithFallbacks(query: string): Promise<ScoredProduct[]> {
  const trimmed = query.trim();
  const normalized = trimmed.toLowerCase().endsWith('s') ? trimmed.slice(0, -1) : trimmed;
  const dePunctuated = trimmed.replace(/[^a-z0-9\s]/gi, ' ').replace(/\s+/g, ' ').trim();
  const termVariants = Array.from(new Set([trimmed, normalized, dePunctuated].filter(Boolean)));
  const countryVariants: Array<string | null> = ['en:united-states', null];
  const barcodeQuery = trimmed.replace(/[^0-9]/g, '');

  const offTasks = termVariants.flatMap((term) =>
    countryVariants.map((country) =>
      searchOpenFoodFactsProducts(term, country, 40)
        .then((products) =>
          products.map((product) => {
            const result = runEuCheck(product.eNumbers, product.ingredientsText);
            const score = scoreProduct(result);
            return { product, result, score } as ScoredProduct;
          })
        )
        .catch(() => [] as ScoredProduct[])
    )
  );
  const usdaTask = searchUsdaBrandedFoods(trimmed)
    .then((foods) =>
      foods.map(mapUsdaFoodToScoredProduct).filter((item): item is ScoredProduct => item !== null)
    )
    .catch(() => [] as ScoredProduct[]);

  const obfTask = Promise.all(
    termVariants.map((term) =>
      searchOpenBeautyFactsProducts(term, 25)
        .then((products) =>
          products.map((p) => {
            const result = runEuCosmeticCheck(p.ingredientsText);
            const score = scoreCosmeticProduct(result);
            return { product: p, result, score } as ScoredProduct;
          })
        )
        .catch(() => [] as ScoredProduct[])
    )
  ).then((results) => results.flat());

  const opfTask = Promise.all(
    termVariants.map((term) =>
      searchOpenProductsFactsProducts(term, 25)
        .then((products) =>
          products.map((p) => {
            const result = runEuCheck([], p.ingredientsText);
            const score = scoreProduct(result);
            return { product: p, result, score } as ScoredProduct;
          })
        )
        .catch(() => [] as ScoredProduct[])
    )
  ).then((results) => results.flat());

  const exactBarcodeTask =
    barcodeQuery.length >= 8
      ? Promise.all([
          getProductByBarcode(barcodeQuery),
          getBeautyProductByBarcode(barcodeQuery),
          getHouseholdProductByBarcode(barcodeQuery),
        ])
          .then(([food, beauty, household]) => {
            const exactResults: ScoredProduct[] = [];

            if (food) {
              const result = runEuCheck(food.eNumbers, food.ingredientsText);
              exactResults.push({ product: food, result, score: scoreProduct(result) });
            }

            if (beauty) {
              const result = runEuCosmeticCheck(beauty.ingredientsText);
              exactResults.push({ product: beauty, result, score: scoreCosmeticProduct(result) });
            }

            if (household) {
              const result = runEuCheck([], household.ingredientsText);
              exactResults.push({ product: household, result, score: scoreProduct(result) });
            }

            return exactResults;
          })
          .catch(() => [] as ScoredProduct[])
      : Promise.resolve([] as ScoredProduct[]);

  const settled = await Promise.all([...offTasks, usdaTask, obfTask, opfTask, exactBarcodeTask]);
  const combinedResults = settled.flat();

  const deduped = dedupeSearchResults(combinedResults);
  const relevant = deduped.filter((item) => isRelevantToQuery(item, termVariants));

  return relevant.sort((a, b) => {
    const relevanceDelta = getRelevanceScore(b, termVariants) - getRelevanceScore(a, termVariants);
    if (relevanceDelta !== 0) return relevanceDelta;
    return b.score - a.score;
  });
}

function mapUsdaFoodToScoredProduct(food: UsdaBrandedFood): ScoredProduct | null {
  const ingredientsRaw = food.ingredients?.trim();
  if (!ingredientsRaw) return null;

  const ingredientsText = normalizeUsdaIngredientsText(ingredientsRaw);
  if (!ingredientsText) return null;

  const product: OpenFoodFactsProduct = {
    barcode: toUsdaBarcode(food.fdcId),
    name: food.description || 'Unknown Product',
    brand: food.brandOwner ?? null,
    imageUrl: null,
    ingredientsText,
    eNumbers: [],
    allergens: [],
    analysisFlags: [],
    categoriesTags: [],
    stores: [],
    metaScores: {
      nutriScoreGrade: null,
      nutriScoreScore: null,
      ecoScoreGrade: null,
      ecoScoreScore: null,
      novaGroup: null,
    },
    nutritionFacts: food.nutrition
      ? {
          basis: 'serving',
          servingSize: null,
          calories: food.nutrition.calories,
          fat: food.nutrition.fat,
          saturatedFat: null,
          carbohydrate: food.nutrition.carbohydrate,
          sugar: food.nutrition.sugar,
          fiber: food.nutrition.fiber,
          protein: food.nutrition.protein,
          sodium: food.nutrition.sodium,
        }
      : null,
  };

  const result = runEuCheck([], ingredientsText);
  const score = scoreProduct(result);

  return { product, result, score };
}

function normalizeForSearch(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isRelevantToQuery(item: ScoredProduct, terms: string[]): boolean {
  return getRelevanceScore(item, terms) > 0;
}

function getRelevanceScore(item: ScoredProduct, terms: string[]): number {
  const name = normalizeForSearch(item.product.name);
  const brand = normalizeForSearch(item.product.brand ?? '');
  const barcode = normalizeForSearch(item.product.barcode ?? '');
  const haystack = `${name} ${brand}`.trim();
  if (!haystack && !barcode) return 0;

  let score = 0;
  for (const rawTerm of terms) {
    const term = normalizeForSearch(rawTerm);
    if (!term) continue;

    if (barcode && barcode === term) score += 400;
    if (barcode && barcode.includes(term)) score += 220;
    if (name === term) score += 250;
    if (name.includes(term)) score += 150;
    if (brand.includes(term)) score += 90;
    if (haystack.includes(term)) score += 70;

    const tokens = term.split(' ').filter((token) => token.length > 1);
    if (tokens.length > 0 && tokens.every((token) => haystack.includes(token))) {
      score += 40;
    }
    if (
      tokens.length > 1 &&
      tokens.filter((token) => haystack.includes(token)).length >= Math.ceil(tokens.length / 2)
    ) {
      score += 20;
    }
  }

  return score;
}

function dedupeSearchResults(items: ScoredProduct[]): ScoredProduct[] {
  const seen = new Set<string>();
  const deduped: ScoredProduct[] = [];

  for (const item of items) {
    const key =
      item.product.barcode ??
      `${normalizeForSearch(item.product.name)}::${normalizeForSearch(item.product.brand ?? '')}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
  }

  return deduped;
}

function scoreChipColor(value: string | number | null, type: 'grade' | 'nova'): string {
  if (value == null) return colors.unknown;
  if (type === 'grade') {
    const g = String(value).toLowerCase();
    if (g === 'a' || g === 'b') return colors.approved;
    if (g === 'c') return colors.warning;
    return colors.restricted;
  }
  const n = Number(value);
  if (n <= 2) return colors.approved;
  if (n === 3) return colors.warning;
  return colors.restricted;
}

function normalizeNutriGrade(grade: string | null): string | null {
  if (!grade) return null;
  return grade.toLowerCase() === 'e' ? 'f' : grade.toLowerCase();
}

function ProductRow({
  item,
  missingIngredientsReportCount,
  isFavorite,
  onReport,
  onToggleFavorite,
}: {
  item: ScoredProduct;
  missingIngredientsReportCount: number;
  isFavorite: boolean;
  onReport: (payload: { barcode: string | null; name: string }) => void;
  onToggleFavorite: (payload: {
    barcode: string;
    name: string;
    productType: 'food' | 'beauty' | 'household' | 'unknown';
  }) => void;
}) {
  const { product, result, score } = item;
  const productType = classifyProductByCategories(product.categoriesTags);
  const isBeauty = productType === 'beauty';
  const isHousehold = productType === 'household';
  const flagCount = result.banned.length + result.restricted.length + result.warning.length;
  const nutriScore = normalizeNutriGrade(product.metaScores.nutriScoreGrade)?.toUpperCase() ?? null;
  const ecoScore = product.metaScores.ecoScoreGrade?.toUpperCase() ?? null;
  const novaGroup = product.metaScores.novaGroup;
  const dietaryAnalysis = getDietaryAnalysis(product).slice(0, 3);
  const nutritionFacts = product.nutritionFacts;
  const storeLabel = (() => {
    if (isBeauty || !product.stores.length) return null;
    const match = getMatchingUsStore(product.stores);
    return match ? `${match.emoji} ${match.label}` : null;
  })();

  return (
    <TouchableOpacity
      style={styles.row}
      activeOpacity={0.8}
      onPress={() => product.barcode && router.push(`/product/${product.barcode}?from=search`)}
    >
      {product.imageUrl ? (
        <Image source={{ uri: product.imageUrl }} style={styles.rowImage} resizeMode="contain" />
      ) : (
        <View style={styles.rowImagePlaceholder}>
          <Text style={styles.rowPlaceholderEmoji}>
            {isBeauty ? '💄' : isHousehold ? '🧴' : '🛒'}
          </Text>
        </View>
      )}
      <View style={styles.rowInfo}>
        <Text style={styles.rowName} numberOfLines={2}>
          {product.name}
        </Text>
        {product.brand && (
          <Text style={styles.rowBrand} numberOfLines={1}>
            {product.brand}
          </Text>
        )}
        <View style={styles.rowMeta}>
          <Text style={[styles.rowFlags, flagCount === 0 && styles.rowFlagsClean]}>
            {flagCount === 0 ? '✓ No flags' : `${flagCount} flag${flagCount > 1 ? 's' : ''}`}
          </Text>
          <Text style={styles.rowType}>
            {isBeauty ? 'Beauty' : isHousehold ? 'Household' : 'Food'}
          </Text>
          {storeLabel && <Text style={styles.rowStore}>{storeLabel}</Text>}
        </View>
        {!isBeauty && !isHousehold && (nutriScore || ecoScore || novaGroup) && (
          <View style={styles.scoreMetaRow}>
            {nutriScore && (
              <Text
                style={[
                  styles.scoreMetaChip,
                  { color: scoreChipColor(nutriScore, 'grade'), backgroundColor: `${scoreChipColor(nutriScore, 'grade')}22` },
                ]}
              >
                Nutri {nutriScore}
              </Text>
            )}
            {ecoScore && (
              <Text
                style={[
                  styles.scoreMetaChip,
                  { color: scoreChipColor(ecoScore, 'grade'), backgroundColor: `${scoreChipColor(ecoScore, 'grade')}22` },
                ]}
              >
                Eco {ecoScore}
              </Text>
            )}
            {novaGroup != null && (
              <Text
                style={[
                  styles.scoreMetaChip,
                  { color: scoreChipColor(novaGroup, 'nova'), backgroundColor: `${scoreChipColor(novaGroup, 'nova')}22` },
                ]}
              >
                NOVA {novaGroup}
              </Text>
            )}
          </View>
        )}
        {!isBeauty && !isHousehold && dietaryAnalysis.length > 0 && (
          <View style={styles.scoreMetaRow}>
            {dietaryAnalysis.map((item) => (
              <Text
                key={item.key}
                style={[
                  styles.scoreMetaChip,
                  item.tone === 'good' && styles.dietaryChipGood,
                  item.tone === 'warning' && styles.dietaryChipWarning,
                  item.tone === 'neutral' && styles.dietaryChipNeutral,
                ]}
                numberOfLines={1}
              >
                {item.label}
              </Text>
            ))}
          </View>
        )}
        {!isBeauty && !isHousehold && nutritionFacts && (
          <View style={styles.nutritionLabelMini}>
            <Text style={styles.nutritionLabelMiniTitle}>Nutrition Facts</Text>
            {nutritionFacts.basis && (
              <Text style={styles.nutritionLabelMiniBasis}>
                {nutritionFacts.basis === '100g' ? 'Per 100g' : 'Per serving'}
              </Text>
            )}
            {nutritionFacts.calories && (
              <View style={[styles.nutritionLabelMiniRow, styles.nutritionLabelMiniRowStrong]}>
                <Text style={styles.nutritionLabelMiniNameStrong}>Calories</Text>
                <Text style={styles.nutritionLabelMiniValueStrong}>{nutritionFacts.calories}</Text>
              </View>
            )}
            {nutritionFacts.protein && (
              <View style={styles.nutritionLabelMiniRow}>
                <Text style={styles.nutritionLabelMiniName}>Protein</Text>
                <Text style={styles.nutritionLabelMiniValue}>{nutritionFacts.protein}g</Text>
              </View>
            )}
            {nutritionFacts.sugar && (
              <View style={styles.nutritionLabelMiniRow}>
                <Text style={styles.nutritionLabelMiniName}>Sugar</Text>
                <Text style={styles.nutritionLabelMiniValue}>{nutritionFacts.sugar}g</Text>
              </View>
            )}
            {nutritionFacts.fat && (
              <View style={styles.nutritionLabelMiniRow}>
                <Text style={styles.nutritionLabelMiniName}>Fat</Text>
                <Text style={styles.nutritionLabelMiniValue}>{nutritionFacts.fat}g</Text>
              </View>
            )}
          </View>
        )}
        {missingIngredientsReportCount > 0 && (
          <View style={styles.rowMissingBadge}>
            <Text style={styles.rowMissingBadgeText}>
              Missing ingredients reported ({missingIngredientsReportCount})
            </Text>
          </View>
        )}
        <TouchableOpacity
          style={styles.rowReportButton}
          onPress={() => onReport({ barcode: product.barcode, name: product.name })}
          activeOpacity={0.8}
        >
          <Text style={styles.rowReportText}>Report Issue</Text>
        </TouchableOpacity>
        {!!product.barcode && (
          <TouchableOpacity
            style={[styles.rowReportButton, isFavorite && styles.favoriteButtonActive]}
            onPress={() =>
              onToggleFavorite({
                barcode: product.barcode!,
                name: product.name,
                productType,
              })
            }
            activeOpacity={0.8}
          >
            <Text style={[styles.rowReportText, isFavorite && styles.favoriteButtonTextActive]}>
              {isFavorite ? '♥ Favorited' : '♡ Favorite'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
      <ScoreRing score={score} />
    </TouchableOpacity>
  );
}

function ScoreRing({ score }: { score: number }) {
  const color = score >= 80 ? colors.approved : score >= 60 ? colors.warning : colors.restricted;
  return (
    <View style={[styles.scoreRing, { borderColor: color }]}>
      <Text style={[styles.scoreNumber, { color }]}>{score}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },

  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    gap: 2,
  },
  title: { ...typography.title2, color: colors.textPrimary },
  subtitle: { ...typography.subhead, color: colors.textSecondary },

  searchRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...typography.callout,
    color: colors.textPrimary,
  },
  searchButton: {
    backgroundColor: colors.euBlue,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchButtonText: { ...typography.callout, color: '#fff', fontWeight: '600' },

  barcodeRow: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  barcodeToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  barcodeToggleText: { ...typography.caption1, color: colors.euGold },

  barcodeInputRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  barcodeInput: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...typography.callout,
    color: colors.textPrimary,
  },

  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: { ...typography.title3, color: colors.textPrimary, textAlign: 'center' },
  emptyBody: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
  retryButton: {
    backgroundColor: colors.euBlue,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    marginTop: spacing.sm,
  },
  retryText: { ...typography.callout, color: '#fff', fontWeight: '600' },

  list: { padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing.xxl },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.md,
  },
  rowImage: {
    width: 56,
    height: 56,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceElevated,
  },
  rowImagePlaceholder: {
    width: 56,
    height: 56,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowPlaceholderEmoji: { fontSize: 24 },
  rowInfo: { flex: 1, gap: 2 },
  rowName: { ...typography.callout, color: colors.textPrimary, fontWeight: '600' },
  rowBrand: { ...typography.caption1, color: colors.textMuted },
  rowMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 2 },
  rowFlags: { ...typography.caption2, color: colors.warning },
  rowFlagsClean: { color: colors.approved },
  rowType: { ...typography.caption2, color: colors.textSecondary },
  rowStore: { ...typography.caption2, color: colors.textMuted },
  scoreMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  scoreMetaChip: {
    ...typography.caption2,
    color: colors.textPrimary,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    overflow: 'hidden',
  },
  nutritionLabelMini: {
    marginTop: spacing.xs,
    alignSelf: 'flex-start',
    minWidth: 150,
    backgroundColor: '#fff',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: '#111',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  nutritionLabelMiniTitle: {
    fontSize: 15,
    lineHeight: 18,
    fontWeight: '900',
    color: '#111',
  },
  nutritionLabelMiniBasis: {
    ...typography.caption2,
    color: '#111',
    marginTop: 2,
    marginBottom: 4,
  },
  nutritionLabelMiniRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingVertical: 3,
    borderTopWidth: 1,
    borderTopColor: '#111',
  },
  nutritionLabelMiniRowStrong: {
    borderTopWidth: 2,
    marginTop: 4,
  },
  nutritionLabelMiniName: {
    ...typography.caption2,
    color: '#111',
    fontWeight: '700',
  },
  nutritionLabelMiniValue: {
    ...typography.caption2,
    color: '#111',
    fontWeight: '700',
  },
  nutritionLabelMiniNameStrong: {
    ...typography.caption1,
    color: '#111',
    fontWeight: '900',
  },
  nutritionLabelMiniValueStrong: {
    ...typography.caption1,
    color: '#111',
    fontWeight: '900',
  },
  dietaryChipGood: {
    backgroundColor: colors.approvedLight,
    color: colors.approved,
  },
  dietaryChipWarning: {
    backgroundColor: colors.warningLight,
    color: colors.warning,
  },
  dietaryChipNeutral: {
    backgroundColor: colors.surfaceElevated,
    color: colors.textSecondary,
  },
  rowMissingBadge: {
    alignSelf: 'flex-start',
    marginTop: spacing.xs,
    backgroundColor: colors.warningLight,
    borderWidth: 1,
    borderColor: colors.warning,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  rowMissingBadgeText: { ...typography.caption2, color: colors.warning, fontWeight: '700' },
  rowReportButton: {
    alignSelf: 'flex-start',
    marginTop: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  rowReportText: { ...typography.caption2, color: colors.euGold, fontWeight: '600' },
  favoriteButtonActive: {
    borderColor: colors.euGold,
    backgroundColor: colors.euGold,
  },
  favoriteButtonTextActive: {
    color: colors.background,
  },
  scoreRing: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  scoreNumber: { ...typography.subhead, fontWeight: '700' },
});
