import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import i18n from '@/locales';
import { getErrorMessage } from '@/lib/api-client';
import { receivableApi, payableApi } from './api';
import { RecordPaymentInput } from '@/types';

export function useReceivables(filters?: Record<string, unknown>) {
  return useQuery({
    queryKey: ['receivables', filters],
    queryFn: () => receivableApi.list(filters).then(r => r.data),
  });
}

export function useReceivableSummary() {
  return useQuery({
    queryKey: ['receivable-summary'],
    queryFn: () => receivableApi.getSummary().then(r => r.data),
  });
}

export function useRecordReceivablePayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: RecordPaymentInput) => receivableApi.recordPayment(data).then(r => r.data),
    onSuccess: () => {
      toast.success(i18n.t('debt.recordPaymentSuccess'));
      queryClient.invalidateQueries({ queryKey: ['receivables'] });
      queryClient.invalidateQueries({ queryKey: ['receivable-summary'] });
    },
    onError: (err: unknown) => toast.error(getErrorMessage(err)),
  });
}

export function usePayables(filters?: Record<string, unknown>) {
  return useQuery({
    queryKey: ['payables', filters],
    queryFn: () => payableApi.list(filters).then(r => r.data),
  });
}

export function usePayableSummary() {
  return useQuery({
    queryKey: ['payable-summary'],
    queryFn: () => payableApi.getSummary().then(r => r.data),
  });
}

export function useRecordPayablePayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: RecordPaymentInput) => payableApi.recordPayment(data).then(r => r.data),
    onSuccess: () => {
      toast.success(i18n.t('debt.recordPaymentSuccess'));
      queryClient.invalidateQueries({ queryKey: ['payables'] });
      queryClient.invalidateQueries({ queryKey: ['payable-summary'] });
    },
    onError: (err: unknown) => toast.error(getErrorMessage(err)),
  });
}
