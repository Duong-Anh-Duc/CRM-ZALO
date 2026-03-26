import prisma from '../../lib/prisma';
import { AppError } from '../../middleware/error.middleware';
import { SalesOrderStatus, VATRate } from '@prisma/client';
import { config } from '../../config';
import { t } from '../../locales';
import dayjs from 'dayjs';
import { delCache } from '../../lib/redis';

interface CreateSalesOrderInput {
  customer_id: string;
  expected_delivery?: string;
  notes?: string;
  vat_rate: VATRate;
  items: Array<{
    product_id?: string;
    combo_id?: string;
    quantity: number;
    unit_price: number;
    discount_pct?: number;
    color_note?: string;
    packaging_note?: string;
  }>;
}

export class SalesOrderService {
  static async list(filters: { page?: number; limit?: number; status?: SalesOrderStatus; customer_id?: string; search?: string; from_date?: string; to_date?: string }) {
    const page = Number(filters.page) || 1;
    const limit = Number(filters.limit) || 20;
    const { status, customer_id, search, from_date, to_date } = filters;

    const where = {
      ...(status && { status }),
      ...(customer_id && { customer_id }),
      ...(search && {
        OR: [
          { order_code: { contains: search, mode: 'insensitive' as const } },
          { customer: { company_name: { contains: search, mode: 'insensitive' as const } } },
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
      prisma.salesOrder.findMany({
        where,
        include: {
          customer: { select: { id: true, company_name: true, phone: true } },
          items: { include: { product: { select: { id: true, sku: true, name: true } } } },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
      prisma.salesOrder.count({ where }),
    ]);

    return { orders, total, page, limit, total_pages: Math.ceil(total / limit) };
  }

  static async getById(id: string) {
    const order = await prisma.salesOrder.findUnique({
      where: { id },
      include: {
        customer: true,
        items: {
          include: {
            product: { select: { id: true, sku: true, name: true, images: { where: { is_primary: true }, take: 1 } } },
            combo: true,
          },
        },
        receivables: { include: { payments: true } },
      },
    });
    if (!order) throw new AppError(t('order.salesNotFound'), 404);
    return order;
  }

  static async generateOrderCode(): Promise<string> {
    const prefix = `SO-${dayjs().format('YYYYMMDD')}-`;
    const count = await prisma.salesOrder.count({
      where: { order_code: { startsWith: prefix } },
    });
    return `${prefix}${(count + 1).toString().padStart(3, '0')}`;
  }

  static async create(input: CreateSalesOrderInput) {
    const orderCode = await this.generateOrderCode();

    const items = input.items.map((item) => {
      const discountPct = item.discount_pct || 0;
      const lineTotal = item.quantity * item.unit_price * (1 - discountPct / 100);
      return { ...item, line_total: lineTotal };
    });

    const subtotal = items.reduce((sum, i) => sum + i.line_total, 0);
    const vatPct = input.vat_rate === 'VAT_0' ? 0 : input.vat_rate === 'VAT_8' ? 8 : 10;
    const vatAmount = subtotal * (vatPct / 100);
    const grandTotal = subtotal + vatAmount;

    const order = await prisma.salesOrder.create({
      data: {
        order_code: orderCode,
        customer_id: input.customer_id,
        expected_delivery: input.expected_delivery ? new Date(input.expected_delivery) : null,
        notes: input.notes,
        subtotal,
        vat_rate: input.vat_rate,
        vat_amount: vatAmount,
        grand_total: grandTotal,
        items: { create: items },
      },
      include: { customer: true, items: true },
    });

    await delCache('cache:/api/sales-orders*', 'cache:/api/dashboard*');
    return order;
  }

  static async updateStatus(id: string, status: SalesOrderStatus) {
    const order = await prisma.salesOrder.findUnique({ where: { id } });
    if (!order) throw new AppError(t('order.salesNotFound'), 404);

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.salesOrder.update({
        where: { id },
        data: { status },
        include: { customer: true, items: true },
      });

      if (status === 'CONFIRMED' && order.status === 'NEW') {
        const dueDays = config.defaultReceivableDueDays;
        await tx.receivable.create({
          data: {
            sales_order_id: id,
            customer_id: order.customer_id,
            invoice_date: new Date(),
            due_date: dayjs().add(dueDays, 'day').toDate(),
            original_amount: order.grand_total,
            remaining: order.grand_total,
          },
        });
      }

      return result;
    });

    await delCache('cache:/api/sales-orders*', 'cache:/api/dashboard*', 'cache:/api/receivables*');
    return updated;
  }
}
