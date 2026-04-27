import prisma from '../../lib/prisma';
import dayjs from 'dayjs';
import { ReturnStatus } from '@prisma/client';
import { AppError } from '../../middleware/error.middleware';
import { t } from '../../locales';
import { delCache } from '../../lib/redis';
import { AlertService } from '../alert/alert.service';
import logger from '../../utils/logger';

interface CreateSalesReturnInput {
  sales_order_id: string;
  customer_id: string;
  return_date?: string;
  reason?: string;
  notes?: string;
  items: { product_id: string; quantity: number; unit_price: number; reason?: string }[];
}

export class SalesReturnService {
  private static async generateReturnCode(): Promise<string> {
    const prefix = `SR-${dayjs().format('YYYYMMDD')}`;
    const count = await prisma.salesReturn.count({
      where: { return_code: { startsWith: prefix } },
    });
    return `${prefix}-${String(count + 1).padStart(3, '0')}`;
  }

  static async list(filters: { page?: number; limit?: number; status?: string; search?: string; customer_id?: string }) {
    const page = Number(filters.page) || 1;
    const limit = Number(filters.limit) || 20;

    const where: any = {};
    if (filters.status && filters.status !== 'ALL') where.status = filters.status;
    if (filters.customer_id) where.customer_id = filters.customer_id;
    if (filters.search) {
      where.OR = [
        { return_code: { contains: filters.search, mode: 'insensitive' } },
        { sales_order: { order_code: { contains: filters.search, mode: 'insensitive' } } },
        { customer: { company_name: { contains: filters.search, mode: 'insensitive' } } },
      ];
    }

    const [data, total] = await Promise.all([
      prisma.salesReturn.findMany({
        where,
        include: {
          customer: { select: { id: true, company_name: true, contact_name: true } },
          sales_order: { select: { id: true, order_code: true } },
          _count: { select: { items: true } },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
      prisma.salesReturn.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  static async getById(id: string) {
    const record = await prisma.salesReturn.findUnique({
      where: { id },
      include: {
        customer: { select: { id: true, company_name: true, contact_name: true, phone: true } },
        sales_order: {
          select: {
            id: true, order_code: true, grand_total: true,
            items: { select: { product_id: true, quantity: true, unit_price: true, product: { select: { name: true, sku: true } } } },
          },
        },
        items: {
          include: { product: { select: { id: true, name: true, sku: true, material: true, capacity_ml: true } } },
        },
      },
    });
    if (!record) throw new AppError(t('return.notFound'), 404);
    return record;
  }

  static async create(input: CreateSalesReturnInput) {
    const so = await prisma.salesOrder.findUnique({ where: { id: input.sales_order_id } });
    if (!so) throw new AppError(t('order.notFound'), 404);

    const return_code = await this.generateReturnCode();
    const items = input.items.map((item) => ({
      product_id: item.product_id,
      quantity: item.quantity,
      unit_price: item.unit_price,
      line_total: item.quantity * item.unit_price,
      reason: item.reason,
    }));
    const total_amount = items.reduce((sum, i) => sum + i.line_total, 0);

    const record = await prisma.salesReturn.create({
      data: {
        return_code,
        sales_order_id: input.sales_order_id,
        customer_id: input.customer_id,
        return_date: input.return_date ? new Date(input.return_date) : new Date(),
        total_amount,
        reason: input.reason,
        notes: input.notes,
        items: { create: items },
      },
      include: { items: true },
    });

    return record;
  }

  static async delete(id: string) {
    const record = await prisma.salesReturn.findUnique({ where: { id } });
    if (!record) throw new AppError(t('return.notFound'), 404);

    // Block in-flight statuses where reversal is ambiguous (goods being received / approved but not finished)
    if (record.status === 'APPROVED' || record.status === 'RECEIVING') {
      throw new AppError(t('return.cannotDelete'), 400);
    }

    const totalAmount = Number(record.total_amount);

    await prisma.$transaction(async (tx) => {
      // If COMPLETED, the receivable was reduced via reduceReceivable() at status update.
      // Replay in reverse: bump remaining + original_amount back, recompute status.
      if (record.status === 'COMPLETED' && totalAmount > 0) {
        const receivables = await tx.receivable.findMany({
          where: { sales_order_id: record.sales_order_id, customer_id: record.customer_id },
          orderBy: [{ due_date: 'asc' }, { created_at: 'asc' }],
        });

        let toRestore = totalAmount;
        for (const inv of receivables) {
          if (toRestore <= 0) break;
          const original = Number(inv.original_amount);
          const paid = Number(inv.paid_amount);
          const currentRemaining = Number(inv.remaining);
          // Cap restore so newOriginal doesn't go above any prior value implicitly — bounded by totalAmount
          const restore = toRestore;
          const newOriginal = original + restore;
          const newRemaining = currentRemaining + restore;
          let newStatus: 'UNPAID' | 'PARTIAL' | 'PAID' | 'OVERDUE' = inv.status as any;
          if (newRemaining <= 0) newStatus = 'PAID';
          else if (paid > 0 && paid < newOriginal) newStatus = 'PARTIAL';
          else if (paid <= 0) newStatus = inv.due_date && inv.due_date < new Date() ? 'OVERDUE' : 'UNPAID';

          await tx.receivable.update({
            where: { id: inv.id },
            data: { original_amount: newOriginal, remaining: newRemaining, status: newStatus },
          });
          toRestore -= restore;
          break; // restore the full return amount onto the first matching receivable
        }
        logger.info(`SalesReturn ${record.return_code} deleted — receivable restored by ${totalAmount}`);
      }

      await tx.salesReturn.delete({ where: { id } }); // Cascade deletes items
    });

    await delCache('cache:/api/receivables*', 'cache:/api/dashboard*', 'cache:/api/returns*');

    if (record.status === 'COMPLETED') {
      AlertService.createAlert({
        type: 'INFO',
        title: t('salesReturn.reversedOnDelete', { code: record.return_code }),
        message: t('salesReturn.reversedOnDelete', { code: record.return_code }),
      }).catch((err) => logger.warn(`Alert creation failed: ${err.message}`));
    }
  }

  static async updateStatus(id: string, status: ReturnStatus) {
    const record = await prisma.salesReturn.findUnique({ where: { id } });
    if (!record) throw new AppError(t('return.notFound'), 404);

    if (record.status === 'COMPLETED' || record.status === 'CANCELLED') {
      throw new AppError(t('return.cannotChangeStatus'), 400);
    }

    const updated = await prisma.salesReturn.update({
      where: { id },
      data: { status },
    });

    // When COMPLETED → reduce receivable
    if (status === 'COMPLETED') {
      await this.reduceReceivable(record.sales_order_id, record.customer_id, record.total_amount);

      AlertService.createAlert({
        type: 'INFO',
        title: t('return.salesReturnCompleted', { code: record.return_code }),
        message: t('return.salesReturnCompleted', { code: record.return_code }),
      }).catch((err) => logger.warn(`Alert creation failed: ${err.message}`));
    }

    await delCache('cache:/api/receivables*', 'cache:/api/dashboard*', 'cache:/api/returns*');
    return updated;
  }

  private static async reduceReceivable(salesOrderId: string, customerId: string, amount: number) {
    const receivables = await prisma.receivable.findMany({
      where: { sales_order_id: salesOrderId, customer_id: customerId, status: { in: ['UNPAID', 'PARTIAL', 'OVERDUE'] } },
      orderBy: [{ due_date: 'desc' }, { created_at: 'desc' }],
    });

    if (receivables.length === 0) return;

    let remaining = amount;
    const updates: any[] = [];

    for (const inv of receivables) {
      if (remaining <= 0) break;
      const reduce = Math.min(remaining, inv.remaining);
      const newRemaining = inv.remaining - reduce;
      const newStatus = newRemaining <= 0 ? 'PAID' : inv.status;

      updates.push(
        prisma.receivable.update({
          where: { id: inv.id },
          data: { remaining: newRemaining, status: newStatus },
        })
      );
      remaining -= reduce;
    }

    if (updates.length > 0) {
      await prisma.$transaction(updates);
    }
  }
}
