import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View, FlatList, TouchableOpacity, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { colors, radius, spacing, statusColors, typography } from '@/constants/theme';
import { getRegulatedIngredients, type RegulatedIngredient } from '@/lib/regulated-ingredients';

const DATA = getRegulatedIngredients();

function statusLabel(status: RegulatedIngredient['status']): string {
  if (status === 'approved') return 'Compliant';
  if (status === 'warning') return 'Warning';
  if (status === 'restricted') return 'Restricted';
  if (status === 'banned') return 'Banned';
  return 'Unknown';
}

export default function RegulatedIngredientsScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});

  const filtered = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return DATA;

    return DATA.filter((item) => {
      const haystack = [item.name, item.category, item.euCode, item.source].join(' ').toLowerCase();
      return haystack.includes(query);
    });
  }, [searchQuery]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Regulated Ingredients</Text>
      </View>

      <View style={styles.searchWrap}>
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search ingredient, category, or EU code..."
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const palette = statusColors[item.status];
          const expanded = Boolean(expandedIds[item.id]);

          return (
            <TouchableOpacity
              style={[styles.row, { borderLeftColor: palette.border }]}
              activeOpacity={0.85}
              onPress={() =>
                setExpandedIds((prev) => ({
                  ...prev,
                  [item.id]: !prev[item.id],
                }))
              }
            >
              <View style={styles.rowHeader}>
                <Text style={styles.name}>{item.name}</Text>
                <View style={[styles.statusChip, { backgroundColor: palette.bg }]}>
                  <Text style={[styles.statusText, { color: palette.text }]}>
                    {statusLabel(item.status)}
                  </Text>
                </View>
              </View>

              <View style={styles.metaRow}>
                <Text style={styles.metaText}>EU Code: {item.euCode}</Text>
                <Text style={styles.metaDot}>•</Text>
                <Text style={styles.metaText}>
                  Type: {item.source === 'food' ? 'Food' : 'Cosmetic'}
                </Text>
              </View>

              <Text style={styles.category}>Category: {item.category}</Text>

              {expanded && (
                <View style={styles.detailsWrap}>
                  {item.bannedSince ? (
                    <Text style={styles.detailsText}>Banned since: {item.bannedSince}</Text>
                  ) : null}
                  {item.notes ? <Text style={styles.detailsText}>{item.notes}</Text> : null}
                  {!item.notes && !item.bannedSince ? (
                    <Text style={styles.detailsText}>No additional notes for this ingredient.</Text>
                  ) : null}
                </View>
              )}

              <Text style={styles.expandHint}>
                {expanded ? 'Tap to collapse' : 'Tap to view details'}
              </Text>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No ingredients found</Text>
            <Text style={styles.emptyBody}>Try another search term.</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: spacing.xs,
  },
  backText: { ...typography.callout, color: colors.euGold },
  title: { ...typography.title2, color: colors.textPrimary },
  searchWrap: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  searchInput: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...typography.callout,
    color: colors.textPrimary,
  },
  list: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.sm,
  },
  row: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderLeftWidth: 3,
    padding: spacing.md,
    gap: spacing.xs,
  },
  rowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  name: { ...typography.callout, color: colors.textPrimary, fontWeight: '700' },
  statusChip: {
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  statusText: { ...typography.caption2, fontWeight: '700' },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  metaText: { ...typography.caption1, color: colors.textSecondary },
  metaDot: { ...typography.caption2, color: colors.textMuted },
  category: { ...typography.caption1, color: colors.textMuted },
  detailsWrap: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.sm,
    padding: spacing.sm,
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  detailsText: { ...typography.caption1, color: colors.textSecondary, lineHeight: 18 },
  expandHint: { ...typography.caption2, color: colors.euGold, marginTop: spacing.xs },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
    gap: spacing.sm,
  },
  emptyTitle: { ...typography.title3, color: colors.textPrimary },
  emptyBody: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
});
