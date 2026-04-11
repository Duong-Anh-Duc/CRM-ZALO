import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import i18n from '@/locales';
import { getErrorMessage } from '@/lib/api-client';
import { invoiceApi } from './api';

export function useInvoices(filters?: Record<string, unknown>) {
  return useQuery({
    queryKey: ['invoices', filters],
    queryFn: () => invoiceApi.list(filters).then((r) => r.data),
  });
}

export function useInvoice(id?: string) {
  return useQuery({
    queryKey: ['invoice', id],
    queryFn: () => invoiceApi.getById(id!).then((r) => r.data),
    enabled: !!id,
  });
}

export function useCreateInvoiceFromOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orderId: string) => invoiceApi.createFromOrder(orderId).then((r) => r.data),
    onSuccess: () => {
      toast.success(i18n.t('invoice.draftCreated'));
      qc.invalidateQueries({ queryKey: ['invoices'] });
    },
    onError: (err: unknown) => toast.error(getErrorMessage(err)),
  });
}

export function useUpdateInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      invoiceApi.update(id, data).then((r) => r.data),
    onSuccess: () => {
      toast.success(i18n.t('invoice.updated'));
      qc.invalidateQueries({ queryKey: ['invoices'] });
      qc.invalidateQueries({ queryKey: ['invoice'] });
    },
    onError: (err: unknown) => toast.error(getErrorMessage(err)),
  });
}

export function useFinalizeInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => invoiceApi.finalize(id).then((r) => r.data),
    onSuccess: () => {
      toast.success(i18n.t('invoice.finalized'));
      qc.invalidateQueries({ queryKey: ['invoices'] });
      qc.invalidateQueries({ queryKey: ['invoice'] });
    },
    onError: (err: unknown) => toast.error(getErrorMessage(err)),
  });
}

export function useCancelInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => invoiceApi.cancel(id).then((r) => r.data),
    onSuccess: () => {
      toast.success(i18n.t('invoice.cancelled'));
      qc.invalidateQueries({ queryKey: ['invoices'] });
      qc.invalidateQueries({ queryKey: ['invoice'] });
    },
    onError: (err: unknown) => toast.error(getErrorMessage(err)),
  });
}
