import prisma from '../../lib/prisma';
import { AppError } from '../../middleware/error.middleware';
import { PurchaseOrderStatus } from '@prisma/client';
import { config } from '../../config';
import { t } from '../../locales';
import dayjs from 'dayjs';
import { delCache } from '../../lib/redis';
import { AlertService } from '../alert/alert.service';
import logger from '../../utils/logger';

interface CreatePurchaseOrderInput {
  supplier_id: string;
  sales_order_id?: string;
  expected_delivery?: string;
  notes?: string;
  shipping_fee?: number;
  other_fee?: number;
  other_fee_note?: string;
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
          sales_order: { select: { order_code: true, customer: { select: { company_name: true, contact_name: true } } } },
          items: { include: { product: { select: { id: true, sku: true, name: true } } } },
          invoices: { where: { type: 'PURCHASE' }, select: { id: true, status: true, file_url: true } },
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
        sales_order: { select: { id: true, order_code: true, status: true, grand_total: true, customer: { select: { company_name: true, contact_name: true } } } },
        items: { include: { product: { select: { id: true, sku: true, name: true } } } },
        invoices: { where: { type: 'PURCHASE' } },
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

    const itemsTotal = items.reduce((sum, i) => sum + i.line_total, 0);
    const shippingFee = Number(input.shipping_fee) || 0;
    const otherFee = Number(input.other_fee) || 0;
    const total = itemsTotal + shippingFee + otherFee;

    const order = await prisma.purchaseOrder.create({
      data: {
        order_code: orderCode,
        supplier_id: input.supplier_id,
        sales_order_id: input.sales_order_id || null,
        status: input.status || 'DRAFT',
        expected_delivery: input.expected_delivery ? new Date(input.expected_delivery) : null,
        notes: input.notes,
        total,
        shipping_fee: shippingFee,
        other_fee: otherFee,
        other_fee_note: input.other_fee_note,
        items: { create: items },
      },
      include: { supplier: true, items: true },
    });

    // Seed supplier_prices for any (supplier, product) pairs not yet in the price catalog.
    // Preserves existing manual prices — only fills gaps so "Sản phẩm cung cấp" matches reality.
    await this.syncSupplierPricesFromItems(input.supplier_id, items).catch((err) =>
      logger.warn(`syncSupplierPricesFromItems failed: ${err.message}`),
    );

    await delCache('cache:/api/purchase-orders*', 'cache:/api/dashboard*', 'cache:/api/suppliers*');
    return order;
  }

  private static async syncSupplierPricesFromItems(
    supplierId: string,
    items: Array<{ product_id: string; unit_price: number; quantity: number }>,
  ): Promise<void> {
    if (!items.length) return;
    const productIds = [...new Set(items.map((i) => i.product_id))];
    const existing = await prisma.supplierPrice.findMany({
      where: { supplier_id: supplierId, product_id: { in: productIds } },
      select: { product_id: true },
    });
    const existingSet = new Set(existing.map((e) => e.product_id));
    const toCreate = items
      .filter((i) => !existingSet.has(i.product_id))
      // dedupe if same product appears in multiple items on the same PO
      .filter((i, idx, arr) => arr.findIndex((x) => x.product_id === i.product_id) === idx)
      .map((i) => ({
        supplier_id: supplierId,
        product_id: i.product_id,
        purchase_price: i.unit_price,
        moq: i.quantity > 0 ? i.quantity : null,
        is_preferred: false,
      }));
    if (toCreate.length > 0) {
      await prisma.supplierPrice.createMany({ data: toCreate, skipDuplicates: true });
    }
  }

  static async update(id: string, data: { notes?: string; expected_delivery?: string }) {
    const order = await prisma.purchaseOrder.findUnique({ where: { id } });
    if (!order) throw new AppError(t('order.purchaseNotFound'), 404);

    const updateData: any = {};
    if (data.notes !== undefined) updateData.notes = data.notes;
    if (data.expected_delivery) updateData.expected_delivery = new Date(data.expected_delivery);

    const updated = await prisma.purchaseOrder.update({ where: { id }, data: updateData, include: { supplier: true, items: true } });
    await delCache('cache:/api/purchase-orders*');
    return updated;
  }

  static async updateStatus(id: string, status: PurchaseOrderStatus) {
    const order = await prisma.purchaseOrder.findUnique({ where: { id } });
    if (!order) throw new AppError(t('order.purchaseNotFound'), 404);

    const updated = await prisma.purchaseOrder.update({
      where: { id },
      data: { status },
    });

    // Debts are now created by SalesOrderService.checkAndCreateDebts
    // when both sales + purchase invoices are approved

    // Create alert for PO status change
    AlertService.createAlert({
      type: 'WARNING',
      title: t('alert.poStatusChanged', { code: updated.order_code, status }),
      message: t('alert.poStatusChanged', { code: updated.order_code, status }),
      purchase_order_id: id,
    }).catch((err) => logger.warn(`Alert creation failed: ${err.message}`));

    await delCache('cache:/api/purchase-orders*', 'cache:/api/dashboard*', 'cache:/api/payables*');
    return updated;
  }

  static async delete(id: string) {
    const order = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        items: { select: { id: true } },
        invoices: { where: { status: { not: 'CANCELLED' } } },
        payables: { include: { payments: true } },
        purchase_returns: true,
      },
    });
    if (!order) throw new AppError(t('order.purchaseNotFound'), 404);

    // Block guards
    if (order.invoices.some((inv) => inv.status === 'APPROVED')) {
      throw new AppError(t('order.deleteBlockedInvoiceApproved'), 400);
    }
    if (order.payables.some((p) => Number(p.paid_amount) > 0)) {
      throw new AppError(t('order.deleteBlockedHasPayment'), 400);
    }
    if (order.purchase_returns.some((pr) => pr.status === 'COMPLETED')) {
      throw new AppError(t('order.deleteBlockedReturnCompleted'), 400);
    }

    const payableIds = order.payables.map((p) => p.id);
    const invoiceIdsToCancel = order.invoices
      .filter((inv) => inv.status !== 'CANCELLED')
      .map((inv) => inv.id);
    const returnIdsToDelete = order.purchase_returns
      .filter((pr) => pr.status !== 'COMPLETED')
      .map((pr) => pr.id);

    await prisma.$transaction(async (tx) => {
      if (payableIds.length > 0) {
        await tx.payable.deleteMany({ where: { id: { in: payableIds } } });
      }
      if (invoiceIdsToCancel.length > 0) {
        await tx.invoice.updateMany({
          where: { id: { in: invoiceIdsToCancel } },
          data: { status: 'CANCELLED' },
        });
      }
      if (returnIdsToDelete.length > 0) {
        await tx.purchaseReturn.deleteMany({ where: { id: { in: returnIdsToDelete } } });
      }
      await tx.purchaseOrderItem.deleteMany({ where: { purchase_order_id: id } });
      await tx.purchaseOrder.delete({ where: { id } });
    });

    await delCache(
      'cache:/api/purchase-orders*',
      'cache:/api/dashboard*',
      'cache:/api/payables*',
      'cache:/api/invoices*',
    );
    return { deleted: true };
  }
}
