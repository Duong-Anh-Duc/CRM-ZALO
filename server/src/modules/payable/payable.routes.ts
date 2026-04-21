import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { requireAbility } from '../../middleware/ability.middleware';
import { validate } from '../../middleware/validate.middleware';
import { recordPaymentSchema } from './payable.validation';
import { PayableController } from './payable.controller';

const router = Router();
router.use(authenticate);

router.get('/', requireAbility('read', 'Payable'), PayableController.list);
router.get('/by-supplier', requireAbility('read', 'Payable'), PayableController.listBySupplier);
router.get('/summary', requireAbility('read', 'Payable'), PayableController.getSummary);
router.get('/supplier/:supplierId', requireAbility('read', 'Payable'), PayableController.getSupplierDetail);
router.get('/supplier/:supplierId/ledger', requireAbility('read', 'Payable'), PayableController.getSupplierLedger);
router.get('/supplier/:supplierId/export-pdf', requireAbility('export', 'Payable'), PayableController.exportSupplierPdf);
router.get('/supplier/:supplierId/export-excel', requireAbility('export', 'Payable'), PayableController.exportSupplierExcel);
router.post('/payments', requireAbility('create', 'PayablePayment'), validate(recordPaymentSchema), PayableController.recordPayment);
router.patch('/payments/:paymentId/evidence', requireAbility('update', 'PayablePayment'), PayableController.updatePaymentEvidence);

export default router;
