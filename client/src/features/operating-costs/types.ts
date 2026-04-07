import { OperatingCost } from '@/types';

export interface CostFormModalProps {
  open: boolean;
  editingCost: OperatingCost | null;
  onCancel: () => void;
  onSuccess: () => void;
}
