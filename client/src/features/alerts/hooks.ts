import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import i18n from '@/locales';
import { getErrorMessage } from '@/lib/api-client';
import { alertApi } from './api';

export function useAlerts(filters?: Record<string, unknown>) {
  return useQuery({
    queryKey: ['alerts', filters],
    queryFn: () => alertApi.list(filters).then(r => r.data),
  });
}

export function useUnreadAlertCount() {
  return useQuery({
    queryKey: ['alert-count'],
    queryFn: () => alertApi.getUnreadCount().then(r => r.data),
    refetchInterval: 60000,
  });
}

export function useMarkAlertRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => alertApi.markAsRead(id).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
      queryClient.invalidateQueries({ queryKey: ['alert-count'] });
    },
    onError: (err: unknown) => toast.error(getErrorMessage(err)),
  });
}

export function useMarkAllAlertsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => alertApi.markAllAsRead().then(r => r.data),
    onSuccess: () => {
      toast.success(i18n.t('alert.markedAllRead'));
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
      queryClient.invalidateQueries({ queryKey: ['alert-count'] });
    },
    onError: (err: unknown) => toast.error(getErrorMessage(err)),
  });
}

export function useDeleteAlert() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => alertApi.delete(id).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
      queryClient.invalidateQueries({ queryKey: ['alert-count'] });
    },
    onError: (err: unknown) => toast.error(getErrorMessage(err)),
  });
}

export function useAlertAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action, new_expected_date }: { id: string; action: string; new_expected_date?: string }) =>
      alertApi.takeAction(id, action, new_expected_date).then(r => r.data),
    onSuccess: () => {
      toast.success(i18n.t('alert.actionSuccess'));
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
      queryClient.invalidateQueries({ queryKey: ['alert-count'] });
    },
    onError: (err: unknown) => toast.error(getErrorMessage(err)),
  });
}
