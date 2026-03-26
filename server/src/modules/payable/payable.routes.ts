import { Router } from 'express';
import { authenticate, requireRole } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import { recordPaymentSchema } from './payable.validation';
import { PayableController } from './payable.controller';

const router = Router();
router.use(authenticate);

router.get('/', PayableController.list);
router.get('/summary', PayableController.getSummary);
router.post('/payments', requireRole('ADMIN', 'STAFF'), validate(recordPaymentSchema), PayableController.recordPayment);

export default router;
