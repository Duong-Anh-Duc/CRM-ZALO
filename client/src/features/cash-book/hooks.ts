import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cashBookApi } from './api';
import { message } from 'antd';
import { useTranslation } from 'react-i18next';

export const useCashTransactions = (filters: Record<string, any>) =>
  useQuery({ queryKey: ['cash-book', filters], queryFn: () => cashBookApi.list(filters).then((r) => r.data) });

export const useCashSummary = (filters: Record<string, any>) =>
  useQuery({ queryKey: ['cash-summary', filters], queryFn: () => cashBookApi.getSummary(filters).then((r) => r.data) });

export const useCashCategories = (type?: string) =>
  useQuery({ queryKey: ['cash-categories', type], queryFn: () => cashBookApi.listCategories(type).then((r) => r.data) });

export const useCreateCashTransaction = () => {
  const qc = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: (data: any) => cashBookApi.create(data),
    onSuccess: () => {
      message.success(t('cashBook.createSuccess'));
      qc.invalidateQueries({ queryKey: ['cash-book'] });
      qc.invalidateQueries({ queryKey: ['cash-summary'] });
    },
  });
};

export const useUpdateCashTransaction = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => cashBookApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cash-book'] });
      qc.invalidateQueries({ queryKey: ['cash-summary'] });
    },
  });
};

export const useDeleteCashTransaction = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => cashBookApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cash-book'] });
      qc.invalidateQueries({ queryKey: ['cash-summary'] });
    },
  });
};

export const useCreateCashCategory = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => cashBookApi.createCategory(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cash-categories'] }); },
  });
};
