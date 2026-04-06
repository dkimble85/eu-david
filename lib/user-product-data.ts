import { supabase, type ScanResult } from '@/lib/supabase';
import type { ProductType } from '@/lib/product-type';

type HistoryStatus = 'approved' | 'flagged' | 'unknown';

export type ScanResultMeta = {
  productType?: ProductType;
  status?: HistoryStatus;
};

export type FavoriteRow = {
  id: string;
  user_id: string;
  barcode: string;
  product_name: string | null;
  product_type: ProductType | null;
  created_at: string;
};

export function computeHistoryStatus(result: ScanResult | null): HistoryStatus {
  if (!result) return 'unknown';
  if ((result.bannedCount ?? 0) > 0 || (result.restrictedCount ?? 0) > 0 || (result.warningCount ?? 0) > 0) {
    return 'flagged';
  }
  return 'approved';
}

export async function saveScanToHistory(params: {
  userId: string;
  barcode: string;
  productName: string | null;
  result: ScanResult | null;
  productType: ProductType;
}) {
  const { userId, barcode, productName, result, productType } = params;
  const resultWithMeta = result
    ? ({ ...result, productType, status: computeHistoryStatus(result) } satisfies ScanResult & ScanResultMeta)
    : null;

  const insert = await supabase.from('scan_history').insert({
    user_id: userId,
    barcode,
    product_name: productName,
    result: resultWithMeta,
  });

  if (insert.error) return { ok: false as const, error: insert.error };

  const staleRows = await supabase
    .from('scan_history')
    .select('id')
    .eq('user_id', userId)
    .order('scan_date', { ascending: false })
    .range(50, 1000);

  if (!staleRows.error && staleRows.data && staleRows.data.length > 0) {
    const staleIds = staleRows.data.map((row) => row.id);
    await supabase.from('scan_history').delete().in('id', staleIds);
  }

  return { ok: true as const };
}

export async function loadFavoriteBarcodes(userId: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('favorites')
    .select('barcode')
    .eq('user_id', userId);

  if (error || !data) return new Set();
  return new Set((data as Array<{ barcode: string }>).map((row) => row.barcode));
}

export async function toggleFavorite(params: {
  userId: string;
  barcode: string;
  productName: string | null;
  productType: ProductType;
  currentlyFavorite: boolean;
}) {
  const { userId, barcode, productName, productType, currentlyFavorite } = params;

  if (currentlyFavorite) {
    const { error } = await supabase
      .from('favorites')
      .delete()
      .eq('user_id', userId)
      .eq('barcode', barcode);
    return { ok: !error, isFavorite: false, error };
  }

  const { error } = await supabase.from('favorites').upsert(
    {
      user_id: userId,
      barcode,
      product_name: productName,
      product_type: productType,
    },
    { onConflict: 'user_id,barcode' }
  );

  return { ok: !error, isFavorite: true, error };
}
