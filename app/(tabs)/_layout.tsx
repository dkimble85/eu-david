import { Tabs } from 'expo-router';
import { Text, View, StyleSheet } from 'react-native';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';

function TabIcon({ emoji, focused }: { emoji: string; focused: boolean }) {
  return (
    <View style={[styles.tabIcon, focused && styles.tabIconFocused]}>
      <Text style={styles.tabEmoji}>{emoji}</Text>
    </View>
  );
}

function ProfileTabIcon({ focused }: { focused: boolean }) {
  const { user } = useAuth();
  const { profile } = useProfile(user);

  if (!user) {
    return (
      <View style={[styles.tabIcon, focused && styles.tabIconFocused]}>
        <Text style={styles.tabEmoji}>👤</Text>
      </View>
    );
  }

  const letter = (profile.username?.[0] ?? user.email?.[0] ?? '?').toUpperCase();

  return (
    <View style={[styles.tabIcon, focused && styles.tabIconFocused]}>
      <View style={[styles.avatarCircle, focused && styles.avatarCircleFocused]}>
        <Text style={styles.avatarLetter}>{letter}</Text>
      </View>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: colors.euGold,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: styles.tabLabel,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Scan',
          tabBarIcon: ({ focused }) => <TabIcon emoji="📷" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarIcon: ({ focused }) => <TabIcon emoji="📋" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="recommendations"
        options={{
          title: 'Recos',
          tabBarIcon: ({ focused }) => <TabIcon emoji="⭐" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ focused }) => <ProfileTabIcon focused={focused} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    paddingTop: spacing.sm,
    height: 84,
  },
  tabLabel: {
    ...typography.caption2,
    fontWeight: '600',
  },
  tabIcon: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 40,
    height: 32,
    borderRadius: 16,
  },
  tabIconFocused: {
    backgroundColor: `${colors.euGold}22`,
  },
  tabEmoji: { fontSize: 20 },
  avatarCircle: {
    width: 26,
    height: 26,
    borderRadius: radius.full,
    backgroundColor: colors.euBlue,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.textMuted,
  },
  avatarCircleFocused: {
    borderColor: colors.euGold,
  },
  avatarLetter: {
    ...typography.caption2,
    color: '#fff',
    fontWeight: '700',
  },
});
