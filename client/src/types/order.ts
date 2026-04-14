import { Product } from './product';
import { Customer } from './customer';
import { Supplier } from './supplier';

export type SalesOrderStatus = 'DRAFT' | 'CONFIRMED' | 'SHIPPING' | 'COMPLETED' | 'CANCELLED';
export type PurchaseOrderStatus = 'DRAFT' | 'CONFIRMED' | 'SHIPPING' | 'COMPLETED' | 'CANCELLED';
export type VATRate = 'VAT_0' | 'VAT_8' | 'VAT_10';

export interface SalesOrderItem {
  id: string;
  sales_order_id: string;
  product_id?: string;
  combo_id?: string;
  quantity: number;
  unit_price: number;
  discount_pct: number;
  line_total: number;
  color_note?: string;
  packaging_note?: string;
  product?: Pick<Product, 'id' | 'sku' | 'name'>;
}

export interface SalesOrder {
  id: string;
  order_code: string;
  customer_id: string;
  customer: Pick<Customer, 'id' | 'company_name' | 'phone'>;
  order_date: string;
  expected_delivery?: string;
  notes?: string;
  subtotal: number;
  discount_amount: number;
  vat_rate: VATRate;
  vat_amount: number;
  grand_total: number;
  status: SalesOrderStatus;
  items: SalesOrderItem[];
  created_at: string;
}

export interface PurchaseOrderItem {
  id: string;
  purchase_order_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  product?: Pick<Product, 'id' | 'sku' | 'name'>;
}

export interface PurchaseOrder {
  id: string;
  order_code: string;
  supplier_id: string;
  supplier: Pick<Supplier, 'id' | 'company_name' | 'phone'>;
  order_date: string;
  expected_delivery?: string;
  notes?: string;
  total: number;
  status: PurchaseOrderStatus;
  items: PurchaseOrderItem[];
  created_at: string;
}

export interface CreateSalesOrderInput {
  customer_id: string;
  expected_delivery?: string;
  notes?: string;
  vat_rate: VATRate;
  items: Array<{
    product_id?: string;
    combo_id?: string;
    quantity: number;
    unit_price: number;
    discount_pct?: number;
    color_note?: string;
    packaging_note?: string;
  }>;
}

export interface CreatePurchaseOrderInput {
  supplier_id: string;
  expected_delivery?: string;
  notes?: string;
  items: Array<{
    product_id: string;
    quantity: number;
    unit_price: number;
  }>;
}
