import dayjs from 'dayjs';
import i18n from '@/locales';

export function formatVND(amount: number | undefined | null): string {
  if (amount == null) return '0 VND';
  return new Intl.NumberFormat('vi-VN').format(Math.round(amount)) + ' VND';
}

export function formatNumber(num: number | undefined | null): string {
  if (num == null) return '0';
  return new Intl.NumberFormat('vi-VN').format(num);
}

export function formatDate(date: string | Date | undefined | null): string {
  if (!date) return '';
  return dayjs(date).format('DD/MM/YYYY');
}

export function formatDateTime(date: string | Date | undefined | null): string {
  if (!date) return '';
  return dayjs(date).format('DD/MM/YYYY HH:mm');
}

export function getSalesStatusLabels(): Record<string, string> {
  const t = i18n.t;
  return {
    NEW: t('salesStatusLabels.NEW'),
    CONFIRMED: t('salesStatusLabels.CONFIRMED'),
    PREPARING: t('salesStatusLabels.PREPARING'),
    SHIPPING: t('salesStatusLabels.SHIPPING'),
    COMPLETED: t('salesStatusLabels.COMPLETED'),
    CANCELLED: t('salesStatusLabels.CANCELLED'),
  };
}

export function getPurchaseStatusLabels(): Record<string, string> {
  const t = i18n.t;
  return {
    NEW: t('purchaseStatusLabels.NEW'),
    CONFIRMED: t('purchaseStatusLabels.CONFIRMED'),
    PROCESSING: t('purchaseStatusLabels.PROCESSING'),
    SHIPPING: t('purchaseStatusLabels.SHIPPING'),
    COMPLETED: t('purchaseStatusLabels.COMPLETED'),
    CANCELLED: t('purchaseStatusLabels.CANCELLED'),
  };
}

export function getDebtStatusLabels(): Record<string, string> {
  const t = i18n.t;
  return {
    UNPAID: t('debtStatusLabels.UNPAID'),
    PARTIAL: t('debtStatusLabels.PARTIAL'),
    PAID: t('debtStatusLabels.PAID'),
    OVERDUE: t('debtStatusLabels.OVERDUE'),
  };
}

export function getCustomerTypeLabels(): Record<string, string> {
  const t = i18n.t;
  return {
    RETAIL: t('customerTypeLabels.RETAIL'),
    WHOLESALE: t('customerTypeLabels.WHOLESALE'),
    DISTRIBUTOR: t('customerTypeLabels.DISTRIBUTOR'),
    OEM: t('customerTypeLabels.OEM'),
  };
}

export function getMaterialLabels(): Record<string, string> {
  const t = i18n.t;
  return {
    PET: t('materialLabels.PET'),
    HDPE: t('materialLabels.HDPE'),
    PP: t('materialLabels.PP'),
    PVC: t('materialLabels.PVC'),
    PS: t('materialLabels.PS'),
    ABS: t('materialLabels.ABS'),
  };
}

// Keep backward compatible exports as getters
export const salesStatusLabels = new Proxy({} as Record<string, string>, {
  get: (_, key: string) => getSalesStatusLabels()[key],
});

export const purchaseStatusLabels = new Proxy({} as Record<string, string>, {
  get: (_, key: string) => getPurchaseStatusLabels()[key],
});

export const debtStatusLabels = new Proxy({} as Record<string, string>, {
  get: (_, key: string) => getDebtStatusLabels()[key],
});

export const customerTypeLabels = new Proxy({} as Record<string, string>, {
  get: (_, key: string) => getCustomerTypeLabels()[key],
});

export const materialLabels = new Proxy({} as Record<string, string>, {
  get: (_, key: string) => getMaterialLabels()[key],
});

// Re-export statusColors from constants for backward compatibility
export { statusColors } from '@/constants/status';
