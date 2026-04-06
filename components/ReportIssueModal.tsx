import React, { useEffect, useState } from 'react';
import { Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { colors, radius, spacing, typography } from '@/constants/theme';
import type { ProductReportIssueType } from '@/lib/reports';

type Props = {
  visible: boolean;
  productName: string;
  submitting: boolean;
  statusMessage: string | null;
  onClose: () => void;
  onSubmit: (issueType: ProductReportIssueType, details: string) => Promise<void>;
};

export default function ReportIssueModal({
  visible,
  productName,
  submitting,
  statusMessage,
  onClose,
  onSubmit,
}: Props) {
  const [issueType, setIssueType] = useState<ProductReportIssueType>('missing_ingredients');
  const [details, setDetails] = useState('');

  useEffect(() => {
    if (!visible) return;
    setIssueType('missing_ingredients');
    setDetails('');
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <Text style={styles.title}>Report Product Issue</Text>
        <Text style={styles.subtitle} numberOfLines={2}>
          {productName}
        </Text>

        <View style={styles.typeRow}>
          <IssueTypeButton
            selected={issueType === 'missing_ingredients'}
            label="Missing ingredients"
            onPress={() => setIssueType('missing_ingredients')}
          />
          <IssueTypeButton
            selected={issueType === 'misinformation'}
            label="Misinformation"
            onPress={() => setIssueType('misinformation')}
          />
        </View>

        <TextInput
          style={styles.input}
          placeholder="Optional details..."
          placeholderTextColor={colors.textMuted}
          value={details}
          onChangeText={setDetails}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
          editable={!submitting}
        />

        {statusMessage ? <Text style={styles.status}>{statusMessage}</Text> : null}

        <View style={styles.actions}>
          <TouchableOpacity style={styles.cancel} onPress={onClose} disabled={submitting}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.submit, submitting && styles.submitDisabled]}
            disabled={submitting}
            onPress={() => onSubmit(issueType, details)}
          >
            <Text style={styles.submitText}>{submitting ? 'Sending...' : 'Submit Report'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function IssueTypeButton({
  selected,
  label,
  onPress,
}: {
  selected: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.typeButton, selected && styles.typeButtonSelected]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Text style={[styles.typeText, selected && styles.typeTextSelected]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.md,
  },
  handle: {
    width: 34,
    height: 4,
    borderRadius: radius.full,
    backgroundColor: colors.border,
    alignSelf: 'center',
  },
  title: { ...typography.headline, color: colors.textPrimary },
  subtitle: { ...typography.subhead, color: colors.textSecondary },
  typeRow: { flexDirection: 'row', gap: spacing.sm },
  typeButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
  },
  typeButtonSelected: {
    borderColor: colors.euGold,
    backgroundColor: `${colors.euGold}22`,
  },
  typeText: { ...typography.footnote, color: colors.textSecondary, fontWeight: '600' },
  typeTextSelected: { color: colors.euGold },
  input: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.textPrimary,
    padding: spacing.md,
    minHeight: 96,
    ...typography.subhead,
  },
  status: { ...typography.caption1, color: colors.textSecondary },
  actions: { flexDirection: 'row', gap: spacing.sm },
  cancel: {
    flex: 1,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  cancelText: { ...typography.callout, color: colors.textSecondary, fontWeight: '600' },
  submit: {
    flex: 1,
    borderRadius: radius.md,
    backgroundColor: colors.euBlue,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  submitDisabled: { opacity: 0.6 },
  submitText: { ...typography.callout, color: '#fff', fontWeight: '700' },
});
