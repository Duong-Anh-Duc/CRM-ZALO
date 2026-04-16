import prisma from '../../lib/prisma';
import dayjs from 'dayjs';

export class ReportService {
  static async getPnlReport(fromDate: string, toDate: string) {
    const from = new Date(fromDate);
    const to = new Date(toDate);

    const [salesOrders, purchaseOrders, expenses] = await Promise.all([
      prisma.salesOrder.findMany({
        where: { order_date: { gte: from, lte: to }, status: { not: 'CANCELLED' } },
        select: { grand_total: true },
      }),
      prisma.purchaseOrder.findMany({
        where: { order_date: { gte: from, lte: to }, status: { not: 'CANCELLED' } },
        select: { total: true },
      }),
      prisma.cashTransaction.findMany({
        where: { date: { gte: from, lte: to }, type: 'EXPENSE' },
        select: { amount: true },
      }),
    ]);

    const revenue = salesOrders.reduce((sum, o) => sum + o.grand_total, 0);
    const cogs = purchaseOrders.reduce((sum, o) => sum + o.total, 0);
    const opex = expenses.reduce((sum, c) => sum + c.amount, 0);
    const grossProfit = revenue - cogs;
    const netProfit = grossProfit - opex;

    return { revenue, cogs, gross_profit: grossProfit, operating_costs: opex, net_profit: netProfit };
  }

  static async getDebtAgingReport() {
    const now = dayjs();

    const receivables = await prisma.receivable.findMany({
      where: { status: { in: ['UNPAID', 'PARTIAL', 'OVERDUE'] } },
      include: { customer: { select: { company_name: true } } },
    });

    const payables = await prisma.payable.findMany({
      where: { status: { in: ['UNPAID', 'PARTIAL', 'OVERDUE'] } },
      include: { supplier: { select: { company_name: true } } },
    });

    const bucketize = (dueDate: Date): string => {
      const diff = now.diff(dayjs(dueDate), 'day');
      if (diff <= 0) return 'current';
      if (diff <= 30) return '1_30';
      if (diff <= 60) return '31_60';
      return '60_plus';
    };

    const receivableBuckets = { current: 0, '1_30': 0, '31_60': 0, '60_plus': 0 };
    const payableBuckets = { current: 0, '1_30': 0, '31_60': 0, '60_plus': 0 };

    receivables.forEach((r) => {
      receivableBuckets[bucketize(r.due_date) as keyof typeof receivableBuckets] += r.remaining;
    });

    payables.forEach((p) => {
      payableBuckets[bucketize(p.due_date) as keyof typeof payableBuckets] += p.remaining;
    });

    return {
      receivables: { buckets: receivableBuckets, details: receivables },
      payables: { buckets: payableBuckets, details: payables },
    };
  }

  static async getProductSalesReport(fromDate: string, toDate: string) {
    const items = await prisma.salesOrderItem.findMany({
      where: {
        sales_order: {
          order_date: { gte: new Date(fromDate), lte: new Date(toDate) },
          status: { not: 'CANCELLED' },
        },
        product_id: { not: null },
      },
      include: { product: { select: { id: true, sku: true, name: true } } },
    });

    const grouped = new Map<string, { sku: string; name: string; qty: number; revenue: number }>();
    items.forEach((item) => {
      if (!item.product_id || !item.product) return;
      const existing = grouped.get(item.product_id);
      if (existing) {
        existing.qty += item.quantity;
        existing.revenue += item.line_total;
      } else {
        grouped.set(item.product_id, {
          sku: item.product.sku,
          name: item.product.name,
          qty: item.quantity,
          revenue: item.line_total,
        });
      }
    });

    return Array.from(grouped.values()).sort((a, b) => b.revenue - a.revenue);
  }
}
