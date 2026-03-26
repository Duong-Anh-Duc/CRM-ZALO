import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import i18n from '@/locales';
import { getErrorMessage } from '@/lib/api-client';
import { productApi } from './api';

export function useProducts(filters?: Record<string, unknown>) {
  return useQuery({
    queryKey: ['products', filters],
    queryFn: () => productApi.list(filters).then(r => r.data),
  });
}

export function useProduct(id?: string) {
  return useQuery({
    queryKey: ['products', id],
    queryFn: () => productApi.getById(id!).then(r => r.data),
    enabled: !!id,
  });
}

export function useCreateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: FormData) => productApi.create(data).then(r => r.data),
    onSuccess: () => {
      toast.success(i18n.t('product.createSuccess'));
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (err: unknown) => toast.error(getErrorMessage(err)),
  });
}

export function useUpdateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      productApi.update(id, data).then(r => r.data),
    onSuccess: () => {
      toast.success(i18n.t('product.updateSuccess'));
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (err: unknown) => toast.error(getErrorMessage(err)),
  });
}

export function useDeleteProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => productApi.softDelete(id).then(r => r.data),
    onSuccess: () => {
      toast.success(i18n.t('product.deleteSuccess'));
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (err: unknown) => toast.error(getErrorMessage(err)),
  });
}

export function useCompatibleCaps(id?: string) {
  return useQuery({
    queryKey: ['compatible-caps', id],
    queryFn: () => productApi.getCompatibleCaps(id!).then(r => r.data),
    enabled: !!id,
  });
}

// Image hooks

export function useUploadProductImages() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ productId, files }: { productId: string; files: FormData }) =>
      productApi.uploadImages(productId, files).then(r => r.data),
    onSuccess: () => {
      toast.success(i18n.t('product.uploadSuccess'));
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (err: unknown) => toast.error(getErrorMessage(err)),
  });
}

export function useDeleteProductImage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ productId, imageId }: { productId: string; imageId: string }) =>
      productApi.deleteImage(productId, imageId).then(r => r.data),
    onSuccess: () => {
      toast.success(i18n.t('product.imageDeleted'));
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (err: unknown) => toast.error(getErrorMessage(err)),
  });
}

export function useSetPrimaryImage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ productId, imageId }: { productId: string; imageId: string }) =>
      productApi.setPrimaryImage(productId, imageId).then(r => r.data),
    onSuccess: () => {
      toast.success(i18n.t('product.primaryImageSet'));
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (err: unknown) => toast.error(getErrorMessage(err)),
  });
}
