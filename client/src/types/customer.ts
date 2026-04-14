export type CustomerType = 'INDIVIDUAL' | 'BUSINESS';

export interface Customer {
  id: string;
  company_name: string;
  tax_code?: string;
  address?: string;
  contact_name?: string;
  phone?: string;
  email?: string;
  customer_type: CustomerType;
  debt_limit: number;
  zalo_user_id?: string;
  is_active: boolean;
  total_receivable?: number;
  overdue_amount?: number;
  last_order_date?: string;
  created_at: string;
  updated_at: string;
}

export interface DebtLimitCheck {
  debt_limit: number;
  current_debt: number;
  new_order_total: number;
  exceeds_limit: boolean;
}
