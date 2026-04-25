import XLSX from 'xlsx-js-style';
import dayjs from 'dayjs';
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

interface SupplierExportFilters {
  search?: string;
  city?: string;
  has_payable?: boolean;
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
        purchase_orders: {
          orderBy: { order_date: 'desc' }, take: 50,
          include: { sales_order: { select: { order_code: true, customer: { select: { company_name: true, contact_name: true } } } } },
        },
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

  static async exportExcel(filters: SupplierExportFilters): Promise<Buffer> {
    const { search, city, has_payable } = filters;

    const where: Record<string, unknown> = {
      is_active: true,
      ...(search && {
        OR: [
          { company_name: { contains: search, mode: 'insensitive' as const } },
          { contact_name: { contains: search, mode: 'insensitive' as const } },
          { phone: { contains: search } },
          { tax_code: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
      ...(city && { address: { contains: city, mode: 'insensitive' as const } }),
    };

    const suppliers = await prisma.supplier.findMany({
      where,
      include: {
        _count: { select: { supplier_prices: true, purchase_orders: true } },
        payables: {
          where: { status: { in: ['UNPAID', 'PARTIAL', 'OVERDUE'] } },
          select: { remaining: true },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    const enriched = suppliers
      .map((s) => {
        const total_payable_remaining = s.payables.reduce((sum, p) => sum + p.remaining, 0);
        return {
          company_name: s.company_name,
          contact_name: s.contact_name || '',
          phone: s.phone || '',
          email: s.email || '',
          address: s.address || '',
          city: '',
          tax_code: s.tax_code || '',
          products_count: s._count.supplier_prices,
          orders_count: s._count.purchase_orders,
          total_payable_remaining,
          payment_terms: s.payment_terms,
          created_at: s.created_at,
        };
      })
      .filter((s) => (has_payable ? s.total_payable_remaining > 0 : true));

    const THIN = { style: 'thin' as const, color: { rgb: '000000' } };
    const BORDER = { top: THIN, bottom: THIN, left: THIN, right: THIN };
    const headerStyle = {
      font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 11 },
      alignment: { horizontal: 'center' as const, vertical: 'center' as const, wrapText: true },
      fill: { patternType: 'solid' as const, fgColor: { rgb: 'F5222D' } },
      border: BORDER,
    };
    const bodyText = { font: { sz: 11 }, alignment: { vertical: 'center' as const, wrapText: true }, border: BORDER };
    const bodyCenter = { ...bodyText, alignment: { horizontal: 'center' as const, vertical: 'center' as const } };
    const bodyNum = { ...bodyText, alignment: { horizontal: 'right' as const, vertical: 'center' as const }, numFmt: '#,##0' };

    const headers = [
      'STT', 'Tên công ty', 'Người liên hệ', 'SĐT', 'Email', 'Địa chỉ', 'Thành phố',
      'MST', 'Số SP cung cấp', 'Số đơn mua', 'Công nợ trả còn (VND)', 'Điều khoản TT', 'Ngày tạo',
    ];

    const ws: XLSX.WorkSheet = {};
    const COLS = headers.length;

    headers.forEach((h, c) => {
      ws[XLSX.utils.encode_cell({ r: 0, c })] = { v: h, t: 's', s: headerStyle };
    });

    enriched.forEach((s, i) => {
      const r = i + 1;
      const row: Array<{ v: unknown; t: string; s: Record<string, unknown> }> = [
        { v: i + 1, t: 'n', s: bodyCenter },
        { v: s.company_name, t: 's', s: bodyText },
        { v: s.contact_name, t: 's', s: bodyText },
        { v: s.phone, t: 's', s: bodyCenter },
        { v: s.email, t: 's', s: bodyText },
        { v: s.address, t: 's', s: bodyText },
        { v: s.city, t: 's', s: bodyText },
        { v: s.tax_code, t: 's', s: bodyCenter },
        { v: s.products_count, t: 'n', s: bodyNum },
        { v: s.orders_count, t: 'n', s: bodyNum },
        { v: s.total_payable_remaining || 0, t: 'n', s: bodyNum },
        { v: s.payment_terms, t: 's', s: bodyCenter },
        { v: dayjs(s.created_at).format('DD/MM/YYYY'), t: 's', s: bodyCenter },
      ];
      row.forEach((cell, c) => {
        ws[XLSX.utils.encode_cell({ r, c })] = cell;
      });
    });

    const lastRow = Math.max(0, enriched.length);
    ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: lastRow, c: COLS - 1 } });
    ws['!cols'] = [
      { wch: 5 }, { wch: 30 }, { wch: 20 }, { wch: 14 }, { wch: 24 },
      { wch: 32 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 12 },
      { wch: 18 }, { wch: 14 }, { wch: 12 },
    ];
    ws['!rows'] = [{ hpt: 30 }];
    (ws as unknown as { '!views'?: unknown[] })['!views'] = [{ state: 'frozen', ySplit: 1, topLeftCell: 'A2' }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Danh sách NCC');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    return Buffer.from(buf);
  }
}
