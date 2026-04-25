import XLSX from 'xlsx-js-style';
import dayjs from 'dayjs';
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

interface CustomerExportFilters {
  search?: string;
  customer_type?: 'BUSINESS' | 'INDIVIDUAL';
  city?: string;
  has_debt?: boolean;
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

  static async exportExcel(filters: CustomerExportFilters): Promise<Buffer> {
    const { search, customer_type, city, has_debt } = filters;

    const where = {
      is_active: true,
      ...(search && {
        OR: [
          { company_name: { contains: search, mode: 'insensitive' as const } },
          { contact_name: { contains: search, mode: 'insensitive' as const } },
          { phone: { contains: search } },
        ],
      }),
      ...(customer_type && { customer_type: customer_type as never }),
      ...(city && { address: { contains: city, mode: 'insensitive' as const } }),
    };

    const customers = await prisma.customer.findMany({
      where,
      include: {
        receivables: {
          where: { status: { in: ['UNPAID', 'PARTIAL', 'OVERDUE'] } },
          select: { remaining: true },
        },
        _count: { select: { sales_orders: true } },
      },
      orderBy: { created_at: 'desc' },
    });

    const rows = customers
      .map((c) => ({
        company_name: c.company_name,
        contact_name: c.contact_name || '',
        phone: c.phone || '',
        email: c.email || '',
        address: c.address || '',
        address_city: '',
        customer_type: c.customer_type,
        tax_code: c.tax_code || '',
        order_count: c._count.sales_orders,
        debt: c.receivables.reduce((s, r) => s + r.remaining, 0),
        created_at: c.created_at,
      }))
      .filter((r) => (has_debt ? r.debt > 0 : true));

    const HEADERS = [
      'STT', 'Tên công ty', 'Người liên hệ', 'SĐT', 'Email',
      'Địa chỉ', 'Thành phố', 'Loại', 'Mã số thuế',
      'Số đơn', 'Công nợ còn (VND)', 'Ngày tạo',
    ];

    const headerStyle = {
      font: { name: 'Calibri', bold: true, sz: 11, color: { rgb: 'FFFFFF' } },
      alignment: { horizontal: 'center' as const, vertical: 'center' as const, wrapText: true },
      fill: { patternType: 'solid' as const, fgColor: { rgb: '1677FF' } },
      border: {
        top: { style: 'thin' as const, color: { rgb: '000000' } },
        bottom: { style: 'thin' as const, color: { rgb: '000000' } },
        left: { style: 'thin' as const, color: { rgb: '000000' } },
        right: { style: 'thin' as const, color: { rgb: '000000' } },
      },
    };
    const bodyBase = {
      font: { name: 'Calibri', sz: 11 },
      alignment: { vertical: 'center' as const, wrapText: true },
      border: {
        top: { style: 'thin' as const, color: { rgb: 'D9D9D9' } },
        bottom: { style: 'thin' as const, color: { rgb: 'D9D9D9' } },
        left: { style: 'thin' as const, color: { rgb: 'D9D9D9' } },
        right: { style: 'thin' as const, color: { rgb: 'D9D9D9' } },
      },
    };
    const bodyCenter = { ...bodyBase, alignment: { ...bodyBase.alignment, horizontal: 'center' as const } };
    const bodyNum = { ...bodyBase, alignment: { ...bodyBase.alignment, horizontal: 'right' as const }, numFmt: '#,##0' };

    const ws: XLSX.WorkSheet = {};
    HEADERS.forEach((h, c) => {
      ws[XLSX.utils.encode_cell({ r: 0, c })] = { v: h, t: 's', s: headerStyle };
    });

    rows.forEach((r, i) => {
      const rowIdx = i + 1;
      const typeLabel = r.customer_type === 'BUSINESS' ? 'Doanh nghiệp' : 'Cá nhân';
      const cells: Array<{ v: string | number; t: 's' | 'n'; s: Record<string, unknown> }> = [
        { v: i + 1, t: 'n', s: bodyCenter },
        { v: r.company_name, t: 's', s: bodyBase },
        { v: r.contact_name, t: 's', s: bodyBase },
        { v: r.phone, t: 's', s: bodyCenter },
        { v: r.email, t: 's', s: bodyBase },
        { v: r.address, t: 's', s: bodyBase },
        { v: r.address_city, t: 's', s: bodyBase },
        { v: typeLabel, t: 's', s: bodyCenter },
        { v: r.tax_code, t: 's', s: bodyCenter },
        { v: r.order_count, t: 'n', s: bodyNum },
        { v: r.debt, t: 'n', s: bodyNum },
        { v: dayjs(r.created_at).format('DD/MM/YYYY'), t: 's', s: bodyCenter },
      ];
      cells.forEach((cell, c) => {
        ws[XLSX.utils.encode_cell({ r: rowIdx, c })] = cell;
      });
    });

    const lastRow = rows.length;
    ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: lastRow, c: HEADERS.length - 1 } });
    ws['!cols'] = [
      { wch: 5 }, { wch: 32 }, { wch: 22 }, { wch: 14 }, { wch: 26 },
      { wch: 38 }, { wch: 16 }, { wch: 14 }, { wch: 16 },
      { wch: 8 }, { wch: 18 }, { wch: 12 },
    ];
    ws['!rows'] = [{ hpt: 28 }];
    ws['!freeze'] = { xSplit: 0, ySplit: 1 };
    ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: 0, c: HEADERS.length - 1 } }) };

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Khách hàng');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    return Buffer.from(buf);
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
