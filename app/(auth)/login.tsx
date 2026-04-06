import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
} from 'react-native';
import { Link, router } from 'expo-router';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';

export default function LoginScreen() {
  const { signIn, signInWithGoogle, user, loading: authLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin() {
    if (!email || !password) {
      setError('Please enter your email and password.');
      return;
    }
    setEmailLoading(true);
    setError(null);
    try {
      await signIn(email, password);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Login failed. Please try again.');
    } finally {
      setEmailLoading(false);
    }
  }

  async function handleGoogleLogin() {
    setGoogleLoading(true);
    setError(null);
    try {
      await signInWithGoogle();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Google sign-in failed. Please try again.');
    } finally {
      setGoogleLoading(false);
    }
  }

  useEffect(() => {
    if (user) {
      router.replace('/(tabs)');
      return;
    }
    if (user || !authLoading) {
      setGoogleLoading(false);
    }
  }, [user, authLoading]);

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Image source={require('@/assets/logo.png')} style={styles.logo} />
          <Text style={styles.title}>EU David</Text>
          <Text style={styles.subtitle}>Know what's in your food</Text>
        </View>

        <View style={styles.form}>
          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <View style={styles.field}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="you@example.com"
              placeholderTextColor={colors.textMuted}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="••••••••"
              placeholderTextColor={colors.textMuted}
            />
          </View>

          <TouchableOpacity
            style={[styles.button, emailLoading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={emailLoading || googleLoading}
            activeOpacity={0.85}
          >
            {emailLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Sign In</Text>
            )}
          </TouchableOpacity>

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity
            style={[styles.googleButton, googleLoading && styles.buttonDisabled]}
            onPress={handleGoogleLogin}
            disabled={emailLoading || googleLoading}
            activeOpacity={0.85}
          >
            {googleLoading ? (
              <ActivityIndicator color={colors.textPrimary} />
            ) : (
              <Text style={styles.googleButtonText}>Continue with Google</Text>
            )}
          </TouchableOpacity>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Don't have an account? </Text>
            <Link href="/(auth)/register" asChild>
              <TouchableOpacity>
                <Text style={styles.footerLink}>Sign Up</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.xl,
  },
  header: { alignItems: 'center', gap: spacing.sm },
  logo: { width: 120, height: 80, resizeMode: 'contain' },
  title: { ...typography.largeTitle, color: colors.textPrimary },
  subtitle: { ...typography.body, color: colors.textSecondary },
  form: { gap: spacing.md },
  errorBox: {
    backgroundColor: colors.bannedLight,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.banned,
  },
  errorText: { ...typography.callout, color: colors.banned },
  field: { gap: spacing.sm },
  label: { ...typography.subhead, color: colors.textSecondary, fontWeight: '600' },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    ...typography.body,
    color: colors.textPrimary,
  },
  button: {
    backgroundColor: colors.euBlue,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { ...typography.headline, color: '#fff' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { ...typography.caption1, color: colors.textMuted, textTransform: 'uppercase' },
  googleButton: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    alignItems: 'center',
  },
  googleButtonText: { ...typography.headline, color: colors.textPrimary },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: spacing.sm },
  footerText: { ...typography.callout, color: colors.textSecondary },
  footerLink: { ...typography.callout, color: colors.euGold, fontWeight: '600' },
});
