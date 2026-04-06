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

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={[styles.container, isMobile && styles.containerCompact]}
        showsVerticalScrollIndicator={false}
        scrollEnabled={!cameraActive}
        keyboardShouldPersistTaps="handled"
      >
        {!cameraActive && (
          <View style={styles.heroHeader}>
            <Image
              source={require('@/assets/logo.png')}
              style={[
                styles.logoImageBase,
                isDesktop ? styles.logoImageDesktop : isMobile ? styles.logoImageMobile : styles.logoImageDefault,
              ]}
            />
            <View style={styles.header}>
              <Text style={styles.subtitle}>Scan a barcode to check EU compliance</Text>
            </View>
          </View>
        )}

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
          <View style={[styles.cta, isMobile && styles.ctaCompact]}>
            <View style={[styles.illustrationBox, isMobile && styles.illustrationBoxCompact]}>
              <View style={styles.barcodeRow}>
                {[3, 1, 2, 1, 3, 1, 1, 2, 1, 3, 2, 1, 1, 2, 3, 1, 2, 1, 1, 3].map((width, i) => (
                  <View
                    key={i}
                    style={[
                      styles.barcodeBar,
                      {
                        width: width * 3,
                        backgroundColor: i % 2 === 0 ? colors.textPrimary : 'transparent',
                      },
                    ]}
                  />
                ))}
              </View>
            </View>
            <Text style={styles.ctaTitle}>Check before you eat</Text>
            <Text style={[styles.ctaBody, isMobile && styles.ctaBodyCompact]}>
              Scan with your phone camera to quickly check ingredients banned or restricted in the
              EU.
            </Text>
            {!user && <Text style={styles.signInHint}>Sign in to start scanning barcodes.</Text>}
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
  container: { flexGrow: 1, padding: spacing.lg, gap: spacing.lg },
  containerCompact: { paddingVertical: spacing.md, gap: spacing.md },
  heroHeader: { gap: spacing.lg * 0.119952, marginTop: -spacing.lg * 0.43125 },
  logoImageBase: {
    alignSelf: 'center',
    resizeMode: 'contain',
  },
  logoImageMobile: {
    width: 320,
    height: 214,
  },
  logoImageDefault: {
    width: 480,
    height: 320,
  },
  logoImageDesktop: {
    width: 720,
    height: 480,
  },
  header: { alignItems: 'center', gap: spacing.xs },
  logo: { fontSize: 40 },
  subtitle: { ...typography.title2, color: colors.textSecondary, textAlign: 'center' },

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
  ctaCompact: { gap: spacing.md },
  illustrationBox: {
    width: 120,
    height: 120,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  illustrationBoxCompact: {
    width: 92,
    height: 92,
  },
  illustration: { fontSize: 56 },
  ctaTitle: { ...typography.title2, color: colors.textPrimary, textAlign: 'center' },
  ctaBody: { ...typography.body, color: colors.textSecondary, textAlign: 'center', maxWidth: 300 },
  ctaBodyCompact: { maxWidth: 280 },
  signInHint: { ...typography.caption1, color: colors.textMuted, textAlign: 'center' },
  barcodeRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    height: 64,
    maxWidth: 90,
    overflow: 'hidden',
  },
  barcodeBar: {
    height: '100%',
  },
  scanButton: {
    backgroundColor: colors.euBlue,
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
    alignSelf: 'stretch',
    marginTop: spacing.md,
    alignItems: 'center',
    shadowColor: colors.euBlue,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 8,
  },
  scanButtonText: { ...typography.title2, color: '#fff', fontWeight: '800' },
});
