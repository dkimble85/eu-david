import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { colors, radius, spacing, typography } from '@/constants/theme';
import type { ScoredAlternative } from '@/hooks/useAlternatives';

type Props = {
  alternatives: ScoredAlternative[];
  loading: boolean;
};

export default function AlternativesList({ alternatives, loading }: Props) {
  if (!loading && alternatives.length === 0) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Better Alternatives</Text>
      <Text style={styles.sectionSubtitle}>Similar products with fewer flagged additives</Text>

      {loading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={colors.euGold} />
          <Text style={styles.loadingText}>Finding alternatives...</Text>
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {alternatives.map((alt, index) => (
            <AlternativeCard key={index} alt={alt} />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function ScoreRing({ score }: { score: number }) {
  const color = score >= 80 ? colors.approved : score >= 50 ? colors.warning : colors.restricted;

  return (
    <View style={[styles.scoreRing, { borderColor: color }]}>
      <Text style={[styles.scoreNumber, { color }]}>{score}</Text>
    </View>
  );
}

function AlternativeCard({ alt }: { alt: ScoredAlternative }) {
  const flagCount =
    alt.result.banned.length + alt.result.restricted.length + alt.result.warning.length;

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.8}
      onPress={() => alt.product.barcode && router.push(`/product/${alt.product.barcode}`)}
    >
      <View style={styles.cardTop}>
        {alt.product.imageUrl ? (
          <Image source={{ uri: alt.product.imageUrl }} style={styles.image} resizeMode="contain" />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Text style={styles.placeholderEmoji}>🛒</Text>
          </View>
        )}
        <ScoreRing score={alt.score} />
      </View>

      <Text style={styles.productName} numberOfLines={2}>
        {alt.product.name}
      </Text>
      {alt.product.brand && (
        <Text style={styles.brand} numberOfLines={1}>
          {alt.product.brand}
        </Text>
      )}
      <Text style={styles.flagCount}>
        {flagCount === 0 ? '✓ No flags' : `${flagCount} flag${flagCount > 1 ? 's' : ''}`}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  sectionTitle: {
    ...typography.headline,
    color: colors.textPrimary,
  },
  sectionSubtitle: {
    ...typography.subhead,
    color: colors.textSecondary,
    marginTop: -spacing.xs,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  loadingText: {
    ...typography.subhead,
    color: colors.textSecondary,
  },
  scrollContent: {
    gap: spacing.md,
    paddingVertical: spacing.xs,
    paddingRight: spacing.lg,
  },
  card: {
    width: 148,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.xs,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.xs,
  },
  image: {
    width: 56,
    height: 56,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceElevated,
  },
  imagePlaceholder: {
    width: 56,
    height: 56,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderEmoji: { fontSize: 24 },
  scoreRing: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreNumber: {
    ...typography.caption1,
    fontWeight: '700',
  },
  productName: {
    ...typography.subhead,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  brand: {
    ...typography.caption1,
    color: colors.textMuted,
  },
  flagCount: {
    ...typography.caption2,
    color: colors.approved,
    marginTop: spacing.xs,
  },
});
