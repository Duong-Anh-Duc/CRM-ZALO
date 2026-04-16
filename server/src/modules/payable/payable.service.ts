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
  supplier_id: string;
  amount: number;
  payment_date?: string;
  method: PaymentMethod;
  reference?: string;
}

export class PayableService {
  // ── Group by supplier ──
  static async listBySupplier(filters: { page?: number; limit?: number; status?: string; search?: string }) {
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

    return { suppliers: paged, total, page, limit, total_pages: Math.ceil(total / limit) };
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

    await prisma.$transaction([...paymentCreates, ...payableUpdates]);

    // Auto-sync: create cash book expense record
    try {
      const supplier = await prisma.supplier.findUnique({ where: { id: input.supplier_id }, select: { company_name: true } });
      const suppName = supplier?.company_name || '';
      const expenseCat = await prisma.cashCategory.findFirst({ where: { type: 'EXPENSE', name: { contains: 'NCC' } } });
      if (expenseCat) {
        await prisma.cashTransaction.create({
          data: {
            type: 'EXPENSE',
            category_id: expenseCat.id,
            date: input.payment_date ? new Date(input.payment_date) : new Date(),
            amount: input.amount,
            description: `TT NCC ${suppName}`,
            reference: input.reference,
            payment_method: input.method,
            is_auto: true,
          },
        });
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

  // ── Export supplier debt report as PDF ──
  static async exportSupplierPdf(supplierId: string): Promise<Buffer> {
    const detail = await this.getSupplierDetail(supplierId);
    const { supplier, payables, summary } = detail;

    const invoices = payables.map((p: any) => ({
      invoice_number: p.invoice_number,
      order_code: p.purchase_order?.order_code || '-',
      invoice_date: dayjs(p.invoice_date).format('DD/MM/YYYY'),
      due_date: dayjs(p.due_date).format('DD/MM/YYYY'),
      original_amount: Number(p.original_amount),
      paid_amount: Number(p.paid_amount),
      remaining: Number(p.remaining),
      status: p.status,
    }));

    const payments = payables.flatMap((p: any) =>
      (p.payments || []).map((pay: any) => ({
        payment_date: dayjs(pay.payment_date).format('DD/MM/YYYY'),
        invoice_number: p.invoice_number,
        amount: Number(pay.amount),
        method: pay.method,
        reference: pay.reference || '',
      }))
    ).sort((a: any, b: any) => b.payment_date.localeCompare(a.payment_date));

    const html = buildDebtReportHtml({
      type: 'payable',
      entity: {
        name: supplier.company_name || supplier.contact_name || '',
        phone: supplier.phone || '',
        email: supplier.email || '',
        address: supplier.address || '',
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
