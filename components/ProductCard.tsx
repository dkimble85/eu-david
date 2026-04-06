import React from 'react';
import { StyleSheet, Text, View, Image } from 'react-native';
import { colors, radius, spacing, typography } from '@/constants/theme';
import type { EuCheckResult } from '@/lib/eu-check';

type Props = {
  name: string;
  brand: string | null;
  imageUrl: string | null;
  result: EuCheckResult;
};

export default function ProductCard({ name, brand, imageUrl, result }: Props) {
  const overallStatus = !result.hasAnyIngredientData
    ? 'unknown'
    : result.banned.length > 0
      ? 'banned'
      : result.restricted.length > 0
        ? 'restricted'
        : result.warning.length > 0
          ? 'warning'
          : 'approved';

  const statusConfig = {
    banned: { color: colors.banned, label: 'Contains EU Banned Ingredients', emoji: '🚫' },
    restricted: { color: colors.restricted, label: 'Contains Restricted Ingredients', emoji: '⚠️' },
    warning: { color: colors.warning, label: 'Warning Label Required in EU', emoji: '⚠️' },
    approved: { color: colors.approved, label: 'EU Compliant', emoji: '✓' },
    unknown: { color: colors.unknown, label: 'Ingredients Could Not Be Found', emoji: 'ℹ️' },
  }[overallStatus];

  return (
    <View style={[styles.card, { borderTopColor: statusConfig.color }]}>
      <View style={styles.header}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.image} resizeMode="contain" />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Text style={styles.imagePlaceholderText}>🛒</Text>
          </View>
        )}
        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={2}>
            {name}
          </Text>
          {brand && <Text style={styles.brand}>{brand}</Text>}
          <View style={[styles.statusBadge, { backgroundColor: `${statusConfig.color}22` }]}>
            <Text style={styles.statusEmoji}>{statusConfig.emoji}</Text>
            <Text style={[styles.statusLabel, { color: statusConfig.color }]}>
              {statusConfig.label}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.stats}>
        <StatChip count={result.banned.length} label="Banned" color={colors.banned} />
        <StatChip count={result.restricted.length} label="Restricted" color={colors.restricted} />
        <StatChip count={result.warning.length} label="Warning" color={colors.warning} />
        <StatChip count={result.approved.length} label="OK" color={colors.approved} />
      </View>
    </View>
  );
}

function StatChip({ count, label, color }: { count: number; label: string; color: string }) {
  return (
    <View style={[styles.chip, { opacity: count > 0 ? 1 : 0.35 }]}>
      <Text style={[styles.chipCount, { color }]}>{count}</Text>
      <Text style={styles.chipLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderTopWidth: 3,
    overflow: 'hidden',
    padding: spacing.md,
    gap: spacing.md,
  },
  header: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  image: {
    width: 80,
    height: 80,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceElevated,
  },
  imagePlaceholder: {
    width: 80,
    height: 80,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imagePlaceholderText: { fontSize: 32 },
  info: { flex: 1, gap: spacing.sm },
  name: { ...typography.headline, color: colors.textPrimary },
  brand: { ...typography.subhead, color: colors.textSecondary },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    gap: spacing.xs,
  },
  statusEmoji: { fontSize: 12 },
  statusLabel: { ...typography.caption1, fontWeight: '600' },
  stats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
  },
  chip: { alignItems: 'center', gap: 2 },
  chipCount: { ...typography.title3 },
  chipLabel: { ...typography.caption2, color: colors.textMuted },
});
