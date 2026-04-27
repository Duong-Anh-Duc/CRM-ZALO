import prisma from '../../lib/prisma';
import puppeteer from 'puppeteer';
import { AppError } from '../../middleware/error.middleware';
import { DebtStatus, PaymentMethod } from '@prisma/client';
import { t } from '../../locales';
import { delCache } from '../../lib/redis';
import { AlertService } from '../alert/alert.service';
import logger from '../../utils/logger';
import { buildLedgerReportHtml } from './debt-report-template';
import { ReceivableLedgerService } from './receivable-ledger.service';

interface RecordPaymentInput {
  customer_id: string;
  amount: number;
  payment_date?: string;
  method: PaymentMethod;
  reference?: string;
  evidence_url?: string;
}

export class ReceivableService {
  // ── Group by customer ──
  static async listByCustomer(filters: { page?: number; limit?: number; status?: string; search?: string; from_date?: string; to_date?: string }) {
    const page = Number(filters.page) || 1;
    const limit = Number(filters.limit) || 20;

    const where: any = { status: { in: ['UNPAID', 'PARTIAL', 'OVERDUE', 'PAID'] } };
    if (filters.status === 'OUTSTANDING') {
      where.status = { in: ['UNPAID', 'PARTIAL', 'OVERDUE'] };
    } else if (filters.status && filters.status !== 'ALL') {
      where.status = filters.status;
    }
    if (filters.search) {
      where.customer = { OR: [
        { company_name: { contains: filters.search, mode: 'insensitive' } },
        { contact_name: { contains: filters.search, mode: 'insensitive' } },
      ]};
    }
    if (filters.from_date || filters.to_date) {
      where.invoice_date = {
        ...(filters.from_date && { gte: new Date(filters.from_date) }),
        ...(filters.to_date && { lte: new Date(filters.to_date) }),
      };
    }

    // Get all receivables grouped by customer
    const receivables = await prisma.receivable.findMany({
      where,
      include: { customer: { select: { id: true, company_name: true, contact_name: true, phone: true } } },
      orderBy: { due_date: 'asc' },
    });

    // Group by customer
    const customerMap = new Map<string, any>();
    for (const rec of receivables) {
      const cid = rec.customer_id;
      if (!customerMap.has(cid)) {
        customerMap.set(cid, {
          customer_id: cid,
          customer: rec.customer,
          total_original: 0,
          total_paid: 0,
          total_remaining: 0,
          invoice_count: 0,
          overdue_count: 0,
          oldest_due_date: rec.due_date,
        });
      }
      const entry = customerMap.get(cid)!;
      entry.total_original += rec.original_amount;
      entry.total_paid += rec.paid_amount;
      entry.total_remaining += rec.remaining;
      entry.invoice_count += 1;
      if (rec.status === 'OVERDUE') entry.overdue_count += 1;
      if (rec.due_date < entry.oldest_due_date) entry.oldest_due_date = rec.due_date;
    }

    let rows = Array.from(customerMap.values());
    // Sort: outstanding first (by remaining desc), then by name
    rows.sort((a, b) => b.total_remaining - a.total_remaining);

    const total = rows.length;
    const paged = rows.slice((page - 1) * limit, page * limit);

    const summary = rows.reduce(
      (acc, r) => ({
        total_original: acc.total_original + r.total_original,
        total_paid: acc.total_paid + r.total_paid,
        total_remaining: acc.total_remaining + r.total_remaining,
        customer_count: acc.customer_count + 1,
        invoice_count: acc.invoice_count + r.invoice_count,
      }),
      { total_original: 0, total_paid: 0, total_remaining: 0, customer_count: 0, invoice_count: 0 },
    );

    return { customers: paged, total, page, limit, total_pages: Math.ceil(total / limit), summary };
  }

