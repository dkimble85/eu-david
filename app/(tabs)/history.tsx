import React, { useEffect, useMemo, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import {
  CircleCheck,
  Flag,
  Grid2x2,
  Heart,
  House,
  Sparkles,
  UtensilsCrossed,
} from 'lucide-react-native';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import type { ProductType } from '@/lib/product-type';
import type { ScanHistoryRow, ScanResult } from '@/lib/supabase';
import { loadFavoriteBarcodes } from '@/lib/user-product-data';

type HistoryFilter = 'all' | 'favorites' | 'food' | 'beauty' | 'household' | 'approved' | 'flagged';

type HistoryStatus = 'banned' | 'restricted' | 'warning' | 'approved' | 'unknown';

type HistoryItem = {
  row: ScanHistoryRow;
  productType: ProductType;
  status: HistoryStatus;
};

const FILTERS: Array<{ key: HistoryFilter; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'favorites', label: 'Favorites' },
  { key: 'food', label: 'Food' },
  { key: 'beauty', label: 'Beauty' },
  { key: 'household', label: 'Household' },
  { key: 'approved', label: 'Compliant' },
  { key: 'flagged', label: 'Flagged' },
];

const FILTER_ICONS: Record<HistoryFilter, React.ComponentType<{ color: string; size?: number }>> = {
  all: Grid2x2,
  favorites: Heart,
  food: UtensilsCrossed,
  beauty: Sparkles,
  household: House,
  approved: CircleCheck,
  flagged: Flag,
};

function getHistoryStatus(result: ScanResult | null): HistoryStatus {
  if (!result) return 'unknown';
  if (result.bannedCount > 0) return 'banned';
  if (result.restrictedCount > 0) return 'restricted';
  if (result.warningCount > 0) return 'warning';
  return 'approved';
}

function getProductType(result: ScanResult | null): ProductType {
  const type = result?.productType;
  if (type === 'food' || type === 'beauty' || type === 'household' || type === 'unknown') {
    return type;
  }
  return 'unknown';
}

