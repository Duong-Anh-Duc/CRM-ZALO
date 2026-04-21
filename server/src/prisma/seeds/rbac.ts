import { PrismaClient } from '@prisma/client';

// ─── Permission definitions ────────────────────────
export const PERMISSIONS: ReadonlyArray<{
  key: string;
  action: string;
  subject: string;
  module: string;
  description?: string;
}> = [
  // customer
  { key: 'customer.view', action: 'read', subject: 'Customer', module: 'customer', description: 'Xem khách hàng' },
  { key: 'customer.create', action: 'create', subject: 'Customer', module: 'customer', description: 'Tạo khách hàng' },
  { key: 'customer.update', action: 'update', subject: 'Customer', module: 'customer', description: 'Sửa khách hàng' },
  { key: 'customer.delete', action: 'delete', subject: 'Customer', module: 'customer', description: 'Xoá khách hàng' },
  { key: 'customer.approve', action: 'approve', subject: 'Customer', module: 'customer', description: 'Duyệt khách hàng' },
  // product
  { key: 'product.view', action: 'read', subject: 'Product', module: 'product', description: 'Xem sản phẩm' },
  { key: 'product.create', action: 'create', subject: 'Product', module: 'product', description: 'Tạo sản phẩm' },
  { key: 'product.update', action: 'update', subject: 'Product', module: 'product', description: 'Sửa sản phẩm' },
  { key: 'product.delete', action: 'delete', subject: 'Product', module: 'product', description: 'Xoá sản phẩm' },
  { key: 'product.manage_images', action: 'manage', subject: 'ProductImage', module: 'product', description: 'Quản lý ảnh sản phẩm' },
  // supplier
  { key: 'supplier.view', action: 'read', subject: 'Supplier', module: 'supplier', description: 'Xem nhà cung cấp' },
  { key: 'supplier.create', action: 'create', subject: 'Supplier', module: 'supplier', description: 'Tạo nhà cung cấp' },
  { key: 'supplier.update', action: 'update', subject: 'Supplier', module: 'supplier', description: 'Sửa nhà cung cấp' },
  { key: 'supplier.delete', action: 'delete', subject: 'Supplier', module: 'supplier', description: 'Xoá nhà cung cấp' },
  // sales order
  { key: 'sales_order.view', action: 'read', subject: 'SalesOrder', module: 'sales_order', description: 'Xem đơn bán' },
  { key: 'sales_order.create', action: 'create', subject: 'SalesOrder', module: 'sales_order', description: 'Tạo đơn bán' },
  { key: 'sales_order.update', action: 'update', subject: 'SalesOrder', module: 'sales_order', description: 'Sửa đơn bán' },
  { key: 'sales_order.manage_status', action: 'manage_status', subject: 'SalesOrder', module: 'sales_order', description: 'Đổi trạng thái đơn bán' },
  { key: 'sales_order.manage_items', action: 'manage_items', subject: 'SalesOrder', module: 'sales_order', description: 'Quản lý chi tiết đơn bán' },
  // purchase order
  { key: 'purchase_order.view', action: 'read', subject: 'PurchaseOrder', module: 'purchase_order', description: 'Xem đơn mua' },
  { key: 'purchase_order.create', action: 'create', subject: 'PurchaseOrder', module: 'purchase_order', description: 'Tạo đơn mua' },
  { key: 'purchase_order.update', action: 'update', subject: 'PurchaseOrder', module: 'purchase_order', description: 'Sửa đơn mua' },
  { key: 'purchase_order.manage_status', action: 'manage_status', subject: 'PurchaseOrder', module: 'purchase_order', description: 'Đổi trạng thái đơn mua' },
  // invoice
  { key: 'invoice.view', action: 'read', subject: 'Invoice', module: 'invoice', description: 'Xem hoá đơn' },
  { key: 'invoice.create', action: 'create', subject: 'Invoice', module: 'invoice', description: 'Tạo hoá đơn' },
  { key: 'invoice.update', action: 'update', subject: 'Invoice', module: 'invoice', description: 'Sửa hoá đơn' },
  { key: 'invoice.finalize', action: 'finalize', subject: 'Invoice', module: 'invoice', description: 'Duyệt hoá đơn' },
  { key: 'invoice.cancel', action: 'cancel', subject: 'Invoice', module: 'invoice', description: 'Huỷ hoá đơn' },
  // returns
  { key: 'return.view', action: 'read', subject: 'Return', module: 'return', description: 'Xem đơn trả' },
  { key: 'return.create', action: 'create', subject: 'Return', module: 'return', description: 'Tạo đơn trả' },
  { key: 'return.update', action: 'update', subject: 'Return', module: 'return', description: 'Sửa đơn trả' },
  { key: 'return.delete', action: 'delete', subject: 'Return', module: 'return', description: 'Xoá đơn trả' },
  // receivable
  { key: 'receivable.view', action: 'read', subject: 'Receivable', module: 'receivable', description: 'Xem công nợ phải thu' },
  { key: 'receivable.record_payment', action: 'create', subject: 'ReceivablePayment', module: 'receivable', description: 'Ghi nhận thanh toán phải thu' },
  { key: 'receivable.update_evidence', action: 'update', subject: 'ReceivablePayment', module: 'receivable', description: 'Cập nhật minh chứng phải thu' },
  { key: 'receivable.export', action: 'export', subject: 'Receivable', module: 'receivable', description: 'Xuất sổ phải thu' },
  // payable
  { key: 'payable.view', action: 'read', subject: 'Payable', module: 'payable', description: 'Xem công nợ phải trả' },
  { key: 'payable.record_payment', action: 'create', subject: 'PayablePayment', module: 'payable', description: 'Ghi nhận thanh toán phải trả' },
  { key: 'payable.update_evidence', action: 'update', subject: 'PayablePayment', module: 'payable', description: 'Cập nhật minh chứng phải trả' },
  { key: 'payable.export', action: 'export', subject: 'Payable', module: 'payable', description: 'Xuất sổ phải trả' },
  // operating cost
  { key: 'operating_cost.view', action: 'read', subject: 'OperatingCost', module: 'operating_cost', description: 'Xem chi phí' },
  { key: 'operating_cost.create', action: 'create', subject: 'OperatingCost', module: 'operating_cost', description: 'Tạo chi phí' },
  { key: 'operating_cost.update', action: 'update', subject: 'OperatingCost', module: 'operating_cost', description: 'Sửa chi phí' },
  { key: 'operating_cost.delete', action: 'delete', subject: 'OperatingCost', module: 'operating_cost', description: 'Xoá chi phí' },
  { key: 'operating_cost.manage_categories', action: 'manage', subject: 'OperatingCostCategory', module: 'operating_cost', description: 'Quản lý nhóm chi phí' },
  // cash book
  { key: 'cash_book.view', action: 'read', subject: 'CashTransaction', module: 'cash_book', description: 'Xem sổ quỹ' },
  { key: 'cash_book.create', action: 'create', subject: 'CashTransaction', module: 'cash_book', description: 'Tạo giao dịch sổ quỹ' },
  { key: 'cash_book.update', action: 'update', subject: 'CashTransaction', module: 'cash_book', description: 'Sửa giao dịch sổ quỹ' },
  { key: 'cash_book.delete', action: 'delete', subject: 'CashTransaction', module: 'cash_book', description: 'Xoá giao dịch sổ quỹ' },
  { key: 'cash_book.manage_categories', action: 'manage', subject: 'CashCategory', module: 'cash_book', description: 'Quản lý nhóm sổ quỹ' },
  // payroll
  { key: 'payroll.view', action: 'read', subject: 'Payroll', module: 'payroll', description: 'Xem lương' },
  { key: 'payroll.manage_config', action: 'manage', subject: 'PayrollConfig', module: 'payroll', description: 'Cấu hình lương' },
  { key: 'payroll.manage_employees', action: 'manage', subject: 'EmployeeProfile', module: 'payroll', description: 'Quản lý hồ sơ nhân viên' },
  { key: 'payroll.manage_periods', action: 'manage', subject: 'PayrollPeriod', module: 'payroll', description: 'Quản lý kỳ lương' },
  // user & role
  { key: 'user.view', action: 'read', subject: 'User', module: 'user', description: 'Xem người dùng' },
  { key: 'user.create', action: 'create', subject: 'User', module: 'user', description: 'Tạo người dùng' },
  { key: 'user.update', action: 'update', subject: 'User', module: 'user', description: 'Sửa người dùng' },
  { key: 'user.delete', action: 'delete', subject: 'User', module: 'user', description: 'Xoá người dùng' },
  { key: 'role.manage', action: 'manage', subject: 'Role', module: 'role', description: 'Quản lý vai trò' },
  // dashboard & report
  { key: 'dashboard.view', action: 'read', subject: 'Dashboard', module: 'dashboard', description: 'Xem dashboard' },
  { key: 'report.view', action: 'read', subject: 'Report', module: 'report', description: 'Xem báo cáo' },
  // audit log
  { key: 'audit_log.view', action: 'read', subject: 'AuditLog', module: 'audit_log', description: 'Xem nhật ký hệ thống' },
  // zalo
  { key: 'zalo.view', action: 'read', subject: 'Zalo', module: 'zalo', description: 'Xem Zalo' },
  { key: 'zalo.manage_config', action: 'manage', subject: 'ZaloConfig', module: 'zalo', description: 'Cấu hình Zalo' },
  { key: 'zalo.sync_messages', action: 'manage', subject: 'ZaloMessage', module: 'zalo', description: 'Đồng bộ tin nhắn Zalo' },
  { key: 'zalo.manage_training', action: 'manage', subject: 'AiTraining', module: 'zalo', description: 'Huấn luyện AI' },
  // pricing
  { key: 'customer_product_price.manage', action: 'manage', subject: 'CustomerProductPrice', module: 'pricing', description: 'Bảng giá khách hàng' },
  { key: 'supplier_price.manage', action: 'manage', subject: 'SupplierPrice', module: 'pricing', description: 'Bảng giá NCC' },
  // alert
  { key: 'alert.manage', action: 'manage', subject: 'Alert', module: 'alert', description: 'Quản lý cảnh báo hệ thống (broadcast, tạo mới)' },
  // ai chat
  { key: 'ai.chat', action: 'use', subject: 'AiChat', module: 'ai', description: 'Sử dụng trợ lý AI / chatbot' },
];

