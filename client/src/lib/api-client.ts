import axios from 'axios';
import i18n from '@/locales';

const apiClient = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// Request: attach JWT token
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  // Send current language to backend
  config.headers['Accept-Language'] = i18n.language || 'vi';
  return config;
});

// Response: unwrap { success, data, meta, message } and handle errors
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  },
);

export default apiClient;

/**
 * Extract user-friendly error message from API error
 */
export function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    // Backend sends { success: false, message: "..." }
    const message = error.response?.data?.message;
    if (message) return message;

    // Fallback by status code
    switch (error.response?.status) {
      case 400: return i18n.t('errors.badRequest');
      case 401: return i18n.t('errors.sessionExpired');
      case 403: return i18n.t('errors.forbidden');
      case 404: return i18n.t('errors.notFound');
      case 409: return i18n.t('errors.conflict');
      case 422: return i18n.t('errors.unprocessable');
      case 429: return i18n.t('errors.tooManyRequests');
      case 500: return i18n.t('errors.serverError');
      default: return i18n.t('errors.defaultError');
    }
  }

  if (error instanceof Error) return error.message;
  return i18n.t('errors.unknownError');
}

/**
 * Extract field-level validation errors from API 422 response
 */
export function getFieldErrors(error: unknown): Record<string, string> | null {
  if (axios.isAxiosError(error)) {
    const errors = error.response?.data?.errors;
    if (errors) {
      const fieldErrors: Record<string, string> = {};
      Object.entries(errors).forEach(([field, messages]) => {
        fieldErrors[field] = (messages as string[])[0];
      });
      return fieldErrors;
    }
  }
  return null;
}
