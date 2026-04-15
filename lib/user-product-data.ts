import { supabase, type ScanResult } from '@/lib/supabase';
import type { ProductType } from '@/lib/product-type';

type HistoryStatus = 'approved' | 'flagged' | 'unknown';
const FAVORITE_METADATA_KEY = 'favorite_barcodes';

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

function parseFavoriteMetadata(value: unknown): Set<string> {
  if (!Array.isArray(value)) return new Set();
  return new Set(
    value
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter(Boolean)
  );
}

async function loadFavoriteBarcodesFromMetadata(): Promise<Set<string>> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return new Set();
  return parseFavoriteMetadata(data.user.user_metadata?.[FAVORITE_METADATA_KEY]);
}

async function saveFavoriteBarcodesToMetadata(barcodes: Set<string>) {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return { ok: false as const, error };

  const currentMetadata = data.user.user_metadata ?? {};
  const { error: updateError } = await supabase.auth.updateUser({
    data: {
      ...currentMetadata,
      [FAVORITE_METADATA_KEY]: Array.from(barcodes),
    },
  });

  return { ok: !updateError, error: updateError };
}

export function computeHistoryStatus(result: ScanResult | null): HistoryStatus {
  if (!result) return 'unknown';
  if (
    (result.bannedCount ?? 0) > 0 ||
    (result.restrictedCount ?? 0) > 0 ||
    (result.warningCount ?? 0) > 0
  ) {
    return 'flagged';
  }
  return 'approved';
}

function getHistoryDuplicateKey(row: { barcode: string | null; product_name: string | null }) {
  return `${row.barcode ?? ''}::${(row.product_name ?? '').trim().toLowerCase()}`;
}

export async function cleanupUserScanHistory(userId: string) {
  const favoriteBarcodes = await loadFavoriteBarcodes(userId);
  const { data, error } = await supabase
    .from('scan_history')
    .select('id, barcode, product_name, scan_date')
    .eq('user_id', userId)
    .order('scan_date', { ascending: false });

  if (error || !data) return { ok: false as const, error };

  const seen = new Set<string>();
  const idsToDelete: string[] = [];

  for (const [index, row] of data.entries()) {
    const isFavorite = row.barcode ? favoriteBarcodes.has(row.barcode) : false;
    const duplicateKey = getHistoryDuplicateKey(row);
    if ((seen.has(duplicateKey) || index >= 50) && !isFavorite) {
      idsToDelete.push(row.id);
      continue;
    }
    seen.add(duplicateKey);
  }

  if (idsToDelete.length > 0) {
    const { error: deleteError } = await supabase
      .from('scan_history')
      .delete()
      .in('id', idsToDelete);
    if (deleteError) return { ok: false as const, error: deleteError };
  }

  return { ok: true as const, error: null };
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
    ? ({ ...result, productType, status: computeHistoryStatus(result) } satisfies ScanResult &
        ScanResultMeta)
    : null;

  const insert = await supabase.from('scan_history').insert({
    user_id: userId,
    barcode,
    product_name: productName,
    result: resultWithMeta,
  });

  if (insert.error) return { ok: false as const, error: insert.error };
  return cleanupUserScanHistory(userId);
}

export async function loadFavoriteBarcodes(userId: string): Promise<Set<string>> {
  const { data, error } = await supabase.from('favorites').select('barcode').eq('user_id', userId);

  if (error || !data) {
    return loadFavoriteBarcodesFromMetadata();
  }
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
    if (!error) return { ok: true, isFavorite: false, error: null };

    const metadataBarcodes = await loadFavoriteBarcodesFromMetadata();
    metadataBarcodes.delete(barcode);
    const metadataResponse = await saveFavoriteBarcodesToMetadata(metadataBarcodes);
    return { ok: metadataResponse.ok, isFavorite: false, error: metadataResponse.error };
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

  if (!error) return { ok: true, isFavorite: true, error: null };

  const metadataBarcodes = await loadFavoriteBarcodesFromMetadata();
  metadataBarcodes.add(barcode);
  const metadataResponse = await saveFavoriteBarcodesToMetadata(metadataBarcodes);
  return { ok: metadataResponse.ok, isFavorite: true, error: metadataResponse.error };
}
