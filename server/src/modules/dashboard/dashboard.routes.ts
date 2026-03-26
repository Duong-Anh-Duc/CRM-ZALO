import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { cache } from '../../middleware/cache.middleware';
import { DashboardController } from './dashboard.controller';

const router = Router();
router.use(authenticate);

router.get('/', cache(60), DashboardController.getOverview);

export default router;
