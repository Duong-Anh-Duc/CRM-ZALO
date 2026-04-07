import { AxiosError } from 'axios';
import i18n from '@/locales';
import { ApiErrorResponse } from './types';

export function getApiErrorMessage(error: unknown): string {
  if (error instanceof AxiosError) {
    const data = error.response?.data as ApiErrorResponse | undefined;
    if (data?.message) return data.message;

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

export function getApiFieldErrors(error: unknown): Record<string, string> | null {
  if (error instanceof AxiosError) {
    const data = error.response?.data as ApiErrorResponse | undefined;
    if (data?.errors) {
      const fieldErrors: Record<string, string> = {};
      Object.entries(data.errors).forEach(([field, messages]) => {
        fieldErrors[field] = messages[0];
      });
      return fieldErrors;
    }
  }
  return null;
}
