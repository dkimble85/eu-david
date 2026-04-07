import React, { useCallback, useRef, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
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
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;
  const isMobile = width < 768;
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

  React.useEffect(() => {
    if (isFocused && !authLoading && user && !cameraActive) {
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

  function startScanning() {
    if (authLoading) return;
    if (!user) {
      router.push('/(auth)/login');
      return;
    }
    setCameraActive(true);
    scanner.start();
  }

  function closeScanner() {
    setCameraActive(false);
    scanner.pause();
    router.replace('/history');
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={[styles.container, isMobile && styles.containerCompact]}
        showsVerticalScrollIndicator={false}
        scrollEnabled={cameraActive}
        keyboardShouldPersistTaps="handled"
      >
        {!cameraActive && !user && (
          <View style={styles.heroHeader}>
            <Image
              source={require('@/assets/logo.png')}
              style={[
                styles.logoImageBase,
                isDesktop
                  ? styles.logoImageDesktop
                  : isMobile
                    ? styles.logoImageMobile
                  : styles.logoImageDefault,
              ]}
            />
          </View>
        )}

        {cameraActive ? (
          <View style={styles.scannerWrapper}>
            <TouchableOpacity style={styles.closeButton} onPress={closeScanner} activeOpacity={0.85}>
              <X size={20} color={colors.textPrimary} />
            </TouchableOpacity>
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
          </View>
        ) : (
          <View style={[styles.cta, isMobile && styles.ctaCompact]}>
            <View style={styles.heroCard}>
              <View style={styles.heroCardHeader}>
                <Text style={styles.heroEyebrow}>EU barcode checker</Text>
                <Text style={styles.heroTitle}>Check yourself before you wreck yourself</Text>
                <Text style={styles.heroBody}>
                  Instantly spot ingredients that are banned, restricted, or warning-labeled in
                  the European Union.
                </Text>
              </View>
              <View style={[styles.illustrationBox, isMobile && styles.illustrationBoxCompact]}>
                <Image
                  source={require('@/assets/barcode-hero.png')}
                  style={styles.barcodeImage}
                  resizeMode="contain"
                />
              </View>
              <View style={styles.heroPoints}>
                <Text style={styles.heroPoint}>Food, beauty, and household products</Text>
              </View>
            </View>
            {!user && <Text style={styles.signInHint}>Sign in to start scanning and save results.</Text>}
            <TouchableOpacity style={styles.scanButton} onPress={startScanning} activeOpacity={0.8}>
              <Text style={styles.scanButtonText}>
                {authLoading ? 'Checking account...' : user ? '📷 Start Scanning' : 'Sign In to Scan'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { flexGrow: 1, padding: spacing.lg, gap: spacing.md, justifyContent: 'center' },
  containerCompact: { paddingVertical: spacing.sm, gap: spacing.sm, justifyContent: 'center' },
  heroHeader: { gap: spacing.xs, marginTop: -spacing.sm },
  logoImageBase: {
    alignSelf: 'center',
    resizeMode: 'contain',
  },
  logoImageMobile: {
    width: 250,
    height: 168,
  },
  logoImageDefault: {
    width: 480,
    height: 320,
  },
  logoImageDesktop: {
    width: 720,
    height: 480,
  },
  scannerWrapper: { flex: 1, gap: spacing.md },
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
  cta: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  ctaCompact: { gap: spacing.sm },
  heroCard: {
    alignSelf: 'stretch',
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  heroCardHeader: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  heroEyebrow: {
    ...typography.caption1,
    color: colors.euGold,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  heroTitle: {
    ...typography.title2,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  heroBody: {
    ...typography.callout,
    color: colors.textSecondary,
    textAlign: 'center',
    maxWidth: 300,
  },
  illustrationBox: {
    alignSelf: 'center',
    width: '100%',
    height: 132,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  illustrationBoxCompact: {
    height: 116,
  },
  heroPoints: {
    gap: spacing.xs,
  },
  heroPoint: {
    ...typography.subhead,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  signInHint: { ...typography.caption1, color: colors.textMuted, textAlign: 'center', maxWidth: 280 },
  barcodeImage: {
    width: '88%',
    height: '70%',
  },
  scanButton: {
    backgroundColor: colors.euBlue,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    alignSelf: 'stretch',
    marginTop: spacing.sm,
    alignItems: 'center',
    shadowColor: colors.euBlue,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 8,
  },
  scanButtonText: { ...typography.title2, color: '#fff', fontWeight: '800' },
});
