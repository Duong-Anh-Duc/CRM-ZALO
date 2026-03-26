import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { cache } from '../../middleware/cache.middleware';
import { ReportController } from './report.controller';

const router = Router();
router.use(authenticate);

router.get('/pnl', cache(120), ReportController.getPnl);
router.get('/debt-aging', cache(120), ReportController.getDebtAging);
router.get('/product-sales', cache(120), ReportController.getProductSales);

export default router;
