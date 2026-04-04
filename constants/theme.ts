export const colors = {
  background: '#0F1117',
  surface: '#1C1F2E',
  surfaceElevated: '#252840',
  border: '#2E3148',

  euBlue: '#003399',
  euGold: '#FFCC00',

  banned: '#FF4444',
  bannedLight: 'rgba(255, 68, 68, 0.15)',
  restricted: '#FF8C00',
  restrictedLight: 'rgba(255, 140, 0, 0.15)',
  warning: '#FFB800',
  warningLight: 'rgba(255, 184, 0, 0.15)',
  approved: '#00C851',
  approvedLight: 'rgba(0, 200, 81, 0.15)',
  unknown: '#6B7280',
  unknownLight: 'rgba(107, 114, 128, 0.15)',

  textPrimary: '#FFFFFF',
  textSecondary: '#9BA3AF',
  textMuted: '#6B7280',

  scannerOverlay: 'rgba(0, 0, 0, 0.5)',
  scannerBracket: '#FFCC00',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
};

export const typography = {
  largeTitle: { fontSize: 34, fontWeight: '700' as const, letterSpacing: 0.37 },
  title1: { fontSize: 28, fontWeight: '700' as const, letterSpacing: 0.36 },
  title2: { fontSize: 22, fontWeight: '700' as const, letterSpacing: 0.35 },
  title3: { fontSize: 20, fontWeight: '600' as const, letterSpacing: 0.38 },
  headline: { fontSize: 17, fontWeight: '600' as const, letterSpacing: -0.41 },
  body: { fontSize: 17, fontWeight: '400' as const, letterSpacing: -0.41 },
  callout: { fontSize: 16, fontWeight: '400' as const, letterSpacing: -0.32 },
  subhead: { fontSize: 15, fontWeight: '400' as const, letterSpacing: -0.24 },
  footnote: { fontSize: 13, fontWeight: '400' as const, letterSpacing: -0.08 },
  caption1: { fontSize: 12, fontWeight: '400' as const, letterSpacing: 0 },
  caption2: { fontSize: 11, fontWeight: '400' as const, letterSpacing: 0.06 },
};

export type AdditiveStatus = 'banned' | 'restricted' | 'warning' | 'approved' | 'unknown';

export const statusColors: Record<AdditiveStatus, { bg: string; text: string; border: string }> = {
  banned: { bg: colors.bannedLight, text: colors.banned, border: colors.banned },
  restricted: { bg: colors.restrictedLight, text: colors.restricted, border: colors.restricted },
  warning: { bg: colors.warningLight, text: colors.warning, border: colors.warning },
  approved: { bg: colors.approvedLight, text: colors.approved, border: colors.approved },
  unknown: { bg: colors.unknownLight, text: colors.unknown, border: colors.unknown },
};

export const statusLabels: Record<AdditiveStatus, string> = {
  banned: 'Banned in EU',
  restricted: 'Restricted in EU',
  warning: 'Warning Label Required',
  approved: 'EU Approved',
  unknown: 'Unknown',
};
