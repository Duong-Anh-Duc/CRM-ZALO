import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import i18n from '@/locales';
import { getErrorMessage } from '@/lib/api-client';
import { operatingCostApi } from './api';

export function useOperatingCosts(filters?: Record<string, unknown>) {
  return useQuery({
    queryKey: ['operating-costs', filters],
    queryFn: () => operatingCostApi.list(filters).then(r => r.data),
  });
}

export function useCostCategories() {
  return useQuery({
    queryKey: ['cost-categories'],
    queryFn: () => operatingCostApi.getCategories().then(r => r.data),
  });
}

export function useCreateCost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => operatingCostApi.create(data).then(r => r.data),
    onSuccess: () => {
      toast.success(i18n.t('cost.createSuccess'));
      queryClient.invalidateQueries({ queryKey: ['operating-costs'] });
    },
    onError: (err: unknown) => toast.error(getErrorMessage(err)),
  });
}

export function useUpdateCost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      operatingCostApi.update(id, data).then(r => r.data),
    onSuccess: () => {
      toast.success(i18n.t('cost.updateSuccess'));
      queryClient.invalidateQueries({ queryKey: ['operating-costs'] });
    },
    onError: (err: unknown) => toast.error(getErrorMessage(err)),
  });
}

export function useDeleteCost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => operatingCostApi.delete(id).then(r => r.data),
    onSuccess: () => {
      toast.success(i18n.t('cost.deleteSuccess'));
      queryClient.invalidateQueries({ queryKey: ['operating-costs'] });
    },
    onError: (err: unknown) => toast.error(getErrorMessage(err)),
  });
}

export function useCreateCostCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => operatingCostApi.createCategory(name).then(r => r.data),
    onSuccess: () => {
      toast.success(i18n.t('cost.createCategorySuccess'));
      queryClient.invalidateQueries({ queryKey: ['cost-categories'] });
    },
    onError: (err: unknown) => toast.error(getErrorMessage(err)),
  });
}

export function useMonthlyCostSummary(year?: number) {
  return useQuery({
    queryKey: ['monthly-cost-summary', year],
    queryFn: () => operatingCostApi.getMonthlySummary(year!).then(r => r.data),
    enabled: !!year,
  });
}
