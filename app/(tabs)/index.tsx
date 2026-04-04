import React, { useCallback, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { router } from 'expo-router';
import BarcodeScanner from '@/components/BarcodeScanner';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { useScanner } from '@/hooks/useScanner';

export default function ScanScreen() {
  const [cameraActive, setCameraActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleScan = useCallback(
    async (barcode: string) => {
      setLoading(true);
      setError(null);
      try {
        router.push(`/product/${barcode}`);
      } catch {
        setError('Failed to look up product. Please try again.');
        scanner.resume();
      } finally {
        setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const scanner = useScanner(handleScan);

  function startScanning() {
    setCameraActive(true);
    scanner.start();
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.logo}>🇪🇺</Text>
          <Text style={styles.title}>EU David</Text>
          <Text style={styles.subtitle}>Scan a barcode to check EU compliance</Text>
        </View>

        {cameraActive ? (
          <View style={styles.scannerWrapper}>
            <BarcodeScanner onScan={scanner.handleDecode} active={scanner.state === 'scanning'} />
            {loading && (
              <View style={styles.loadingOverlay}>
                <ActivityIndicator size="large" color={colors.euGold} />
                <Text style={styles.loadingText}>Looking up product...</Text>
              </View>
            )}
            {error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
                <TouchableOpacity onPress={scanner.resume}>
                  <Text style={styles.retryText}>Tap to scan again</Text>
                </TouchableOpacity>
              </View>
            )}
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => {
                setCameraActive(false);
                scanner.pause();
              }}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.cta}>
            <View style={styles.illustrationBox}>
              <Text style={styles.illustration}>🔍</Text>
            </View>
            <Text style={styles.ctaTitle}>Check before you eat</Text>
            <Text style={styles.ctaBody}>
              Scan any food barcode to instantly see which ingredients are banned or restricted in
              the European Union.
            </Text>
            <TouchableOpacity style={styles.scanButton} onPress={startScanning} activeOpacity={0.85}>
              <Text style={styles.scanButtonText}>📷  Start Scanning</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, padding: spacing.lg, gap: spacing.lg },
  header: { alignItems: 'center', gap: spacing.xs },
  logo: { fontSize: 40 },
  title: { ...typography.title2, color: colors.textPrimary },
  subtitle: { ...typography.subhead, color: colors.textSecondary, textAlign: 'center' },

  scannerWrapper: { flex: 1, gap: spacing.md },

  loadingOverlay: {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  loadingText: { ...typography.headline, color: colors.textPrimary },

  errorBox: {
    backgroundColor: colors.bannedLight,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.banned,
    alignItems: 'center',
    gap: spacing.sm,
  },
  errorText: { ...typography.callout, color: colors.banned, textAlign: 'center' },
  retryText: { ...typography.subhead, color: colors.textSecondary },

  cancelButton: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  cancelText: { ...typography.callout, color: colors.textSecondary },

  cta: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg },
  illustrationBox: {
    width: 120,
    height: 120,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  illustration: { fontSize: 56 },
  ctaTitle: { ...typography.title2, color: colors.textPrimary, textAlign: 'center' },
  ctaBody: { ...typography.body, color: colors.textSecondary, textAlign: 'center', maxWidth: 300 },
  scanButton: {
    backgroundColor: colors.euBlue,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    marginTop: spacing.md,
  },
  scanButtonText: { ...typography.headline, color: '#fff' },
});
