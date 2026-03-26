import { Router } from 'express';
import authRoutes from '../modules/auth/auth.route';
import userRoutes from '../modules/user/user.route';
import productRoutes from '../modules/product/product.route';
import customerRoutes from '../modules/customer/customer.route';
import supplierRoutes from '../modules/supplier/supplier.route';
import salesOrderRoutes from '../modules/sales-order/sales-order.routes';
import purchaseOrderRoutes from '../modules/purchase-order/purchase-order.routes';
import receivableRoutes from '../modules/receivable/receivable.routes';
import payableRoutes from '../modules/payable/payable.routes';
import operatingCostRoutes from '../modules/operating-cost/operating-cost.routes';
import dashboardRoutes from '../modules/dashboard/dashboard.routes';
import reportRoutes from '../modules/report/report.routes';
import alertRoutes from '../modules/alert/alert.routes';
import zaloRoutes from '../modules/zalo/zalo.route';

const router = Router();

router.get('/health', (_req, res) => res.json({ status: 'ok' }));

router.use('/zalo', zaloRoutes);
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/products', productRoutes);
router.use('/customers', customerRoutes);
router.use('/suppliers', supplierRoutes);
router.use('/sales-orders', salesOrderRoutes);
router.use('/purchase-orders', purchaseOrderRoutes);
router.use('/receivables', receivableRoutes);
router.use('/payables', payableRoutes);
router.use('/operating-costs', operatingCostRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/reports', reportRoutes);
router.use('/alerts', alertRoutes);

export default router;
