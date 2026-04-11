import prisma from '../../lib/prisma';
import { AppError } from '../../middleware/error.middleware';
import { PurchaseOrderStatus } from '@prisma/client';
import { config } from '../../config';
import { t } from '../../locales';
import dayjs from 'dayjs';
import { delCache } from '../../lib/redis';

interface CreatePurchaseOrderInput {
  supplier_id: string;
  expected_delivery?: string;
  notes?: string;
  status?: PurchaseOrderStatus;
  items: Array<{
    product_id: string;
    quantity: number;
    unit_price: number;
  }>;
}

export class PurchaseOrderService {
  static async list(filters: { page?: number; limit?: number; status?: PurchaseOrderStatus; supplier_id?: string; search?: string; from_date?: string; to_date?: string }) {
    const page = Number(filters.page) || 1;
    const limit = Number(filters.limit) || 20;
    const { status, supplier_id, search, from_date, to_date } = filters;

    const where = {
      ...(status && { status }),
      ...(supplier_id && { supplier_id }),
      ...(search && {
        OR: [
          { order_code: { contains: search, mode: 'insensitive' as const } },
          { supplier: { company_name: { contains: search, mode: 'insensitive' as const } } },
        ],
      }),
      ...(from_date || to_date ? {
        order_date: {
          ...(from_date && { gte: new Date(from_date) }),
          ...(to_date && { lte: new Date(to_date) }),
        },
      } : {}),
    };

    const [orders, total] = await Promise.all([
      prisma.purchaseOrder.findMany({
        where,
        include: {
          supplier: { select: { id: true, company_name: true, phone: true } },
          items: { include: { product: { select: { id: true, sku: true, name: true } } } },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
      prisma.purchaseOrder.count({ where }),
    ]);

    return { orders, total, page, limit, total_pages: Math.ceil(total / limit) };
  }

  static async getById(id: string) {
    const order = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        supplier: true,
        items: { include: { product: { select: { id: true, sku: true, name: true } } } },
        payables: { include: { payments: true } },
      },
    });
    if (!order) throw new AppError(t('order.purchaseNotFound'), 404);
    return order;
  }

  static async generateOrderCode(): Promise<string> {
    const prefix = `PO-${dayjs().format('YYYYMMDD')}-`;
    const count = await prisma.purchaseOrder.count({
      where: { order_code: { startsWith: prefix } },
    });
    return `${prefix}${(count + 1).toString().padStart(3, '0')}`;
  }

  static async create(input: CreatePurchaseOrderInput) {
    const orderCode = await this.generateOrderCode();

    const items = input.items.map((item) => ({
      ...item,
      line_total: item.quantity * item.unit_price,
    }));

    const total = items.reduce((sum, i) => sum + i.line_total, 0);

    const order = await prisma.purchaseOrder.create({
      data: {
        order_code: orderCode,
        supplier_id: input.supplier_id,
        status: input.status || 'NEW',
        expected_delivery: input.expected_delivery ? new Date(input.expected_delivery) : null,
        notes: input.notes,
        total,
        items: { create: items },
      },
      include: { supplier: true, items: true },
    });

    await delCache('cache:/api/purchase-orders*', 'cache:/api/dashboard*');
    return order;
  }

  static async updateStatus(id: string, status: PurchaseOrderStatus) {
    const order = await prisma.purchaseOrder.findUnique({ where: { id } });
    if (!order) throw new AppError(t('order.purchaseNotFound'), 404);

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.purchaseOrder.update({
        where: { id },
        data: { status },
      });

      if (status === 'CONFIRMED' && order.status === 'NEW') {
        const dueDays = config.defaultReceivableDueDays;
        await tx.payable.create({
          data: {
            purchase_order_id: id,
            supplier_id: order.supplier_id,
            invoice_date: new Date(),
            due_date: dayjs().add(dueDays, 'day').toDate(),
            original_amount: order.total,
            remaining: order.total,
          },
        });
      }

      return result;
    });

    await delCache('cache:/api/purchase-orders*', 'cache:/api/dashboard*', 'cache:/api/payables*');
    return updated;
  }
}
