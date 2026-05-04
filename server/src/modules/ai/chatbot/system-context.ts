import dayjs from 'dayjs';
import prisma from '../../../lib/prisma';

let cachedContext: string | null = null;
let cacheTime = 0;
const CACHE_TTL = 60_000;

export function invalidateSystemContext(): void {
  cachedContext = null;
  cacheTime = 0;
}

export async function getSystemContext(): Promise<string> {
  if (cachedContext && Date.now() - cacheTime < CACHE_TTL) return cachedContext;

  const now = dayjs();
  const [
    productCount, customerCount, supplierCount,
    soStats, poStats,
    recSummary, paySummary,
    cashIncome, cashExpense,
    overdueRec, overduePay,
  ] = await Promise.all([
    prisma.product.count({ where: { is_active: true } }),
    prisma.customer.count({ where: { is_active: true } }),
    prisma.supplier.count({ where: { is_active: true } }),
    prisma.salesOrder.groupBy({ by: ['status'], _count: true }),
    prisma.purchaseOrder.groupBy({ by: ['status'], _count: true }),
    prisma.receivable.aggregate({
      where: { status: { in: ['UNPAID', 'PARTIAL', 'OVERDUE'] } },
      _sum: { remaining: true, original_amount: true, paid_amount: true },
      _count: true,
    }),
    prisma.payable.aggregate({
      where: { status: { in: ['UNPAID', 'PARTIAL', 'OVERDUE'] } },
      _sum: { remaining: true, original_amount: true, paid_amount: true },
      _count: true,
    }),
    prisma.cashTransaction.aggregate({ where: { type: 'INCOME' }, _sum: { amount: true } }),
    prisma.cashTransaction.aggregate({ where: { type: 'EXPENSE' }, _sum: { amount: true } }),
    prisma.receivable.count({ where: { status: 'OVERDUE' } }),
    prisma.payable.count({ where: { status: 'OVERDUE' } }),
  ]);

  const { AiTrainingService } = await import('../ai-training.service');
  const trainingContext = await AiTrainingService.buildTrainingContext().catch(() => '');

  cachedContext = `
=== DỮ LIỆU PACKFLOW CRM (${now.format('DD/MM/YYYY HH:mm')}) ===
Sản phẩm: ${productCount} | Khách hàng: ${customerCount} | NCC: ${supplierCount}
Đơn bán: ${soStats.map((s) => `${s.status}: ${s._count}`).join(', ')}
Đơn mua: ${poStats.map((s) => `${s.status}: ${s._count}`).join(', ')}
Phải thu: ${recSummary._count} HĐ, gốc ${Number(recSummary._sum.original_amount || 0).toLocaleString()}, còn ${Number(recSummary._sum.remaining || 0).toLocaleString()} VND (${overdueRec} quá hạn)
Phải trả: ${paySummary._count} HĐ, gốc ${Number(paySummary._sum.original_amount || 0).toLocaleString()}, còn ${Number(paySummary._sum.remaining || 0).toLocaleString()} VND (${overduePay} quá hạn)
Sổ quỹ: Thu ${Number(cashIncome._sum.amount || 0).toLocaleString()}, Chi ${Number(cashExpense._sum.amount || 0).toLocaleString()}, Dư ${(Number(cashIncome._sum.amount || 0) - Number(cashExpense._sum.amount || 0)).toLocaleString()} VND${trainingContext ? `\n\n${trainingContext}` : ''}
`.trim();
  cacheTime = Date.now();
  return cachedContext;
}
