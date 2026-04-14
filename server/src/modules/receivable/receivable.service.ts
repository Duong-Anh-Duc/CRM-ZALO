import prisma from '../../lib/prisma';
import puppeteer from 'puppeteer';
import dayjs from 'dayjs';
import { AppError } from '../../middleware/error.middleware';
import { DebtStatus, PaymentMethod } from '@prisma/client';
import { t } from '../../locales';
import { delCache } from '../../lib/redis';
import { AlertService } from '../alert/alert.service';
import logger from '../../utils/logger';
import { buildDebtReportHtml } from './debt-report-template';

interface RecordPaymentInput {
  customer_id: string;
  amount: number;
  payment_date?: string;
  method: PaymentMethod;
  reference?: string;
}

export class ReceivableService {
  // ── Group by customer ──
  static async listByCustomer(filters: { page?: number; limit?: number; status?: string; search?: string }) {
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

    return { customers: paged, total, page, limit, total_pages: Math.ceil(total / limit) };
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

    await prisma.$transaction([...paymentCreates, ...receivableUpdates]);

    // Create alert for payment recorded
    AlertService.createAlert({
      type: 'WARNING',
      title: t('alert.receivablePaymentRecorded', { amount: input.amount }),
      message: t('alert.receivablePaymentRecorded', { amount: input.amount }),
    }).catch((err) => logger.warn(`Alert creation failed: ${err.message}`));

    await delCache('cache:/api/receivables*', 'cache:/api/dashboard*');
    return { allocated: paymentCreates.length, total_amount: input.amount };
  }

  // ── Export customer debt report as PDF ──
  static async exportCustomerPdf(customerId: string): Promise<Buffer> {
    const detail = await this.getCustomerDetail(customerId);
    const { customer, receivables, summary } = detail;

    const invoices = receivables.map((r: any) => ({
      invoice_number: r.invoice_number,
      order_code: r.sales_order?.order_code || '-',
      invoice_date: dayjs(r.invoice_date).format('DD/MM/YYYY'),
      due_date: dayjs(r.due_date).format('DD/MM/YYYY'),
      original_amount: Number(r.original_amount),
      paid_amount: Number(r.paid_amount),
      remaining: Number(r.remaining),
      status: r.status,
    }));

    const payments = receivables.flatMap((r: any) =>
      (r.payments || []).map((p: any) => ({
        payment_date: dayjs(p.payment_date).format('DD/MM/YYYY'),
        invoice_number: r.invoice_number,
        amount: Number(p.amount),
        method: p.method,
        reference: p.reference || '',
      }))
    ).sort((a: any, b: any) => b.payment_date.localeCompare(a.payment_date));

    const html = buildDebtReportHtml({
      type: 'receivable',
      entity: {
        name: customer.company_name || customer.contact_name || '',
        phone: customer.phone || '',
        email: customer.email || '',
        address: customer.address || '',
      },
      summary: {
        total_original: Number(summary.total_original),
        total_paid: Number(summary.total_paid),
        total_remaining: Number(summary.total_remaining),
      },
      invoices,
      payments,
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
        printBackground: true,
        margin: { top: '15mm', right: '10mm', bottom: '15mm', left: '10mm' },
      });
      return Buffer.from(pdf);
    } finally {
      await browser.close();
    }
  }
}
