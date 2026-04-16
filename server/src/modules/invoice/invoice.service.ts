import puppeteer from 'puppeteer';
import prisma from '../../lib/prisma';
import { AppError } from '../../middleware/error.middleware';
import { t } from '../../locales';
import { buildInvoiceHtml } from './invoice-template';
import type { InvoiceData } from './invoice-template';
import dayjs from 'dayjs';
import logger from '../../utils/logger';
import { delCache } from '../../lib/redis';
import { AlertService } from '../alert/alert.service';

const DEFAULT_SELLER = {
  name: 'CÔNG TY TNHH TECHLA AI',
  taxCode: '0111293827',
  address: 'Tầng 8, Toà nhà Licogi, số 164 Khuất Duy Tiến, Phường Thanh Xuân, Thành phố Hà Nội, Việt Nam',
  phone: '0868287651',
  email: 'admin@techlaai.com',
  representative: 'NGUYỄN THẾ ĐỨC',
  position: 'Giám Đốc',
  bankAccount: '39156868',
  bankName: 'Ngân hàng Thương Mại Cổ phần Kỹ thương Việt Nam (Techcombank)',
  bankHolder: 'CONG TY TNHH TECHLA AI',
};

function numberToVietnameseWords(n: number): string {
  if (n === 0) return 'Không đồng';
  const ones = ['', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
  const units = ['', 'nghìn', 'triệu', 'tỷ'];

  function readBlock(num: number): string {
    const h = Math.floor(num / 100);
    const t = Math.floor((num % 100) / 10);
    const o = num % 10;
    let result = '';
    if (h > 0) result += ones[h] + ' trăm ';
    if (t > 1) result += ones[t] + ' mươi ';
    else if (t === 1) result += 'mười ';
    else if (t === 0 && h > 0 && o > 0) result += 'lẻ ';
    if (o === 5 && t > 0) result += 'lăm';
    else if (o === 1 && t > 1) result += 'mốt';
    else if (o > 0) result += ones[o];
    return result.trim();
  }

  const blocks: number[] = [];
  let temp = n;
  while (temp > 0) { blocks.push(temp % 1000); temp = Math.floor(temp / 1000); }
  let result = '';
  for (let i = blocks.length - 1; i >= 0; i--) {
    if (blocks[i] > 0) result += readBlock(blocks[i]) + ' ' + units[i] + ' ';
  }
  result = result.trim();
  return result.charAt(0).toUpperCase() + result.slice(1) + ' đồng';
}

export class InvoiceService {
  // ──── Get next invoice number ────
  private static async getNextInvoiceNumber(): Promise<number> {
    const year = new Date().getFullYear();
    const count = await prisma.invoice.count({
      where: { created_at: { gte: new Date(`${year}-01-01`), lt: new Date(`${year + 1}-01-01`) } },
    });
    return count + 1;
  }

  // ──── Xuất hoá đơn bán (APPROVED luôn + tạo công nợ) ────
  static async createFromOrder(orderId: string) {
    const order = await prisma.salesOrder.findUnique({
      where: { id: orderId },
      include: {
        customer: true,
        items: { include: { product: { select: { name: true, unit_of_sale: true } } } },
      },
    });
    if (!order) throw new AppError(t('order.notFound'), 404);

    // Check if already exists
    const existing = await prisma.invoice.findFirst({ where: { sales_order_id: orderId, status: { not: 'CANCELLED' } } });
    if (existing) return existing;

    const vatPct = order.vat_rate === 'VAT_0' ? 0 : order.vat_rate === 'VAT_8' ? 8 : 10;
    const unitMap: Record<string, string> = { PIECE: 'Cái', CARTON: 'Thùng', KG: 'Kg' };
    const cqtCode = Array.from({ length: 32 }, () => '0123456789ABCDEF'[Math.floor(Math.random() * 16)]).join('');

    const items = order.items.map((item) => ({
      name: item.product?.name || t('invoice.defaultProduct'),
      unit: unitMap[item.product?.unit_of_sale || 'PIECE'] || 'Cái',
      quantity: item.quantity,
      unitPrice: Number(item.unit_price),
      amount: Number(item.line_total),
    }));

    const total = Number(order.grand_total);
    const dueDate = new Date(order.order_date);
    dueDate.setDate(dueDate.getDate() + 30);

    // Create invoice as DRAFT (user phải duyệt thủ công)
    const invoice = await prisma.invoice.create({
      data: {
        sales_order_id: orderId,
        status: 'DRAFT',
        invoice_number: await this.getNextInvoiceNumber(),
        invoice_date: new Date(),
        cqt_code: cqtCode,
        seller_name: DEFAULT_SELLER.name,
        seller_tax_code: DEFAULT_SELLER.taxCode,
        seller_address: DEFAULT_SELLER.address,
        seller_phone: DEFAULT_SELLER.phone,
        seller_email: DEFAULT_SELLER.email,
        seller_rep: DEFAULT_SELLER.representative,
        seller_position: DEFAULT_SELLER.position,
        seller_bank: DEFAULT_SELLER.bankAccount,
        seller_bank_name: DEFAULT_SELLER.bankName,
        buyer_name: order.customer.contact_name || order.customer.company_name,
        buyer_company: order.customer.company_name,
        buyer_address: order.customer.address || '',
        buyer_tax_code: order.customer.tax_code || '',
        buyer_email: order.customer.email || '',
        items: items as any,
        subtotal: Number(order.subtotal),
        vat_rate: vatPct,
        vat_amount: Number(order.vat_amount),
        total,
        total_in_words: numberToVietnameseWords(Math.round(total)),
      },
    });

    await delCache('cache:/api/sales-orders*');
    logger.info(`Draft sales invoice created: #${invoice.invoice_number} for order ${order.order_code}`);
    return invoice;
  }

  // ──── List invoices ────
  static async list(filters: { status?: string; search?: string; from_date?: string; to_date?: string; page?: number; limit?: number; sales_order_id?: string; purchase_order_id?: string }) {
    const page = Number(filters.page) || 1;
    const limit = Number(filters.limit) || 20;

    const conditions: any[] = [];
    if (filters.status) conditions.push({ status: filters.status });
    if (filters.sales_order_id) conditions.push({ sales_order_id: filters.sales_order_id });
    if (filters.purchase_order_id) conditions.push({ purchase_order_id: filters.purchase_order_id });
    if (filters.search) {
      conditions.push({
        OR: [
          { invoice_number: { contains: filters.search, mode: 'insensitive' } },
          { buyer_company: { contains: filters.search, mode: 'insensitive' } },
          { buyer_name: { contains: filters.search, mode: 'insensitive' } },
          { buyer_tax_code: { contains: filters.search } },
          { sales_order: { order_code: { contains: filters.search, mode: 'insensitive' } } },
        ],
      });
    }
    if (filters.from_date || filters.to_date) {
      const dateFilter: any = {};
      if (filters.from_date) dateFilter.gte = new Date(filters.from_date);
      if (filters.to_date) dateFilter.lte = new Date(filters.to_date);
      conditions.push({ invoice_date: dateFilter });
    }
    const where = conditions.length > 0 ? { AND: conditions } : {};

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        include: { sales_order: { select: { order_code: true, customer: { select: { company_name: true } } } } },
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.invoice.count({ where }),
    ]);

    return { invoices, total, page, limit, total_pages: Math.ceil(total / limit) };
  }

  // ──── Get by ID ────
  static async getById(id: string) {
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: { sales_order: { select: { order_code: true, customer: { select: { company_name: true } } } } },
    });
    if (!invoice) throw new AppError(t('invoice.notFound'), 404);
    return invoice;
  }

  // ──── Update invoice (cho phép sửa nếu SO/PO chưa COMPLETED) ────
  static async updateInvoice(id: string, data: Record<string, unknown>) {
    const invoice = await prisma.invoice.findUnique({ where: { id } });
    if (!invoice) throw new AppError(t('invoice.notFound'), 404);
    if (invoice.status === 'CANCELLED') throw new AppError(t('invoice.cannotEditCancelled'), 400);

    // Check SO/PO not COMPLETED
    if (invoice.sales_order_id) {
      const so = await prisma.salesOrder.findUnique({ where: { id: invoice.sales_order_id }, select: { status: true } });
      if (so?.status === 'COMPLETED' || so?.status === 'CANCELLED') throw new AppError(t('invoice.orderLocked'), 400);
    }
    if (invoice.purchase_order_id) {
      const po = await prisma.purchaseOrder.findUnique({ where: { id: invoice.purchase_order_id }, select: { status: true } });
      if (po?.status === 'COMPLETED' || po?.status === 'CANCELLED') throw new AppError(t('invoice.orderLocked'), 400);
    }

    const updateData: any = { ...data };
    if (data.total) {
      updateData.total_in_words = numberToVietnameseWords(Math.round(Number(data.total)));
    }

    return prisma.invoice.update({ where: { id }, data: updateData });
  }

  // ──── Create purchase invoice from PO (auto-generate like sales invoice) ────
  static async createPurchaseInvoice(purchaseOrderId: string, fileUrl?: string, fileName?: string) {
    const po = await prisma.purchaseOrder.findUnique({
      where: { id: purchaseOrderId },
      include: {
        supplier: true,
        items: { include: { product: { select: { name: true, unit_of_sale: true } } } },
      },
    });
    if (!po) throw new AppError(t('order.purchaseNotFound'), 404);

    const existing = await prisma.invoice.findFirst({ where: { purchase_order_id: purchaseOrderId, type: 'PURCHASE', status: { not: 'CANCELLED' } } });
    if (existing) return existing;

    const unitMap: Record<string, string> = { PIECE: 'Cái', CARTON: 'Thùng', KG: 'Kg' };
    const cqtCode = Array.from({ length: 32 }, () => '0123456789ABCDEF'[Math.floor(Math.random() * 16)]).join('');

    const items = po.items.map((item) => ({
      name: item.product?.name || 'Sản phẩm',
      unit: unitMap[item.product?.unit_of_sale || 'PIECE'] || 'Cái',
      quantity: item.quantity,
      unitPrice: Number(item.unit_price),
      amount: Number(item.line_total),
    }));

    const subtotal = Number(po.total);
    const vatPct = 10;
    const vatAmount = Math.round(subtotal * vatPct / (100 + vatPct));
    const beforeVat = subtotal - vatAmount;

    const invoice = await prisma.invoice.create({
      data: {
        type: 'PURCHASE',
        purchase_order_id: purchaseOrderId,
        status: 'DRAFT',
        invoice_number: await this.getNextInvoiceNumber(),
        invoice_date: new Date(),
        cqt_code: cqtCode,
        seller_name: po.supplier.company_name,
        seller_tax_code: po.supplier.tax_code || '',
        seller_address: po.supplier.address || '',
        seller_phone: po.supplier.phone || '',
        seller_email: po.supplier.email || '',
        seller_rep: po.supplier.contact_name || '',
        seller_position: '',
        buyer_name: DEFAULT_SELLER.representative,
        buyer_company: DEFAULT_SELLER.name,
        buyer_address: DEFAULT_SELLER.address,
        buyer_tax_code: DEFAULT_SELLER.taxCode,
        buyer_email: DEFAULT_SELLER.email,
        buyer_payment: 'Chuyển khoản',
        items: items as any,
        subtotal: beforeVat,
        vat_rate: vatPct,
        vat_amount: vatAmount,
        total: subtotal,
        total_in_words: numberToVietnameseWords(Math.round(subtotal)),
        ...(fileUrl ? { file_url: fileUrl, file_name: fileName } : {}),
      },
    });

    await delCache('cache:/api/purchase-orders*');
    logger.info(`Draft purchase invoice created: #${invoice.invoice_number} for PO ${po.order_code}`);
    return invoice;
  }

  // ──── Approve invoice (finalize) → tạo công nợ + update SO/PO status ────
  static async finalize(id: string) {
    const invoice = await prisma.invoice.findUnique({ where: { id } });
    if (!invoice) throw new AppError(t('invoice.notFound'), 404);
    if (invoice.status !== 'DRAFT') throw new AppError(t('invoice.onlyFinalizeDraft'), 400);

    const updated = await prisma.invoice.update({ where: { id }, data: { status: 'APPROVED' } });
    const total = Number(invoice.total);
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30);

    // HĐ bán → tạo công nợ phải thu + SO → INVOICED
    if (invoice.type === 'SALES' && invoice.sales_order_id) {
      const so = await prisma.salesOrder.findUnique({ where: { id: invoice.sales_order_id }, select: { customer_id: true, order_code: true } });
      if (so) {
        // Tạo receivable
        await prisma.receivable.create({
          data: {
            customer_id: so.customer_id,
            sales_order_id: invoice.sales_order_id,
            invoice_number: `INV-${invoice.invoice_number}`,
            invoice_date: new Date(),
            due_date: dueDate,
            original_amount: total,
            paid_amount: 0,
            remaining: total,
            status: 'UNPAID',
          },
        });
        logger.info(`Invoice #${invoice.invoice_number} approved → receivable created for SO ${so.order_code}`);
      }
    }

    // HĐ mua → tạo công nợ phải trả + PO → INVOICED
    if (invoice.type === 'PURCHASE' && invoice.purchase_order_id) {
      const po = await prisma.purchaseOrder.findUnique({ where: { id: invoice.purchase_order_id }, select: { supplier_id: true, order_code: true } });
      if (po) {
        // Tạo payable
        await prisma.payable.create({
          data: {
            supplier_id: po.supplier_id,
            purchase_order_id: invoice.purchase_order_id,
            invoice_number: `PI-${invoice.invoice_number}`,
            invoice_date: new Date(),
            due_date: dueDate,
            original_amount: total,
            paid_amount: 0,
            remaining: total,
            status: 'UNPAID',
          },
        });
        logger.info(`Invoice #${invoice.invoice_number} approved → payable created for PO ${po.order_code}`);
      }
    }

    // Create alert for invoice approval
    AlertService.createAlert({
      type: 'WARNING',
      title: t('alert.invoiceApproved', { number: invoice.invoice_number }),
      message: t('alert.invoiceApproved', { number: invoice.invoice_number }),
    }).catch((err) => logger.warn(`Alert creation failed: ${err.message}`));

    await delCache('cache:/api/sales-orders*', 'cache:/api/purchase-orders*', 'cache:/api/receivables*', 'cache:/api/payables*', 'cache:/api/dashboard*');
    return updated;
  }

  // ──── Cancel invoice ────
  static async cancel(id: string) {
    const invoice = await prisma.invoice.findUnique({ where: { id } });
    if (!invoice) throw new AppError(t('invoice.notFound'), 404);

    return prisma.invoice.update({ where: { id }, data: { status: 'CANCELLED' } });
  }

  // ──── Generate PDF preview ────
  static async generatePdf(id: string): Promise<Buffer> {
    const invoice = await prisma.invoice.findUnique({ where: { id } });
    if (!invoice) throw new AppError(t('invoice.notFound'), 404);

    const invoiceData: InvoiceData = {
      serial: invoice.serial,
      number: invoice.invoice_number,
      date: `Ngày (date) ${dayjs(invoice.invoice_date).format('DD')} tháng (month) ${dayjs(invoice.invoice_date).format('MM')} năm (year) ${dayjs(invoice.invoice_date).format('YYYY')}`,
      cqtCode: invoice.cqt_code || undefined,
      seller: {
        name: invoice.seller_name || '',
        taxCode: invoice.seller_tax_code || '',
        address: invoice.seller_address || '',
        phone: invoice.seller_phone || '',
        email: invoice.seller_email || '',
        representative: invoice.seller_rep || '',
        position: invoice.seller_position || '',
      },
      buyer: {
        contactName: invoice.buyer_name || '',
        companyName: invoice.buyer_company || '',
        address: invoice.buyer_address || '',
        taxCode: invoice.buyer_tax_code || '',
        paymentMethod: invoice.buyer_payment || 'Chuyển khoản',
        email: invoice.buyer_email || '',
      },
      items: (invoice.items as any[]) || [],
      subtotal: Number(invoice.subtotal || 0),
      vatRate: invoice.vat_rate,
      vatAmount: Number(invoice.vat_amount),
      total: Number(invoice.total),
      totalInWords: invoice.total_in_words || numberToVietnameseWords(Math.round(Number(invoice.total))),
    };

    const html = buildInvoiceHtml(invoiceData);
    const isDraft = invoice.status === 'DRAFT';

    // Add DRAFT watermark
    const finalHtml = isDraft
      ? html.replace('</body>', `<div style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-30deg);font-size:120px;color:rgba(255,0,0,0.08);font-weight:bold;pointer-events:none;z-index:9999;">NHÁP</div></body>`)
      : html;

    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    try {
      const page = await browser.newPage();
      await page.setContent(finalHtml, { waitUntil: 'networkidle0' });
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '0', right: '0', bottom: '0', left: '0' },
      });
      return Buffer.from(pdf);
    } finally {
      await browser.close();
    }
  }
}
