import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { requireAbility } from '../../middleware/ability.middleware';
import { cache } from '../../middleware/cache.middleware';
import { DashboardController } from './dashboard.controller';

const router = Router();
router.use(authenticate);

router.get('/', requireAbility('read', 'Dashboard'), cache(60), DashboardController.getOverview);

export default router;
