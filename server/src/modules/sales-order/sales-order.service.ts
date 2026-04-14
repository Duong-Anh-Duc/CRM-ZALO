import prisma from '../../lib/prisma';
import { AppError } from '../../middleware/error.middleware';
import { SalesOrderStatus, VATRate } from '@prisma/client';
import { config } from '../../config';
import { t } from '../../locales';
import dayjs from 'dayjs';
import { delCache } from '../../lib/redis';
import { InvoiceService } from '../invoice/invoice.service';
import { PurchaseOrderService } from '../purchase-order/purchase-order.service';
import { AlertService } from '../alert/alert.service';
import logger from '../../utils/logger';

interface CreateSalesOrderInput {
  customer_id: string;
  expected_delivery?: string;
  notes?: string;
  vat_rate: VATRate;
  status?: SalesOrderStatus;
  items: Array<{
    product_id?: string;
    supplier_id?: string;
    quantity: number;
    unit_price: number;
    purchase_price?: number;
    discount_pct?: number;
    customer_product_name?: string;
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
          customer: { select: { id: true, company_name: true, contact_name: true, phone: true } },
          items: {
            include: {
              product: { select: { id: true, sku: true, name: true } },
              supplier: { select: { id: true, company_name: true } },
            },
          },
          purchase_orders: {
            select: { id: true, order_code: true, supplier: { select: { company_name: true } }, status: true, total: true },
          },
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
            product: {
              select: {
                id: true, sku: true, name: true,
                images: { where: { is_primary: true }, take: 1 },
                supplier_prices: { include: { supplier: { select: { id: true, company_name: true } } } },
              },
            },
            supplier: { select: { id: true, company_name: true, phone: true } },
          },
        },
        purchase_orders: {
          include: {
            supplier: { select: { id: true, company_name: true } },
            items: { include: { product: { select: { name: true } } } },
            invoices: { select: { id: true, status: true, file_url: true } },
          },
        },
        receivables: { include: { payments: true } },
        invoices: { where: { type: 'SALES' } },
      },
    });
    if (!order) throw new AppError(t('order.salesNotFound'), 404);

    // Calculate profit
    const purchaseTotal = order.purchase_orders.reduce((s, po) => s + Number(po.total), 0);
    const profit = Number(order.grand_total) - purchaseTotal;

    return { ...order, purchase_total: purchaseTotal, profit };
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

    // Auto-assign preferred supplier + purchase price if not specified
    const enrichedItems = await Promise.all(input.items.map(async (item) => {
      let supplierId = item.supplier_id;
      let purchasePrice = item.purchase_price;

      if (item.product_id && !supplierId) {
        const preferred = await prisma.supplierPrice.findFirst({
          where: { product_id: item.product_id, is_preferred: true },
          select: { supplier_id: true, purchase_price: true },
        });
        if (preferred) {
          supplierId = preferred.supplier_id;
          purchasePrice = purchasePrice || preferred.purchase_price;
        }
      }

      const discountPct = item.discount_pct || 0;
      const lineTotal = item.quantity * item.unit_price * (1 - discountPct / 100);

      return {
        product_id: item.product_id,
        supplier_id: supplierId || null,
        quantity: item.quantity,
        unit_price: item.unit_price,
        purchase_price: purchasePrice || null,
        discount_pct: discountPct,
        line_total: lineTotal,
        customer_product_name: item.customer_product_name || null,
        color_note: item.color_note,
        packaging_note: item.packaging_note,
        supplier_status: 'PENDING',
      };
    }));

    const subtotal = enrichedItems.reduce((sum, i) => sum + i.line_total, 0);
    const vatPct = input.vat_rate === 'VAT_0' ? 0 : input.vat_rate === 'VAT_8' ? 8 : 10;
    const vatAmount = subtotal * (vatPct / 100);
    const grandTotal = subtotal + vatAmount;

    const order = await prisma.salesOrder.create({
      data: {
        order_code: orderCode,
        customer_id: input.customer_id,
        status: input.status || 'DRAFT',
        expected_delivery: input.expected_delivery ? new Date(input.expected_delivery) : null,
        notes: input.notes,
        subtotal,
        vat_rate: input.vat_rate,
        vat_amount: vatAmount,
        grand_total: grandTotal,
        items: { create: enrichedItems },
      },
      include: { customer: true, items: { include: { supplier: { select: { company_name: true } } } } },
    });

    // Auto-save product aliases (customer product names)
    for (const item of input.items) {
      if (item.product_id && item.customer_product_name?.trim()) {
        await prisma.productAlias.upsert({
          where: { product_id_alias: { product_id: item.product_id, alias: item.customer_product_name.trim() } },
          create: { product_id: item.product_id, alias: item.customer_product_name.trim() },
          update: {},
        }).catch(() => {}); // ignore duplicates
      }
    }

    await delCache('cache:/api/sales-orders*', 'cache:/api/dashboard*');
    return order;
  }

  // Auto-create POs grouped by supplier when SO is confirmed
  static async createPurchaseOrders(salesOrderId: string) {
    const so = await prisma.salesOrder.findUnique({
      where: { id: salesOrderId },
      include: { items: { where: { supplier_id: { not: null } } } },
    });
    if (!so) return [];

    // Group items by supplier
    const supplierMap = new Map<string, Array<{ product_id: string; quantity: number; unit_price: number }>>();
    for (const item of so.items) {
      if (!item.supplier_id || !item.product_id) continue;
      if (!supplierMap.has(item.supplier_id)) supplierMap.set(item.supplier_id, []);
      supplierMap.get(item.supplier_id)!.push({
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: Number(item.purchase_price) || Number(item.unit_price),
      });
    }

    const pos = [];
    for (const [supplierId, items] of supplierMap) {
      const po = await PurchaseOrderService.create({
        supplier_id: supplierId,
        sales_order_id: salesOrderId,
        expected_delivery: so.expected_delivery ? dayjs(so.expected_delivery).format('YYYY-MM-DD') : undefined,
        notes: `Mua cho đơn ${so.order_code}`,
        items,
      });
      pos.push(po);
    }

    return pos;
  }

  static async update(id: string, data: { notes?: string; expected_delivery?: string; vat_rate?: VATRate }) {
    const order = await prisma.salesOrder.findUnique({ where: { id } });
    if (!order) throw new AppError(t('order.salesNotFound'), 404);

    const updateData: any = {};
    if (data.notes !== undefined) updateData.notes = data.notes;
    if (data.expected_delivery) updateData.expected_delivery = new Date(data.expected_delivery);
    if (data.vat_rate) {
      updateData.vat_rate = data.vat_rate;
      const vatPct = data.vat_rate === 'VAT_0' ? 0 : data.vat_rate === 'VAT_8' ? 8 : 10;
      updateData.vat_amount = Number(order.subtotal) * (vatPct / 100);
      updateData.grand_total = Number(order.subtotal) + updateData.vat_amount;
    }

    const updated = await prisma.salesOrder.update({
      where: { id },
      data: updateData,
      include: { customer: true, items: true },
    });

    await delCache('cache:/api/sales-orders*');
    return updated;
  }

  static async updateStatus(id: string, status: SalesOrderStatus) {
    const order = await prisma.salesOrder.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!order) throw new AppError(t('order.salesNotFound'), 404);

    // DRAFT → CONFIRMED: check tất cả items phải có NCC
    if (status === 'CONFIRMED' && (order.status === 'DRAFT' || order.status === 'PENDING')) {
      const itemsNoSupplier = order.items.filter((item) => !item.supplier_id);
      if (itemsNoSupplier.length > 0) {
        throw new AppError(t('order.allItemsMustHaveSupplier', { count: itemsNoSupplier.length }), 400);
      }
    }

    const updated = await prisma.salesOrder.update({
      where: { id },
      data: { status },
      include: { customer: true, items: true },
    });

    // DRAFT → CONFIRMED: auto-create POs (DRAFT status)
    if (status === 'CONFIRMED' && (order.status === 'DRAFT' || order.status === 'PENDING')) {
      this.createPurchaseOrders(id).catch((err) => {
        logger.warn(`Auto PO creation failed for ${id}: ${err.message}`);
      });
    }

    // Create alert for status change
    AlertService.createAlert({
      type: 'WARNING',
      title: t('alert.soStatusChanged', { code: updated.order_code, status }),
      message: t('alert.soStatusChanged', { code: updated.order_code, status }),
    }).catch((err) => logger.warn(`Alert creation failed: ${err.message}`));

    await delCache('cache:/api/sales-orders*', 'cache:/api/dashboard*', 'cache:/api/receivables*');
    return updated;
  }

  // Recalculate SO totals after item changes
  private static async recalculateTotals(salesOrderId: string) {
    const so = await prisma.salesOrder.findUnique({
      where: { id: salesOrderId },
      include: { items: true },
    });
    if (!so) return;

    const subtotal = so.items.reduce((sum, i) => sum + Number(i.line_total), 0);
    const vatPct = so.vat_rate === 'VAT_0' ? 0 : so.vat_rate === 'VAT_8' ? 8 : 10;
    const vatAmount = subtotal * (vatPct / 100);
    const grandTotal = subtotal + vatAmount;

    await prisma.salesOrder.update({
      where: { id: salesOrderId },
      data: { subtotal, vat_amount: vatAmount, grand_total: grandTotal },
    });
    await delCache('cache:/api/sales-orders*', 'cache:/api/dashboard*');
  }

  static async addItem(salesOrderId: string, input: { product_id: string; supplier_id?: string; quantity: number; unit_price: number; purchase_price?: number; discount_pct?: number; customer_product_name?: string }) {
    const order = await prisma.salesOrder.findUnique({ where: { id: salesOrderId } });
    if (!order) throw new AppError(t('order.salesNotFound'), 404);
    if (order.status !== 'DRAFT') throw new AppError(t('order.onlyEditDraft'), 400);

    // Auto-assign preferred supplier if not specified
    let supplierId = input.supplier_id || null;
    let purchasePrice = input.purchase_price || null;
    if (input.product_id && !supplierId) {
      const preferred = await prisma.supplierPrice.findFirst({
        where: { product_id: input.product_id, is_preferred: true },
        select: { supplier_id: true, purchase_price: true },
      });
      if (preferred) {
        supplierId = preferred.supplier_id;
        purchasePrice = purchasePrice || preferred.purchase_price;
      }
    }

    const discountPct = input.discount_pct || 0;
    const lineTotal = input.quantity * input.unit_price * (1 - discountPct / 100);

    const item = await prisma.salesOrderItem.create({
      data: {
        sales_order_id: salesOrderId,
        product_id: input.product_id,
        supplier_id: supplierId,
        quantity: input.quantity,
        unit_price: input.unit_price,
        purchase_price: purchasePrice,
        discount_pct: discountPct,
        line_total: lineTotal,
        customer_product_name: input.customer_product_name || null,
        supplier_status: 'PENDING',
      },
      include: {
        product: { select: { id: true, sku: true, name: true, images: { where: { is_primary: true }, take: 1 } } },
        supplier: { select: { id: true, company_name: true } },
      },
    });

    await this.recalculateTotals(salesOrderId);
    return item;
  }

  static async removeItem(salesOrderId: string, itemId: string) {
    const order = await prisma.salesOrder.findUnique({ where: { id: salesOrderId } });
    if (!order) throw new AppError(t('order.salesNotFound'), 404);
    if (order.status !== 'DRAFT') throw new AppError(t('order.onlyEditDraft'), 400);

    const item = await prisma.salesOrderItem.findFirst({ where: { id: itemId, sales_order_id: salesOrderId } });
    if (!item) throw new AppError(t('order.itemNotFound'), 404);

    // Ensure at least 1 item remains
    const count = await prisma.salesOrderItem.count({ where: { sales_order_id: salesOrderId } });
    if (count <= 1) throw new AppError(t('order.minOneItem'), 400);

    await prisma.salesOrderItem.delete({ where: { id: itemId } });
    await this.recalculateTotals(salesOrderId);
    return { deleted: true };
  }

  static async updateItem(salesOrderId: string, itemId: string, input: { supplier_id?: string; purchase_price?: number; quantity?: number; unit_price?: number; discount_pct?: number }) {
    const order = await prisma.salesOrder.findUnique({ where: { id: salesOrderId } });
    if (!order) throw new AppError(t('order.salesNotFound'), 404);
    if (order.status !== 'DRAFT') throw new AppError(t('order.onlyEditDraft'), 400);

    const item = await prisma.salesOrderItem.findFirst({ where: { id: itemId, sales_order_id: salesOrderId } });
    if (!item) throw new AppError(t('order.itemNotFound'), 404);

    const updateData: any = {};
    if (input.supplier_id !== undefined) updateData.supplier_id = input.supplier_id || null;
    if (input.purchase_price !== undefined) updateData.purchase_price = input.purchase_price;
    if (input.quantity !== undefined) updateData.quantity = input.quantity;
    if (input.unit_price !== undefined) updateData.unit_price = input.unit_price;
    if (input.discount_pct !== undefined) updateData.discount_pct = input.discount_pct;

    // Recalculate line_total if qty/price/discount changed
    const qty = input.quantity ?? item.quantity;
    const price = input.unit_price ?? Number(item.unit_price);
    const disc = input.discount_pct ?? Number(item.discount_pct);
    updateData.line_total = qty * price * (1 - disc / 100);

    const updated = await prisma.salesOrderItem.update({
      where: { id: itemId },
      data: updateData,
      include: {
        product: { select: { id: true, sku: true, name: true, images: { where: { is_primary: true }, take: 1 } } },
        supplier: { select: { id: true, company_name: true } },
      },
    });

    await this.recalculateTotals(salesOrderId);
    return updated;
  }

  // Create debts only when both sales + purchase invoices are approved
  static async checkAndCreateDebts(salesOrderId: string) {
    const so = await prisma.salesOrder.findUnique({
      where: { id: salesOrderId },
      include: {
        invoices: { where: { type: 'SALES' } },
        purchase_orders: { include: { invoices: { where: { type: 'PURCHASE' } } } },
      },
    });
    if (!so) return;

    const salesInvoiceApproved = so.invoices.some((i) => i.status === 'APPROVED');
    const allPOsHaveApprovedInvoice = so.purchase_orders.length > 0 &&
      so.purchase_orders.every((po) => po.invoices.some((i) => i.status === 'APPROVED'));

    if (!salesInvoiceApproved || !allPOsHaveApprovedInvoice) return;

    // Check if receivable already exists
    const existingRec = await prisma.receivable.findFirst({ where: { sales_order_id: salesOrderId } });
    if (!existingRec) {
      const dueDays = config.defaultReceivableDueDays;
      await prisma.receivable.create({
        data: {
          sales_order_id: salesOrderId,
          customer_id: so.customer_id,
          invoice_date: new Date(),
          due_date: dayjs().add(dueDays, 'day').toDate(),
          original_amount: so.grand_total,
          remaining: so.grand_total,
        },
      });
      logger.info(`Receivable created for ${so.order_code}`);
    }

    // Create payables for each PO
    for (const po of so.purchase_orders) {
      const existingPay = await prisma.payable.findFirst({ where: { purchase_order_id: po.id } });
      if (!existingPay) {
        const dueDays = config.defaultReceivableDueDays;
        await prisma.payable.create({
          data: {
            purchase_order_id: po.id,
            supplier_id: po.supplier_id,
            invoice_date: new Date(),
            due_date: dayjs().add(dueDays, 'day').toDate(),
            original_amount: po.total,
            remaining: po.total,
          },
        });
        logger.info(`Payable created for ${po.order_code}`);
      }
    }
  }
}
