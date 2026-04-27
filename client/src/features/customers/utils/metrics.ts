import dayjs from 'dayjs';

export interface CustomerFinancialStats {
  totalRevenue: number;
  totalPaid: number;
  totalRemaining: number;
  overdueCount: number;
  overdueAmount: number;
  inTermAmount: number;
  avgOrderValue: number;
  paymentRatePct: number;
  avgAgeDays: number;
  firstOrderDate: string | null;
  lastOrderDate: string | null;
  worstOverdueInvoice: { invoiceNumber: string; amount: number; daysLate: number } | null;
}

export function computeCustomerStats(orders: any[], receivables: any[]): CustomerFinancialStats {
  const validOrders = orders.filter((o) => o.status !== 'CANCELLED');
  const totalRevenue = validOrders.reduce((s, o) => s + Number(o.grand_total || 0), 0);
  const totalPaid = receivables.reduce((s, r) => s + Number(r.paid_amount || 0), 0);
  const totalRemaining = receivables.reduce((s, r) => s + Number(r.remaining || 0), 0);

  const overdue = receivables.filter((r) => r.status === 'OVERDUE');
  const overdueAmount = overdue.reduce((s, r) => s + Number(r.remaining || 0), 0);
  const inTermAmount = totalRemaining - overdueAmount;

  const orderDates = validOrders.map((o) => o.order_date).filter(Boolean).sort();
  const firstOrderDate = orderDates[0] ?? null;
  const lastOrderDate = orderDates[orderDates.length - 1] ?? null;

  const today = dayjs();
  const ages = receivables
    .filter((r) => Number(r.remaining) > 0 && r.invoice_date)
    .map((r) => today.diff(dayjs(r.invoice_date), 'day'));
  const avgAgeDays = ages.length ? Math.round(ages.reduce((a, b) => a + b, 0) / ages.length) : 0;

  let worstOverdueInvoice: CustomerFinancialStats['worstOverdueInvoice'] = null;
  for (const r of overdue) {
    if (!r.due_date) continue;
    const daysLate = today.diff(dayjs(r.due_date), 'day');
    if (!worstOverdueInvoice || daysLate > worstOverdueInvoice.daysLate) {
      worstOverdueInvoice = {
        invoiceNumber: r.invoice_number || `REC-${String(r.id).slice(0, 6)}`,
        amount: Number(r.remaining || 0),
        daysLate,
      };
    }
  }

  return {
    totalRevenue,
    totalPaid,
    totalRemaining,
    overdueCount: overdue.length,
    overdueAmount,
    inTermAmount,
    avgOrderValue: validOrders.length ? totalRevenue / validOrders.length : 0,
    paymentRatePct: totalRevenue > 0 ? Math.round((totalPaid / totalRevenue) * 1000) / 10 : 0,
    avgAgeDays,
    firstOrderDate,
    lastOrderDate,
    worstOverdueInvoice,
  };
}

export function formatVNDShort(n: number): { value: string; unit: string } {
  if (n >= 1_000_000_000) return { value: (n / 1_000_000_000).toFixed(2).replace(/\.?0+$/, ''), unit: 'tỷ ₫' };
  if (n >= 1_000_000) return { value: (n / 1_000_000).toFixed(2).replace(/\.?0+$/, ''), unit: 'triệu ₫' };
  if (n >= 1_000) return { value: (n / 1_000).toFixed(1).replace(/\.0$/, ''), unit: 'k ₫' };
  return { value: String(Math.round(n)), unit: '₫' };
}

export function getInitials(name: string): string {
  return name.split(/\s+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase() || '?';
}

export function daysBetween(from: string | Date, to: string | Date): number {
  return dayjs(to).diff(dayjs(from), 'day');
}
