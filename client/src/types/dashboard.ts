export interface DashboardOverview {
  receivable: {
    total_amount: number;
    total_count: number;
    overdue_amount: number;
    overdue_count: number;
  };
  payable: {
    total_amount: number;
    total_count: number;
    overdue_amount: number;
    overdue_count: number;
  };
  top_customers: Array<{ id: string; name: string; revenue: number }>;
  top_products: Array<{ id: string; name: string; qty: number; revenue: number }>;
  orders_by_status: Array<{ status: string; count: number }>;
  upcoming_deliveries: Array<{
    id: string;
    order_code: string;
    expected_delivery: string;
    supplier: { company_name: string };
  }>;
  revenue_trend: Array<{ month: string; revenue: number; cost: number; profit: number }>;
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
