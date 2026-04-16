import prisma from '../../lib/prisma';
import { CashTransactionType } from '@prisma/client';
import { AppError } from '../../middleware/error.middleware';
import { t } from '../../locales';

interface CreateTransactionInput {
  type: CashTransactionType;
  category_id: string;
  date?: string;
  amount: number;
  description: string;
  reference?: string;
  payment_method?: string;
  notes?: string;
}

export class CashBookService {
  // ── Transactions ──
  static async list(filters: { page?: number; limit?: number; type?: string; category_id?: string; search?: string; from_date?: string; to_date?: string }) {
    const page = Number(filters.page) || 1;
    const limit = Number(filters.limit) || 20;

    const where: any = {};
    if (filters.type && filters.type !== 'ALL') where.type = filters.type;
    if (filters.category_id) where.category_id = filters.category_id;
    if (filters.search) {
      where.OR = [
        { description: { contains: filters.search, mode: 'insensitive' } },
        { reference: { contains: filters.search, mode: 'insensitive' } },
      ];
    }
    if (filters.from_date || filters.to_date) {
      where.date = {};
      if (filters.from_date) where.date.gte = new Date(filters.from_date);
      if (filters.to_date) where.date.lte = new Date(filters.to_date);
    }

    const [data, total] = await Promise.all([
      prisma.cashTransaction.findMany({
        where,
        include: { category: { select: { id: true, name: true, type: true } } },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { date: 'desc' },
      }),
      prisma.cashTransaction.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  static async create(input: CreateTransactionInput) {
    if (input.amount <= 0) throw new AppError(t('cashBook.amountPositive'), 400);

    return prisma.cashTransaction.create({
      data: {
        type: input.type,
        category_id: input.category_id,
        date: input.date ? new Date(input.date) : new Date(),
        amount: input.amount,
        description: input.description,
        reference: input.reference,
        payment_method: (input.payment_method as any) || 'CASH',
        notes: input.notes,
      },
      include: { category: true },
    });
  }

  static async update(id: string, data: Partial<CreateTransactionInput>) {
    const existing = await prisma.cashTransaction.findUnique({ where: { id } });
    if (!existing) throw new AppError(t('cashBook.notFound'), 404);

    return prisma.cashTransaction.update({
      where: { id },
      data: {
        ...(data.type && { type: data.type }),
        ...(data.category_id && { category_id: data.category_id }),
        ...(data.date && { date: new Date(data.date) }),
        ...(data.amount && { amount: data.amount }),
        ...(data.description && { description: data.description }),
        ...(data.reference !== undefined && { reference: data.reference }),
        ...(data.payment_method && { payment_method: data.payment_method as any }),
        ...(data.notes !== undefined && { notes: data.notes }),
      },
      include: { category: true },
    });
  }

  static async delete(id: string) {
    const existing = await prisma.cashTransaction.findUnique({ where: { id } });
    if (!existing) throw new AppError(t('cashBook.notFound'), 404);
    if (existing.is_auto) throw new AppError(t('cashBook.cannotDeleteAuto'), 400);
    await prisma.cashTransaction.delete({ where: { id } });
  }

  // ── Summary ──
  static async getSummary(filters: { from_date?: string; to_date?: string }) {
    const where: any = {};
    if (filters.from_date || filters.to_date) {
      where.date = {};
      if (filters.from_date) where.date.gte = new Date(filters.from_date);
      if (filters.to_date) where.date.lte = new Date(filters.to_date);
    }

    const [income, expense] = await Promise.all([
      prisma.cashTransaction.aggregate({ where: { ...where, type: 'INCOME' }, _sum: { amount: true }, _count: true }),
      prisma.cashTransaction.aggregate({ where: { ...where, type: 'EXPENSE' }, _sum: { amount: true }, _count: true }),
    ]);

    return {
      total_income: income._sum.amount || 0,
      total_expense: expense._sum.amount || 0,
      balance: (income._sum.amount || 0) - (expense._sum.amount || 0),
      income_count: income._count,
      expense_count: expense._count,
    };
  }

  // ── Categories ──
  static async listCategories(type?: string) {
    const where: any = { is_active: true };
    if (type && type !== 'ALL') where.type = type;
    return prisma.cashCategory.findMany({ where, orderBy: { name: 'asc' } });
  }

  static async createCategory(data: { name: string; type: CashTransactionType }) {
    return prisma.cashCategory.create({ data });
  }

  static async updateCategory(id: string, data: { name?: string; is_active?: boolean }) {
    return prisma.cashCategory.update({ where: { id }, data });
  }
}
