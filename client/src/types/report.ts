export interface PnlReport {
  revenue: number;
  cogs: number;
  gross_profit: number;
  operating_costs: number;
  net_profit: number;
}

export interface DebtAgingBuckets {
  current: number;
  '1_30': number;
  '31_60': number;
  '60_plus': number;
}

export interface DebtAgingReport {
  receivables: { buckets: DebtAgingBuckets; details: unknown[] };
  payables: { buckets: DebtAgingBuckets; details: unknown[] };
}

export interface ProductSalesItem {
  sku: string;
  name: string;
  qty: number;
  revenue: number;
}

export interface OperatingCost {
  id: string;
  date: string;
  category_id: string;
  category: { id: string; name: string };
  description?: string;
  amount: number;
  receipt_url?: string;
}

export interface OperatingCostCategory {
  id: string;
  name: string;
  is_active: boolean;
}
