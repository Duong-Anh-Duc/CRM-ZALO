/**
 * Tool domain map — used by hierarchical tool routing.
 * Stage 1 LLM picks domains from this list, then stage 2 only loads those tools.
 *
 * ALWAYS_LOADED tools are included regardless of routing — they cover meta needs
 * (help, confirm, memory, search) that any conversation may require.
 */

export const ALWAYS_LOADED = new Set<string>([
  'confirm_action',
  'help',
  'remember',
  'forget',
  'list_memories',
  'search_customer',
  'search_supplier',
  'search_product',
]);

export const DOMAINS = {
  READ: {
    label: 'Đọc / báo cáo / tra cứu danh sách / chi tiết KH-NCC-SP-đơn-công nợ-sổ quỹ-báo cáo tài chính',
    tools: [
      'get_customer_list', 'get_product_list', 'get_supplier_list',
      'get_recent_orders', 'get_order_detail', 'get_return_details',
      'get_receivable_details', 'get_payable_details',
      'get_financial_report', 'get_cash_book_details', 'list_categories',
    ],
  },
  VISION: {
    label: 'Nhận diện sản phẩm từ ảnh KH gửi',
    tools: ['find_product_by_image'],
  },
  CUSTOMER: {
    label: 'Tạo/sửa/xoá khách hàng + giá riêng cho KH',
    tools: [
      'create_customer', 'update_customer', 'delete_customer',
      'upsert_customer_product_price', 'delete_customer_product_price',
    ],
  },
  SUPPLIER: {
    label: 'Tạo/sửa/xoá nhà cung cấp + giá NCC',
    tools: [
      'create_supplier', 'update_supplier', 'delete_supplier',
      'upsert_supplier_price', 'delete_supplier_price',
    ],
  },
  PRODUCT: {
    label: 'Tạo/sửa/xoá sản phẩm + danh mục SP',
    tools: [
      'create_product', 'update_product', 'delete_product',
      'create_product_category', 'update_product_category', 'delete_product_category',
    ],
  },
  ORDER: {
    label: 'Tạo/sửa đơn bán SO, đơn mua PO, đổi trạng thái, thêm/gỡ item',
    tools: [
      'create_sales_order', 'update_sales_order', 'update_sales_order_status',
      'add_sales_order_item', 'remove_sales_order_item',
      'create_purchase_order', 'update_purchase_order', 'update_purchase_order_status',
    ],
  },
  INVOICE: {
    label: 'Tạo/sửa hoá đơn bán-mua, finalize, cancel',
    tools: [
      'create_sales_invoice', 'update_sales_invoice', 'create_purchase_invoice',
      'finalize_invoice', 'cancel_invoice',
    ],
  },
  RETURN: {
    label: 'Trả hàng bán/mua',
    tools: [
      'create_sales_return', 'update_sales_return', 'delete_sales_return',
      'create_purchase_return', 'update_purchase_return', 'delete_purchase_return',
    ],
  },
  PAYMENT: {
    label: 'Ghi nhận thanh toán công nợ KH/NCC',
    tools: [
      'record_receivable_payment', 'record_payable_payment',
      'update_receivable_payment_evidence', 'update_payable_payment_evidence',
    ],
  },
  CASH: {
    label: 'Sổ quỹ thu/chi + chi phí vận hành + danh mục',
    tools: [
      'create_cash_transaction', 'update_cash_transaction', 'delete_cash_transaction',
      'create_cash_category', 'update_cash_category', 'delete_cash_category',
      'create_operating_cost', 'update_operating_cost', 'delete_operating_cost',
      'create_operating_cost_category', 'update_operating_cost_category', 'delete_operating_cost_category',
    ],
  },
  PAYROLL: {
    label: 'Lương + nhân viên + duyệt/đánh dấu trả lương',
    tools: [
      'create_payroll_period', 'calculate_payroll', 'approve_payroll', 'mark_payroll_paid',
      'create_employee_profile', 'update_employee_profile', 'delete_employee_profile',
    ],
  },
  ALERT: {
    label: 'Cảnh báo hệ thống',
    tools: ['mark_alert_read', 'take_alert_action'],
  },
  ZALO: {
    label: 'Gửi tin Zalo, đọc tin, auto-reply, danh sách hội thoại',
    tools: [
      'send_zalo_message', 'send_zalo_group_message',
      'list_zalo_threads', 'get_zalo_messages', 'set_zalo_auto_reply',
    ],
  },
  EXPORT: {
    label: 'Xuất Excel danh sách KH-SP-NCC',
    tools: ['export_customers_excel', 'export_products_excel', 'export_suppliers_excel'],
  },
  TRAINING: {
    label: 'Tài liệu training cho AI',
    tools: ['add_ai_training', 'list_ai_training', 'delete_ai_training'],
  },
} as const;

export type DomainKey = keyof typeof DOMAINS;

export function expandDomains(domains: DomainKey[]): Set<string> {
  const out = new Set<string>(ALWAYS_LOADED);
  for (const d of domains) {
    const def = DOMAINS[d];
    if (!def) continue;
    for (const t of def.tools) out.add(t);
  }
  return out;
}

export function allToolNames(): Set<string> {
  const out = new Set<string>(ALWAYS_LOADED);
  for (const k of Object.keys(DOMAINS) as DomainKey[]) {
    for (const t of DOMAINS[k].tools) out.add(t);
  }
  return out;
}