  // ── All invoices for a customer ──
  static async getCustomerDetail(customerId: string) {
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: { id: true, company_name: true, contact_name: true, phone: true, email: true, address: true },
    });
    if (!customer) throw new AppError(t('customer.notFound'), 404);

    const receivables = await prisma.receivable.findMany({
      where: { customer_id: customerId },
      include: {
        sales_order: {
          select: {
            id: true, order_code: true, order_date: true, expected_delivery: true, notes: true, status: true, grand_total: true,
            items: { select: { quantity: true, unit_price: true, line_total: true, discount_pct: true, product: { select: { name: true, sku: true, material: true, capacity_ml: true } } } },
          },
        },
        payments: { orderBy: { payment_date: 'desc' } },
      },
      orderBy: { due_date: 'asc' },
    });

    const summary = receivables.reduce((acc, r) => ({
      total_original: acc.total_original + r.original_amount,
      total_paid: acc.total_paid + r.paid_amount,
      total_remaining: acc.total_remaining + r.remaining,
    }), { total_original: 0, total_paid: 0, total_remaining: 0 });

    return { customer, receivables, summary };
  }

  // ── Flat list (keep for backward compat) ──
  static async list(filters: { page?: number; limit?: number; status?: DebtStatus; customer_id?: string; customer_search?: string; from_date?: string; to_date?: string }) {
    const page = Number(filters.page) || 1;
    const limit = Number(filters.limit) || 20;
    const { status, customer_id, customer_search, from_date, to_date } = filters;

    const where = {
      ...(status && { status }),
      ...(customer_id && { customer_id }),
      ...(customer_search && {
        customer: { company_name: { contains: customer_search, mode: 'insensitive' as const } },
      }),
      ...(from_date || to_date ? {
        invoice_date: {
          ...(from_date && { gte: new Date(from_date) }),
          ...(to_date && { lte: new Date(to_date) }),
        },
      } : {}),
    };

    const [receivables, total] = await Promise.all([
      prisma.receivable.findMany({
        where,
        include: {
          customer: { select: { id: true, company_name: true } },
          sales_order: { select: { id: true, order_code: true } },
          payments: { orderBy: { payment_date: 'desc' } },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
      prisma.receivable.count({ where }),
    ]);

    return { receivables, total, page, limit, total_pages: Math.ceil(total / limit) };
  }

  static async getSummary() {
    const [totalResult, overdueResult, dueThisWeek] = await Promise.all([
      prisma.receivable.aggregate({
        where: { status: { in: ['UNPAID', 'PARTIAL', 'OVERDUE'] } },
        _sum: { remaining: true },
      }),
      prisma.receivable.aggregate({
        where: { status: 'OVERDUE' },
        _sum: { remaining: true },
      }),
      prisma.receivable.aggregate({
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
      total_receivable: totalResult._sum.remaining || 0,
      overdue: overdueResult._sum.remaining || 0,
      due_this_week: dueThisWeek._sum.remaining || 0,
    };
  }

  // ── FIFO Payment by customer ──
  static async recordPayment(input: RecordPaymentInput) {
    if (input.amount <= 0) throw new AppError(t('debt.amountPositive'), 400);

    // Get all unpaid/partial/overdue receivables for this customer, ordered by due_date ASC (FIFO)
    const invoices = await prisma.receivable.findMany({
      where: { customer_id: input.customer_id, status: { in: ['UNPAID', 'PARTIAL', 'OVERDUE'] } },
      orderBy: [{ due_date: 'asc' }, { created_at: 'asc' }],
    });

    if (invoices.length === 0) throw new AppError(t('debt.noOutstandingDebt'), 400);

    const totalRemaining = invoices.reduce((sum, inv) => sum + inv.remaining, 0);
    if (input.amount > totalRemaining) throw new AppError(t('debt.amountExceedsRemaining'), 400);

    // FIFO allocation
    let remaining = input.amount;
    const paymentCreates: any[] = [];
    const receivableUpdates: any[] = [];

    for (const inv of invoices) {
      if (remaining <= 0) break;
      const allocate = Math.min(remaining, inv.remaining);

      paymentCreates.push(
        prisma.receivablePayment.create({
          data: {
            receivable_id: inv.id,
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

      receivableUpdates.push(
        prisma.receivable.update({
          where: { id: inv.id },
          data: { paid_amount: newPaid, remaining: newRemaining, status: newStatus },
        })
      );

      remaining -= allocate;
    }

    const createdPayments = await prisma.$transaction([...paymentCreates, ...receivableUpdates]);
    // First N items in result correspond to created payment records
    const createdPaymentRows = createdPayments.slice(0, paymentCreates.length) as Array<{ id: string; amount: number }>;

    // Auto-sync: create ONE cash_transaction per payment record so rollback is 1:1.
    try {
      const customer = await prisma.customer.findUnique({ where: { id: input.customer_id }, select: { company_name: true, contact_name: true } });
      const custName = customer?.company_name || customer?.contact_name || '';
      const incomeCat = await prisma.cashCategory.findFirst({ where: { type: 'INCOME', name: { contains: 'khách' } } });
      if (incomeCat) {
        await Promise.all(createdPaymentRows.map((p) => prisma.cashTransaction.create({
          data: {
            type: 'INCOME',
            category_id: incomeCat.id,
            date: input.payment_date ? new Date(input.payment_date) : new Date(),
            amount: Number(p.amount),
            description: `Thu từ ${custName}`,
            reference: input.reference,
            payment_method: input.method,
            is_auto: true,
            reference_id: p.id,
            reference_type: 'RECEIVABLE_PAYMENT',
          },
        })));
      }
    } catch (err) { logger.warn(`Cash book sync failed: ${(err as Error).message}`); }

    // Create alert for payment recorded
    AlertService.createAlert({
      type: 'WARNING',
      title: t('alert.receivablePaymentRecorded', { amount: input.amount }),
      message: t('alert.receivablePaymentRecorded', { amount: input.amount }),
    }).catch((err) => logger.warn(`Alert creation failed: ${err.message}`));

    await delCache('cache:/api/receivables*', 'cache:/api/dashboard*', 'cache:/api/cash-book*');
    return { allocated: paymentCreates.length, total_amount: input.amount };
  }

  // ── Export customer ledger as PDF ──
  static async exportCustomerPdf(customerId: string, fromDate?: string, toDate?: string, lang = 'vi'): Promise<Buffer> {
    const ledger = await ReceivableLedgerService.getCustomerLedger(customerId, fromDate, toDate, lang);

    const html = buildLedgerReportHtml({
      type: 'receivable',
      entityName: ledger.customer.company_name || ledger.customer.contact_name || '',
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
    const result = await prisma.receivablePayment.update({
      where: { id: paymentId },
      data: { evidence_url: evidenceUrl },
    });
    await delCache('cache:/api/receivables*');
    return result;
  }

  // ── Export customer ledger (detailed) as Excel ──
  static async exportCustomerExcel(customerId: string, fromDate?: string, toDate?: string, lang = 'vi'): Promise<Buffer> {
    return ReceivableLedgerService.exportLedgerExcel(customerId, fromDate, toDate, lang);
  }

  // ── Rollback a single payment + recompute receivable ──
  static async deletePayment(paymentId: string) {
    const payment = await prisma.receivablePayment.findUnique({
      where: { id: paymentId },
      include: { receivable: { include: { payments: true } } },
    });
    if (!payment) throw new AppError(t('debt.notFound'), 404);

    const receivable = payment.receivable;
    // Compute new aggregates after removing this payment
    const remainingPayments = receivable.payments.filter((p) => p.id !== paymentId);
    const newPaid = remainingPayments.reduce((sum, p) => sum + p.amount, 0);
    const newRemaining = receivable.original_amount - newPaid;
    const wasOverdue = receivable.status === 'OVERDUE';
    const isOverdueByDate = receivable.due_date.getTime() < Date.now();
    let newStatus: DebtStatus;
    if (newPaid <= 0) {
      newStatus = wasOverdue || isOverdueByDate ? 'OVERDUE' : 'UNPAID';
    } else if (newPaid >= receivable.original_amount) {
      newStatus = 'PAID';
    } else {
      newStatus = wasOverdue || isOverdueByDate ? 'OVERDUE' : 'PARTIAL';
    }

    await prisma.$transaction(async (tx) => {
      // Delete the 1:1 auto-created CashTransaction matching this payment via reference_id
      await tx.cashTransaction.deleteMany({
        where: { reference_type: 'RECEIVABLE_PAYMENT', reference_id: paymentId },
      });
      await tx.receivablePayment.delete({ where: { id: paymentId } });
      await tx.receivable.update({
        where: { id: receivable.id },
        data: { paid_amount: newPaid, remaining: newRemaining, status: newStatus },
      });
    });

    await delCache('cache:/api/receivables*', 'cache:/api/dashboard*', 'cache:/api/cash-book*');
    return { id: paymentId, receivable_id: receivable.id, new_paid: newPaid, new_remaining: newRemaining, new_status: newStatus };
  }

  // ── Delete a receivable (only if no payments) ──
  static async delete(id: string) {
    const receivable = await prisma.receivable.findUnique({
      where: { id },
      include: { payments: true },
    });
    if (!receivable) throw new AppError(t('debt.notFound'), 404);
    if (receivable.payments.length > 0) {
      throw new AppError(t('receivable.deleteBlockedHasPayments'), 400);
    }

    await prisma.receivable.delete({ where: { id } });
    await delCache('cache:/api/receivables*', 'cache:/api/dashboard*');
    return { id };
  }

  // ── Delete receivable for an invoice (used by invoice cancel flow) ──
  // Receivable schema has no `invoice_id`; match by `invoice_number` (the SO/invoice link)
  static async deleteByInvoice(invoiceId: string) {
    // Try `invoice_number` field first (Receivable.invoice_number stores the invoice ref)
    const receivable = await prisma.receivable.findFirst({
      where: { invoice_number: invoiceId },
      include: { payments: true },
    });
    if (!receivable) return { deleted: 0 };

    if (receivable.payments.length > 0) {
      throw new AppError(t('receivable.deleteBlockedHasPayments'), 400);
    }

    await prisma.receivable.delete({ where: { id: receivable.id } });
    await delCache('cache:/api/receivables*', 'cache:/api/dashboard*');
    return { deleted: 1, id: receivable.id };
  }
}
