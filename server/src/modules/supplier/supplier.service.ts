import prisma from '../../lib/prisma';
import { AppError } from '../../middleware/error.middleware';
import { t } from '../../locales';
import { delCache } from '../../lib/redis';

interface SupplierFilters {
  page?: number;
  limit?: number;
  search?: string;
  is_active?: boolean;
  from_date?: string;
  to_date?: string;
}

export class SupplierService {
  static async list(filters: SupplierFilters) {
    const page = Number(filters.page) || 1;
    const limit = Number(filters.limit) || 20;
    const { search, is_active = true, from_date, to_date } = filters;

    const where = {
      is_active,
      ...(search && {
        OR: [
          { company_name: { contains: search, mode: 'insensitive' as const } },
          { contact_name: { contains: search, mode: 'insensitive' as const } },
          { phone: { contains: search } },
        ],
      }),
      ...(from_date || to_date ? {
        created_at: {
          ...(from_date && { gte: new Date(from_date) }),
          ...(to_date && { lte: new Date(to_date) }),
        },
      } : {}),
    };

    const [suppliers, total] = await Promise.all([
      prisma.supplier.findMany({
        where,
        include: {
          _count: { select: { supplier_prices: true } },
          payables: {
            where: { status: { in: ['UNPAID', 'PARTIAL', 'OVERDUE'] } },
            select: { remaining: true, status: true },
          },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
      prisma.supplier.count({ where }),
    ]);

    const enriched = suppliers.map((s) => {
      const totalPayable = s.payables.reduce((sum, p) => sum + p.remaining, 0);
      const overdueAmount = s.payables
        .filter((p) => p.status === 'OVERDUE')
        .reduce((sum, p) => sum + p.remaining, 0);
      return {
        ...s,
        products_count: s._count.supplier_prices,
        total_payable: totalPayable,
        overdue_amount: overdueAmount,
      };
    });

    return { suppliers: enriched, total, page, limit, total_pages: Math.ceil(total / limit) };
  }

  static async getById(id: string) {
    const supplier = await prisma.supplier.findUnique({
      where: { id },
      include: {
        supplier_prices: {
          include: { product: { select: { id: true, sku: true, name: true } } },
        },
        purchase_orders: { orderBy: { order_date: 'desc' }, take: 50 },
        payables: {
          include: { payments: true },
          orderBy: { created_at: 'desc' },
        },
      },
    });
    if (!supplier) throw new AppError(t('supplier.notFound'), 404);
    return supplier;
  }

  static async create(data: Record<string, unknown>) {
    const supplier = await prisma.supplier.create({ data: data as never });
    await delCache('cache:/api/suppliers*');
    return supplier;
  }

  static async update(id: string, data: Record<string, unknown>) {
    const supplier = await prisma.supplier.update({ where: { id }, data: data as never });
    await delCache('cache:/api/suppliers*');
    return supplier;
  }

  static async softDelete(id: string) {
    const result = await prisma.supplier.update({ where: { id }, data: { is_active: false } });
    await delCache('cache:/api/suppliers*');
    return result;
  }
}
