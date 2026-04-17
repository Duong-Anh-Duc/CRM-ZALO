import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from './api';

export function useDashboard(params?: { from_date?: string; to_date?: string }) {
  return useQuery({
    queryKey: ['dashboard', params],
    queryFn: () => dashboardApi.getOverview(params).then(r => r.data),
  });
}
