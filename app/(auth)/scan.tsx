import React from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';

export default function GuestScanScreen() {
  const { user, loading } = useAuth();

  React.useEffect(() => {
    if (!loading && user) {
      router.replace('/(tabs)/scan');
    }
  }, [loading, user]);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.heroHeader}>
          <Image source={require('@/assets/logo.png')} style={styles.logoImage} />
        </View>

        <View style={styles.cta}>
          <View style={styles.heroCard}>
            <View style={styles.heroCardHeader}>
              <Text style={styles.heroEyebrow}>EU barcode checker</Text>
              <Text style={styles.heroTitle}>Check yourself before you wreck yourself</Text>
              <Text style={styles.heroBody}>
                Instantly spot ingredients that are banned, restricted, or warning-labeled in the
                European Union.
              </Text>
            </View>
            <View style={styles.illustrationBox}>
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

          <Text style={styles.signInHint}>Sign in to start scanning and save results.</Text>

          <TouchableOpacity
            style={styles.scanButton}
            onPress={() => router.push('/(auth)/login')}
            activeOpacity={0.8}
          >
            <Text style={styles.scanButtonText}>Sign In to Scan</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: {
    flexGrow: 1,
    padding: spacing.lg,
    gap: spacing.md,
    justifyContent: 'center',
  },
  heroHeader: { alignItems: 'center', marginTop: -spacing.sm, marginBottom: spacing.xs },
  logoImage: {
    alignSelf: 'center',
    resizeMode: 'contain',
    width: 313,
    height: 210,
  },
  cta: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
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
  heroPoints: {
    gap: spacing.xs,
  },
  heroPoint: {
    ...typography.subhead,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  signInHint: {
    ...typography.caption1,
    color: colors.textMuted,
    textAlign: 'center',
    maxWidth: 280,
  },
  barcodeImage: {
    width: '88%',
    height: '70%',
  },
  scanButton: {
    backgroundColor: colors.euBlue,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    alignSelf: 'stretch',
    alignItems: 'center',
    shadowColor: colors.euBlue,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 8,
  },
  scanButtonText: { ...typography.title2, color: '#fff', fontWeight: '800' },
});
