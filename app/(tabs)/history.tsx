import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import type { ScanHistoryRow, ScanResult } from '@/lib/supabase';

export default function HistoryScreen() {
  const { user } = useAuth();
  const [scans, setScans] = useState<ScanHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);

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
    loadHistory();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  if (!user) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <Text style={styles.emoji}>🔒</Text>
          <Text style={styles.title}>Sign in to view history</Text>
          <Text style={styles.subtitle}>Your scan history is saved to your account.</Text>
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
          <Text style={styles.pageTitle}>Scan History</Text>
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
          <Text style={styles.pageTitle}>Scan History</Text>
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
        <Text style={styles.pageTitle}>Scan History</Text>
      </View>
      <FlatList
        data={scans}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => <HistoryRow item={item} />}
      />
    </SafeAreaView>
  );
}

function HistoryRow({ item }: { item: ScanHistoryRow }) {
  const result = item.result as ScanResult | null;
  const date = new Date(item.scan_date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const statusColor =
    result && result.bannedCount > 0
      ? colors.banned
      : result && result.restrictedCount > 0
      ? colors.restricted
      : colors.approved;

  return (
    <TouchableOpacity
      style={[styles.row, { borderLeftColor: statusColor }]}
      onPress={() => router.push(`/product/${item.barcode}`)}
      activeOpacity={0.7}
    >
      <View style={styles.rowContent}>
        <Text style={styles.rowName} numberOfLines={1}>
          {item.product_name ?? item.barcode}
        </Text>
        <Text style={styles.rowDate}>{date}</Text>
      </View>
      {result && (
        <View style={styles.rowStats}>
          {result.bannedCount > 0 && (
            <Text style={[styles.statChip, { color: colors.banned }]}>
              🚫 {result.bannedCount}
            </Text>
          )}
          {result.restrictedCount > 0 && (
            <Text style={[styles.statChip, { color: colors.restricted }]}>
              ⚠️ {result.restrictedCount}
            </Text>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { padding: spacing.lg, paddingBottom: 0 },
  pageTitle: { ...typography.title2, color: colors.textPrimary },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl },
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
  list: { padding: spacing.lg, gap: spacing.sm },
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
  rowDate: { ...typography.caption1, color: colors.textMuted },
  rowStats: { flexDirection: 'row', gap: spacing.sm },
  statChip: { ...typography.footnote, fontWeight: '600' },
});
