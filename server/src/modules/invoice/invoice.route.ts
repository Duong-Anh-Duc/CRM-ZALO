import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authenticate } from '../../middleware/auth.middleware';
import { InvoiceService } from './invoice.service';
import { sendSuccess } from '../../utils/response';
import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../../types';

const uploadsDir = path.join(__dirname, '../../../uploads/invoices');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const invoiceUpload = multer({
  storage: multer.diskStorage({
    destination: uploadsDir,
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, `inv-${Date.now()}${ext}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['.pdf', '.jpg', '.jpeg', '.png'];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, allowed.includes(ext));
  },
}).single('file');

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

// Xuất hoá đơn từ SO (APPROVED + tạo công nợ)
router.post('/from-order/:orderId', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, await InvoiceService.createFromOrder(req.params.orderId as string));
  } catch (err) { next(err); }
});

// Create purchase invoice (auto-generate, optionally with uploaded file)
router.post('/purchase/:poId', invoiceUpload, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const file = req.file;
    const fileUrl = file ? `/uploads/invoices/${file.filename}` : undefined;
    const fileName = file ? file.originalname : undefined;
    sendSuccess(res, await InvoiceService.createPurchaseInvoice(req.params.poId as string, fileUrl, fileName));
  } catch (err) { next(err); }
});

// Update invoice (chỉ HĐ bán, SO chưa COMPLETED)
router.patch('/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, await InvoiceService.updateInvoice(req.params.id as string, req.body));
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
    const invoice = await InvoiceService.createFromOrder(req.params.id as string);
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
