import { Supplier } from '@/types';

export interface SupplierFormModalProps {
  open: boolean;
  supplier?: Supplier;
  onClose: () => void;
  onSuccess: () => void;
}
