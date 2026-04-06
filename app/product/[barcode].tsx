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
import { useUsdaVerificationEnabled } from '@/hooks/useUsdaVerification';
import { scoreProduct } from '@/lib/eu-check';
import { compareSources } from '@/lib/source-compare';
import { submitProductReport } from '@/lib/reports';
import ProductCard from '@/components/ProductCard';
import IngredientList from '@/components/IngredientList';
import AlternativesList from '@/components/AlternativesList';
import ReportIssueModal from '@/components/ReportIssueModal';
import type { CheckedIngredient } from '@/lib/eu-check';
import type { ProductReportIssueType } from '@/lib/reports';

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

  // Avoid false positives from ingredients like maltodextrin in gluten-free products.
  if (hasGlutenFreeClaim && !hasExplicitGlutenSource) {
    return { hasGluten: false, reason: null };
  }

  if (hasOnlyMaltodextrinMaltSignal) return { hasGluten: false, reason: null };
  if (hasDirectGlutenTerm) return { hasGluten: true, reason: 'ingredient text contains "gluten"' };
  if (hasGrainSource)
    return { hasGluten: true, reason: 'ingredient text contains wheat/barley/rye/triticale' };
  if (hasMaltGlutenSource)
    return {
      hasGluten: true,
      reason: 'ingredient text contains barley malt/malt extract/malt flour',
    };
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

