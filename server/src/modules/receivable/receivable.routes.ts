import { Router } from 'express';
import { authenticate, requireRole } from '../../middleware/auth.middleware';
import { validate, validateIdParam } from '../../middleware/validate.middleware';
import { recordPaymentSchema } from './receivable.validation';
import { ReceivableController } from './receivable.controller';

const router = Router();
router.use(authenticate);

router.get('/', ReceivableController.list);
router.get('/by-customer', ReceivableController.listByCustomer);
router.get('/summary', ReceivableController.getSummary);
router.get('/customer/:customerId', ReceivableController.getCustomerDetail);
router.get('/customer/:customerId/export-pdf', ReceivableController.exportCustomerPdf);
router.get('/customer/:customerId/export-excel', ReceivableController.exportCustomerExcel);
router.post('/payments', requireRole('ADMIN', 'STAFF'), validate(recordPaymentSchema), ReceivableController.recordPayment);
router.patch('/payments/:paymentId/evidence', requireRole('ADMIN', 'STAFF'), ReceivableController.updatePaymentEvidence);

export default router;
