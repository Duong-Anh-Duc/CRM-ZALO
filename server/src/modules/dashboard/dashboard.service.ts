import prisma from '../../lib/prisma';
import dayjs from 'dayjs';

export class DashboardService {
  static async getOverview() {
    const now = dayjs();
    const sixMonthsAgo = now.subtract(6, 'month').startOf('month').toDate();

    const [
      receivableSummary,
      payableSummary,
      topCustomers,
      topProducts,
      ordersByStatus,
      upcomingDeliveries,
      revenueTrend,
    ] = await Promise.all([
      this.getReceivableSummary(),
      this.getPayableSummary(),
      this.getTopCustomers(),
      this.getTopProducts(),
      this.getOrdersByStatus(),
      this.getUpcomingDeliveries(),
      this.getRevenueTrend(sixMonthsAgo),
    ]);

    return {
      receivable: receivableSummary,
      payable: payableSummary,
      top_customers: topCustomers,
      top_products: topProducts,
      orders_by_status: ordersByStatus,
      upcoming_deliveries: upcomingDeliveries,
      revenue_trend: revenueTrend,
    };
  }

  private static async getReceivableSummary() {
    const [total, overdue] = await Promise.all([
      prisma.receivable.aggregate({
        where: { status: { in: ['UNPAID', 'PARTIAL', 'OVERDUE'] } },
        _sum: { remaining: true },
        _count: true,
      }),
      prisma.receivable.aggregate({
        where: { status: 'OVERDUE' },
        _sum: { remaining: true },
        _count: true,
      }),
    ]);
    return {
      total_amount: total._sum.remaining || 0,
      total_count: total._count,
      overdue_amount: overdue._sum.remaining || 0,
      overdue_count: overdue._count,
    };
  }

  private static async getPayableSummary() {
    const [total, overdue] = await Promise.all([
      prisma.payable.aggregate({
        where: { status: { in: ['UNPAID', 'PARTIAL', 'OVERDUE'] } },
        _sum: { remaining: true },
        _count: true,
      }),
      prisma.payable.aggregate({
        where: { status: 'OVERDUE' },
        _sum: { remaining: true },
        _count: true,
      }),
    ]);
    return {
      total_amount: total._sum.remaining || 0,
      total_count: total._count,
      overdue_amount: overdue._sum.remaining || 0,
      overdue_count: overdue._count,
    };
  }

  private static async getTopCustomers() {
    const startOfMonth = dayjs().startOf('month').toDate();
    const orders = await prisma.salesOrder.findMany({
      where: { order_date: { gte: startOfMonth }, status: { not: 'CANCELLED' } },
      select: { customer_id: true, grand_total: true, customer: { select: { company_name: true } } },
    });

    const grouped = new Map<string, { name: string; revenue: number }>();
    orders.forEach((o) => {
      const existing = grouped.get(o.customer_id);
      if (existing) {
        existing.revenue += o.grand_total;
      } else {
        grouped.set(o.customer_id, { name: o.customer.company_name, revenue: o.grand_total });
      }
    });

    return Array.from(grouped.entries())
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }

  private static async getTopProducts() {
    const startOfMonth = dayjs().startOf('month').toDate();
    const items = await prisma.salesOrderItem.findMany({
      where: {
        sales_order: { order_date: { gte: startOfMonth }, status: { not: 'CANCELLED' } },
        product_id: { not: null },
      },
      select: { product_id: true, quantity: true, line_total: true, product: { select: { name: true } } },
    });

    const grouped = new Map<string, { name: string; qty: number; revenue: number }>();
    items.forEach((i) => {
      if (!i.product_id) return;
      const existing = grouped.get(i.product_id);
      if (existing) {
        existing.qty += i.quantity;
        existing.revenue += i.line_total;
      } else {
        grouped.set(i.product_id, { name: i.product?.name || '', qty: i.quantity, revenue: i.line_total });
      }
    });

    return Array.from(grouped.entries())
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }

  private static async getOrdersByStatus() {
    const statuses = ['NEW', 'CONFIRMED', 'PREPARING', 'SHIPPING', 'COMPLETED', 'CANCELLED'] as const;
    const counts = await Promise.all(
      statuses.map(async (status) => ({
        status,
        count: await prisma.salesOrder.count({ where: { status } }),
      }))
    );
    return counts;
  }

  private static async getUpcomingDeliveries() {
    const nextWeek = dayjs().add(7, 'day').toDate();
    return prisma.purchaseOrder.findMany({
      where: {
        expected_delivery: { gte: new Date(), lte: nextWeek },
        status: { in: ['CONFIRMED', 'PROCESSING', 'SHIPPING'] },
      },
      include: { supplier: { select: { company_name: true } } },
      orderBy: { expected_delivery: 'asc' },
      take: 10,
    });
  }

  private static async getRevenueTrend(since: Date) {
    const orders = await prisma.salesOrder.findMany({
      where: { order_date: { gte: since }, status: { not: 'CANCELLED' } },
      select: { order_date: true, grand_total: true },
    });

    const costs = await prisma.operatingCost.findMany({
      where: { date: { gte: since } },
      select: { date: true, amount: true },
    });

    const months: Record<string, { revenue: number; cost: number }> = {};
    orders.forEach((o) => {
      const key = dayjs(o.order_date).format('YYYY-MM');
      if (!months[key]) months[key] = { revenue: 0, cost: 0 };
      months[key].revenue += o.grand_total;
    });
    costs.forEach((c) => {
      const key = dayjs(c.date).format('YYYY-MM');
      if (!months[key]) months[key] = { revenue: 0, cost: 0 };
      months[key].cost += c.amount;
    });

    return Object.entries(months)
      .map(([month, data]) => ({ month, ...data, profit: data.revenue - data.cost }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }
}
