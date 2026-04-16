import { ReactNode } from 'react';

export interface StatusTagProps {
  status: string;
  type?: 'sales' | 'purchase' | 'debt' | 'return';
}

export interface ConfirmDeleteProps {
  title: string;
  onConfirm: () => void;
  children: ReactNode;
}

export interface PageHeaderProps {
  title: ReactNode;
  subtitle?: string;
  extra?: ReactNode;
}

export interface EmptyStateProps {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

export interface PaymentModalProps {
  open: boolean;
  onClose: () => void;
  type: 'receivable' | 'payable';
  debtId: string;
  maxAmount: number;
}
