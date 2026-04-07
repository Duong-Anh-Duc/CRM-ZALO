import { Customer } from '@/types';

export interface CustomerFormModalProps {
  open: boolean;
  customer?: Customer;
  onClose: () => void;
  onSuccess: () => void;
}
