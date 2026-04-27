import prisma from '../../lib/prisma';
import puppeteer from 'puppeteer';
import { AppError } from '../../middleware/error.middleware';
import { DebtStatus, PaymentMethod } from '@prisma/client';
import { t } from '../../locales';
import { delCache } from '../../lib/redis';
import { AlertService } from '../alert/alert.service';
import logger from '../../utils/logger';
import { buildLedgerReportHtml } from './debt-report-template';
import { PayableLedgerService } from './payable-ledger.service';

interface RecordPaymentInput {
  supplier_id: string;
  amount: number;
  payment_date?: string;
  method: PaymentMethod;
  reference?: string;
  evidence_url?: string;
}

export class PayableService {
  // ── Group by supplier ──
  static async listBySupplier(filters: { page?: number; limit?: number; status?: string; search?: string; from_date?: string; to_date?: string }) {
    const page = Number(filters.page) || 1;
    const limit = Number(filters.limit) || 20;

    const where: any = { status: { in: ['UNPAID', 'PARTIAL', 'OVERDUE', 'PAID'] } };
    if (filters.status === 'OUTSTANDING') {
      where.status = { in: ['UNPAID', 'PARTIAL', 'OVERDUE'] };
    } else if (filters.status && filters.status !== 'ALL') {
      where.status = filters.status;
    }
    if (filters.search) {
      where.supplier = { company_name: { contains: filters.search, mode: 'insensitive' } };
    }
    if (filters.from_date || filters.to_date) {
      where.invoice_date = {
        ...(filters.from_date && { gte: new Date(filters.from_date) }),
        ...(filters.to_date && { lte: new Date(filters.to_date) }),
      };
    }

    const payables = await prisma.payable.findMany({
      where,
      include: { supplier: { select: { id: true, company_name: true, phone: true } } },
      orderBy: { due_date: 'asc' },
    });

    // Group by supplier
    const supplierMap = new Map<string, any>();
    for (const pay of payables) {
      const sid = pay.supplier_id;
      if (!supplierMap.has(sid)) {
        supplierMap.set(sid, {
          supplier_id: sid,
          supplier: pay.supplier,
          total_original: 0,
          total_paid: 0,
          total_remaining: 0,
          invoice_count: 0,
          overdue_count: 0,
          oldest_due_date: pay.due_date,
        });
      }
      const entry = supplierMap.get(sid)!;
      entry.total_original += pay.original_amount;
      entry.total_paid += pay.paid_amount;
      entry.total_remaining += pay.remaining;
      entry.invoice_count += 1;
      if (pay.status === 'OVERDUE') entry.overdue_count += 1;
      if (pay.due_date < entry.oldest_due_date) entry.oldest_due_date = pay.due_date;
    }

    let rows = Array.from(supplierMap.values());
    rows.sort((a, b) => b.total_remaining - a.total_remaining);

    const total = rows.length;
    const paged = rows.slice((page - 1) * limit, page * limit);

    const summary = rows.reduce(
      (acc, r) => ({
        total_original: acc.total_original + r.total_original,
        total_paid: acc.total_paid + r.total_paid,
        total_remaining: acc.total_remaining + r.total_remaining,
        supplier_count: acc.supplier_count + 1,
        invoice_count: acc.invoice_count + r.invoice_count,
      }),
      { total_original: 0, total_paid: 0, total_remaining: 0, supplier_count: 0, invoice_count: 0 },
    );

    return { suppliers: paged, total, page, limit, total_pages: Math.ceil(total / limit), summary };
  }

  // ── All invoices for a supplier ──
  static async getSupplierDetail(supplierId: string) {
    const supplier = await prisma.supplier.findUnique({
      where: { id: supplierId },
      select: { id: true, company_name: true, contact_name: true, phone: true, email: true, address: true },
    });
    if (!supplier) throw new AppError(t('supplier.notFound'), 404);

    const payables = await prisma.payable.findMany({
      where: { supplier_id: supplierId },
      include: {
        purchase_order: {
          select: {
            id: true, order_code: true, order_date: true, expected_delivery: true, notes: true, status: true, total: true,
            items: { select: { quantity: true, unit_price: true, line_total: true, product: { select: { name: true, sku: true, material: true, capacity_ml: true } } } },
          },
        },
        payments: { orderBy: { payment_date: 'desc' } },
      },
      orderBy: { due_date: 'asc' },
    });

    const summary = payables.reduce((acc, p) => ({
      total_original: acc.total_original + p.original_amount,
      total_paid: acc.total_paid + p.paid_amount,
      total_remaining: acc.total_remaining + p.remaining,
    }), { total_original: 0, total_paid: 0, total_remaining: 0 });

    return { supplier, payables, summary };
  }

