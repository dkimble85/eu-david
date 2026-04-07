import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import { X } from 'lucide-react-native';
import BarcodeScanner from '@/components/BarcodeScanner';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useScanner } from '@/hooks/useScanner';

export default function ScanScreen() {
  const [cameraActive, setCameraActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isFocused = useIsFocused();
  const { user, loading: authLoading } = useAuth();
  const wasFocusedRef = useRef(false);

  const handleScan = useCallback(
    async (barcode: string) => {
      if (loading) return;
      setLoading(true);
      setError(null);
      try {
        router.push(`/product/${barcode}?from=scan`);
      } catch {
        setError('Failed to look up product. Please try again.');
        scanner.resume();
      } finally {
        setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [loading]
  );

  const scanner = useScanner(handleScan);
  const shouldRenderCamera = isFocused && cameraActive && scanner.state === 'scanning';

  React.useEffect(() => {
    if (!isFocused) {
      setCameraActive(false);
      scanner.pause();
      setLoading(false);
      return;
    }

    if (!authLoading && user && !cameraActive) {
      setError(null);
      setCameraActive(true);
      scanner.start();
    }
  }, [isFocused, authLoading, user, cameraActive, scanner]);

  React.useEffect(() => {
    const returnedToFocusedScreen = isFocused && !wasFocusedRef.current;
    if (returnedToFocusedScreen && cameraActive && !loading) {
      setError(null);
      scanner.resume();
    }
    wasFocusedRef.current = isFocused;
  }, [isFocused, cameraActive, loading, scanner]);

  React.useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/(auth)/scan');
    }
  }, [authLoading, user]);

  function closeScanner() {
    setCameraActive(false);
    scanner.pause();
    router.replace('/history');
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.scannerWrapper}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={closeScanner}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Close scanner"
          >
            <X size={20} color={colors.textPrimary} />
          </TouchableOpacity>
          <BarcodeScanner
            onScan={scanner.handleDecode}
            active={shouldRenderCamera}
            autoRequestPermission={isFocused}
          />
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
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: {
    flex: 1,
    padding: spacing.lg,
    justifyContent: 'center',
  },
  scannerWrapper: { flex: 1, justifyContent: 'center', gap: spacing.md },
  closeButton: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    zIndex: 3,
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: 'rgba(15, 17, 23, 0.82)',
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
});
