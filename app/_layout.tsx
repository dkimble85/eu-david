import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StyleSheet, View } from 'react-native';
import { useAuth } from '@/hooks/useAuth';
import { colors } from '@/constants/theme';

const queryClient = new QueryClient();

export default function RootLayout() {
  const { session, loading } = useAuth();

  if (loading) return <View style={styles.loading} />;

  return (
    <QueryClientProvider client={queryClient}>
    <GestureHandlerRootView style={styles.root}>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }}>
        {session ? (
          <Stack.Screen name="(tabs)" />
        ) : (
          <Stack.Screen name="(auth)" />
        )}
        <Stack.Screen name="product/[barcode]" options={{ presentation: 'modal' }} />
      </Stack>
    </GestureHandlerRootView>
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  loading: { flex: 1, backgroundColor: colors.background },
});
