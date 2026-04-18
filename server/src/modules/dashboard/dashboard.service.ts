import prisma from '../../lib/prisma';
import dayjs from 'dayjs';
import { getAgingBuckets } from './dashboard.helpers';

interface OverviewParams {
  from_date?: string;
  to_date?: string;
}

export class DashboardService {
  static async getOverview(params: OverviewParams = {}) {
    const now = dayjs();
    const fromDate = params.from_date
      ? dayjs(params.from_date).startOf('day').toDate()
      : now.subtract(6, 'month').startOf('month').toDate();
    const toDate = params.to_date
      ? dayjs(params.to_date).endOf('day').toDate()
      : now.endOf('day').toDate();

    const [
      receivableSummary,
      payableSummary,
      topCustomers,
      topProducts,
      ordersByStatus,
      upcomingDeliveries,
      revenueTrend,
      cashBookSummary,
      receivableAging,
      payableAging,
      recentOrders,
      returnsSummary,
      payrollSummary,
      cashFlowByMonth,
      orderTrend,
      expenseByCategory,
    ] = await Promise.all([
      this.getReceivableSummary(),
      this.getPayableSummary(),
      this.getTopCustomers(),
      this.getTopProducts(),
      this.getOrdersByStatus(),
      this.getUpcomingDeliveries(),
      this.getRevenueTrend(fromDate, toDate),
      this.getCashBookSummary(),
      getAgingBuckets('receivable'),
      getAgingBuckets('payable'),
      this.getRecentOrders(),
      this.getReturnsSummary(),
      this.getPayrollSummary(),
      this.getCashFlowByMonth(fromDate, toDate),
      this.getOrderTrend(fromDate, toDate),
      this.getExpenseByCategory(fromDate, toDate),
    ]);

    return {
      receivable: receivableSummary,
      payable: payableSummary,
      top_customers: topCustomers,
      top_products: topProducts,
      orders_by_status: ordersByStatus,
      upcoming_deliveries: upcomingDeliveries,
      revenue_trend: revenueTrend,
      cash_book: cashBookSummary,
      receivable_aging: receivableAging,
      payable_aging: payableAging,
      recent_orders: recentOrders,
      returns_summary: returnsSummary,
      payroll_summary: payrollSummary,
      cash_flow: cashFlowByMonth,
      order_trend: orderTrend,
      expense_by_category: expenseByCategory,
    };
  }

