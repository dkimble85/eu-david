import React from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { RELEASE_NOTES } from '@/constants/changelog';

type ReleaseContextValue = {
  openChangelog: () => void;
  closeChangelog: () => void;
};

const ReleaseNotesContext = React.createContext<ReleaseContextValue | null>(null);

export function useReleaseNotes() {
  const context = React.useContext(ReleaseNotesContext);
  if (!context) {
    throw new Error('useReleaseNotes must be used within a ReleaseNotesProvider');
  }
  return context;
}

export default function ReleaseNotesProvider({ children }: { children: React.ReactNode }) {
  const [showChangelog, setShowChangelog] = React.useState(false);

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
        <Modal
          visible={showChangelog}
          animationType="slide"
          transparent
          onRequestClose={() => setShowChangelog(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Changelog</Text>
                <TouchableOpacity onPress={() => setShowChangelog(false)} activeOpacity={0.8}>
                  <Text style={styles.modalCloseText}>X</Text>
                </TouchableOpacity>
              </View>
              <ScrollView
                contentContainerStyle={styles.modalBody}
                showsVerticalScrollIndicator={false}
              >
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
