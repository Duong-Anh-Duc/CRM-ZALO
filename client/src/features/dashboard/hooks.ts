import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from './api';

export function useDashboard() {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: () => dashboardApi.getOverview().then(r => r.data),
  });
}
