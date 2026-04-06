import React, { useEffect } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { colors, spacing, typography } from '@/constants/theme';

type Props = {
  onScan: (barcode: string) => void;
  active: boolean;
};

export default function BarcodeScanner({ onScan, active }: Props) {
  const [permission, requestPermission] = useCameraPermissions();

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  if (!permission || permission.status === 'undetermined') {
    return (
      <View style={styles.placeholder}>
        <Text style={styles.placeholderText}>Requesting camera permission...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.placeholder}>
        <Text style={styles.placeholderText}>
          Camera access was denied. Please enable it in Settings → EU David → Camera.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{
          barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39', 'qr'],
        }}
        onBarcodeScanned={active ? (result) => onScan(result.data) : undefined}
      />
      <ScannerOverlay />
    </View>
  );
}

function ScannerOverlay() {
  const color = colors.scannerBracket;
  const thickness = 3;

  const bracket = (position: object) => (
    <View
      style={[styles.bracket, position as object, { borderColor: color, borderWidth: thickness }]}
    />
  );

  return (
    <View style={styles.overlay}>
      <View style={styles.overlayFrame}>
        {bracket({
          top: 0,
          left: 0,
          borderRightWidth: 0,
          borderBottomWidth: 0,
          borderTopLeftRadius: 2,
        })}
        {bracket({
          top: 0,
          right: 0,
          borderLeftWidth: 0,
          borderBottomWidth: 0,
          borderTopRightRadius: 2,
        })}
        {bracket({
          bottom: 0,
          left: 0,
          borderRightWidth: 0,
          borderTopWidth: 0,
          borderBottomLeftRadius: 2,
        })}
        {bracket({
          bottom: 0,
          right: 0,
          borderLeftWidth: 0,
          borderTopWidth: 0,
          borderBottomRightRadius: 2,
        })}
      </View>
      <Text style={styles.overlayHint}>Align barcode within the frame</Text>
    </View>
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
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  overlayFrame: {
    width: '60%',
    aspectRatio: 1,
    position: 'relative',
  },
  bracket: {
    position: 'absolute',
    width: 32,
    height: 32,
  },
  overlayHint: {
    ...typography.footnote,
    color: colors.textSecondary,
  },
});
