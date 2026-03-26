import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import i18n from '@/locales';
import { getErrorMessage } from '@/lib/api-client';
import { supplierApi } from './api';

export function useSuppliers(filters?: Record<string, unknown>) {
  return useQuery({
    queryKey: ['suppliers', filters],
    queryFn: () => supplierApi.list(filters).then(r => r.data),
  });
}

export function useSupplier(id?: string) {
  return useQuery({
    queryKey: ['suppliers', id],
    queryFn: () => supplierApi.getById(id!).then(r => r.data),
    enabled: !!id,
  });
}

export function useCreateSupplier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => supplierApi.create(data).then(r => r.data),
    onSuccess: () => {
      toast.success(i18n.t('supplier.createSuccess'));
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
    },
    onError: (err: unknown) => toast.error(getErrorMessage(err)),
  });
}

export function useUpdateSupplier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      supplierApi.update(id, data).then(r => r.data),
    onSuccess: () => {
      toast.success(i18n.t('supplier.updateSuccess'));
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
    },
    onError: (err: unknown) => toast.error(getErrorMessage(err)),
  });
}

export function useDeleteSupplier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => supplierApi.softDelete(id).then(r => r.data),
    onSuccess: () => {
      toast.success(i18n.t('supplier.deleteSuccess'));
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
    },
    onError: (err: unknown) => toast.error(getErrorMessage(err)),
  });
}
