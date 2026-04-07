import Constants from 'expo-constants';
import React from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { RELEASE_NOTES } from '@/constants/changelog';

type ReleaseContextValue = {
  openChangelog: () => void;
  closeChangelog: () => void;
};

const ReleaseNotesContext = React.createContext<ReleaseContextValue | null>(null);

type ReleaseManifest = {
  latestVersion?: string;
};

export function useReleaseNotes() {
  const context = React.useContext(ReleaseNotesContext);
  if (!context) {
    throw new Error('useReleaseNotes must be used within a ReleaseNotesProvider');
  }
  return context;
}

export default function ReleaseNotesProvider({ children }: { children: React.ReactNode }) {
  const currentVersion = Constants.expoConfig?.version ?? '1.0.0';
  const [showChangelog, setShowChangelog] = React.useState(false);
  const [availableVersion, setAvailableVersion] = React.useState<string | null>(null);
  const [dismissedVersion, setDismissedVersion] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (Platform.OS !== 'web') return;

    let intervalId: ReturnType<typeof setInterval> | null = null;
    let cancelled = false;

    async function checkForUpdate() {
      try {
        const response = await fetch(`/release.json?ts=${Date.now()}`, {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache' },
        });
        if (!response.ok) return;
        const payload = (await response.json()) as ReleaseManifest;
        const latestVersion = payload.latestVersion?.trim();
        if (!latestVersion || cancelled) return;
        if (latestVersion !== currentVersion) {
          setAvailableVersion(latestVersion);
        }
      } catch {
        // Silent: update checks should never affect app usage.
      }
    }

    checkForUpdate();
    intervalId = setInterval(checkForUpdate, 5 * 60 * 1000);

    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
    };
  }, [currentVersion]);

  const showUpdateBanner = availableVersion != null && dismissedVersion !== availableVersion;

  const value = React.useMemo<ReleaseContextValue>(
    () => ({
      openChangelog: () => setShowChangelog(true),
      closeChangelog: () => setShowChangelog(false),
    }),
    []
  );

  return (
    <ReleaseNotesContext.Provider value={value}>
      <View style={styles.root}>
        {children}
        {showUpdateBanner && (
          <View style={styles.bannerWrap} pointerEvents="box-none">
            <View style={styles.banner}>
              <View style={styles.bannerTextWrap}>
                <Text style={styles.bannerTitle}>New version available</Text>
                <Text style={styles.bannerBody}>
                  v{availableVersion} is ready. Refresh to load the newest version.
                </Text>
              </View>
              <View style={styles.bannerActions}>
                <TouchableOpacity
                  style={styles.bannerSecondary}
                  onPress={() => setShowChangelog(true)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.bannerSecondaryText}>View changes</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.bannerPrimary}
                  onPress={() => {
                    if (Platform.OS === 'web' && typeof window !== 'undefined') {
                      window.location.reload();
                    }
                  }}
                  activeOpacity={0.85}
                >
                  <Text style={styles.bannerPrimaryText}>Refresh</Text>
                </TouchableOpacity>
              </View>
              <Pressable
                style={styles.bannerClose}
                onPress={() => setDismissedVersion(availableVersion)}
              >
                <Text style={styles.bannerCloseText}>X</Text>
              </Pressable>
            </View>
          </View>
        )}

        <Modal visible={showChangelog} animationType="slide" transparent onRequestClose={() => setShowChangelog(false)}>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Changelog</Text>
                <TouchableOpacity onPress={() => setShowChangelog(false)} activeOpacity={0.8}>
                  <Text style={styles.modalCloseText}>X</Text>
                </TouchableOpacity>
              </View>
              <ScrollView contentContainerStyle={styles.modalBody} showsVerticalScrollIndicator={false}>
                {RELEASE_NOTES.map((release) => (
                  <View key={release.version} style={styles.releaseCard}>
                    <View style={styles.releaseHeader}>
                      <Text style={styles.releaseVersion}>v{release.version}</Text>
                      <Text style={styles.releaseDate}>{release.date}</Text>
                    </View>
                    {release.changes.map((change) => (
                      <Text key={change} style={styles.releaseChange}>
                        • {change}
                      </Text>
                    ))}
                  </View>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>
      </View>
    </ReleaseNotesContext.Provider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  bannerWrap: {
    position: 'absolute',
    top: spacing.lg,
    left: spacing.md,
    right: spacing.md,
    zIndex: 50,
  },
  banner: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.euGold,
    padding: spacing.md,
    gap: spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  bannerTextWrap: { gap: 2, paddingRight: spacing.xl },
  bannerTitle: { ...typography.callout, color: colors.textPrimary, fontWeight: '700' },
  bannerBody: { ...typography.caption1, color: colors.textSecondary },
  bannerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  bannerPrimary: {
    backgroundColor: colors.euBlue,
    borderRadius: radius.md,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  bannerPrimaryText: { ...typography.caption1, color: '#fff', fontWeight: '700' },
  bannerSecondary: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  bannerSecondaryText: { ...typography.caption1, color: colors.euGold, fontWeight: '700' },
  bannerClose: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerCloseText: { ...typography.caption1, color: colors.textMuted, fontWeight: '700' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalCard: {
    maxHeight: '82%',
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: { ...typography.title3, color: colors.textPrimary },
  modalCloseText: { ...typography.callout, color: colors.euGold, fontWeight: '700' },
  modalBody: { padding: spacing.lg, gap: spacing.md },
  releaseCard: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  releaseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  releaseVersion: { ...typography.callout, color: colors.textPrimary, fontWeight: '700' },
  releaseDate: { ...typography.caption1, color: colors.textMuted },
  releaseChange: { ...typography.subhead, color: colors.textSecondary, lineHeight: 21 },
});

