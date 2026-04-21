import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import i18n from '@/locales';
import { getErrorMessage } from '@/lib/api-client';
import { zaloApi } from './api';

export function useZaloConfig() {
  return useQuery({ queryKey: ['zalo-config'], queryFn: () => zaloApi.getConfig().then(r => r.data) });
}

export function useSaveZaloConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => zaloApi.saveConfig(data).then(r => r.data),
    onSuccess: () => { toast.success(i18n.t('zalo.configSaved')); qc.invalidateQueries({ queryKey: ['zalo-config'] }); },
    onError: (err: unknown) => toast.error(getErrorMessage(err)),
  });
}

export function useZaloThreads(type?: string) {
  return useQuery({
    queryKey: ['zalo-threads', type],
    queryFn: () => zaloApi.getThreads({ type }).then(r => r.data),
    staleTime: 0,
    refetchInterval: 15000,
  });
}

export function useZaloThreadMessages(contact_pid?: string) {
  return useQuery({
    queryKey: ['zalo-thread-messages', contact_pid],
    queryFn: () => zaloApi.getThreadMessages(contact_pid!).then(r => r.data),
    enabled: !!contact_pid,
    staleTime: 0,
    refetchInterval: 10000,
  });
}

export function useZaloGroupInfo(group_id?: string) {
  return useQuery({
    queryKey: ['zalo-group-info', group_id],
    queryFn: () => zaloApi.getGroupInfo(group_id!).then(r => r.data),
    enabled: !!group_id,
  });
}

export function useZaloUserInfo(user_id?: string) {
  return useQuery({
    queryKey: ['zalo-user-info', user_id],
    queryFn: () => zaloApi.getUserInfo(user_id!).then(r => r.data),
    enabled: !!user_id,
  });
}

export function useZaloStats() {
  return useQuery({ queryKey: ['zalo-stats'], queryFn: () => zaloApi.getStats().then(r => r.data), refetchInterval: 30000 });
}

export function useZaloMessages(filters?: Record<string, unknown>) {
  return useQuery({
    queryKey: ['zalo-messages', filters],
    queryFn: () => zaloApi.getMessages(filters).then(r => r.data),
    refetchInterval: 10000,
  });
}

export function useZaloSyncMessages() {
  return useMutation({
    mutationFn: () => zaloApi.syncMessages().then(r => r.data),
    onSuccess: (res: any) => {
      const data = res.data;
      toast.success(i18n.t('zalo.syncSuccess', { synced: data?.synced || 0, skipped: data?.skipped || 0 }));
    },
    onError: (err: unknown) => toast.error(getErrorMessage(err)),
  });
}

export function useZaloAiChat() {
  return useMutation({
    mutationFn: (question: string) => zaloApi.aiChat(question).then(r => r.data),
    onError: (err: unknown) => toast.error(getErrorMessage(err)),
  });
}

export function useAiTrainingList(category?: string) {
  return useQuery({
    queryKey: ['ai-training', category],
    queryFn: () => zaloApi.listTraining(category).then(r => r.data),
  });
}

export function useCreateAiTraining() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { category: string; title: string; content: string }) => zaloApi.createTraining(data).then(r => r.data),
    onSuccess: () => { toast.success(i18n.t('zalo.trainingAdded')); qc.invalidateQueries({ queryKey: ['ai-training'] }); },
    onError: (err: unknown) => toast.error(getErrorMessage(err)),
  });
}

export function useRemoveAiTraining() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => zaloApi.removeTraining(id).then(r => r.data),
    onSuccess: () => { toast.success(i18n.t('common.deleted')); qc.invalidateQueries({ queryKey: ['ai-training'] }); },
    onError: (err: unknown) => toast.error(getErrorMessage(err)),
  });
}

export function useZaloAiSummary(hours?: number) {
  return useQuery({
    queryKey: ['zalo-ai-summary', hours],
    queryFn: () => zaloApi.aiSummary(hours).then(r => r.data),
    enabled: false, // manual trigger only
  });
}

export function useThreadSettings(threadKey: string | null | undefined) {
  return useQuery({
    queryKey: ['zalo-thread-settings', threadKey],
    queryFn: () => zaloApi.getThreadSettings(threadKey!).then((r) => r.data?.data ?? r.data),
    enabled: !!threadKey,
    staleTime: 0,
  });
}

export function useToggleAutoReply() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ threadKey, enabled }: { threadKey: string; enabled: boolean }) =>
      zaloApi.toggleAutoReply(threadKey, enabled).then((r) => r.data),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['zalo-thread-settings', vars.threadKey] });
      toast.success(i18n.t('zalo.autoReplyUpdated'));
    },
    onError: (err: unknown) => toast.error(getErrorMessage(err)),
  });
}
