export type PaymentTerms = 'IMMEDIATE' | 'NET_30' | 'NET_60' | 'NET_90';

export interface Supplier {
  id: string;
  company_name: string;
  tax_code?: string;
  address?: string;
  contact_name?: string;
  phone?: string;
  email?: string;
  payment_terms: PaymentTerms;
  zalo_user_id?: string;
  is_active: boolean;
  products_count?: number;
  total_payable?: number;
  overdue_amount?: number;
  created_at: string;
  updated_at: string;
}
