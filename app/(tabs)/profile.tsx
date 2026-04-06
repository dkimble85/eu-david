import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Image, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Constants from 'expo-constants';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const releaseVersion = Constants.expoConfig?.version ?? '1.0.0';

  if (!user) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <Text style={styles.emoji}>👤</Text>
          <Text style={styles.title}>Not signed in</Text>
          <TouchableOpacity style={styles.button} onPress={() => router.push('/(auth)/login')}>
            <Text style={styles.buttonText}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.pageTitle}>Settings</Text>
        </View>

        <View style={styles.section}>
          <View style={styles.avatarBox}>
            <Image source={require('@/assets/logo.png')} style={styles.avatarLogo} />
          </View>
          <Text style={styles.email}>{user.email}</Text>
          <Text style={styles.since}>
            Member since{' '}
            {new Date(user.created_at).toLocaleDateString('en-US', {
              month: 'long',
              year: 'numeric',
            })}
          </Text>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.cardTitle}>About EU David</Text>
          <Text style={styles.cardBody}>
            EU David checks food barcodes against the EU positive list of permitted food additives
            (EC Regulation No 1333/2008). Ingredients not on this list are banned by default in the
            European Union.
          </Text>
          <Text style={styles.versionText}>Release version: v{releaseVersion}</Text>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.cardTitle}>Data Sources</Text>
          <Text style={styles.cardBody}>
            • OpenFoodFacts — ingredients and E-numbers{'\n'}• FatSecret — nutrition data{'\n'}• EU
            Regulation 1333/2008 — additive status
          </Text>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.cardTitle}>Navigation</Text>
          <TouchableOpacity
            style={styles.navItem}
            onPress={() => router.push('./regulated-ingredients')}
            activeOpacity={0.8}
          >
            <View style={styles.navItemTextWrap}>
              <Text style={styles.navItemTitle}>Regulated Ingredients</Text>
              <Text style={styles.navItemSubtitle}>
                Browse food + cosmetic ingredient restrictions and EU codes
              </Text>
            </View>
            <Text style={styles.navItemArrow}>›</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.signOutButton} onPress={signOut} activeOpacity={0.85}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  header: { marginBottom: spacing.sm },
  pageTitle: { ...typography.title2, color: colors.textPrimary },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.xl,
  },
  emoji: { fontSize: 56 },
  title: { ...typography.title3, color: colors.textPrimary },
  button: {
    backgroundColor: colors.euBlue,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  buttonText: { ...typography.headline, color: '#fff' },

  section: { alignItems: 'center', gap: spacing.sm },
  avatarBox: {
    width: 80,
    height: 80,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLogo: { width: 64, height: 44, resizeMode: 'contain' },
  email: { ...typography.headline, color: colors.textPrimary },
  since: { ...typography.subhead, color: colors.textMuted },

  infoCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  cardTitle: { ...typography.callout, color: colors.textPrimary, fontWeight: '600' },
  cardBody: { ...typography.subhead, color: colors.textSecondary, lineHeight: 22 },
  versionText: { ...typography.caption1, color: colors.textMuted, marginTop: spacing.xs },
  navItem: {
    marginTop: spacing.xs,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  navItemTextWrap: { flex: 1, gap: 2 },
  navItemTitle: { ...typography.callout, color: colors.textPrimary, fontWeight: '600' },
  navItemSubtitle: { ...typography.caption1, color: colors.textSecondary },
  navItemArrow: { ...typography.title3, color: colors.euGold },

  signOutButton: {
    backgroundColor: colors.bannedLight,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.banned,
    marginTop: spacing.md,
  },
  signOutText: { ...typography.callout, color: colors.banned, fontWeight: '600' },
});
