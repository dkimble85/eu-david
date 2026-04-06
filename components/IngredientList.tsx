import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView } from 'react-native';
import { colors, radius, spacing, typography, statusColors } from '@/constants/theme';
import IngredientBadge from './IngredientBadge';
import type { CheckedIngredient } from '@/lib/eu-check';
import type { AdditiveStatus } from '@/constants/theme';

type Props = {
  ingredients: CheckedIngredient[];
  onIngredientPress?: (ingredient: CheckedIngredient) => void;
};

const STATUS_ORDER: AdditiveStatus[] = ['banned', 'restricted', 'warning', 'approved', 'unknown'];

const SECTION_TITLES: Record<AdditiveStatus, string> = {
  banned: 'Banned in EU',
  restricted: 'Restricted in EU',
  warning: 'Warning Label Required',
  approved: 'EU Approved',
  unknown: 'Unknown Status',
};

export default function IngredientList({ ingredients, onIngredientPress }: Props) {
  const grouped = STATUS_ORDER.reduce(
    (acc, status) => {
      const items = ingredients.filter((i) => i.status === status);
      if (items.length > 0) acc[status] = items;
      return acc;
    },
    {} as Partial<Record<AdditiveStatus, CheckedIngredient[]>>
  );

  if (ingredients.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No additives or E-numbers detected.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
      {STATUS_ORDER.map((status) => {
        const items = grouped[status];
        if (!items) return null;
        const palette = statusColors[status];
        return (
          <View key={status} style={styles.section}>
            <View style={[styles.sectionHeader, { borderLeftColor: palette.text }]}>
              <Text style={[styles.sectionTitle, { color: palette.text }]}>
                {SECTION_TITLES[status]}
              </Text>
              <View style={[styles.countBadge, { backgroundColor: palette.bg }]}>
                <Text style={[styles.countText, { color: palette.text }]}>{items.length}</Text>
              </View>
            </View>
            {items.map((ingredient) => (
              <IngredientRow
                key={ingredient.key}
                ingredient={ingredient}
                onPress={onIngredientPress}
              />
            ))}
          </View>
        );
      })}
    </ScrollView>
  );
}

function IngredientRow({
  ingredient,
  onPress,
}: {
  ingredient: CheckedIngredient;
  onPress?: (ingredient: CheckedIngredient) => void;
}) {
  const palette = statusColors[ingredient.status];

  return (
    <TouchableOpacity
      style={[styles.row, { borderLeftColor: palette.text }]}
      onPress={() => onPress?.(ingredient)}
      activeOpacity={0.7}
    >
      <View style={styles.rowContent}>
        <Text style={styles.rowName}>{ingredient.name}</Text>
        {ingredient.isENumber && <Text style={styles.rowKey}>{ingredient.key.toUpperCase()}</Text>}
        {ingredient.notes && (
          <Text style={styles.rowNotes} numberOfLines={2}>
            {ingredient.notes}
          </Text>
        )}
      </View>
      <IngredientBadge status={ingredient.status} compact />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  section: { marginBottom: spacing.lg },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderLeftWidth: 3,
    paddingLeft: spacing.sm,
    marginBottom: spacing.sm,
  },
  sectionTitle: { ...typography.subhead, fontWeight: '600' },
  countBadge: {
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    minWidth: 24,
    alignItems: 'center',
  },
  countText: { ...typography.caption2, fontWeight: '700' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderLeftWidth: 3,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  rowContent: { flex: 1, gap: 2 },
  rowName: { ...typography.callout, color: colors.textPrimary, fontWeight: '600' },
  rowKey: { ...typography.caption1, color: colors.textMuted },
  rowNotes: { ...typography.caption1, color: colors.textSecondary, marginTop: 2 },
  empty: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyText: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
});
