export type DebtStatus = 'UNPAID' | 'PARTIAL' | 'PAID' | 'OVERDUE';
export type PaymentMethod = 'CASH' | 'BANK_TRANSFER' | 'OTHER';

export interface Payment {
  id: string;
  amount: number;
  payment_date: string;
  method: PaymentMethod;
  reference?: string;
  created_at: string;
}

export interface Receivable {
  id: string;
  sales_order_id: string;
  customer_id: string;
  invoice_number?: string;
  invoice_date: string;
  due_date: string;
  original_amount: number;
  paid_amount: number;
  remaining: number;
  status: DebtStatus;
  customer?: { id: string; company_name: string };
  sales_order?: { id: string; order_code: string };
  payments: Payment[];
  created_at: string;
}

export interface Payable {
  id: string;
  purchase_order_id: string;
  supplier_id: string;
  invoice_number?: string;
  invoice_date: string;
  due_date: string;
  original_amount: number;
  paid_amount: number;
  remaining: number;
  status: DebtStatus;
  statement_url?: string;
  supplier?: { id: string; company_name: string };
  purchase_order?: { id: string; order_code: string };
  payments: Payment[];
  created_at: string;
}

export interface DebtSummary {
  total_receivable?: number;
  total_payable?: number;
  overdue: number;
  due_this_week: number;
}

export interface RecordPaymentInput {
  receivable_id?: string;
  payable_id?: string;
  amount: number;
  payment_date?: string;
  method: PaymentMethod;
  reference?: string;
}
