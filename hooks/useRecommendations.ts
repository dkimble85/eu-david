import { useQuery } from '@tanstack/react-query';
import { fetchRecommendations } from '@/lib/recommendations';
import type { ScoreFilter } from '@/lib/recommendations';

export function useRecommendations(
  categoryTag: string | null,
  searchQuery: string,
  scoreFilter: ScoreFilter,
  storeTag: string | null
) {
  const trimmed = searchQuery.trim();
  return useQuery({
    queryKey: ['recommendations', categoryTag, trimmed, scoreFilter, storeTag],
    queryFn: () => fetchRecommendations(categoryTag, trimmed, scoreFilter, storeTag),
    staleTime: 5 * 60 * 1000,
    retry: 1,
    enabled: !!(categoryTag || trimmed),
  });
}
