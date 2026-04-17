import prisma from '../../lib/prisma';
import { AppError } from '../../middleware/error.middleware';
import { t } from '../../locales';
import { delCache } from '../../lib/redis';

interface CustomerFilters {
  page?: number;
  limit?: number;
  search?: string;
  customer_type?: string;
  approval_status?: string;
  is_active?: boolean;
  from_date?: string;
  to_date?: string;
}

export class CustomerService {
  static async list(filters: CustomerFilters) {
    const page = Number(filters.page) || 1;
    const limit = Number(filters.limit) || 20;
    const { search, customer_type, approval_status, is_active = true, from_date, to_date } = filters;

    const where = {
      is_active,
      ...(search && {
        OR: [
          { company_name: { contains: search, mode: 'insensitive' as const } },
          { contact_name: { contains: search, mode: 'insensitive' as const } },
          { phone: { contains: search } },
        ],
      }),
      ...(customer_type && { customer_type: customer_type as never }),
      ...(approval_status && { approval_status }),
      ...(from_date || to_date ? {
        created_at: {
          ...(from_date && { gte: new Date(from_date) }),
          ...(to_date && { lte: new Date(to_date) }),
        },
      } : {}),
    };

    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        include: {
          receivables: {
            where: { status: { in: ['UNPAID', 'PARTIAL', 'OVERDUE'] } },
            select: { remaining: true, status: true },
          },
          sales_orders: { orderBy: { order_date: 'desc' }, take: 1, select: { order_date: true } },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
      prisma.customer.count({ where }),
    ]);

    const enriched = customers.map((c) => {
      const totalReceivable = c.receivables.reduce((sum, r) => sum + r.remaining, 0);
      const overdueAmount = c.receivables
        .filter((r) => r.status === 'OVERDUE')
        .reduce((sum, r) => sum + r.remaining, 0);
      return {
        ...c,
        total_receivable: totalReceivable,
        overdue_amount: overdueAmount,
        last_order_date: c.sales_orders[0]?.order_date || null,
      };
    });

    return { customers: enriched, total, page, limit, total_pages: Math.ceil(total / limit) };
  }

  static async getById(id: string) {
    const customer = await prisma.customer.findUnique({
      where: { id },
      include: {
        sales_orders: { orderBy: { order_date: 'desc' }, take: 50 },
        receivables: {
          include: { payments: true },
          orderBy: { created_at: 'desc' },
        },
      },
    });
    if (!customer) throw new AppError(t('customer.notFound'), 404);
    return customer;
  }

  static async create(data: Record<string, unknown>) {
    const customer = await prisma.customer.create({ data: data as never });
    await delCache('cache:/api/customers*');
    return customer;
  }

  static async update(id: string, data: Record<string, unknown>) {
    const customer = await prisma.customer.update({ where: { id }, data: data as never });
    await delCache('cache:/api/customers*');
    return customer;
  }

  static async approve(id: string) {
    const result = await prisma.customer.update({ where: { id }, data: { approval_status: 'APPROVED' } });
    await delCache('cache:/api/customers*');
    return result;
  }

  static async softDelete(id: string) {
    const result = await prisma.customer.update({ where: { id }, data: { is_active: false } });
    await delCache('cache:/api/customers*');
    return result;
  }

  static async checkDebtLimit(customerId: string, newOrderTotal: number) {
    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) throw new AppError(t('customer.notFound'), 404);

    const unpaidReceivables = await prisma.receivable.aggregate({
      where: { customer_id: customerId, status: { in: ['UNPAID', 'PARTIAL', 'OVERDUE'] } },
      _sum: { remaining: true },
    });

    const totalUnpaid = unpaidReceivables._sum.remaining || 0;
    const exceedsLimit = customer.debt_limit > 0 && totalUnpaid + newOrderTotal > customer.debt_limit;

    return {
      debt_limit: customer.debt_limit,
      current_debt: totalUnpaid,
      new_order_total: newOrderTotal,
      exceeds_limit: exceedsLimit,
    };
  }
}
