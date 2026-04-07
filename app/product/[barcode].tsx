import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { colors, radius, spacing, typography, statusColors, statusLabels } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useProduct } from '@/hooks/useProduct';
import { useAlternatives } from '@/hooks/useAlternatives';
import { scoreProduct } from '@/lib/eu-check';
import { submitProductReport } from '@/lib/reports';
import { loadFavoriteBarcodes, saveScanToHistory, toggleFavorite } from '@/lib/user-product-data';
import { getDietaryAnalysis } from '@/lib/dietary-analysis';
import ProductCard from '@/components/ProductCard';
import IngredientList from '@/components/IngredientList';
import AlternativesList from '@/components/AlternativesList';
import ReportIssueModal from '@/components/ReportIssueModal';
import type { CheckedIngredient } from '@/lib/eu-check';
import type { ProductNutritionFacts } from '@/lib/openfoodfacts';
import type { ProductReportIssueType } from '@/lib/reports';

type FoodMetaScores = {
  nutriScoreGrade: string | null;
  nutriScoreScore: number | null;
  novaGroup: number | null;
};

function getScoreTone(value: string | number | null, type: 'grade' | 'nova') {
  if (value == null) return colors.unknown;
  if (type === 'grade') {
    const grade = String(value).toLowerCase();
    if (grade === 'a' || grade === 'b') return colors.approved;
    if (grade === 'c') return colors.warning;
    return colors.restricted;
  }
  const group = Number(value);
  if (group <= 2) return colors.approved;
  if (group === 3) return colors.warning;
  return colors.restricted;
}

function normalizeNutriGrade(grade: string | null): string | null {
  if (!grade) return null;
  return grade.toLowerCase() === 'e' ? 'f' : grade.toLowerCase();
}

function nutriScoreLabel(grade: string | null): string {
  switch (normalizeNutriGrade(grade)) {
    case 'a': return 'Excellent nutritional quality';
    case 'b': return 'Good nutritional quality';
    case 'c': return 'Average nutritional quality';
    case 'd': return 'Poor nutritional quality';
    case 'f': return 'Bad nutritional quality';
    default: return 'Not rated';
  }
}

function novaLabel(group: number | null): string {
  switch (group) {
    case 1: return 'Unprocessed or minimally processed';
    case 2: return 'Processed culinary ingredients';
    case 3: return 'Processed food';
    case 4: return 'Ultra-processed food';
    default: return 'Not rated';
  }
}