// ─── Role definitions ──────────────────────────────
export const ROLES: ReadonlyArray<{ slug: string; name: string; description: string; is_system: boolean }> = [
  { slug: 'admin', name: 'Quản trị viên', description: 'Toàn quyền hệ thống', is_system: true },
  { slug: 'manager', name: 'Quản lý', description: 'Quản lý toàn bộ (không gồm user/role/audit log)', is_system: true },
  { slug: 'accountant', name: 'Kế toán', description: 'Quản lý công nợ, hoá đơn, chi phí, lương', is_system: true },
  { slug: 'sales', name: 'Nhân viên kinh doanh', description: 'Khách hàng, đơn bán, hoá đơn', is_system: true },
];

function resolveRolePermissions(): Record<string, string[]> {
  const allKeys = PERMISSIONS.map((p) => p.key);

  const admin = [...allKeys];

  const manager = allKeys.filter(
    (k) => !k.startsWith('user.') && !k.startsWith('role.') && !k.startsWith('audit_log.')
  );

  const accountant = [
    'customer.view', 'supplier.view', 'product.view',
    'sales_order.view',
    'purchase_order.view', 'purchase_order.create', 'purchase_order.update', 'purchase_order.manage_status',
    'invoice.view', 'invoice.create', 'invoice.update', 'invoice.finalize', 'invoice.cancel',
    'return.view', 'return.create',
    'receivable.view', 'receivable.record_payment', 'receivable.update_evidence', 'receivable.export',
    'payable.view', 'payable.record_payment', 'payable.update_evidence', 'payable.export',
    'operating_cost.view', 'operating_cost.create', 'operating_cost.update', 'operating_cost.manage_categories',
    'cash_book.view', 'cash_book.create', 'cash_book.update', 'cash_book.manage_categories',
    'payroll.view', 'payroll.manage_employees', 'payroll.manage_periods',
    'supplier_price.manage',
    'dashboard.view', 'report.view',
    'ai.chat',
  ];

  const sales = [
    'customer.view', 'customer.create', 'customer.update', 'customer.approve',
    'product.view', 'supplier.view',
    'sales_order.view', 'sales_order.create', 'sales_order.update', 'sales_order.manage_status', 'sales_order.manage_items',
    'invoice.view', 'invoice.create', 'invoice.update',
    'return.view', 'return.create', 'return.update', 'return.delete',
    'receivable.view',
    'customer_product_price.manage',
    'dashboard.view',
    'ai.chat',
  ];

  return { admin, manager, accountant, sales };
}

