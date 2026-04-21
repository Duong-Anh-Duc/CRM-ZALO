import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth.store';
import { usePermission } from '@/contexts/AbilityContext';
import AppLayout from '@/layouts/AppLayout';
import LoginPage from '@/features/auth/pages/LoginPage';
import DashboardPage from '@/features/dashboard/pages/DashboardPage';
import ProductListPage from '@/features/products/pages/ProductListPage';
import ProductDetailPage from '@/features/products/pages/ProductDetailPage';
import CustomerListPage from '@/features/customers/pages/CustomerListPage';
import CustomerDetailPage from '@/features/customers/pages/CustomerDetailPage';
import SupplierListPage from '@/features/suppliers/pages/SupplierListPage';
import SupplierDetailPage from '@/features/suppliers/pages/SupplierDetailPage';
import SalesOrderListPage from '@/features/orders/pages/sales/SalesOrderListPage';
import SalesOrderDetailPage from '@/features/orders/pages/sales/SalesOrderDetailPage';
import CreateSalesOrderPage from '@/features/orders/pages/sales/CreateSalesOrderPage';
import PurchaseOrderListPage from '@/features/orders/pages/purchase/PurchaseOrderListPage';
import PurchaseOrderDetailPage from '@/features/orders/pages/purchase/PurchaseOrderDetailPage';
import CreatePurchaseOrderPage from '@/features/orders/pages/purchase/CreatePurchaseOrderPage';
import DebtPage from '@/features/debts/pages/DebtPage';
import CustomerDebtDetailPage from '@/features/debts/pages/CustomerDebtDetailPage';
import SupplierDebtDetailPage from '@/features/debts/pages/SupplierDebtDetailPage';
import ReturnListPage from '@/features/returns/pages/ReturnListPage';
import CashBookPage from '@/features/cash-book/pages/CashBookPage';
import ReportsPage from '@/features/reports/pages/ReportsPage';
import SettingsPage from '@/features/settings/pages/SettingsPage';
import AlertsPage from '@/features/alerts/pages/AlertsPage';
import ZaloPage from '@/features/zalo/pages/ZaloPage';
import UserManagementPage from '@/features/users/pages/UserManagementPage';
import PayrollPage from '@/features/payroll/pages/PayrollPage';
// import UniversePage from '@/features/universe/pages/UniversePage';
import AuditLogPage from '@/features/audit-logs/pages/AuditLogPage';
import RoleManagementPage from '@/features/roles/pages/RoleManagementPage';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const isAuth = useAuthStore((s) => s.isAuthenticated());
  return isAuth ? <>{children}</> : <Navigate to="/login" replace />;
}

