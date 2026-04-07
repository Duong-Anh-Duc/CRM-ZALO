import { Product, ProductImage } from '@/types';

export interface ProductFormModalProps {
  open: boolean;
  product?: Product | null;
  onClose: () => void;
  onSuccess: () => void;
}

export interface ProductImageManagerProps {
  productId: string;
  images: ProductImage[];
  canManage: boolean;
}
