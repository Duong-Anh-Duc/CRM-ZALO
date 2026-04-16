import prisma from '../../lib/prisma';
import dayjs from 'dayjs';
import { ReturnStatus } from '@prisma/client';
import { AppError } from '../../middleware/error.middleware';
import { t } from '../../locales';
import { delCache } from '../../lib/redis';
import { AlertService } from '../alert/alert.service';
import logger from '../../utils/logger';

interface CreatePurchaseReturnInput {
  purchase_order_id: string;
  supplier_id: string;
  return_date?: string;
  reason?: string;
  notes?: string;
  items: { product_id: string; quantity: number; unit_price: number; reason?: string }[];
}

export class PurchaseReturnService {
  private static async generateReturnCode(): Promise<string> {
    const prefix = `PR-${dayjs().format('YYYYMMDD')}`;
    const count = await prisma.purchaseReturn.count({
      where: { return_code: { startsWith: prefix } },
    });
    return `${prefix}-${String(count + 1).padStart(3, '0')}`;
  }

  static async list(filters: { page?: number; limit?: number; status?: string; search?: string; supplier_id?: string }) {
    const page = Number(filters.page) || 1;
    const limit = Number(filters.limit) || 20;

    const where: any = {};
    if (filters.status && filters.status !== 'ALL') where.status = filters.status;
    if (filters.supplier_id) where.supplier_id = filters.supplier_id;
    if (filters.search) {
      where.OR = [
        { return_code: { contains: filters.search, mode: 'insensitive' } },
        { purchase_order: { order_code: { contains: filters.search, mode: 'insensitive' } } },
        { supplier: { company_name: { contains: filters.search, mode: 'insensitive' } } },
      ];
    }

    const [data, total] = await Promise.all([
      prisma.purchaseReturn.findMany({
        where,
        include: {
          supplier: { select: { id: true, company_name: true } },
          purchase_order: { select: { id: true, order_code: true } },
          _count: { select: { items: true } },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
      prisma.purchaseReturn.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  static async getById(id: string) {
    const record = await prisma.purchaseReturn.findUnique({
      where: { id },
      include: {
        supplier: { select: { id: true, company_name: true, contact_name: true, phone: true } },
        purchase_order: {
          select: {
            id: true, order_code: true, total: true,
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

  static async create(input: CreatePurchaseReturnInput) {
    const po = await prisma.purchaseOrder.findUnique({ where: { id: input.purchase_order_id } });
    if (!po) throw new AppError(t('order.notFound'), 404);

    const return_code = await this.generateReturnCode();
    const items = input.items.map((item) => ({
      product_id: item.product_id,
      quantity: item.quantity,
      unit_price: item.unit_price,
      line_total: item.quantity * item.unit_price,
      reason: item.reason,
    }));
    const total_amount = items.reduce((sum, i) => sum + i.line_total, 0);

    const record = await prisma.purchaseReturn.create({
      data: {
        return_code,
        purchase_order_id: input.purchase_order_id,
        supplier_id: input.supplier_id,
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
    const record = await prisma.purchaseReturn.findUnique({ where: { id } });
    if (!record) throw new AppError(t('return.notFound'), 404);
    if (record.status === 'COMPLETED' || record.status === 'APPROVED' || record.status === 'SHIPPING') {
      throw new AppError(t('return.cannotDelete'), 400);
    }
    await prisma.purchaseReturn.delete({ where: { id } });
  }

  static async updateStatus(id: string, status: ReturnStatus) {
    const record = await prisma.purchaseReturn.findUnique({ where: { id } });
    if (!record) throw new AppError(t('return.notFound'), 404);

    if (record.status === 'COMPLETED' || record.status === 'CANCELLED') {
      throw new AppError(t('return.cannotChangeStatus'), 400);
    }

    const updated = await prisma.purchaseReturn.update({
      where: { id },
      data: { status },
    });

    // When COMPLETED → reduce payable
    if (status === 'COMPLETED') {
      await this.reducePayable(record.purchase_order_id, record.supplier_id, record.total_amount);

      AlertService.createAlert({
        type: 'INFO',
        title: t('return.purchaseReturnCompleted', { code: record.return_code }),
        message: t('return.purchaseReturnCompleted', { code: record.return_code }),
      }).catch((err) => logger.warn(`Alert creation failed: ${err.message}`));
    }

    await delCache('cache:/api/payables*', 'cache:/api/dashboard*', 'cache:/api/returns*');
    return updated;
  }

  private static async reducePayable(purchaseOrderId: string, supplierId: string, amount: number) {
    const payables = await prisma.payable.findMany({
      where: { purchase_order_id: purchaseOrderId, supplier_id: supplierId, status: { in: ['UNPAID', 'PARTIAL', 'OVERDUE'] } },
      orderBy: [{ due_date: 'desc' }, { created_at: 'desc' }],
    });

    if (payables.length === 0) return;

    let remaining = amount;
    const updates: any[] = [];

    for (const inv of payables) {
      if (remaining <= 0) break;
      const reduce = Math.min(remaining, inv.remaining);
      const newRemaining = inv.remaining - reduce;
      const newStatus = newRemaining <= 0 ? 'PAID' : inv.status;

      updates.push(
        prisma.payable.update({
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