export async function seedRBAC(prisma: PrismaClient): Promise<void> {
  // 1) Upsert all permissions
  for (const p of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key: p.key },
      update: {
        action: p.action,
        subject: p.subject,
        module: p.module,
        description: p.description ?? null,
      },
      create: {
        key: p.key,
        action: p.action,
        subject: p.subject,
        module: p.module,
        description: p.description ?? null,
      },
    });
  }

  // 2) Upsert system roles
  for (const r of ROLES) {
    await prisma.role.upsert({
      where: { slug: r.slug },
      update: { name: r.name, description: r.description, is_system: r.is_system },
      create: { slug: r.slug, name: r.name, description: r.description, is_system: r.is_system },
    });
  }

  // 3) Apply role -> permission mappings
  const allPerms = await prisma.permission.findMany();
  const byKey = new Map(allPerms.map((p) => [p.key, p]));
  const allRoles = await prisma.role.findMany();
  const roleBySlug = new Map(allRoles.map((r) => [r.slug, r]));

  const resolved = resolveRolePermissions();

  for (const [slug, keys] of Object.entries(resolved)) {
    const role = roleBySlug.get(slug);
    if (!role) continue;
    await prisma.rolePermission.deleteMany({ where: { role_id: role.id } });
    for (const key of keys) {
      const perm = byKey.get(key);
      if (!perm) continue;
      await prisma.rolePermission.create({
        data: { role_id: role.id, permission_id: perm.id },
      });
    }
  }

  console.log(`✓ RBAC seed: ${ROLES.length} roles, ${PERMISSIONS.length} permissions seeded.`);
}
