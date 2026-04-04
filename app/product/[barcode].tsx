import React, { useState } from 'react';
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
import { useProfile } from '@/hooks/useProfile';
import { useAlternatives } from '@/hooks/useAlternatives';
import { scoreProduct } from '@/lib/eu-check';
import ProductCard from '@/components/ProductCard';
import IngredientList from '@/components/IngredientList';
import AlternativesList from '@/components/AlternativesList';
import type { CheckedIngredient } from '@/lib/eu-check';

export default function ProductScreen() {
  const { barcode } = useLocalSearchParams<{ barcode: string }>();
  const { user } = useAuth();
  const { profile } = useProfile(user);

  const { data, isLoading, isError, refetch } = useProduct(barcode ?? '');
  const [selectedIngredient, setSelectedIngredient] = useState<CheckedIngredient | null>(null);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState(false);

  const offProduct = data?.off ?? null;
  const fsProduct = data?.fs ?? null;
  const euResult = data?.euResult ?? null;

  const currentScore = euResult ? scoreProduct(euResult) : 100;
  const { alternatives, loading: altLoading } = useAlternatives(
    barcode ?? '',
    offProduct?.categoriesTags ?? [],
    currentScore,
    profile.glutenFree
  );

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

  const productName = offProduct?.name ?? fsProduct?.name ?? 'Unknown Product';
  const brand = offProduct?.brand ?? fsProduct?.brand ?? null;

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
            name={productName}
            brand={brand}
            imageUrl={offProduct?.imageUrl ?? null}
            result={euResult}
          />
        )}

        {fsProduct?.nutrition && (
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

        <View style={styles.ingredientsSection}>
          <Text style={styles.sectionTitle}>Ingredient Analysis</Text>
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

        {offProduct?.ingredientsText && (
          <View style={styles.rawCard}>
            <Text style={styles.sectionTitle}>Full Ingredients</Text>
            <Text style={styles.rawText}>{offProduct.ingredientsText}</Text>
          </View>
        )}

        <AlternativesList alternatives={alternatives} loading={altLoading} />
      </ScrollView>

      <IngredientDetailModal
        ingredient={selectedIngredient}
        onClose={() => setSelectedIngredient(null)}
      />
    </SafeAreaView>
  );
}

function NutritionItem({ label, value, unit }: { label: string; value: string | null; unit: string }) {
  if (!value) return null;
  return (
    <View style={styles.nutritionItem}>
      <Text style={styles.nutritionValue}>{value}{unit}</Text>
      <Text style={styles.nutritionLabel}>{label}</Text>
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
        {ingredient.notes && (
          <Text style={styles.modalNotes}>{ingredient.notes}</Text>
        )}
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
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl },
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
  allergenText: { ...typography.caption1, color: colors.warning, fontWeight: '600', textTransform: 'capitalize' },

  ingredientsSection: { gap: spacing.sm },

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