function PermissionRoute({ permission, children }: { permission: string; children: React.ReactNode }) {
  const has = usePermission(permission);
  return has ? <>{children}</> : <Navigate to="/" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      {/* <Route path="/universe" element={<PrivateRoute><UniversePage /></PrivateRoute>} /> */}
      <Route
        path="/"
        element={
          <PrivateRoute>
            <AppLayout />
          </PrivateRoute>
        }
      >
        <Route
          index
          element={
            <PermissionRoute permission="dashboard.view">
              <DashboardPage />
            </PermissionRoute>
          }
        />
        <Route
          path="products"
          element={
            <PermissionRoute permission="product.view">
              <ProductListPage />
            </PermissionRoute>
          }
        />
        <Route
          path="products/:id"
          element={
            <PermissionRoute permission="product.view">
              <ProductDetailPage />
            </PermissionRoute>
          }
        />
        <Route
          path="customers"
          element={
            <PermissionRoute permission="customer.view">
              <CustomerListPage />
            </PermissionRoute>
          }
        />
        <Route
          path="customers/:id"
          element={
            <PermissionRoute permission="customer.view">
              <CustomerDetailPage />
            </PermissionRoute>
          }
        />
        <Route
          path="suppliers"
          element={
            <PermissionRoute permission="supplier.view">
              <SupplierListPage />
            </PermissionRoute>
          }
        />
        <Route
          path="suppliers/:id"
          element={
            <PermissionRoute permission="supplier.view">
              <SupplierDetailPage />
            </PermissionRoute>
          }
        />
        <Route
          path="sales-orders"
          element={
            <PermissionRoute permission="sales_order.view">
              <SalesOrderListPage />
            </PermissionRoute>
          }
        />
        <Route
          path="sales-orders/create"
          element={
            <PermissionRoute permission="sales_order.create">
              <CreateSalesOrderPage />
            </PermissionRoute>
          }
        />
        <Route
          path="sales-orders/:id"
          element={
            <PermissionRoute permission="sales_order.view">
              <SalesOrderDetailPage />
            </PermissionRoute>
          }
        />
        <Route
          path="purchase-orders"
          element={
            <PermissionRoute permission="purchase_order.view">
              <PurchaseOrderListPage />
            </PermissionRoute>
          }
        />
        <Route
          path="purchase-orders/create"
          element={
            <PermissionRoute permission="purchase_order.create">
              <CreatePurchaseOrderPage />
            </PermissionRoute>
          }
        />
        <Route
          path="purchase-orders/:id"
          element={
            <PermissionRoute permission="purchase_order.view">
              <PurchaseOrderDetailPage />
            </PermissionRoute>
          }
        />
        {/* NOTE: /debts shows both receivables+payables tabs; gating on receivable.view only.
            Users with only payable.view won't reach this shell — they can deep-link via /payables/supplier/:id.
            TODO: support multi-permission (OR) guard in PermissionRoute. */}
        <Route
          path="debts"
          element={
            <PermissionRoute permission="receivable.view">
              <DebtPage />
            </PermissionRoute>
          }
        />
        <Route
          path="receivables/customer/:customerId"
          element={
            <PermissionRoute permission="receivable.view">
              <CustomerDebtDetailPage />
            </PermissionRoute>
          }
        />
        <Route
          path="payables/supplier/:supplierId"
          element={
            <PermissionRoute permission="payable.view">
              <SupplierDebtDetailPage />
            </PermissionRoute>
          }
        />
        <Route
          path="returns"
          element={
            <PermissionRoute permission="return.view">
              <ReturnListPage />
            </PermissionRoute>
          }
        />
        <Route
          path="cash-book"
          element={
            <PermissionRoute permission="cash_book.view">
              <CashBookPage />
            </PermissionRoute>
          }
        />
        <Route
          path="payroll"
          element={
            <PermissionRoute permission="payroll.view">
              <PayrollPage />
            </PermissionRoute>
          }
        />
        <Route
          path="reports"
          element={
            <PermissionRoute permission="report.view">
              <ReportsPage />
            </PermissionRoute>
          }
        />
        {/* /alerts: no specific alert.* permission yet — any logged-in user can view their own alerts.
            TODO: add alert.manage permission when backend gates alert mutations. */}
        <Route path="alerts" element={<AlertsPage />} />
        <Route
          path="zalo"
          element={
            <PermissionRoute permission="zalo.view">
              <ZaloPage />
            </PermissionRoute>
          }
        />
        <Route
          path="users"
          element={
            <PermissionRoute permission="user.view">
              <UserManagementPage />
            </PermissionRoute>
          }
        />
        <Route
          path="settings"
          element={
            <PermissionRoute permission="role.manage">
              <SettingsPage />
            </PermissionRoute>
          }
        />
        <Route
          path="audit-logs"
          element={
            <PermissionRoute permission="audit_log.view">
              <AuditLogPage />
            </PermissionRoute>
          }
        />
        <Route
          path="admin/roles"
          element={
            <PermissionRoute permission="role.manage">
              <RoleManagementPage />
            </PermissionRoute>
          }
        />
      </Route>
    </Routes>
  );
}