export default function ProductScreen() {
  const { barcode, from } = useLocalSearchParams<{ barcode: string; from?: string }>();
  const { user } = useAuth();

  const { data, isLoading, isError, refetch } = useProduct(barcode ?? '');
  const [selectedIngredient, setSelectedIngredient] = useState<CheckedIngredient | null>(null);
  const [historySaved, setHistorySaved] = useState(false);
  const [historySaveError, setHistorySaveError] = useState(false);
  const [favorite, setFavorite] = useState(false);
  const [favoriteError, setFavoriteError] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportStatus, setReportStatus] = useState<string | null>(null);
  const [missingIngredientsReportCount, setMissingIngredientsReportCount] = useState<number>(0);

  const offProduct = data?.off ?? null;
  const euResult = data?.euResult ?? null;
  const productType = data?.productType ?? 'food';
  const isBeauty = productType === 'beauty';
  const productName = offProduct?.name ?? '';
  const brand = offProduct?.brand ?? null;
  const reportBarcode = offProduct?.barcode ?? barcode ?? null;
  const metaScores = offProduct?.metaScores ?? null;
  const dietaryAnalysis = getDietaryAnalysis(offProduct);
  const nutritionFacts = offProduct?.nutritionFacts;

  useEffect(() => {
    setHistorySaved(false);
    setHistorySaveError(false);
    setFavoriteError(false);
  }, [barcode]);

  const currentScore = euResult ? scoreProduct(euResult) : 100;
  const { alternatives, loading: altLoading } = useAlternatives(
    barcode ?? '',
    offProduct?.categoriesTags ?? [],
    currentScore,
    true
  );

  useEffect(() => {
    async function loadMissingIngredientsReports() {
      if (!reportBarcode) {
        setMissingIngredientsReportCount(0);
        return;
      }

      const { count, error } = await supabase
        .from('product_reports')
        .select('id', { count: 'exact', head: true })
        .eq('barcode', reportBarcode)
        .eq('issue_type', 'missing_ingredients');

      if (error || typeof count !== 'number') {
        setMissingIngredientsReportCount(0);
        return;
      }

      setMissingIngredientsReportCount(count);
    }

    loadMissingIngredientsReports().catch(() => {
      setMissingIngredientsReportCount(0);
    });
  }, [reportBarcode]);

  useEffect(() => {
    if (!user || !barcode) {
      setFavorite(false);
      return;
    }

    loadFavoriteBarcodes(user.id).then((barcodes) => {
      setFavorite(barcodes.has(barcode));
    });
  }, [user, barcode]);

  useEffect(() => {
    if (!user || !barcode || !data) return;
    if (historySaved) return;
    if (from === 'history') return;

    const result = euResult
      ? {
          bannedCount: euResult.banned.length,
          restrictedCount: euResult.restricted.length,
          warningCount: euResult.warning.length,
          approvedCount: euResult.approved.length,
        }
      : null;

    saveScanToHistory({
      userId: user.id,
      barcode,
      productName: offProduct?.name ?? null,
      result,
      productType,
    }).then((response) => {
      if (!response.ok) {
        setHistorySaveError(true);
        return;
      }
      setHistorySaved(true);
    });
  }, [
    user,
    barcode,
    data,
    from,
    historySaved,
    euResult,
    offProduct?.name,
    productType,
  ]);

  async function handleToggleFavorite() {
    if (!user || !barcode) {
      router.push('/(auth)/login');
      return;
    }

    setFavoriteError(false);
    const response = await toggleFavorite({
      userId: user.id,
      barcode,
      productName: offProduct?.name ?? null,
      productType,
      currentlyFavorite: favorite,
    });

    if (!response.ok) {
      setFavoriteError(true);
      return;
    }

    setFavorite(response.isFavorite);
  }

  async function handleSubmitReport(issueType: ProductReportIssueType, details: string) {
    setReportSubmitting(true);
    setReportStatus(null);

    const response = await submitProductReport({
      userId: user?.id ?? null,
      barcode: reportBarcode,
      productName: displayProductName,
      issueType,
      details,
      sourceScreen: 'product',
    });

    if (!response.ok) {
      setReportStatus(
        response.errorMessage ?? 'Could not submit report right now. Please try again.'
      );
      setReportSubmitting(false);
      return;
    }

    setReportStatus('Thanks for reporting. We will review this item.');
    if (issueType === 'missing_ingredients') {
      setMissingIngredientsReportCount((prev) => prev + 1);
    }
    setReportSubmitting(false);
    setTimeout(() => {
      setShowReportModal(false);
      setReportStatus(null);
    }, 900);
  }

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.euGold} />
          <Text style={styles.loadingText}>Checking ingredients...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (isError) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <Text style={styles.stateEmoji}>❌</Text>
          <Text style={styles.stateTitle}>Something went wrong</Text>
          <Text style={styles.stateBody}>Check your connection and try again.</Text>
          <TouchableOpacity style={styles.button} onPress={() => refetch()}>
            <Text style={styles.buttonText}>Retry</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.buttonSecondary} onPress={() => router.back()}>
            <Text style={styles.buttonSecondaryText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!data) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <Text style={styles.stateEmoji}>🔍</Text>
          <Text style={styles.stateTitle}>Product not found</Text>
          <Text style={styles.stateSubtitle}>Barcode: {barcode}</Text>
          <Text style={styles.stateBody}>
            This product isn't in our database yet. Try scanning the barcode again or search on
            OpenFoodFacts.
          </Text>
          <TouchableOpacity style={styles.button} onPress={() => router.back()}>
            <Text style={styles.buttonText}>Scan Another</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const displayProductName = productName || 'Unknown Product';

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        {user && (
          <TouchableOpacity onPress={handleToggleFavorite} style={styles.saveButton}>
            <Text style={[styles.saveText, favoriteError && styles.saveErrorText]}>
              {favorite ? '♥ Favorited' : favoriteError ? '⚠ Retry' : '♡ Favorite'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {historySaveError && (
          <View style={styles.historyErrorCard}>
            <Text style={styles.historyErrorText}>
              Could not save this scan to history. Pull to refresh or reopen this product.
            </Text>
          </View>
        )}

        {euResult && (
          <ProductCard
            name={displayProductName}
            brand={brand}
            imageUrl={offProduct?.imageUrl ?? null}
            result={euResult}
            productType={productType}
          />
        )}

        {!isBeauty &&
          productType === 'food' &&
          metaScores &&
          (metaScores.nutriScoreGrade || metaScores.novaGroup != null) && (
            <ScoreSummaryCard scores={metaScores} />
          )}

        {isBeauty && (
          <View style={styles.cosmeticRegCard}>
            <Text style={styles.cosmeticRegText}>
              Checked against EU Cosmetics Regulation 1223/2009
            </Text>
          </View>
        )}

        {!isBeauty && dietaryAnalysis.length > 0 && (
          <View style={styles.dietaryCard}>
            <Text style={styles.sectionTitle}>Dietary Analysis</Text>
            <View style={styles.dietaryTags}>
              {dietaryAnalysis.map((item) => (
                <View
                  key={item.key}
                  style={[
                    styles.dietaryTag,
                    item.tone === 'good' && styles.dietaryTagGood,
                    item.tone === 'warning' && styles.dietaryTagWarning,
                    item.tone === 'neutral' && styles.dietaryTagNeutral,
                  ]}
                >
                  <Text
                    style={[
                      styles.dietaryTagText,
                      item.tone === 'good' && styles.dietaryTagTextGood,
                      item.tone === 'warning' && styles.dietaryTagTextWarning,
                      item.tone === 'neutral' && styles.dietaryTagTextNeutral,
                    ]}
                  >
                    {item.label}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {!isBeauty && nutritionFacts && <NutritionFactsCard nutrition={nutritionFacts} />}

        {euResult && !euResult.hasAnyIngredientData && (
          <View style={styles.missingIngredientsCard}>
            <Text style={styles.missingIngredientsTitle}>Ingredients Could Not Be Found</Text>
            <Text style={styles.missingIngredientsBody}>
              We couldn't get ingredients for this item, so no EU approval can be determined yet.
            </Text>
          </View>
        )}

        <View style={styles.ingredientsSection}>
          <Text style={styles.sectionTitle}>
            {isBeauty ? 'INCI Ingredient Analysis' : 'Ingredient Analysis'}
          </Text>
          {missingIngredientsReportCount > 0 && (
            <View style={styles.missingIngredientsReportedBadge}>
              <Text style={styles.missingIngredientsReportedText}>
                Missing ingredients reported ({missingIngredientsReportCount})
              </Text>
            </View>
          )}
          {euResult && (
            <IngredientList
              ingredients={[
                ...euResult.banned,
                ...euResult.restricted,
                ...euResult.warning,
                ...euResult.approved,
                ...euResult.unknown,
              ]}
              onIngredientPress={setSelectedIngredient}
            />
          )}
        </View>

        <View style={styles.reportWrap}>
          <TouchableOpacity
            style={styles.reportButton}
            onPress={() => {
              setReportStatus(null);
              setShowReportModal(true);
            }}
          >
            <Text style={styles.reportButtonText}>
              Report missing ingredients or misinformation
            </Text>
          </TouchableOpacity>
        </View>

        {offProduct?.ingredientsText && (
          <View style={styles.rawCard}>
            <Text style={styles.sectionTitle}>
              {isBeauty ? 'Full INCI Formula' : 'Full Ingredients'}
            </Text>
            <Text style={styles.rawText}>{offProduct.ingredientsText}</Text>
          </View>
        )}

        {!isBeauty && <AlternativesList alternatives={alternatives} loading={altLoading} />}
      </ScrollView>

      <IngredientDetailModal
        ingredient={selectedIngredient}
        onClose={() => setSelectedIngredient(null)}
      />
      <ReportIssueModal
        visible={showReportModal}
        productName={displayProductName}
        submitting={reportSubmitting}
        statusMessage={reportStatus}
        onClose={() => {
          if (reportSubmitting) return;
          setShowReportModal(false);
          setReportStatus(null);
        }}
        onSubmit={handleSubmitReport}
      />
    </SafeAreaView>
  );
}

function ScoreSummaryCard({ scores }: { scores: FoodMetaScores }) {
  const items = [
    scores.nutriScoreGrade != null && {
      label: 'Nutri-Score',
      value: normalizeNutriGrade(scores.nutriScoreGrade)?.toUpperCase() ?? 'N/A',
      description: nutriScoreLabel(scores.nutriScoreGrade),
      sub:
        typeof scores.nutriScoreScore === 'number'
          ? `Raw score: ${scores.nutriScoreScore}`
          : null,
      color: getScoreTone(normalizeNutriGrade(scores.nutriScoreGrade), 'grade'),
    },
    scores.novaGroup != null && {
      label: 'NOVA',
      value: String(scores.novaGroup),
      description: novaLabel(scores.novaGroup),
      sub: null,
      color: getScoreTone(scores.novaGroup, 'nova'),
    },
  ].filter(Boolean) as {
    label: string;
    value: string;
    description: string;
    sub: string | null;
    color: string;
  }[];

  return (
    <View style={styles.scoreCard}>
      <Text style={styles.sectionTitle}>Food Scores</Text>
      <View style={styles.scoreGrid}>
        {items.map((item) => (
          <View
            key={item.label}
            style={[styles.scoreBox, { borderTopColor: item.color, borderTopWidth: 2 }]}
          >
            <Text style={styles.scoreLabel}>{item.label}</Text>
            <Text style={[styles.scoreValue, { color: item.color }]}>{item.value}</Text>
            <Text style={styles.scoreDescription}>{item.description}</Text>
            {item.sub && <Text style={styles.scoreDetail}>{item.sub}</Text>}
          </View>
        ))}
      </View>
    </View>
  );
}

function NutritionFactsCard({ nutrition }: { nutrition: ProductNutritionFacts }) {
  const label =
    nutrition.basis === 'serving'
      ? 'Per serving'
      : nutrition.basis === '100g'
        ? 'Per 100g'
        : null;

  return (
    <View style={styles.nutritionCard}>
      <Text style={styles.nutritionFactsTitle}>Nutrition Facts</Text>
      {nutrition.servingSize && (
        <Text style={styles.nutritionServingSize}>Serving size {nutrition.servingSize}</Text>
      )}
      {label && <Text style={styles.nutritionBasis}>{label}</Text>}
      <View style={styles.nutritionDividerHeavy} />
      <NutritionLabelRow label="Calories" value={nutrition.calories} unit="" highlight />
      <View style={styles.nutritionDividerMedium} />
      <NutritionLabelRow label="Total Fat" value={nutrition.fat} unit="g" />
      <NutritionLabelRow label="Saturated Fat" value={nutrition.saturatedFat} unit="g" indented />
      <NutritionLabelRow label="Total Carbohydrate" value={nutrition.carbohydrate} unit="g" />
      <NutritionLabelRow label="Sugars" value={nutrition.sugar} unit="g" indented />
      <NutritionLabelRow label="Fiber" value={nutrition.fiber} unit="g" indented />
      <NutritionLabelRow label="Protein" value={nutrition.protein} unit="g" />
      <NutritionLabelRow label="Sodium" value={nutrition.sodium} unit="g" />
    </View>
  );
}

function NutritionLabelRow({
  label,
  value,
  unit,
  highlight = false,
  indented = false,
}: {
  label: string;
  value: string | null;
  unit: string;
  highlight?: boolean;
  indented?: boolean;
}) {
  if (!value) return null;
  return (
    <View style={[styles.nutritionLabelRow, highlight && styles.nutritionLabelRowHighlight]}>
      <Text
        style={[
          styles.nutritionLabelName,
          highlight && styles.nutritionLabelNameHighlight,
          indented && styles.nutritionLabelNameIndented,
        ]}
      >
        {label}
      </Text>
      <Text style={[styles.nutritionLabelValue, highlight && styles.nutritionLabelValueHighlight]}>
        {value}
        {unit}
      </Text>
    </View>
  );
}

function IngredientDetailModal({
  ingredient,
  onClose,
}: {
  ingredient: CheckedIngredient | null;
  onClose: () => void;
}) {
  if (!ingredient) return null;
  const palette = statusColors[ingredient.status];

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={onClose} />
      <View style={[styles.modalSheet, { borderTopColor: palette.text }]}>
        <View style={styles.modalHandle} />
        <Text style={[styles.modalTitle, { color: palette.text }]}>{ingredient.name}</Text>
        {ingredient.isENumber && (
          <Text style={styles.modalSubtitle}>{ingredient.key.toUpperCase()}</Text>
        )}
        <View style={[styles.modalStatusBadge, { backgroundColor: palette.bg }]}>
          <Text style={[styles.modalStatusText, { color: palette.text }]}>
            {statusLabels[ingredient.status]}
          </Text>
        </View>
        {ingredient.bannedSince && (
          <Text style={styles.modalDetail}>Banned since: {ingredient.bannedSince}</Text>
        )}
        {ingredient.annex && (
          <Text style={styles.modalDetail}>Regulation: Annex {ingredient.annex}</Text>
        )}
        {ingredient.notes && <Text style={styles.modalNotes}>{ingredient.notes}</Text>}
        <Text style={styles.modalCategory}>Category: {ingredient.category.replace(/-/g, ' ')}</Text>
        <TouchableOpacity style={styles.modalClose} onPress={onClose}>
          <Text style={styles.modalCloseText}>Done</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.xl,
  },
  loadingText: { ...typography.callout, color: colors.textSecondary },
  stateEmoji: { fontSize: 56 },
  stateTitle: { ...typography.title2, color: colors.textPrimary, textAlign: 'center' },
  stateSubtitle: { ...typography.subhead, color: colors.textMuted },
  stateBody: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
  button: {
    backgroundColor: colors.euBlue,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  buttonText: { ...typography.headline, color: '#fff' },
  buttonSecondary: {
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  buttonSecondaryText: { ...typography.callout, color: colors.textSecondary },

  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  backButton: { padding: spacing.sm },
  backText: { ...typography.callout, color: colors.euGold },
  saveButton: { padding: spacing.sm },
  saveText: { ...typography.callout, color: colors.euGold },
  saveErrorText: { color: colors.warning },

  scroll: { flex: 1 },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  historyErrorCard: {
    backgroundColor: colors.warningLight,
    borderWidth: 1,
    borderColor: colors.warning,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  historyErrorText: { ...typography.caption1, color: colors.warning },

  sectionTitle: { ...typography.headline, color: colors.textPrimary, marginBottom: spacing.sm },
  nutritionCard: {
    backgroundColor: '#fff',
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#111',
  },
  nutritionFactsTitle: {
    fontSize: 30,
    lineHeight: 34,
    fontWeight: '900',
    color: '#111',
  },
  nutritionServingSize: {
    ...typography.callout,
    color: '#111',
    fontWeight: '600',
    marginTop: spacing.xs,
  },
  nutritionBasis: {
    ...typography.caption1,
    color: '#111',
    marginTop: 2,
    marginBottom: spacing.xs,
  },
  nutritionDividerHeavy: {
    height: 8,
    backgroundColor: '#111',
    marginBottom: spacing.xs,
  },
  nutritionDividerMedium: {
    height: 4,
    backgroundColor: '#111',
    marginVertical: spacing.xs,
  },
  scoreCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  scoreGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  scoreBox: {
    flexGrow: 1,
    flexBasis: '30%',
    minWidth: 96,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    padding: spacing.sm,
    gap: 2,
  },
  scoreLabel: { ...typography.caption1, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  scoreValue: { ...typography.title2, fontWeight: '700' },
  scoreDescription: { ...typography.caption1, color: colors.textSecondary, lineHeight: 16 },
  scoreDetail: { ...typography.caption2, color: colors.textMuted, marginTop: 2 },
  nutritionLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: '#111',
  },
  nutritionLabelRowHighlight: {
    paddingVertical: spacing.xs,
    borderTopWidth: 0,
  },
  nutritionLabelName: {
    ...typography.callout,
    color: '#111',
    fontWeight: '700',
    flex: 1,
    paddingRight: spacing.sm,
  },
  nutritionLabelNameHighlight: {
    fontSize: 24,
    lineHeight: 28,
    fontWeight: '900',
  },
  nutritionLabelNameIndented: {
    paddingLeft: spacing.md,
    fontWeight: '600',
  },
  nutritionLabelValue: {
    ...typography.callout,
    color: '#111',
    fontWeight: '700',
  },
  nutritionLabelValueHighlight: {
    fontSize: 24,
    lineHeight: 28,
    fontWeight: '900',
  },

  dietaryCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  dietaryTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  dietaryTag: {
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  dietaryTagGood: {
    backgroundColor: colors.approvedLight,
  },
  dietaryTagWarning: {
    backgroundColor: colors.warningLight,
  },
  dietaryTagNeutral: {
    backgroundColor: colors.surfaceElevated,
  },
  dietaryTagText: { ...typography.caption1, fontWeight: '600' },
  dietaryTagTextGood: { color: colors.approved },
  dietaryTagTextWarning: { color: colors.warning },
  dietaryTagTextNeutral: { color: colors.textSecondary },
  missingIngredientsCard: {
    backgroundColor: colors.unknownLight,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.unknown,
    gap: spacing.xs,
  },
  missingIngredientsTitle: { ...typography.callout, color: colors.textPrimary, fontWeight: '700' },
  missingIngredientsBody: { ...typography.subhead, color: colors.textSecondary, lineHeight: 20 },

  ingredientsSection: { gap: spacing.sm },
  missingIngredientsReportedBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.warningLight,
    borderWidth: 1,
    borderColor: colors.warning,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  missingIngredientsReportedText: {
    ...typography.caption2,
    color: colors.warning,
    fontWeight: '700',
  },
  reportWrap: { alignItems: 'flex-start' },
  reportButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  reportButtonText: { ...typography.footnote, color: colors.euGold, fontWeight: '600' },

  cosmeticRegCard: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.euBlue,
  },
  cosmeticRegText: { ...typography.footnote, color: colors.textSecondary },

  rawCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  rawText: { ...typography.subhead, color: colors.textSecondary, lineHeight: 22 },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderTopWidth: 3,
    padding: spacing.xl,
    gap: spacing.md,
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: radius.full,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: spacing.sm,
  },
  modalTitle: { ...typography.title2 },
  modalSubtitle: { ...typography.subhead, color: colors.textMuted },
  modalStatusBadge: {
    alignSelf: 'flex-start',
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  modalStatusText: { ...typography.subhead, fontWeight: '700' },
  modalDetail: { ...typography.callout, color: colors.textSecondary },
  modalNotes: { ...typography.body, color: colors.textSecondary, lineHeight: 24 },
  modalCategory: { ...typography.footnote, color: colors.textMuted, textTransform: 'capitalize' },
  modalClose: {
    backgroundColor: colors.euBlue,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  modalCloseText: { ...typography.callout, color: '#fff', fontWeight: '600' },
});
