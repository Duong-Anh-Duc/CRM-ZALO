import { AbilityBuilder, PureAbility } from '@casl/ability';

export type AppAbility = PureAbility<[string, string]>;

/**
 * Backend-seeded permissions map: permission key "customer.view" → (action, subject).
 * This mirror keeps the FE ability.can() in sync with backend requireAbility().
 * Kept in sync with server/src/prisma/seeds/rbac.ts PERMISSIONS array.
 */
const PERMISSION_MAP: Record<string, [string, string]> = {
  // customer
  'customer.view': ['read', 'Customer'],
  'customer.create': ['create', 'Customer'],
  'customer.update': ['update', 'Customer'],
  'customer.delete': ['delete', 'Customer'],
  'customer.approve': ['approve', 'Customer'],
  // product
  'product.view': ['read', 'Product'],
  'product.create': ['create', 'Product'],
  'product.update': ['update', 'Product'],
  'product.delete': ['delete', 'Product'],
  'product.manage_images': ['manage', 'ProductImage'],
  // supplier
  'supplier.view': ['read', 'Supplier'],
  'supplier.create': ['create', 'Supplier'],
  'supplier.update': ['update', 'Supplier'],
  'supplier.delete': ['delete', 'Supplier'],
  // sales order
  'sales_order.view': ['read', 'SalesOrder'],
  'sales_order.create': ['create', 'SalesOrder'],
  'sales_order.update': ['update', 'SalesOrder'],
  'sales_order.manage_status': ['manage_status', 'SalesOrder'],
  'sales_order.manage_items': ['manage_items', 'SalesOrder'],
  // purchase order
  'purchase_order.view': ['read', 'PurchaseOrder'],
  'purchase_order.create': ['create', 'PurchaseOrder'],
  'purchase_order.update': ['update', 'PurchaseOrder'],
  'purchase_order.manage_status': ['manage_status', 'PurchaseOrder'],
  // invoice
  'invoice.view': ['read', 'Invoice'],
  'invoice.create': ['create', 'Invoice'],
  'invoice.update': ['update', 'Invoice'],
  'invoice.finalize': ['finalize', 'Invoice'],
  'invoice.cancel': ['cancel', 'Invoice'],
  // return
  'return.view': ['read', 'Return'],
  'return.create': ['create', 'Return'],
  'return.update': ['update', 'Return'],
  'return.delete': ['delete', 'Return'],
  // receivable
  'receivable.view': ['read', 'Receivable'],
  'receivable.record_payment': ['create', 'ReceivablePayment'],
  'receivable.update_evidence': ['update', 'ReceivablePayment'],
  'receivable.export': ['export', 'Receivable'],
  // payable
  'payable.view': ['read', 'Payable'],
  'payable.record_payment': ['create', 'PayablePayment'],
  'payable.update_evidence': ['update', 'PayablePayment'],
  'payable.export': ['export', 'Payable'],
  // operating cost
  'operating_cost.view': ['read', 'OperatingCost'],
  'operating_cost.create': ['create', 'OperatingCost'],
  'operating_cost.update': ['update', 'OperatingCost'],
  'operating_cost.delete': ['delete', 'OperatingCost'],
  'operating_cost.manage_categories': ['manage', 'OperatingCostCategory'],
  // cash book
  'cash_book.view': ['read', 'CashTransaction'],
  'cash_book.create': ['create', 'CashTransaction'],
  'cash_book.update': ['update', 'CashTransaction'],
  'cash_book.delete': ['delete', 'CashTransaction'],
  'cash_book.manage_categories': ['manage', 'CashCategory'],
  // payroll
  'payroll.view': ['read', 'Payroll'],
  'payroll.manage_config': ['manage', 'PayrollConfig'],
  'payroll.manage_employees': ['manage', 'EmployeeProfile'],
  'payroll.manage_periods': ['manage', 'PayrollPeriod'],
  // user & role
  'user.view': ['read', 'User'],
  'user.create': ['create', 'User'],
  'user.update': ['update', 'User'],
  'user.delete': ['delete', 'User'],
  'role.manage': ['manage', 'Role'],
  // dashboard / report
  'dashboard.view': ['read', 'Dashboard'],
  'report.view': ['read', 'Report'],
  // audit log
  'audit_log.view': ['read', 'AuditLog'],
  // zalo
  'zalo.view': ['read', 'Zalo'],
  'zalo.manage_config': ['manage', 'ZaloConfig'],
  'zalo.sync_messages': ['manage', 'ZaloMessage'],
  'zalo.manage_training': ['manage', 'AiTraining'],
  // pricing
  'customer_product_price.manage': ['manage', 'CustomerProductPrice'],
  'supplier_price.manage': ['manage', 'SupplierPrice'],
  // alert
  'alert.manage': ['manage', 'Alert'],
  // ai chat
  'ai.chat': ['use', 'AiChat'],
};

export function buildAbility(permissionKeys: string[]): AppAbility {
  const { can, build } = new AbilityBuilder<AppAbility>(PureAbility);
  for (const key of permissionKeys) {
    const pair = PERMISSION_MAP[key];
    if (pair) can(pair[0], pair[1]);
  }
  return build();
}

export { PERMISSION_MAP };
