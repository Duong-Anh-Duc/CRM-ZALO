import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import i18n from '@/locales';
import { getErrorMessage } from '@/lib/api-client';
import { authApi, userApi } from './api';
import { useAuthStore } from '@/stores/auth.store';
import { LoginInput, ChangePasswordInput, CreateUserInput } from '@/types';
import { useNavigate } from 'react-router-dom';

export function useLogin() {
  const { setAuth } = useAuthStore();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: (data: LoginInput) => authApi.login(data).then(r => r.data),
    onSuccess: (res) => {
      setAuth(res.data.user, res.data.token);
      navigate('/');
    },
    onError: (err: unknown) => {
      toast.error(getErrorMessage(err));
    },
  });
}

export function useLogout() {
  const { logout } = useAuthStore();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: () => authApi.logout(),
    onSuccess: () => {
      logout();
      navigate('/login');
    },
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (data: ChangePasswordInput) => authApi.changePassword(data),
    onSuccess: () => toast.success(i18n.t('auth.changePasswordSuccess')),
    onError: (err: unknown) => toast.error(getErrorMessage(err)),
  });
}

export function useUpdateProfile() {
  const { setAuth, token } = useAuthStore();
  return useMutation({
    mutationFn: (data: { full_name: string }) => authApi.updateProfile(data).then(r => r.data),
    onSuccess: (res) => {
      if (token) setAuth(res.data, token);
      toast.success(i18n.t('auth.profileUpdateSuccess'));
    },
    onError: (err: unknown) => toast.error(getErrorMessage(err)),
  });
}

export function useUsers(params?: { page?: number; limit?: number; search?: string }) {
  return useQuery({
    queryKey: ['users', params],
    queryFn: () => userApi.list(params).then(r => r.data),
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateUserInput) => userApi.create(data).then(r => r.data),
    onSuccess: () => {
      toast.success(i18n.t('user.createSuccess'));
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (err: unknown) => toast.error(getErrorMessage(err)),
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateUserInput> & { is_active?: boolean } }) =>
      userApi.update(id, data).then(r => r.data),
    onSuccess: () => {
      toast.success(i18n.t('user.updateSuccess'));
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (err: unknown) => toast.error(getErrorMessage(err)),
  });
}

export function useDeactivateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => userApi.deactivate(id).then(r => r.data),
    onSuccess: () => {
      toast.success(i18n.t('user.deactivateSuccess'));
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (err: unknown) => toast.error(getErrorMessage(err)),
  });
}
