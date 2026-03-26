import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import i18n from '@/locales';
import { getErrorMessage } from '@/lib/api-client';
import { customerApi } from './api';

export function useCustomers(filters?: Record<string, unknown>) {
  return useQuery({
    queryKey: ['customers', filters],
    queryFn: () => customerApi.list(filters).then(r => r.data),
  });
}

export function useCustomer(id?: string) {
  return useQuery({
    queryKey: ['customers', id],
    queryFn: () => customerApi.getById(id!).then(r => r.data),
    enabled: !!id,
  });
}

export function useCreateCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => customerApi.create(data).then(r => r.data),
    onSuccess: () => {
      toast.success(i18n.t('customer.createSuccess'));
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
    onError: (err: unknown) => toast.error(getErrorMessage(err)),
  });
}

export function useUpdateCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      customerApi.update(id, data).then(r => r.data),
    onSuccess: () => {
      toast.success(i18n.t('customer.updateSuccess'));
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
    onError: (err: unknown) => toast.error(getErrorMessage(err)),
  });
}

export function useDeleteCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => customerApi.softDelete(id).then(r => r.data),
    onSuccess: () => {
      toast.success(i18n.t('customer.deleteSuccess'));
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
    onError: (err: unknown) => toast.error(getErrorMessage(err)),
  });
}

export function useCheckDebtLimit() {
  return useMutation({
    mutationFn: ({ customer_id, order_total }: { customer_id: string; order_total: number }) =>
      customerApi.checkDebtLimit(customer_id, order_total).then(r => r.data),
    onError: (err: unknown) => toast.error(getErrorMessage(err)),
  });
}