export default function ProductScreen() {
  const { barcode } = useLocalSearchParams<{ barcode: string }>();
  const { user } = useAuth();

  const { data, isLoading, isError, refetch } = useProduct(barcode ?? '');
  const [selectedIngredient, setSelectedIngredient] = useState<CheckedIngredient | null>(null);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [showNutritionFacts, setShowNutritionFacts] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportStatus, setReportStatus] = useState<string | null>(null);
  const [missingIngredientsReportCount, setMissingIngredientsReportCount] = useState<number>(0);
  const [showSourceVerification, setShowSourceVerification] = useState(false);

  const offProduct = data?.off ?? null;
  const fsProduct = data?.fs ?? null;
  const euResult = data?.euResult ?? null;
  const productName = offProduct?.name ?? fsProduct?.name ?? '';
  const brand = offProduct?.brand ?? fsProduct?.brand ?? null;
  const { data: verificationData, isLoading: verificationLoading } = useUsdaVerificationEnabled(
    productName,
    brand,
    showSourceVerification
  );
  const sourceComparison =
    offProduct?.ingredientsText && euResult && verificationData
      ? compareSources(
          offProduct.ingredientsText,
          verificationData.ingredientsText,
          euResult,
          verificationData.euResult
        )
      : null;
  const glutenDetection = detectGluten(
    offProduct?.ingredientsText ?? null,
    offProduct?.allergens ?? []
  );
  const palmOilDetection = detectPalmOil(offProduct?.ingredientsText ?? null);
  const hasGluten = glutenDetection.hasGluten;
  const hasPalmOil = palmOilDetection.hasPalmOil;
  const hasNutritionFacts = Boolean(fsProduct?.nutrition);
  const reportBarcode = offProduct?.barcode ?? barcode ?? null;

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

  async function saveToHistory() {
    if (!user || !barcode || saved) return;
    setSaveError(false);
    const name = offProduct?.name ?? fsProduct?.name ?? null;
    const result = euResult
      ? {
          bannedCount: euResult.banned.length,
          restrictedCount: euResult.restricted.length,
          warningCount: euResult.warning.length,
          approvedCount: euResult.approved.length,
        }
      : null;

    const { error } = await supabase.from('scan_history').insert({
      user_id: user.id,
      barcode,
      product_name: name,
      result,
    });
    if (error) {
      setSaveError(true);
    } else {
      setSaved(true);
    }
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
          <TouchableOpacity onPress={saveToHistory} style={styles.saveButton} disabled={saved}>
            <Text style={[styles.saveText, saveError && styles.saveErrorText]}>
              {saved ? '✓ Saved' : saveError ? '⚠ Retry' : 'Save'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {euResult && (
          <ProductCard
            name={displayProductName}
            brand={brand}
            imageUrl={offProduct?.imageUrl ?? null}
            result={euResult}
          />
        )}

        {hasNutritionFacts && (
          <View style={styles.nutritionToggleWrap}>
            <TouchableOpacity
              style={styles.nutritionToggleButton}
              onPress={() => setShowNutritionFacts((prev) => !prev)}
              activeOpacity={0.8}
            >
              <Text style={styles.nutritionToggleText}>
                {showNutritionFacts ? 'Hide Nutrition Facts' : 'Show Nutrition Facts'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {showNutritionFacts && fsProduct?.nutrition && (
          <View style={styles.nutritionCard}>
            <Text style={styles.sectionTitle}>Nutrition (per serving)</Text>
            <View style={styles.nutritionGrid}>
              <NutritionItem label="Calories" value={fsProduct.nutrition.calories} unit="" />
              <NutritionItem label="Fat" value={fsProduct.nutrition.fat} unit="g" />
              <NutritionItem label="Carbs" value={fsProduct.nutrition.carbohydrate} unit="g" />
              <NutritionItem label="Protein" value={fsProduct.nutrition.protein} unit="g" />
              <NutritionItem label="Sodium" value={fsProduct.nutrition.sodium} unit="mg" />
              <NutritionItem label="Fiber" value={fsProduct.nutrition.fiber} unit="g" />
            </View>
          </View>
        )}

        {offProduct?.allergens && offProduct.allergens.length > 0 && (
          <View style={styles.allergenCard}>
            <Text style={styles.sectionTitle}>Allergens</Text>
            <View style={styles.allergenTags}>
              {offProduct.allergens.map((a) => (
                <View key={a} style={styles.allergenTag}>
                  <Text style={styles.allergenText}>{a}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {hasGluten && (
          <View style={styles.glutenAlertCard}>
            <Text style={styles.glutenAlertTitle}>Gluten Detected</Text>
            <Text style={styles.glutenAlertBody}>
              This product appears to contain gluten-based ingredients or allergens.
            </Text>
            {__DEV__ && glutenDetection.reason ? (
              <Text style={styles.glutenDebugText}>Debug: {glutenDetection.reason}</Text>
            ) : null}
          </View>
        )}

        {hasPalmOil && (
          <View style={styles.palmOilAlertCard}>
            <Text style={styles.palmOilAlertTitle}>Palm Oil Detected</Text>
            <Text style={styles.palmOilAlertBody}>
              This product appears to contain palm oil or a palm-derived oil ingredient.
            </Text>
            {__DEV__ && palmOilDetection.reason ? (
              <Text style={styles.glutenDebugText}>Debug: {palmOilDetection.reason}</Text>
            ) : null}
          </View>
        )}

        {euResult && !euResult.hasAnyIngredientData && (
          <View style={styles.missingIngredientsCard}>
            <Text style={styles.missingIngredientsTitle}>Ingredients Could Not Be Found</Text>
            <Text style={styles.missingIngredientsBody}>
              We couldn't get ingredients for this item, so no EU approval can be determined yet.
            </Text>
          </View>
        )}

        <View style={styles.ingredientsSection}>
          <Text style={styles.sectionTitle}>Ingredient Analysis</Text>
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
            <Text style={styles.sectionTitle}>Full Ingredients</Text>
            <Text style={styles.rawText}>{offProduct.ingredientsText}</Text>
          </View>
        )}

        <View style={styles.verificationCard}>
          <View style={styles.verificationHeaderRow}>
            <Text style={styles.verificationTitle}>Source Verification (OFF vs USDA)</Text>
            <TouchableOpacity
              style={styles.verificationToggleButton}
              onPress={() => setShowSourceVerification((prev) => !prev)}
              activeOpacity={0.8}
            >
              <Text style={styles.verificationToggleText}>
                {showSourceVerification ? 'Hide' : 'Show'}
              </Text>
            </TouchableOpacity>
          </View>
          {!showSourceVerification ? (
            <Text style={styles.verificationBody}>
              Tap Show to compare ingredient findings between OFF and USDA.
            </Text>
          ) : verificationLoading ? (
            <Text style={styles.verificationBody}>Comparing with USDA ingredient data...</Text>
          ) : !verificationData || !sourceComparison ? (
            <Text style={styles.verificationBody}>
              No USDA comparison match was found for this product.
            </Text>
          ) : (
            <>
              <View style={styles.verificationRow}>
                <Text style={styles.verificationLabel}>USDA Match</Text>
                <Text style={styles.verificationValue}>
                  {verificationData.usdaFood.description}
                </Text>
              </View>
              {verificationData.usdaFood.brandOwner ? (
                <View style={styles.verificationRow}>
                  <Text style={styles.verificationLabel}>Brand</Text>
                  <Text style={styles.verificationValue}>
                    {verificationData.usdaFood.brandOwner}
                  </Text>
                </View>
              ) : null}
              <View style={styles.verificationRow}>
                <Text style={styles.verificationLabel}>Confidence</Text>
                <Text
                  style={[
                    styles.verificationBadge,
                    sourceComparison.confidence === 'high' && styles.confidenceHigh,
                    sourceComparison.confidence === 'medium' && styles.confidenceMedium,
                    sourceComparison.confidence === 'low' && styles.confidenceLow,
                  ]}
                >
                  {sourceComparison.confidence.toUpperCase()}
                </Text>
              </View>
              <Text style={styles.verificationBody}>
                Ingredient overlap: {Math.round(sourceComparison.overlapRatio * 100)}%
              </Text>
              <Text style={styles.verificationBody}>
                Shared flagged findings: {sourceComparison.sharedFlagged.length}
              </Text>
              <Text style={styles.verificationBody}>
                OFF-only flagged findings: {sourceComparison.offOnlyFlagged.length}
              </Text>
              <Text style={styles.verificationBody}>
                USDA-only flagged findings: {sourceComparison.usdaOnlyFlagged.length}
              </Text>

              {sourceComparison.sharedFlagged.length > 0 ? (
                <>
                  <Text style={styles.verificationSubTitle}>Shared flagged ingredients</Text>
                  <Text style={styles.verificationBody}>
                    {formatIngredientNames(sourceComparison.sharedFlagged.map((item) => item.name))}
                  </Text>
                </>
              ) : null}

              {sourceComparison.offOnlyFlagged.length > 0 ? (
                <>
                  <Text style={styles.verificationSubTitle}>OFF-only flagged ingredients</Text>
                  <Text style={styles.verificationBody}>
                    {formatIngredientNames(
                      sourceComparison.offOnlyFlagged.map((item) => item.name)
                    )}
                  </Text>
                </>
              ) : null}

              {sourceComparison.usdaOnlyFlagged.length > 0 ? (
                <>
                  <Text style={styles.verificationSubTitle}>USDA-only flagged ingredients</Text>
                  <Text style={styles.verificationBody}>
                    {formatIngredientNames(
                      sourceComparison.usdaOnlyFlagged.map((item) => item.name)
                    )}
                  </Text>
                </>
              ) : null}
            </>
          )}
        </View>

        <AlternativesList alternatives={alternatives} loading={altLoading} />
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

function NutritionItem({
  label,
  value,
  unit,
}: {
  label: string;
  value: string | null;
  unit: string;
}) {
  if (!value) return null;
  return (
    <View style={styles.nutritionItem}>
      <Text style={styles.nutritionValue}>
        {value}
        {unit}
      </Text>
      <Text style={styles.nutritionLabel}>{label}</Text>
    </View>
  );
}

function formatIngredientNames(names: string[]): string {
  return Array.from(new Set(names)).slice(0, 6).join(', ');
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

  sectionTitle: { ...typography.headline, color: colors.textPrimary, marginBottom: spacing.sm },

  nutritionToggleWrap: {
    alignItems: 'flex-start',
  },
  nutritionToggleButton: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  nutritionToggleText: {
    ...typography.callout,
    color: colors.euGold,
    fontWeight: '600',
  },

  nutritionCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  nutritionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  nutritionItem: {
    width: '30%',
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.sm,
    padding: spacing.sm,
    alignItems: 'center',
    gap: 2,
  },
  nutritionValue: { ...typography.headline, color: colors.textPrimary },
  nutritionLabel: { ...typography.caption2, color: colors.textMuted },

  allergenCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  allergenTags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  allergenTag: {
    backgroundColor: colors.warningLight,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  allergenText: {
    ...typography.caption1,
    color: colors.warning,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  glutenAlertCard: {
    backgroundColor: colors.warningLight,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.warning,
    gap: spacing.xs,
  },
  glutenAlertTitle: { ...typography.callout, color: colors.warning, fontWeight: '700' },
  glutenAlertBody: { ...typography.subhead, color: colors.textSecondary, lineHeight: 20 },
  glutenDebugText: { ...typography.caption2, color: colors.textMuted },
  palmOilAlertCard: {
    backgroundColor: colors.restrictedLight,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.restricted,
    gap: spacing.xs,
  },
  palmOilAlertTitle: { ...typography.callout, color: colors.restricted, fontWeight: '700' },
  palmOilAlertBody: { ...typography.subhead, color: colors.textSecondary, lineHeight: 20 },
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

  rawCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  rawText: { ...typography.subhead, color: colors.textSecondary, lineHeight: 22 },

  verificationCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.xs,
  },
  verificationHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  verificationTitle: { ...typography.headline, color: colors.textPrimary },
  verificationToggleButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    backgroundColor: colors.surfaceElevated,
  },
  verificationToggleText: {
    ...typography.caption1,
    color: colors.euGold,
    fontWeight: '700',
  },
  verificationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
  },
  verificationLabel: { ...typography.subhead, color: colors.textMuted },
  verificationValue: {
    ...typography.subhead,
    color: colors.textPrimary,
    flex: 1,
    textAlign: 'right',
  },
  verificationBody: { ...typography.subhead, color: colors.textSecondary, lineHeight: 20 },
  verificationSubTitle: {
    ...typography.subhead,
    color: colors.textPrimary,
    fontWeight: '700',
    marginTop: spacing.sm,
  },
  verificationBadge: {
    ...typography.caption1,
    fontWeight: '700',
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    overflow: 'hidden',
  },
  confidenceHigh: { color: colors.approved, backgroundColor: colors.approvedLight },
  confidenceMedium: { color: colors.warning, backgroundColor: colors.warningLight },
  confidenceLow: { color: colors.restricted, backgroundColor: colors.restrictedLight },

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
