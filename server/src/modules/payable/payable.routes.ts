import { Router } from 'express';
import { authenticate, requireRole } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import { recordPaymentSchema } from './payable.validation';
import { PayableController } from './payable.controller';

const router = Router();
router.use(authenticate);

router.get('/', PayableController.list);
router.get('/by-supplier', PayableController.listBySupplier);
router.get('/summary', PayableController.getSummary);
router.get('/supplier/:supplierId', PayableController.getSupplierDetail);
router.get('/supplier/:supplierId/ledger', PayableController.getSupplierLedger);
router.get('/supplier/:supplierId/export-pdf', PayableController.exportSupplierPdf);
router.get('/supplier/:supplierId/export-excel', PayableController.exportSupplierExcel);
router.post('/payments', requireRole('ADMIN', 'STAFF'), validate(recordPaymentSchema), PayableController.recordPayment);
router.patch('/payments/:paymentId/evidence', requireRole('ADMIN', 'STAFF'), PayableController.updatePaymentEvidence);

export default router;
