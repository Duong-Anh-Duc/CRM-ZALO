import apiClient from '@/lib/api-client';

export const productApi = {
  list: (params?: Record<string, unknown>) =>
    apiClient.get('/products', { params }),

  getById: (id: string) =>
    apiClient.get(`/products/${id}`),

  create: (data: FormData) =>
    apiClient.post('/products', data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  update: (id: string, data: Record<string, unknown>) =>
    apiClient.put(`/products/${id}`, data),

  softDelete: (id: string) =>
    apiClient.delete(`/products/${id}`),

  getCompatibleCaps: (id: string) =>
    apiClient.get(`/products/${id}/compatible-caps`),

  // Image management
  uploadImages: (productId: string, files: FormData) =>
    apiClient.post(`/products/${productId}/images`, files, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  deleteImage: (productId: string, imageId: string) =>
    apiClient.delete(`/products/${productId}/images/${imageId}`),

  setPrimaryImage: (productId: string, imageId: string) =>
    apiClient.patch(`/products/${productId}/images/${imageId}/primary`),
};
