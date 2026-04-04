import React, { useEffect } from 'react';
import { StyleSheet, View, Text, Platform } from 'react-native';
import { colors, spacing, typography } from '@/constants/theme';

type Props = {
  onScan: (barcode: string) => void;
  active: boolean;
};

// Web-only: dynamically load react-zxing to avoid SSR issues
function WebBarcodeScanner({ onScan, active }: Props) {
  return <ZxingCamera onScan={onScan} active={active} />;
}

function ZxingCamera({ onScan, active }: Props) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [ZxingComponent, setZxingComponent] = React.useState<React.ComponentType<any> | null>(null);

  useEffect(() => {
    // Build a wrapper component that uses the hook at the component level
    import('react-zxing').then(({ useZxing }) => {
      function Scanner({ onDecodeResult, paused }: { onDecodeResult: (r: string) => void; paused: boolean }) {
        const { ref } = useZxing({
          paused,
          onDecodeResult(result) {
            onDecodeResult(result.getText());
          },
        });

        return (
          <div style={{ width: '100%', height: '100%', position: 'relative', borderRadius: 16, overflow: 'hidden', background: '#000' }}>
            <video
              ref={ref as React.RefObject<HTMLVideoElement>}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
            <ScannerOverlayWeb />
          </div>
        );
      }
      setZxingComponent(() => Scanner);
    });
  }, []);

  if (!ZxingComponent) {
    return (
      <View style={styles.placeholder}>
        <Text style={styles.placeholderText}>Loading camera...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ZxingComponent onDecodeResult={onScan} paused={!active} />
    </View>
  );
}

function ScannerOverlayWeb() {
  const bracketStyle: React.CSSProperties = {
    position: 'absolute',
    width: 32,
    height: 32,
  };
  const color = colors.scannerBracket;
  const thickness = 3;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: 16,
      }}
    >
      <div style={{ position: 'relative', width: '60%', aspectRatio: '1' }}>
        {/* Top-left */}
        <div style={{ ...bracketStyle, top: 0, left: 0, borderTop: `${thickness}px solid ${color}`, borderLeft: `${thickness}px solid ${color}`, borderRadius: '2px 0 0 0' }} />
        {/* Top-right */}
        <div style={{ ...bracketStyle, top: 0, right: 0, borderTop: `${thickness}px solid ${color}`, borderRight: `${thickness}px solid ${color}`, borderRadius: '0 2px 0 0' }} />
        {/* Bottom-left */}
        <div style={{ ...bracketStyle, bottom: 0, left: 0, borderBottom: `${thickness}px solid ${color}`, borderLeft: `${thickness}px solid ${color}`, borderRadius: '0 0 0 2px' }} />
        {/* Bottom-right */}
        <div style={{ ...bracketStyle, bottom: 0, right: 0, borderBottom: `${thickness}px solid ${color}`, borderRight: `${thickness}px solid ${color}`, borderRadius: '0 0 2px 0' }} />
      </div>
      <p style={{ color: colors.textSecondary, fontSize: 13, margin: 0 }}>
        Align barcode within the frame
      </p>
    </div>
  );
}

// Native fallback — expo-camera would be used here for a future native build
function NativeBarcodeScanner() {
  return (
    <View style={styles.placeholder}>
      <Text style={styles.placeholderText}>
        Camera scanning is available when opening this app in Safari on iPhone.
      </Text>
    </View>
  );
}

export default function BarcodeScanner(props: Props) {
  if (Platform.OS === 'web') {
    return <WebBarcodeScanner {...props} />;
  }
  return <NativeBarcodeScanner />;
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
