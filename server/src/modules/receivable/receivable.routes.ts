import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { requireAbility } from '../../middleware/ability.middleware';
import { validate, validateIdParam } from '../../middleware/validate.middleware';
import { recordPaymentSchema } from './receivable.validation';
import { ReceivableController } from './receivable.controller';

const router = Router();
router.use(authenticate);

router.get('/', requireAbility('read', 'Receivable'), ReceivableController.list);
router.get('/by-customer', requireAbility('read', 'Receivable'), ReceivableController.listByCustomer);
router.get('/summary', requireAbility('read', 'Receivable'), ReceivableController.getSummary);
router.get('/customer/:customerId', requireAbility('read', 'Receivable'), ReceivableController.getCustomerDetail);
router.get('/customer/:customerId/ledger', requireAbility('read', 'Receivable'), ReceivableController.getCustomerLedger);
router.get('/customer/:customerId/export-pdf', requireAbility('export', 'Receivable'), ReceivableController.exportCustomerPdf);
router.get('/customer/:customerId/export-excel', requireAbility('export', 'Receivable'), ReceivableController.exportCustomerExcel);
router.post('/payments', requireAbility('create', 'ReceivablePayment'), validate(recordPaymentSchema), ReceivableController.recordPayment);
router.patch('/payments/:paymentId/evidence', requireAbility('update', 'ReceivablePayment'), ReceivableController.updatePaymentEvidence);

export default router;
