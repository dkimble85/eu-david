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
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { CATEGORIES, SCORE_FILTERS, US_STORES } from '@/lib/recommendations';
import { useRecommendations } from '@/hooks/useRecommendations';
import type { ScoreFilter, ScoredProduct } from '@/lib/recommendations';

export default function RecommendationsScreen() {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedStore, setSelectedStore]       = useState<string | null>(null);
  const [scoreFilter, setScoreFilter]           = useState<ScoreFilter>('excellent');
  const [searchQuery, setSearchQuery]           = useState('');
  const [submittedQuery, setSubmittedQuery]     = useState('');

  const { data, isLoading, isError, refetch } = useRecommendations(
    selectedCategory,
    submittedQuery,
    scoreFilter,
    selectedStore
  );

  const handleSearch = useCallback(() => {
    setSubmittedQuery(searchQuery.trim());
  }, [searchQuery]);

  const handleCategoryPress = useCallback((tag: string) => {
    setSelectedCategory((prev) => (prev === tag ? null : tag));
    setSubmittedQuery('');
    setSearchQuery('');
  }, []);

  const handleStorePress = useCallback((tag: string) => {
    setSelectedStore((prev) => (prev === tag ? null : tag));
  }, []);

  const hasFilters = !!selectedCategory || !!submittedQuery;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>Recommendations</Text>
        <Text style={styles.subtitle}>Top-rated US products with clean EU scores</Text>
      </View>

      {/* Search */}
      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={handleSearch}
          placeholder="Search products..."
          placeholderTextColor={colors.textMuted}
          returnKeyType="search"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TouchableOpacity style={styles.searchButton} onPress={handleSearch}>
          <Text style={styles.searchButtonText}>Search</Text>
        </TouchableOpacity>
      </View>

      {/* Store filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipsRow}
      >
        {US_STORES.map((store) => {
          const active = selectedStore === store.tag;
          return (
            <TouchableOpacity
              key={store.tag}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => handleStorePress(store.tag)}
              activeOpacity={0.7}
            >
              <Text style={styles.chipEmoji}>{store.emoji}</Text>
              <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>
                {store.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Category filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipsRow}
      >
        {CATEGORIES.map((cat) => {
          const active = selectedCategory === cat.tag;
          return (
            <TouchableOpacity
              key={cat.tag}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => handleCategoryPress(cat.tag)}
              activeOpacity={0.7}
            >
              <Text style={styles.chipEmoji}>{cat.emoji}</Text>
              <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>
                {cat.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Score filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        {SCORE_FILTERS.map((f) => {
          const active = scoreFilter === f.key;
          return (
            <TouchableOpacity
              key={f.key}
              style={[styles.filterChip, active && styles.filterChipActive]}
              onPress={() => setScoreFilter(f.key)}
              activeOpacity={0.7}
            >
              <Text style={[styles.filterLabel, active && styles.filterLabelActive]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Results */}
      {!hasFilters ? (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>⭐</Text>
          <Text style={styles.emptyTitle}>Find top-rated products</Text>
          <Text style={styles.emptyBody}>
            Filter by store or category to browse US products scored by their EU additive status.
          </Text>
        </View>
      ) : isLoading ? (
        <View style={styles.empty}>
          <ActivityIndicator size="large" color={colors.euGold} />
          <Text style={styles.emptyBody}>Finding products...</Text>
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
          <Text style={styles.emptyBody}>
            Try a different store, category, or lower the score filter.
          </Text>
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item, i) => item.product.barcode ?? `${i}`}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => <ProductRow item={item} />}
        />
      )}
    </SafeAreaView>
  );
}

function ScoreRing({ score }: { score: number }) {
  const color =
    score === 100 ? colors.approved
    : score >= 80  ? colors.approved
    : score >= 60  ? colors.warning
    :                colors.restricted;

  return (
    <View style={[styles.scoreRing, { borderColor: color }]}>
      <Text style={[styles.scoreNumber, { color }]}>{score}</Text>
    </View>
  );
}

function ProductRow({ item }: { item: ScoredProduct }) {
  const { product, result, score } = item;
  const flagCount = result.banned.length + result.restricted.length + result.warning.length;

  // Map the first matching store tag to a readable label
  const storeLabel = (() => {
    if (!product.stores.length) return null;
    const match = US_STORES.find((s) => product.stores.includes(s.tag));
    return match ? `${match.emoji} ${match.label}` : null;
  })();

  return (
    <TouchableOpacity
      style={styles.row}
      activeOpacity={0.8}
      onPress={() => product.barcode && router.push(`/product/${product.barcode}`)}
    >
      {product.imageUrl ? (
        <Image source={{ uri: product.imageUrl }} style={styles.rowImage} resizeMode="contain" />
      ) : (
        <View style={styles.rowImagePlaceholder}>
          <Text style={styles.rowPlaceholderEmoji}>🛒</Text>
        </View>
      )}

      <View style={styles.rowInfo}>
        <Text style={styles.rowName} numberOfLines={2}>{product.name}</Text>
        {product.brand && (
          <Text style={styles.rowBrand} numberOfLines={1}>{product.brand}</Text>
        )}
        <View style={styles.rowMeta}>
          <Text style={[styles.rowFlags, flagCount === 0 && styles.rowFlagsClean]}>
            {flagCount === 0 ? '✓ No flags' : `${flagCount} flag${flagCount > 1 ? 's' : ''}`}
          </Text>
          {storeLabel && <Text style={styles.rowStore}>{storeLabel}</Text>}
        </View>
      </View>

      <ScoreRing score={score} />
    </TouchableOpacity>
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
  },
  searchButtonText: { ...typography.callout, color: '#fff', fontWeight: '600' },

  chipsRow: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surface,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  chipActive: {
    backgroundColor: `${colors.euBlue}33`,
    borderColor: colors.euBlue,
  },
  chipEmoji: { fontSize: 14 },
  chipLabel: { ...typography.caption1, color: colors.textSecondary, fontWeight: '600' },
  chipLabelActive: { color: colors.euGold },

  filterRow: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  filterChip: {
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  filterChipActive: {
    backgroundColor: `${colors.euGold}22`,
    borderColor: colors.euGold,
  },
  filterLabel: { ...typography.caption1, color: colors.textMuted, fontWeight: '600' },
  filterLabelActive: { color: colors.euGold },

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
  rowStore: { ...typography.caption2, color: colors.textMuted },

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
