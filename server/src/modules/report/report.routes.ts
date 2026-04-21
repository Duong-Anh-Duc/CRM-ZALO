import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { requireAbility } from '../../middleware/ability.middleware';
import { cache } from '../../middleware/cache.middleware';
import { ReportController } from './report.controller';

const router = Router();
router.use(authenticate);

router.get('/pnl', requireAbility('read', 'Report'), cache(120), ReportController.getPnl);
router.get('/debt-aging', requireAbility('read', 'Report'), cache(120), ReportController.getDebtAging);
router.get('/product-sales', requireAbility('read', 'Report'), cache(120), ReportController.getProductSales);

export default router;
