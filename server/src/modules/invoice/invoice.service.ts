import puppeteer from 'puppeteer';
import prisma from '../../lib/prisma';
import { AppError } from '../../middleware/error.middleware';
import { buildInvoiceHtml } from './invoice-template';
import type { InvoiceData } from './invoice-template';
import dayjs from 'dayjs';
import logger from '../../utils/logger';

// Default seller info - TECHLA AI
const DEFAULT_SELLER = {
  name: 'C\u00D4NG TY TNHH TECHLA AI',
  taxCode: '0111293827',
  address: 'T\u1EA7ng 8, To\u00E0 nh\u00E0 Licogi, s\u1ED1 164 Khu\u1EA5t Duy Ti\u1EBFn, Ph\u01B0\u1EDDng Thanh Xu\u00E2n, Th\u00E0nh ph\u1ED1 H\u00E0 N\u1ED9i, Vi\u1EC7t Nam',
  phone: '0868287651',
  email: 'admin@techlaai.com',
  representative: 'NGUY\u1EC4N TH\u1EBE \u0110\u1EE8C',
  position: 'Gi\u00E1m \u0110\u1ED1c',
  bankAccount: '39156868',
  bankName: 'Ng\u00E2n h\u00E0ng Th\u01B0\u01A1ng M\u1EA1i C\u1ED5 ph\u1EA7n K\u1EF9 th\u01B0\u01A1ng Vi\u1EC7t Nam (Techcombank)',
  bankHolder: 'CONG TY TNHH TECHLA AI',
};

function numberToVietnameseWords(n: number): string {
  if (n === 0) return 'Kh\u00F4ng \u0111\u1ED3ng';

  const ones = ['', 'm\u1ED9t', 'hai', 'ba', 'b\u1ED1n', 'n\u0103m', 's\u00E1u', 'b\u1EA3y', 't\u00E1m', 'ch\u00EDn'];
  const units = ['', 'ngh\u00ECn', 'tri\u1EC7u', 't\u1EF7'];

  function readBlock(num: number): string {
    const h = Math.floor(num / 100);
    const t = Math.floor((num % 100) / 10);
    const o = num % 10;
    let result = '';

    if (h > 0) result += ones[h] + ' tr\u0103m ';
    if (t > 1) result += ones[t] + ' m\u01B0\u01A1i ';
    else if (t === 1) result += 'm\u01B0\u1EDDi ';
    else if (t === 0 && h > 0 && o > 0) result += 'l\u1EBB ';

    if (o === 5 && t > 0) result += 'l\u0103m';
    else if (o === 1 && t > 1) result += 'm\u1ED1t';
    else if (o > 0) result += ones[o];

    return result.trim();
  }

  const blocks: number[] = [];
  let temp = n;
  while (temp > 0) {
    blocks.push(temp % 1000);
    temp = Math.floor(temp / 1000);
  }

  let result = '';
  for (let i = blocks.length - 1; i >= 0; i--) {
    if (blocks[i] > 0) {
      result += readBlock(blocks[i]) + ' ' + units[i] + ' ';
    }
  }

  result = result.trim();
  return result.charAt(0).toUpperCase() + result.slice(1) + ' \u0111\u1ED3ng';
}

export class InvoiceService {
  static async generateFromOrder(orderId: string): Promise<Buffer> {
    const order = await prisma.salesOrder.findUnique({
      where: { id: orderId },
      include: {
        customer: true,
        items: {
          include: { product: { select: { name: true, unit_of_sale: true } } },
        },
      },
    });

    if (!order) throw new AppError('Order not found', 404);

    const vatPct = order.vat_rate === 'VAT_0' ? 0 : order.vat_rate === 'VAT_8' ? 8 : 10;
    const subtotal = Number(order.subtotal);
    const vatAmount = Number(order.vat_amount);
    const total = Number(order.grand_total);

    // Generate random CQT code
    const cqtCode = Array.from({ length: 32 }, () => '0123456789ABCDEF'[Math.floor(Math.random() * 16)]).join('');

    const invoiceData: InvoiceData = {
      serial: '1C26PKF',
      number: await this.getNextInvoiceNumber(),
      date: `Ng\u00E0y (date) ${dayjs(order.order_date).format('DD')} th\u00E1ng (month) ${dayjs(order.order_date).format('MM')} n\u0103m (year) ${dayjs(order.order_date).format('YYYY')}`,
      cqtCode,
      seller: DEFAULT_SELLER,
      buyer: {
        contactName: order.customer.contact_name || '',
        companyName: order.customer.company_name,
        address: order.customer.address || '',
        taxCode: order.customer.tax_code || '',
        paymentMethod: 'Ti\u1EC1n m\u1EB7t/Chuy\u1EC3n kho\u1EA3n',
        email: order.customer.email || '',
      },
      items: order.items.map((item) => {
        const unitMap: Record<string, string> = { PIECE: 'C\u00E1i', CARTON: 'Th\u00F9ng', KG: 'Kg' };
        return {
          name: item.product?.name || 'S\u1EA3n ph\u1EA9m',
          unit: unitMap[item.product?.unit_of_sale || 'PIECE'] || 'Cai',
          quantity: item.quantity,
          unitPrice: Number(item.unit_price),
          amount: Number(item.line_total),
        };
      }),
      subtotal,
      vatRate: vatPct,
      vatAmount,
      total,
      totalInWords: numberToVietnameseWords(Math.round(total)),
    };

    const html = buildInvoiceHtml(invoiceData);

    // Generate PDF
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
        margin: { top: '0', right: '0', bottom: '0', left: '0' },
      });
      logger.info(`Invoice generated for order ${order.order_code}`);
      return Buffer.from(pdf);
    } finally {
      await browser.close();
    }
  }

  private static async getNextInvoiceNumber(): Promise<number> {
    // Simple: count orders this year + 1
    const year = new Date().getFullYear();
    const count = await prisma.salesOrder.count({
      where: {
        order_date: {
          gte: new Date(`${year}-01-01`),
          lt: new Date(`${year + 1}-01-01`),
        },
      },
    });
    return count + 1;
  }
}
