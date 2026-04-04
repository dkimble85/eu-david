import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { radius, spacing, statusColors, statusLabels, typography } from '@/constants/theme';
import type { AdditiveStatus } from '@/constants/theme';

type Props = {
  status: AdditiveStatus;
  compact?: boolean;
};

const STATUS_ICONS: Record<AdditiveStatus, string> = {
  banned: '🚫',
  restricted: '⚠️',
  warning: '⚠️',
  approved: '✓',
  unknown: '?',
};

export default function IngredientBadge({ status, compact = false }: Props) {
  const palette = statusColors[status];

  if (compact) {
    return (
      <View style={[styles.compact, { backgroundColor: palette.bg, borderColor: palette.border }]}>
        <Text style={[styles.compactIcon]}>{STATUS_ICONS[status]}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.badge, { backgroundColor: palette.bg, borderColor: palette.border }]}>
      <Text style={styles.icon}>{STATUS_ICONS[status]}</Text>
      <Text style={[styles.label, { color: palette.text }]}>{statusLabels[status]}</Text>
    </View>
  );
}

export function StatusDot({ status }: { status: AdditiveStatus }) {
  const palette = statusColors[status];
  return <View style={[styles.dot, { backgroundColor: palette.text }]} />;
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    gap: spacing.xs,
  },
  icon: {
    fontSize: 12,
  },
  label: {
    ...typography.caption1,
    fontWeight: '600',
  },
  compact: {
    width: 24,
    height: 24,
    borderRadius: radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactIcon: {
    fontSize: 11,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: radius.full,
  },
});
