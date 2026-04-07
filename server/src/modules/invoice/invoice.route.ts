import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { InvoiceService } from './invoice.service';
import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../../types';

const router = Router();

router.use(authenticate);

router.get('/sales-order/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const pdf = await InvoiceService.generateFromOrder(req.params.id as string);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="invoice-${req.params.id}.pdf"`,
      'Content-Length': pdf.length.toString(),
    });
    res.send(pdf);
  } catch (err) {
    next(err);
  }
});

export default router;
