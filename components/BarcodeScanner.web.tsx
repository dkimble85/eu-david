import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { useZxing } from 'react-zxing';
import { colors, spacing, typography } from '@/constants/theme';

type Props = {
  onScan: (barcode: string) => void;
  active: boolean;
};

export default function BarcodeScanner({ onScan, active }: Props) {
  const { ref } = useZxing({
    paused: !active,
    onDecodeResult(result) {
      onScan(result.getText());
    },
  });

  return (
    <View style={styles.container}>
      <div style={{ width: '100%', height: '100%', position: 'relative' }}>
        <video
          ref={ref as React.RefObject<HTMLVideoElement>}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
        <ScannerOverlay />
      </div>
    </View>
  );
}

function ScannerOverlay() {
  const bracketStyle: React.CSSProperties = { position: 'absolute', width: 32, height: 32 };
  const color = colors.scannerBracket;
  const t = 3;

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
      <div style={{ position: 'relative', width: '60%', aspectRatio: '1' }}>
        <div style={{ ...bracketStyle, top: 0, left: 0, borderTop: `${t}px solid ${color}`, borderLeft: `${t}px solid ${color}`, borderRadius: '2px 0 0 0' }} />
        <div style={{ ...bracketStyle, top: 0, right: 0, borderTop: `${t}px solid ${color}`, borderRight: `${t}px solid ${color}`, borderRadius: '0 2px 0 0' }} />
        <div style={{ ...bracketStyle, bottom: 0, left: 0, borderBottom: `${t}px solid ${color}`, borderLeft: `${t}px solid ${color}`, borderRadius: '0 0 0 2px' }} />
        <div style={{ ...bracketStyle, bottom: 0, right: 0, borderBottom: `${t}px solid ${color}`, borderRight: `${t}px solid ${color}`, borderRadius: '0 0 2px 0' }} />
      </div>
      <p style={{ color: colors.textSecondary, fontSize: 13, margin: 0 }}>
        Align barcode within the frame
      </p>
    </div>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  placeholder: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: 16,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  placeholderText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
