import { useQuery } from '@tanstack/react-query';
import { getProductByBarcode } from '@/lib/openfoodfacts';
import { getFatSecretProduct } from '@/lib/fatsecret';
import { runEuCheck } from '@/lib/eu-check';

async function fetchProduct(barcode: string) {
  const [off, fs] = await Promise.all([
    getProductByBarcode(barcode),
    getFatSecretProduct(barcode),
  ]);
  if (!off && !fs) return null;
  const euResult = runEuCheck(off?.eNumbers ?? [], off?.ingredientsText ?? null);
  return { off, fs, euResult };
}

export function useProduct(barcode: string) {
  return useQuery({
    queryKey: ['product', barcode],
    queryFn: () => fetchProduct(barcode),
    staleTime: Infinity, // product ingredients don't change
    retry: 2,
    enabled: !!barcode,
  });
}
