import prisma from '../../lib/prisma';
import { AppError } from '../../middleware/error.middleware';
import { t } from '../../locales';
import { delCache } from '../../lib/redis';

export class OperatingCostService {
  static async list(filters: { page?: number; limit?: number; category_id?: string; month?: string; year?: string }) {
    const { category_id, month, year } = filters;
    const page = Number(filters.page) || 1;
    const limit = Number(filters.limit) || 50;

    const where = {
      ...(category_id && { category_id }),
      ...(month && {
        date: {
          gte: new Date(`${month}-01`),
          lt: new Date(new Date(`${month}-01`).setMonth(new Date(`${month}-01`).getMonth() + 1)),
        },
      }),
      ...(!month && year && {
        date: {
          gte: new Date(`${year}-01-01`),
          lt: new Date(`${Number(year) + 1}-01-01`),
        },
      }),
    };

    const [costs, total] = await Promise.all([
      prisma.operatingCost.findMany({
        where,
        include: { category: { select: { id: true, name: true } } },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { date: 'desc' },
      }),
      prisma.operatingCost.count({ where }),
    ]);

    return { costs, total, page, limit, total_pages: Math.ceil(total / limit) };
  }

  static async getMonthlySummary(year: number) {
    const costs = await prisma.operatingCost.findMany({
      where: {
        date: {
          gte: new Date(`${year}-01-01`),
          lt: new Date(`${year + 1}-01-01`),
        },
      },
      include: { category: { select: { name: true } } },
    });

    const grouped: Record<string, Record<string, number>> = {};
    costs.forEach((c) => {
      const monthKey = `${c.date.getFullYear()}-${String(c.date.getMonth() + 1).padStart(2, '0')}`;
      if (!grouped[monthKey]) grouped[monthKey] = {};
      const catName = c.category.name;
      grouped[monthKey][catName] = (grouped[monthKey][catName] || 0) + c.amount;
    });

    return grouped;
  }

  static async create(data: { date: string; category_id: string; description?: string; amount: number; receipt_url?: string }) {
    const category = await prisma.operatingCostCategory.findUnique({ where: { id: data.category_id } });
    if (!category) throw new AppError(t('cost.categoryNotFound'), 404);

    const cost = await prisma.operatingCost.create({
      data: {
        date: new Date(data.date),
        category_id: data.category_id,
        description: data.description,
        amount: data.amount,
        receipt_url: data.receipt_url,
      },
      include: { category: true },
    });
    await delCache('cache:/api/operating-costs*', 'cache:/api/reports*');
    return cost;
  }

  static async update(id: string, data: Record<string, unknown>) {
    if (data.date) data.date = new Date(data.date as string);
    const cost = await prisma.operatingCost.update({
      where: { id },
      data: data as never,
      include: { category: true },
    });
    await delCache('cache:/api/operating-costs*', 'cache:/api/reports*');
    return cost;
  }

  static async delete(id: string) {
    const result = await prisma.operatingCost.delete({ where: { id } });
    await delCache('cache:/api/operating-costs*', 'cache:/api/reports*');
    return result;
  }

  // Category management
  static async listCategories() {
    return prisma.operatingCostCategory.findMany({
      where: { is_active: true },
      orderBy: { name: 'asc' },
    });
  }

  static async createCategory(name: string) {
    return prisma.operatingCostCategory.create({ data: { name } });
  }

  static async updateCategory(id: string, name: string) {
    return prisma.operatingCostCategory.update({ where: { id }, data: { name } });
  }
}