export default function HistoryScreen() {
  const { user } = useAuth();
  const isFocused = useIsFocused();
  const [scans, setScans] = useState<ScanHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [activeFilter, setActiveFilter] = useState<HistoryFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [favoriteBarcodes, setFavoriteBarcodes] = useState<Set<string>>(new Set());

  function loadHistory() {
    if (!user) return;
    setLoading(true);
    setFetchError(false);
    supabase
      .from('scan_history')
      .select('*')
      .order('scan_date', { ascending: false })
      .limit(50)
      .then(({ data, error }) => {
        if (error) {
          setFetchError(true);
        } else if (data) {
          setScans(data as ScanHistoryRow[]);
        }
        setLoading(false);
      });
  }

  useEffect(() => {
    if (!isFocused) return;
    loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isFocused]);

  useEffect(() => {
    if (!isFocused) return;
    if (!user) {
      setFavoriteBarcodes(new Set());
      return;
    }
    loadFavoriteBarcodes(user.id).then((barcodes) => {
      setFavoriteBarcodes(barcodes);
    });
  }, [user, isFocused]);

  const historyItems = useMemo<HistoryItem[]>(() => {
    return scans.map((row) => {
      const result = row.result as ScanResult | null;
      return {
        row,
        productType: getProductType(result),
        status: getHistoryStatus(result),
      };
    });
  }, [scans]);

  const filteredItems = useMemo(() => {
    if (activeFilter === 'all') return historyItems;
    if (activeFilter === 'favorites') {
      return historyItems.filter((item) => favoriteBarcodes.has(item.row.barcode));
    }
    if (activeFilter === 'approved')
      return historyItems.filter((item) => item.status === 'approved');
    if (activeFilter === 'flagged')
      return historyItems.filter(
        (item) =>
          item.status === 'banned' || item.status === 'restricted' || item.status === 'warning'
      );
    return historyItems.filter((item) => item.productType === activeFilter);
  }, [activeFilter, favoriteBarcodes, historyItems]);

  const visibleItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return filteredItems;

    return filteredItems.filter((item) => {
      const name = (item.row.product_name ?? '').toLowerCase();
      const barcode = item.row.barcode.toLowerCase();
      return name.includes(query) || barcode.includes(query);
    });
  }, [filteredItems, searchQuery]);

  if (!user) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <Text style={styles.emoji}>🔒</Text>
          <Text style={styles.title}>Sign in to view history</Text>
          <Text style={styles.subtitle}>Your scanned items are saved to your account.</Text>
          <TouchableOpacity style={styles.button} onPress={() => router.push('/(auth)/login')}>
            <Text style={styles.buttonText}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (fetchError) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Text style={styles.pageTitle}>History</Text>
        </View>
        <View style={styles.centered}>
          <Text style={styles.emoji}>⚠️</Text>
          <Text style={styles.title}>Couldn't load history</Text>
          <Text style={styles.subtitle}>Check your connection and try again.</Text>
          <TouchableOpacity style={styles.button} onPress={loadHistory}>
            <Text style={styles.buttonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <ActivityIndicator color={colors.euGold} />
        </View>
      </SafeAreaView>
    );
  }

  if (scans.length === 0) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Text style={styles.pageTitle}>History</Text>
        </View>
        <View style={styles.centered}>
          <Text style={styles.emoji}>📋</Text>
          <Text style={styles.title}>No scans yet</Text>
          <Text style={styles.subtitle}>Start scanning products to build your history.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.pageTitle}>History</Text>
        <Text style={styles.caption}>Showing your latest 50 scanned items</Text>
      </View>
      <View style={styles.searchWrap}>
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search history by name or barcode..."
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filtersScroll}
        contentContainerStyle={styles.filtersRow}
      >
        {FILTERS.map((filter) => {
          const active = activeFilter === filter.key;
          const Icon = FILTER_ICONS[filter.key];
          return (
            <TouchableOpacity
              key={filter.key}
              style={[styles.filterChip, active && styles.filterChipActive]}
              onPress={() => setActiveFilter(filter.key)}
            >
              <Icon size={14} color={active ? '#fff' : colors.textSecondary} />
              <Text style={[styles.filterText, active && styles.filterTextActive]}>
                {filter.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      <View style={styles.sectionDivider} />
      {visibleItems.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.title}>No items for this filter</Text>
          <Text style={styles.subtitle}>
            {searchQuery.trim()
              ? 'Try a different search term.'
              : 'Try switching to another filter.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={visibleItems}
          keyExtractor={(item) => item.row.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => <HistoryRow item={item} />}
        />
      )}
    </SafeAreaView>
  );
}

function HistoryRow({ item }: { item: HistoryItem }) {
  const result = item.row.result as ScanResult | null;
  const date = new Date(item.row.scan_date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const statusColor =
    item.status === 'banned'
      ? colors.banned
      : item.status === 'restricted'
        ? colors.restricted
        : item.status === 'warning'
          ? colors.warning
          : item.status === 'approved'
            ? colors.approved
            : colors.unknown;

  const statusBg =
    item.status === 'banned'
      ? colors.bannedLight
      : item.status === 'restricted'
        ? colors.restrictedLight
        : item.status === 'warning'
          ? colors.warningLight
          : item.status === 'approved'
            ? colors.approvedLight
            : colors.unknownLight;

  const typeLabel =
    item.productType === 'household'
      ? 'Household'
      : item.productType === 'beauty'
        ? 'Beauty'
        : item.productType === 'food'
          ? 'Food'
          : 'Unknown';

  return (
    <TouchableOpacity
      style={[styles.row, { borderLeftColor: statusColor, backgroundColor: statusBg }]}
      onPress={() => router.push(`/product/${item.row.barcode}?from=history`)}
      activeOpacity={0.7}
    >
      <View style={styles.rowContent}>
        <Text style={styles.rowName} numberOfLines={1}>
          {item.row.product_name ?? item.row.barcode}
        </Text>
        <View style={styles.rowMeta}>
          <Text style={styles.rowDate}>{date}</Text>
          <Text style={styles.rowType}>{typeLabel}</Text>
          <Text style={[styles.rowStatus, { color: statusColor }]}>
            {item.status === 'banned'
              ? 'Banned'
              : item.status === 'restricted'
                ? 'Restricted'
                : item.status === 'warning'
                  ? 'Warning'
                  : item.status === 'approved'
                    ? 'Approved'
                    : 'Unknown'}
          </Text>
        </View>
      </View>
      {result && (
        <View style={styles.rowStats}>
          {result.bannedCount > 0 && (
            <Text style={[styles.statChip, { color: colors.banned }]}>🚫 {result.bannedCount}</Text>
          )}
          {result.restrictedCount > 0 && (
            <Text style={[styles.statChip, { color: colors.restricted }]}>
              ⚠️ {result.restrictedCount}
            </Text>
          )}
          {result.warningCount > 0 && (
            <Text style={[styles.statChip, { color: colors.warning }]}>
              ⚠ {result.warningCount}
            </Text>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { padding: spacing.lg, paddingBottom: spacing.sm, gap: spacing.xs },
  pageTitle: { ...typography.title2, color: colors.textPrimary },
  caption: { ...typography.caption1, color: colors.textMuted },
  searchWrap: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
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
  filtersRow: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
  },
  filtersScroll: {
    flexGrow: 0,
    flexShrink: 0,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignSelf: 'flex-start',
    flexShrink: 0,
  },
  filterChipActive: {
    backgroundColor: colors.euBlue,
    borderColor: colors.euBlue,
  },
  filterText: {
    ...typography.caption1,
    color: colors.textSecondary,
    fontWeight: '600',
    flexShrink: 0,
  },
  filterTextActive: { color: '#fff' },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.xl,
  },
  emoji: { fontSize: 56 },
  title: { ...typography.title3, color: colors.textPrimary, textAlign: 'center' },
  subtitle: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
  button: {
    backgroundColor: colors.euBlue,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    marginTop: spacing.sm,
  },
  buttonText: { ...typography.headline, color: '#fff' },
  list: { padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing.xxl },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderLeftWidth: 3,
    padding: spacing.md,
    gap: spacing.md,
  },
  rowContent: { flex: 1, gap: 2 },
  rowName: { ...typography.callout, color: colors.textPrimary, fontWeight: '600' },
  rowMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rowDate: { ...typography.caption1, color: colors.textMuted },
  rowType: { ...typography.caption2, color: colors.textSecondary },
  rowStatus: { ...typography.caption2, fontWeight: '700' },
  rowStats: { flexDirection: 'row', gap: spacing.sm },
  statChip: { ...typography.footnote, fontWeight: '600' },
});
