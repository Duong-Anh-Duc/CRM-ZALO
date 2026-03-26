import { Router } from 'express';
import { authenticate, requireRole } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import { recordPaymentSchema } from './receivable.validation';
import { ReceivableController } from './receivable.controller';

const router = Router();
router.use(authenticate);

router.get('/', ReceivableController.list);
router.get('/summary', ReceivableController.getSummary);
router.post('/payments', requireRole('ADMIN', 'STAFF'), validate(recordPaymentSchema), ReceivableController.recordPayment);

export default router;
