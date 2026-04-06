import { Tabs } from 'expo-router';
import { StyleSheet } from 'react-native';
import { ScanBarcode, History, Search, Settings as SettingsIcon } from 'lucide-react-native';
import { colors, radius, spacing, typography } from '@/constants/theme';

const iconSize = 24;
const iconColor = (focused: boolean) => (focused ? colors.euGold : colors.textMuted);

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: colors.euGold,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: styles.tabLabel,
        tabBarItemStyle: styles.tabItem,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Scan',
          tabBarIcon: ({ focused }) => <ScanBarcode color={iconColor(focused)} size={iconSize} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarIcon: ({ focused }) => <History color={iconColor(focused)} size={iconSize} />,
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: 'Search',
          tabBarIcon: ({ focused }) => <Search color={iconColor(focused)} size={iconSize} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Settings',
          tabBarIcon: ({ focused }) => <SettingsIcon color={iconColor(focused)} size={iconSize} />,
        }}
      />
      <Tabs.Screen
        name="regulated-ingredients"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    bottom: spacing.md,
    height: 72,
    paddingTop: spacing.xs,
    paddingBottom: spacing.xs,
    borderTopWidth: 0,
    borderRadius: radius.xl,
    backgroundColor: 'rgba(28, 31, 46, 0.94)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  tabLabel: {
    ...typography.caption2,
    fontWeight: '600',
  },
  tabItem: {
    paddingTop: 2,
  },
});
