import { useState, useCallback, useRef } from 'react';

type ScannerState = 'idle' | 'scanning' | 'paused';

export function useScanner(onScan: (barcode: string) => void) {
  const [state, setState] = useState<ScannerState>('idle');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastScannedRef = useRef<string | null>(null);

  const handleDecode = useCallback(
    (result: string) => {
      if (state === 'paused') return;
      if (result === lastScannedRef.current) return;

      if (debounceRef.current) clearTimeout(debounceRef.current);

      debounceRef.current = setTimeout(() => {
        lastScannedRef.current = result;
        setState('paused');
        onScan(result);
      }, 300);
    },
    [state, onScan]
  );

  const start = useCallback(() => {
    setState('scanning');
    lastScannedRef.current = null;
  }, []);

  const resume = useCallback(() => {
    setState('scanning');
    lastScannedRef.current = null;
  }, []);

  const pause = useCallback(() => {
    setState('paused');
  }, []);

  return { state, handleDecode, start, resume, pause };
}
