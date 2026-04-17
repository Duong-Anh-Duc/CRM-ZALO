interface AgingBucket { count: number; total: number }

export interface DashboardOverview {
  receivable: { total_amount: number; total_count: number; overdue_amount: number; overdue_count: number };
  payable: { total_amount: number; total_count: number; overdue_amount: number; overdue_count: number };
  top_customers: Array<{ name: string; revenue: number }>;
  top_products: Array<{ name: string; qty: number; revenue: number }>;
  orders_by_status: Array<{ status: string; count: number }>;
  upcoming_deliveries: Array<{ id: string; order_code: string; expected_delivery: string; supplier: { company_name: string } }>;
  revenue_trend: Array<{ month: string; revenue: number; cost: number; profit: number }>;
  cash_book: { total_income: number; total_expense: number; balance: number };
  receivable_aging: { current: AgingBucket; '1_30': AgingBucket; '31_60': AgingBucket; '60_plus': AgingBucket };
  payable_aging: { current: AgingBucket; '1_30': AgingBucket; '31_60': AgingBucket; '60_plus': AgingBucket };
  recent_orders: Array<{ order_code: string; customer_name: string; grand_total: number; status: string; order_date: string }>;
  returns_summary: { sales_returns: Array<{ status: string; count: number }>; purchase_returns: Array<{ status: string; count: number }> };
  payroll_summary: { year: number; month: number; status: string; total_gross: number; total_ins_employee: number; total_ins_employer: number; total_pit: number; total_net: number; employee_count: number } | null;
  cash_flow: Array<{ month: string; income_total: number; expense_total: number }>;
  order_trend: Array<{ month: string; count: number }>;
}

export interface Alert {
  id: string;
  type: 'WARNING' | 'URGENT' | 'CRITICAL' | 'ESCALATION';
  title: string;
  message: string;
  purchase_order_id?: string;
  is_read: boolean;
  action_taken?: string;
  new_expected_date?: string;
  created_at: string;
}
