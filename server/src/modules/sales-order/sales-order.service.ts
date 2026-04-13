import prisma from '../../lib/prisma';
import { AppError } from '../../middleware/error.middleware';
import { SalesOrderStatus, VATRate } from '@prisma/client';
import { config } from '../../config';
import { t } from '../../locales';
import dayjs from 'dayjs';
import { delCache } from '../../lib/redis';
import { InvoiceService } from '../invoice/invoice.service';
import { PurchaseOrderService } from '../purchase-order/purchase-order.service';
import logger from '../../utils/logger';

interface CreateSalesOrderInput {
  customer_id: string;
  expected_delivery?: string;
  notes?: string;
  vat_rate: VATRate;
  status?: SalesOrderStatus;
  items: Array<{
    product_id?: string;
    combo_id?: string;
    supplier_id?: string;
    quantity: number;
    unit_price: number;
    purchase_price?: number;
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
            product: { select: { id: true, sku: true, name: true, images: { where: { is_primary: true }, take: 1 } } },
            supplier: { select: { id: true, company_name: true, phone: true } },
            combo: true,
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
        combo_id: item.combo_id,
        supplier_id: supplierId || null,
        quantity: item.quantity,
        unit_price: item.unit_price,
        purchase_price: purchasePrice || null,
        discount_pct: discountPct,
        line_total: lineTotal,
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
        status: input.status || 'PENDING',
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
    const order = await prisma.salesOrder.findUnique({ where: { id } });
    if (!order) throw new AppError(t('order.salesNotFound'), 404);

    const updated = await prisma.salesOrder.update({
      where: { id },
      data: { status },
      include: { customer: true, items: true },
    });

    // When confirmed: auto-create POs + draft sales invoice
    if (status === 'CONFIRMED' && (order.status === 'PENDING' || order.status === 'NEW')) {
      this.createPurchaseOrders(id).catch((err) => {
        logger.warn(`Auto PO creation failed for ${id}: ${err.message}`);
      });
      InvoiceService.createDraftFromOrder(id).catch((err) => {
        logger.warn(`Auto invoice draft failed for ${id}: ${err.message}`);
      });
    }

    // Check if all invoices approved → create debts
    if (status === 'CONFIRMED' || status === 'COMPLETED') {
      this.checkAndCreateDebts(id).catch((err) => {
        logger.warn(`Debt check failed for ${id}: ${err.message}`);
      });
    }

    await delCache('cache:/api/sales-orders*', 'cache:/api/dashboard*', 'cache:/api/receivables*');
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
