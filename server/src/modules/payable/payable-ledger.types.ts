export interface LedgerRow {
  date: Date;
  doc_code: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
  unit?: string;
  quantity?: number;
  unit_price?: number;
}

export interface LedgerTotals {
  total_debit: number;
  total_credit: number;
  total_quantity: number;
  ending_balance: number;
}

export interface LedgerSupplier {
  id: string;
  company_name: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
}

export interface LedgerResult {
  supplier: LedgerSupplier;
  rows: LedgerRow[];
  opening_balance: number;
  totals: LedgerTotals;
  from_date?: string;
  to_date?: string;
}
