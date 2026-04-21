import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import i18n from '@/locales';
import { getErrorMessage } from '@/lib/api-client';
import { roleApi } from './api';
import type {
  CreateRoleInput,
  Permission,
  Role,
  UpdateRoleMetaInput,
  UpdateRolePermissionsInput,
} from './types';

export function useRoles() {
  return useQuery({
    queryKey: ['roles'],
    queryFn: () => roleApi.list().then((r) => r.data.data as Role[]),
  });
}

export function useRole(id?: string | null) {
  return useQuery({
    queryKey: ['roles', id],
    queryFn: () => roleApi.getById(id!).then((r) => r.data.data as Role),
    enabled: !!id,
  });
}

export function useRolePermissions() {
  return useQuery({
    queryKey: ['role-permissions'],
    queryFn: () =>
      roleApi.permissions().then((r) => r.data.data as Permission[]),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateRoleInput) =>
      roleApi.create(data).then((r) => r.data.data as Role),
    onSuccess: () => {
      toast.success(i18n.t('role.createSuccess'));
      queryClient.invalidateQueries({ queryKey: ['roles'] });
    },
    onError: (err: unknown) => toast.error(getErrorMessage(err)),
  });
}

export function useUpdateRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateRoleMetaInput }) =>
      roleApi.update(id, data).then((r) => r.data.data as Role),
    onSuccess: (_data, variables) => {
      toast.success(i18n.t('role.updateSuccess'));
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      queryClient.invalidateQueries({ queryKey: ['roles', variables.id] });
    },
    onError: (err: unknown) => toast.error(getErrorMessage(err)),
  });
}

export function useUpdateRolePermissions() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, permission_ids }: UpdateRolePermissionsInput) =>
      roleApi.updatePermissions(id, permission_ids).then((r) => r.data.data as Role),
    onSuccess: (_data, variables) => {
      toast.success(i18n.t('role.saveSuccess'));
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      queryClient.invalidateQueries({ queryKey: ['roles', variables.id] });
    },
    onError: (err: unknown) => toast.error(getErrorMessage(err)),
  });
}

export function useDeleteRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => roleApi.remove(id).then((r) => r.data),
    onSuccess: () => {
      toast.success(i18n.t('role.deleteSuccess'));
      queryClient.invalidateQueries({ queryKey: ['roles'] });
    },
    onError: (err: unknown) => toast.error(getErrorMessage(err)),
  });
}
