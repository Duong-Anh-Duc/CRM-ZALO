import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { InvoiceService } from './invoice.service';
import { sendSuccess } from '../../utils/response';
import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../../types';

const router = Router();
router.use(authenticate);

// List invoices
router.get('/', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, await InvoiceService.list(req.query as any));
  } catch (err) { next(err); }
});

// Get invoice by ID
router.get('/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, await InvoiceService.getById(req.params.id as string));
  } catch (err) { next(err); }
});

// Create draft from sales order
router.post('/from-order/:orderId', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, await InvoiceService.createDraftFromOrder(req.params.orderId as string));
  } catch (err) { next(err); }
});

// Update draft
router.patch('/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, await InvoiceService.updateDraft(req.params.id as string, req.body));
  } catch (err) { next(err); }
});

// Finalize invoice
router.post('/:id/finalize', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, await InvoiceService.finalize(req.params.id as string));
  } catch (err) { next(err); }
});

// Cancel invoice
router.post('/:id/cancel', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, await InvoiceService.cancel(req.params.id as string));
  } catch (err) { next(err); }
});

// PDF preview/download
router.get('/:id/pdf', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const pdf = await InvoiceService.generatePdf(req.params.id as string);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="invoice-${req.params.id}.pdf"`,
      'Content-Length': pdf.length.toString(),
    });
    res.send(pdf);
  } catch (err) { next(err); }
});

// Legacy: generate from order directly (backward compat)
router.get('/sales-order/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const invoice = await InvoiceService.createDraftFromOrder(req.params.id as string);
    const pdf = await InvoiceService.generatePdf(invoice.id);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="invoice-${req.params.id}.pdf"`,
      'Content-Length': pdf.length.toString(),
    });
    res.send(pdf);
  } catch (err) { next(err); }
});

export default router;
