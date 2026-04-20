import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth.store';
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

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const isAuth = useAuthStore((s) => s.isAuthenticated());
  return isAuth ? <>{children}</> : <Navigate to="/login" replace />;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const hasRole = useAuthStore((s) => s.hasRole('ADMIN'));
  return hasRole ? <>{children}</> : <Navigate to="/" replace />;
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
        <Route index element={<DashboardPage />} />
        <Route path="products" element={<ProductListPage />} />
        <Route path="products/:id" element={<ProductDetailPage />} />
        <Route path="customers" element={<CustomerListPage />} />
        <Route path="customers/:id" element={<CustomerDetailPage />} />
        <Route path="suppliers" element={<SupplierListPage />} />
        <Route path="suppliers/:id" element={<SupplierDetailPage />} />
        <Route path="sales-orders" element={<SalesOrderListPage />} />
        <Route path="sales-orders/create" element={<CreateSalesOrderPage />} />
        <Route path="sales-orders/:id" element={<SalesOrderDetailPage />} />
        <Route path="purchase-orders" element={<PurchaseOrderListPage />} />
        <Route path="purchase-orders/create" element={<CreatePurchaseOrderPage />} />
        <Route path="purchase-orders/:id" element={<PurchaseOrderDetailPage />} />
        <Route path="debts" element={<DebtPage />} />
        <Route path="receivables/customer/:customerId" element={<CustomerDebtDetailPage />} />
        <Route path="payables/supplier/:supplierId" element={<SupplierDebtDetailPage />} />
        <Route path="returns" element={<ReturnListPage />} />
        <Route path="cash-book" element={<CashBookPage />} />
        <Route path="payroll" element={<PayrollPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="alerts" element={<AlertsPage />} />
        <Route path="zalo" element={<ZaloPage />} />
        <Route
          path="users"
          element={
            <AdminRoute>
              <UserManagementPage />
            </AdminRoute>
          }
        />
        <Route
          path="settings"
          element={
            <AdminRoute>
              <SettingsPage />
            </AdminRoute>
          }
        />
        <Route
          path="audit-logs"
          element={
            <AdminRoute>
              <AuditLogPage />
            </AdminRoute>
          }
        />
      </Route>
    </Routes>
  );
}
