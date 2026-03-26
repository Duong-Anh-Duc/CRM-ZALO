import prisma from '../../lib/prisma';
import { AppError } from '../../middleware/error.middleware';
import { DebtStatus, PaymentMethod } from '@prisma/client';
import { t } from '../../locales';
import { delCache } from '../../lib/redis';

interface RecordPaymentInput {
  receivable_id: string;
  amount: number;
  payment_date?: string;
  method: PaymentMethod;
  reference?: string;
}

export class ReceivableService {
  static async list(filters: { page?: number; limit?: number; status?: DebtStatus; customer_id?: string; customer_search?: string; from_date?: string; to_date?: string }) {
    const page = Number(filters.page) || 1;
    const limit = Number(filters.limit) || 20;
    const { status, customer_id, customer_search, from_date, to_date } = filters;

    const where = {
      ...(status && { status }),
      ...(customer_id && { customer_id }),
      ...(customer_search && {
        customer: { company_name: { contains: customer_search, mode: 'insensitive' as const } },
      }),
      ...(from_date || to_date ? {
        invoice_date: {
          ...(from_date && { gte: new Date(from_date) }),
          ...(to_date && { lte: new Date(to_date) }),
        },
      } : {}),
    };

    const [receivables, total] = await Promise.all([
      prisma.receivable.findMany({
        where,
        include: {
          customer: { select: { id: true, company_name: true } },
          sales_order: { select: { id: true, order_code: true } },
          payments: { orderBy: { payment_date: 'desc' } },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
      prisma.receivable.count({ where }),
    ]);

    return { receivables, total, page, limit, total_pages: Math.ceil(total / limit) };
  }

  static async getSummary() {
    const [totalResult, overdueResult, dueThisWeek] = await Promise.all([
      prisma.receivable.aggregate({
        where: { status: { in: ['UNPAID', 'PARTIAL', 'OVERDUE'] } },
        _sum: { remaining: true },
      }),
      prisma.receivable.aggregate({
        where: { status: 'OVERDUE' },
        _sum: { remaining: true },
      }),
      prisma.receivable.aggregate({
        where: {
          status: { in: ['UNPAID', 'PARTIAL'] },
          due_date: {
            gte: new Date(),
            lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          },
        },
        _sum: { remaining: true },
      }),
    ]);

    return {
      total_receivable: totalResult._sum.remaining || 0,
      overdue: overdueResult._sum.remaining || 0,
      due_this_week: dueThisWeek._sum.remaining || 0,
    };
  }

  static async recordPayment(input: RecordPaymentInput) {
    const receivable = await prisma.receivable.findUnique({ where: { id: input.receivable_id } });
    if (!receivable) throw new AppError(t('debt.notFound'), 404);
    if (input.amount <= 0) throw new AppError(t('debt.amountPositive'), 400);
    if (input.amount > receivable.remaining) throw new AppError(t('debt.amountExceedsRemaining'), 400);

    const newPaid = receivable.paid_amount + input.amount;
    const newRemaining = receivable.original_amount - newPaid;
    const newStatus: DebtStatus = newRemaining <= 0 ? 'PAID' : 'PARTIAL';

    const [payment] = await prisma.$transaction([
      prisma.receivablePayment.create({
        data: {
          receivable_id: input.receivable_id,
          amount: input.amount,
          payment_date: input.payment_date ? new Date(input.payment_date) : new Date(),
          method: input.method,
          reference: input.reference,
        },
      }),
      prisma.receivable.update({
        where: { id: input.receivable_id },
        data: { paid_amount: newPaid, remaining: newRemaining, status: newStatus },
      }),
    ]);

    await delCache('cache:/api/receivables*', 'cache:/api/dashboard*');
    return payment;
  }
}
