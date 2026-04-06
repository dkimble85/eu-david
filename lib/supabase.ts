import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: Platform.OS === 'web',
  },
});

export type ScanResult = {
  bannedCount: number;
  restrictedCount: number;
  warningCount: number;
  approvedCount: number;
};

export type ScanHistoryRow = {
  id: string;
  user_id: string;
  barcode: string;
  product_name: string | null;
  scan_date: string;
  result: ScanResult | null;
};
