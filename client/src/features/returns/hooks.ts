import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { salesReturnApi, purchaseReturnApi } from './api';
import { message } from 'antd';
import { useTranslation } from 'react-i18next';

// ── Sales Returns ──
export const useSalesReturns = (filters: Record<string, any>) =>
  useQuery({ queryKey: ['sales-returns', filters], queryFn: () => salesReturnApi.list(filters).then((r) => r.data) });

export const useSalesReturn = (id?: string) =>
  useQuery({ queryKey: ['sales-returns', id], queryFn: () => salesReturnApi.getById(id!).then((r) => r.data), enabled: !!id });

export const useCreateSalesReturn = () => {
  const qc = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: (data: any) => salesReturnApi.create(data),
    onSuccess: () => {
      message.success(t('return.createSuccess'));
      qc.invalidateQueries({ queryKey: ['sales-returns'] });
    },
  });
};

export const useUpdateSalesReturnStatus = () => {
  const qc = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => salesReturnApi.updateStatus(id, status),
    onSuccess: () => {
      message.success(t('return.updateStatusSuccess'));
      qc.invalidateQueries({ queryKey: ['sales-returns'] });
      qc.invalidateQueries({ queryKey: ['receivables'] });
    },
  });
};

export const useDeleteSalesReturn = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => salesReturnApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sales-returns'] }); },
  });
};

// ── Purchase Returns ──
export const usePurchaseReturns = (filters: Record<string, any>) =>
  useQuery({ queryKey: ['purchase-returns', filters], queryFn: () => purchaseReturnApi.list(filters).then((r) => r.data) });

export const usePurchaseReturn = (id?: string) =>
  useQuery({ queryKey: ['purchase-returns', id], queryFn: () => purchaseReturnApi.getById(id!).then((r) => r.data), enabled: !!id });

export const useCreatePurchaseReturn = () => {
  const qc = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: (data: any) => purchaseReturnApi.create(data),
    onSuccess: () => {
      message.success(t('return.createSuccess'));
      qc.invalidateQueries({ queryKey: ['purchase-returns'] });
    },
  });
};

export const useUpdatePurchaseReturnStatus = () => {
  const qc = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => purchaseReturnApi.updateStatus(id, status),
    onSuccess: () => {
      message.success(t('return.updateStatusSuccess'));
      qc.invalidateQueries({ queryKey: ['purchase-returns'] });
      qc.invalidateQueries({ queryKey: ['payables'] });
    },
  });
};

export const useDeletePurchaseReturn = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => purchaseReturnApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['purchase-returns'] }); },
  });
};