  // ── Flat list (backward compat) ──
  static async list(filters: { page?: number; limit?: number; status?: DebtStatus; supplier_id?: string; supplier_search?: string; from_date?: string; to_date?: string }) {
    const page = Number(filters.page) || 1;
    const limit = Number(filters.limit) || 20;
    const { status, supplier_id, supplier_search, from_date, to_date } = filters;

    const where = {
      ...(status && { status }),
      ...(supplier_id && { supplier_id }),
      ...(supplier_search && {
        supplier: { company_name: { contains: supplier_search, mode: 'insensitive' as const } },
      }),
      ...(from_date || to_date ? {
        invoice_date: {
          ...(from_date && { gte: new Date(from_date) }),
          ...(to_date && { lte: new Date(to_date) }),
        },
      } : {}),
    };

    const [payables, total] = await Promise.all([
      prisma.payable.findMany({
        where,
        include: {
          supplier: { select: { id: true, company_name: true } },
          purchase_order: { select: { id: true, order_code: true } },
          payments: { orderBy: { payment_date: 'desc' } },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
      prisma.payable.count({ where }),
    ]);

    return { payables, total, page, limit, total_pages: Math.ceil(total / limit) };
  }

  static async getSummary() {
    const [totalResult, overdueResult, dueThisWeek] = await Promise.all([
      prisma.payable.aggregate({
        where: { status: { in: ['UNPAID', 'PARTIAL', 'OVERDUE'] } },
        _sum: { remaining: true },
      }),
      prisma.payable.aggregate({
        where: { status: 'OVERDUE' },
        _sum: { remaining: true },
      }),
      prisma.payable.aggregate({
        where: {
          status: { in: ['UNPAID', 'PARTIAL'] },
          due_date: {
            gte: new Date(),
            lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          },
        },
        _sum: { remaining: true },
      }),
    ]);

    return {
      total_payable: totalResult._sum.remaining || 0,
      overdue: overdueResult._sum.remaining || 0,
      due_this_week: dueThisWeek._sum.remaining || 0,
    };
  }

  // ── FIFO Payment by supplier ──
  static async recordPayment(input: RecordPaymentInput) {
    if (input.amount <= 0) throw new AppError(t('debt.amountPositive'), 400);

    const invoices = await prisma.payable.findMany({
      where: { supplier_id: input.supplier_id, status: { in: ['UNPAID', 'PARTIAL', 'OVERDUE'] } },
      orderBy: [{ due_date: 'asc' }, { created_at: 'asc' }],
    });

    if (invoices.length === 0) throw new AppError(t('debt.noOutstandingDebt'), 400);

    const totalRemaining = invoices.reduce((sum, inv) => sum + inv.remaining, 0);
    if (input.amount > totalRemaining) throw new AppError(t('debt.amountExceedsRemaining'), 400);

    let remaining = input.amount;
    const paymentCreates: any[] = [];
    const payableUpdates: any[] = [];

    for (const inv of invoices) {
      if (remaining <= 0) break;
      const allocate = Math.min(remaining, inv.remaining);

      paymentCreates.push(
        prisma.payablePayment.create({
          data: {
            payable_id: inv.id,
            amount: allocate,
            payment_date: input.payment_date ? new Date(input.payment_date) : new Date(),
            method: input.method,
            reference: input.reference,
            evidence_url: input.evidence_url,
          },
        })
      );

      const newPaid = inv.paid_amount + allocate;
      const newRemaining = inv.original_amount - newPaid;
      const newStatus: DebtStatus = newRemaining <= 0 ? 'PAID' : 'PARTIAL';

      payableUpdates.push(
        prisma.payable.update({
          where: { id: inv.id },
          data: { paid_amount: newPaid, remaining: newRemaining, status: newStatus },
        })
      );

      remaining -= allocate;
    }

    const createdPayments = await prisma.$transaction([...paymentCreates, ...payableUpdates]);
    // First N items in result correspond to created payment records
    const createdPaymentRows = createdPayments.slice(0, paymentCreates.length) as Array<{ id: string; amount: number }>;

    // Auto-sync: create ONE cash_transaction per payment record so rollback is 1:1.
    try {
      const supplier = await prisma.supplier.findUnique({ where: { id: input.supplier_id }, select: { company_name: true } });
      const suppName = supplier?.company_name || '';
      const expenseCat = await prisma.cashCategory.findFirst({ where: { type: 'EXPENSE', name: { contains: 'NCC' } } });
      if (expenseCat) {
        await Promise.all(createdPaymentRows.map((p) => prisma.cashTransaction.create({
          data: {
            type: 'EXPENSE',
            category_id: expenseCat.id,
            date: input.payment_date ? new Date(input.payment_date) : new Date(),
            amount: Number(p.amount),
            description: `TT NCC ${suppName}`,
            reference: input.reference,
            payment_method: input.method,
            is_auto: true,
            reference_id: p.id,
            reference_type: 'PAYABLE_PAYMENT',
          },
        })));
      }
    } catch (err) { logger.warn(`Cash book sync failed: ${(err as Error).message}`); }

    // Create alert for payment recorded
    AlertService.createAlert({
      type: 'WARNING',
      title: t('alert.payablePaymentRecorded', { amount: input.amount }),
      message: t('alert.payablePaymentRecorded', { amount: input.amount }),
    }).catch((err) => logger.warn(`Alert creation failed: ${err.message}`));

    await delCache('cache:/api/payables*', 'cache:/api/dashboard*', 'cache:/api/cash-book*');
    return { allocated: paymentCreates.length, total_amount: input.amount };
  }

  // ── Export supplier ledger as PDF ──
  static async exportSupplierPdf(supplierId: string, fromDate?: string, toDate?: string, lang = 'vi'): Promise<Buffer> {
    const ledger = await PayableLedgerService.getSupplierLedger(supplierId, fromDate, toDate, lang);

    const html = buildLedgerReportHtml({
      type: 'payable',
      entityName: ledger.supplier.company_name,
      rows: ledger.rows,
      opening_balance: ledger.opening_balance,
      totals: ledger.totals,
      from_date: ledger.from_date,
      to_date: ledger.to_date,
      lang,
    });

    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const pdf = await page.pdf({
        format: 'A4',
        landscape: true,
        printBackground: true,
        margin: { top: '12mm', right: '10mm', bottom: '12mm', left: '10mm' },
      });
      return Buffer.from(pdf);
    } finally {
      await browser.close();
    }
  }

  // ── Update payment evidence ──
  static async updatePaymentEvidence(paymentId: string, evidenceUrl: string) {
    const result = await prisma.payablePayment.update({
      where: { id: paymentId },
      data: { evidence_url: evidenceUrl },
    });
    await delCache('cache:/api/payables*');
    return result;
  }

  // ── Export supplier ledger (detailed) as Excel ──
  static async exportSupplierExcel(supplierId: string, fromDate?: string, toDate?: string, lang = 'vi'): Promise<Buffer> {
    return PayableLedgerService.exportLedgerExcel(supplierId, fromDate, toDate, lang);
  }

  // ── Rollback a single payment + recompute payable ──
  static async deletePayment(paymentId: string) {
    const payment = await prisma.payablePayment.findUnique({
      where: { id: paymentId },
      include: { payable: { include: { payments: true } } },
    });
    if (!payment) throw new AppError(t('debt.notFound'), 404);

    const payable = payment.payable;
    const remainingPayments = payable.payments.filter((p) => p.id !== paymentId);
    const newPaid = remainingPayments.reduce((sum, p) => sum + p.amount, 0);
    const newRemaining = payable.original_amount - newPaid;
    const wasOverdue = payable.status === 'OVERDUE';
    const isOverdueByDate = payable.due_date.getTime() < Date.now();
    let newStatus: DebtStatus;
    if (newPaid <= 0) {
      newStatus = wasOverdue || isOverdueByDate ? 'OVERDUE' : 'UNPAID';
    } else if (newPaid >= payable.original_amount) {
      newStatus = 'PAID';
    } else {
      newStatus = wasOverdue || isOverdueByDate ? 'OVERDUE' : 'PARTIAL';
    }

    await prisma.$transaction(async (tx) => {
      // Delete the 1:1 auto-created CashTransaction matching this payment via reference_id
      await tx.cashTransaction.deleteMany({
        where: { reference_type: 'PAYABLE_PAYMENT', reference_id: paymentId },
      });
      await tx.payablePayment.delete({ where: { id: paymentId } });
      await tx.payable.update({
        where: { id: payable.id },
        data: { paid_amount: newPaid, remaining: newRemaining, status: newStatus },
      });
    });

    await delCache('cache:/api/payables*', 'cache:/api/dashboard*', 'cache:/api/cash-book*');
    return { id: paymentId, payable_id: payable.id, new_paid: newPaid, new_remaining: newRemaining, new_status: newStatus };
  }

  // ── Delete a payable (only if no payments) ──
  static async delete(id: string) {
    const payable = await prisma.payable.findUnique({
      where: { id },
      include: { payments: true },
    });
    if (!payable) throw new AppError(t('debt.notFound'), 404);
    if (payable.payments.length > 0) {
      throw new AppError(t('payable.deleteBlockedHasPayments'), 400);
    }

    await prisma.payable.delete({ where: { id } });
    await delCache('cache:/api/payables*', 'cache:/api/dashboard*');
    return { id };
  }

  // ── Delete payable for an invoice (used by invoice cancel flow) ──
  // Payable schema has no `invoice_id`; match by `invoice_number`
  static async deleteByInvoice(invoiceId: string) {
    const payable = await prisma.payable.findFirst({
      where: { invoice_number: invoiceId },
      include: { payments: true },
    });
    if (!payable) return { deleted: 0 };

    if (payable.payments.length > 0) {
      throw new AppError(t('payable.deleteBlockedHasPayments'), 400);
    }

    await prisma.payable.delete({ where: { id: payable.id } });
    await delCache('cache:/api/payables*', 'cache:/api/dashboard*');
    return { deleted: 1, id: payable.id };
  }
}