  // ─── Expense grouped by category ─────────────────────
  private static async getExpenseByCategory(fromDate: Date, toDate: Date) {
    const transactions = await prisma.cashTransaction.findMany({
      where: { type: 'EXPENSE', date: { gte: fromDate, lte: toDate } },
      include: { category: { select: { name: true } } },
    });
    const map = new Map<string, number>();
    for (const tx of transactions) {
      const name = tx.category?.name || 'Khác';
      map.set(name, (map.get(name) || 0) + Number(tx.amount));
    }
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
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
      select: {
        customer_id: true,
        grand_total: true,
        customer: { select: { company_name: true, contact_name: true } },
      },
    });

    const grouped = new Map<string, { name: string; revenue: number }>();
    orders.forEach((o) => {
      const existing = grouped.get(o.customer_id);
      if (existing) {
        existing.revenue += o.grand_total;
      } else {
        grouped.set(o.customer_id, {
          name: o.customer.company_name || o.customer.contact_name || '',
          revenue: o.grand_total,
        });
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
    const statuses = ['DRAFT', 'CONFIRMED', 'INVOICED', 'COMPLETED', 'CANCELLED'] as const;
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
        status: { in: ['CONFIRMED', 'SHIPPING'] },
      },
      include: { supplier: { select: { company_name: true } } },
      orderBy: { expected_delivery: 'asc' },
      take: 10,
    });
  }

  private static async getRevenueTrend(since: Date, until: Date) {
    const orders = await prisma.salesOrder.findMany({
      where: { order_date: { gte: since, lte: until }, status: { not: 'CANCELLED' } },
      select: { order_date: true, grand_total: true },
    });

    const costs = await prisma.cashTransaction.findMany({
      where: { date: { gte: since, lte: until }, type: 'EXPENSE' },
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

  // ─── NEW: Cash book summary ──────────────────────────
  private static async getCashBookSummary() {
    const [income, expense] = await Promise.all([
      prisma.cashTransaction.aggregate({
        where: { type: 'INCOME' },
        _sum: { amount: true },
      }),
      prisma.cashTransaction.aggregate({
        where: { type: 'EXPENSE' },
        _sum: { amount: true },
      }),
    ]);
    const totalIncome = income._sum.amount || 0;
    const totalExpense = expense._sum.amount || 0;
    return {
      total_income: totalIncome,
      total_expense: totalExpense,
      balance: totalIncome - totalExpense,
    };
  }

  // ─── NEW: Recent orders ──────────────────────────────
  private static async getRecentOrders() {
    return prisma.salesOrder.findMany({
      orderBy: { order_date: 'desc' },
      take: 10,
      select: {
        id: true,
        order_code: true,
        grand_total: true,
        status: true,
        order_date: true,
        customer: { select: { company_name: true, contact_name: true } },
      },
    });
  }

  // ─── NEW: Returns summary ────────────────────────────
  private static async getReturnsSummary() {
    const returnStatuses = ['PENDING', 'APPROVED', 'RECEIVING', 'SHIPPING', 'COMPLETED', 'REJECTED', 'CANCELLED'] as const;

    const [salesReturnCounts, purchaseReturnCounts] = await Promise.all([
      Promise.all(
        returnStatuses.map(async (status) => ({
          status,
          count: await prisma.salesReturn.count({ where: { status } }),
        }))
      ),
      Promise.all(
        returnStatuses.map(async (status) => ({
          status,
          count: await prisma.purchaseReturn.count({ where: { status } }),
        }))
      ),
    ]);

    return {
      sales_returns: salesReturnCounts.filter((s) => s.count > 0),
      purchase_returns: purchaseReturnCounts.filter((s) => s.count > 0),
    };
  }

  // ─── NEW: Payroll summary ────────────────────────────
  private static async getPayrollSummary() {
    const latestPeriod = await prisma.payrollPeriod.findFirst({
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
      include: {
        records: {
          select: { gross_salary: true, total_insurance_employee: true, total_insurance_employer: true, pit: true, net_salary: true },
        },
      },
    });

    if (!latestPeriod) return null;

    return {
      year: latestPeriod.year,
      month: latestPeriod.month,
      status: latestPeriod.status,
      total_gross: latestPeriod.records.reduce((sum, r) => sum + r.gross_salary, 0),
      total_ins_employee: latestPeriod.records.reduce((sum, r) => sum + r.total_insurance_employee, 0),
      total_ins_employer: latestPeriod.records.reduce((sum, r) => sum + r.total_insurance_employer, 0),
      total_pit: latestPeriod.records.reduce((sum, r) => sum + r.pit, 0),
      total_net: latestPeriod.records.reduce((sum, r) => sum + r.net_salary, 0),
      employee_count: latestPeriod.records.length,
    };
  }

  // ─── NEW: Cash flow by month ─────────────────────────
  private static async getCashFlowByMonth(since: Date, until: Date) {
    const transactions = await prisma.cashTransaction.findMany({
      where: { date: { gte: since, lte: until } },
      select: { type: true, date: true, amount: true },
    });

    const months: Record<string, { income_total: number; expense_total: number }> = {};
    transactions.forEach((t) => {
      const key = dayjs(t.date).format('YYYY-MM');
      if (!months[key]) months[key] = { income_total: 0, expense_total: 0 };
      if (t.type === 'INCOME') {
        months[key].income_total += t.amount;
      } else {
        months[key].expense_total += t.amount;
      }
    });

    return Object.entries(months)
      .map(([month, data]) => ({ month, ...data }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }

  // ─── NEW: Order trend ────────────────────────────────
  private static async getOrderTrend(since: Date, until: Date) {
    const orders = await prisma.salesOrder.findMany({
      where: { order_date: { gte: since, lte: until } },
      select: { order_date: true },
    });

    const months: Record<string, number> = {};
    orders.forEach((o) => {
      const key = dayjs(o.order_date).format('YYYY-MM');
      months[key] = (months[key] || 0) + 1;
    });

    return Object.entries(months)
      .map(([month, count]) => ({ month, count }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }
}
