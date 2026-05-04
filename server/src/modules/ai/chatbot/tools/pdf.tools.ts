import dayjs from 'dayjs';
import { ToolDefinition } from '../types';
import { renderPdf, PdfBlock, PdfDocument, fmtVND, fmtDate } from '../../../../lib/pdf-renderer';
import { uploadExport } from '../../../../lib/cloudinary-export';
import prisma from '../../../../lib/prisma';
import logger from '../../../../utils/logger';

const VALID_BLOCK_TYPES = new Set([
  'heading', 'text', 'kv_list', 'table', 'summary', 'spacer', 'divider', 'signature',
]);

function sanitizeBlocks(input: any): PdfBlock[] {
  if (!Array.isArray(input)) return [];
  const out: PdfBlock[] = [];
  for (const b of input) {
    if (!b || typeof b !== 'object' || !VALID_BLOCK_TYPES.has(b.type)) continue;
    out.push(b as PdfBlock);
  }
  return out;
}

function safeFileName(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
    .toLowerCase();
}

export const pdfTools: ToolDefinition[] = [
  // ─────────────────────────────────────────────────────────
  // 1. Generic PDF builder — for any custom report
  // ─────────────────────────────────────────────────────────
  {
    schema: {
      type: 'function',
      function: {
        name: 'render_custom_pdf',
        description:
          'Tạo PDF tuỳ ý từ các BLOCK có cấu trúc. Dùng khi user yêu cầu PDF KHÔNG có template sẵn (báo cáo riêng, tổng hợp custom). KHÔNG truyền HTML thô — chỉ truyền blocks. Layout, font, brand do server tự render đẹp đồng nhất.',
        parameters: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'Tiêu đề lớn ở header.' },
            subtitle: { type: 'string', description: 'Phụ đề (tuỳ chọn).' },
            orientation: { type: 'string', enum: ['portrait', 'landscape'], description: 'Mặc định portrait.' },
            blocks: {
              type: 'array',
              description:
                'Mảng các block. Loại: heading | text | kv_list | table | summary | spacer | divider | signature.',
              items: {
                type: 'object',
                properties: {
                  type: {
                    type: 'string',
                    enum: ['heading', 'text', 'kv_list', 'table', 'summary', 'spacer', 'divider', 'signature'],
                  },
                  level: { type: 'number', description: 'heading: 1|2|3' },
                  text: { type: 'string', description: 'heading text' },
                  content: { type: 'string', description: 'text content' },
                  items: {
                    type: 'array',
                    description:
                      'kv_list: [{label, value}]. summary: [{label, value, highlight?}].',
                    items: { type: 'object' },
                  },
                  headers: { type: 'array', items: { type: 'string' }, description: 'table headers' },
                  rows: { type: 'array', description: 'table rows: [["a","b"],["c","d"]]', items: { type: 'array' } },
                  align: {
                    type: 'array',
                    items: { type: 'string', enum: ['left', 'right', 'center'] },
                    description: 'Căn lề từng cột table',
                  },
                  height: { type: 'number', description: 'spacer height in px' },
                  left: { type: 'object', description: 'signature left {label, name?}' },
                  right: { type: 'object', description: 'signature right {label, name?}' },
                },
                required: ['type'],
              },
            },
            filename_hint: {
              type: 'string',
              description: 'Gợi ý tên file (slug, không dấu). VD "bao-cao-cong-no-thang-5".',
            },
          },
          required: ['title', 'blocks'],
        },
      },
    },
    handler: async (args) => {
      const blocks = sanitizeBlocks(args.blocks);
      if (!blocks.length) return '❌ blocks rỗng hoặc không hợp lệ.';
      const doc: PdfDocument = {
        title: String(args.title || 'Báo cáo'),
        subtitle: args.subtitle ? String(args.subtitle) : undefined,
        blocks,
        orientation: args.orientation === 'landscape' ? 'landscape' : 'portrait',
      };
      try {
        const buffer = await renderPdf(doc);
        const slug = safeFileName(String(args.filename_hint || args.title || 'document'));
        const fileName = `${slug || 'document'}-${dayjs().format('YYYYMMDD-HHmmss')}.pdf`;
        const url = await uploadExport(buffer, fileName, 'packflow/exports/pdf');
        return `✅ Đã tạo PDF "${doc.title}" (${blocks.length} block).\n📎 ${url}\n[action:${url}|Tải PDF]`;
      } catch (err: any) {
        logger.error('render_custom_pdf error:', err);
        return `❌ Lỗi tạo PDF: ${err?.message || 'unknown'}`;
      }
    },
  },

  // ─────────────────────────────────────────────────────────
  // 2. PDF công nợ phải thu của 1 KH (wrap existing service)
  // ─────────────────────────────────────────────────────────
  {
    schema: {
      type: 'function',
      function: {
        name: 'pdf_receivable_report',
        description:
          'Xuất PDF sao kê công nợ PHẢI THU của 1 khách hàng (template có sẵn, layout chuẩn in giấy). Dùng khi user yêu cầu "PDF công nợ KH X", "in công nợ phải thu KH X".',
        parameters: {
          type: 'object',
          properties: {
            customer_id: { type: 'string', description: 'UUID của KH (lấy từ search_customer trước).' },
            from_date: { type: 'string', description: 'YYYY-MM-DD, bỏ trống = từ đầu' },
            to_date: { type: 'string', description: 'YYYY-MM-DD, bỏ trống = đến hôm nay' },
          },
          required: ['customer_id'],
        },
      },
    },
    handler: async (args) => {
      const { ReceivableService } = await import('../../../receivable/receivable.service');
      try {
        const buffer = await ReceivableService.exportCustomerPdf(
          String(args.customer_id),
          args.from_date,
          args.to_date,
          'vi',
        );
        const customer = await prisma.customer.findUnique({
          where: { id: String(args.customer_id) },
          select: { company_name: true, contact_name: true },
        });
        const cname = customer?.company_name || customer?.contact_name || 'kh';
        const fileName = `cong-no-phai-thu-${safeFileName(cname)}-${dayjs().format('YYYYMMDD-HHmmss')}.pdf`;
        const url = await uploadExport(buffer, fileName, 'packflow/exports/pdf');
        return `✅ Đã xuất PDF công nợ phải thu — ${cname}.\n📎 ${url}\n[action:${url}|Tải PDF]`;
      } catch (err: any) {
        logger.error('pdf_receivable_report error:', err);
        return `❌ Lỗi tạo PDF công nợ KH: ${err?.message || 'unknown'}`;
      }
    },
  },

  // ─────────────────────────────────────────────────────────
  // 3. PDF công nợ phải trả của 1 NCC
  // ─────────────────────────────────────────────────────────
  {
    schema: {
      type: 'function',
      function: {
        name: 'pdf_payable_report',
        description:
          'Xuất PDF sao kê công nợ PHẢI TRẢ cho 1 nhà cung cấp (template có sẵn). Dùng khi user yêu cầu "PDF công nợ NCC X", "in công nợ phải trả NCC X".',
        parameters: {
          type: 'object',
          properties: {
            supplier_id: { type: 'string', description: 'UUID của NCC.' },
            from_date: { type: 'string' },
            to_date: { type: 'string' },
          },
          required: ['supplier_id'],
        },
      },
    },
    handler: async (args) => {
      const { PayableService } = await import('../../../payable/payable.service');
      try {
        const buffer = await PayableService.exportSupplierPdf(
          String(args.supplier_id),
          args.from_date,
          args.to_date,
          'vi',
        );
        const supplier = await prisma.supplier.findUnique({
          where: { id: String(args.supplier_id) },
          select: { company_name: true, contact_name: true },
        });
        const sname = supplier?.company_name || supplier?.contact_name || 'ncc';
        const fileName = `cong-no-phai-tra-${safeFileName(sname)}-${dayjs().format('YYYYMMDD-HHmmss')}.pdf`;
        const url = await uploadExport(buffer, fileName, 'packflow/exports/pdf');
        return `✅ Đã xuất PDF công nợ phải trả — ${sname}.\n📎 ${url}\n[action:${url}|Tải PDF]`;
      } catch (err: any) {
        logger.error('pdf_payable_report error:', err);
        return `❌ Lỗi tạo PDF công nợ NCC: ${err?.message || 'unknown'}`;
      }
    },
  },

  // ─────────────────────────────────────────────────────────
  // 4. PDF báo giá cho KH (template chuẩn, structured)
  // ─────────────────────────────────────────────────────────
  {
    schema: {
      type: 'function',
      function: {
        name: 'pdf_quote',
        description:
          'Xuất PDF báo giá cho 1 KH với danh sách SP + đơn giá. Layout chuẩn có header/khách hàng/bảng SP/tổng/chữ ký. Dùng khi user "tạo báo giá", "xuất quote KH X".',
        parameters: {
          type: 'object',
          properties: {
            customer_id: { type: 'string', description: 'UUID KH' },
            items: {
              type: 'array',
              description: 'Danh sách SP báo giá',
              items: {
                type: 'object',
                properties: {
                  product_name: { type: 'string' },
                  quantity: { type: 'number' },
                  unit: { type: 'string', description: 'cái, kg, …' },
                  unit_price: { type: 'number' },
                },
                required: ['product_name', 'quantity', 'unit_price'],
              },
            },
            validity_days: { type: 'number', description: 'Số ngày hiệu lực, default 7' },
            note: { type: 'string', description: 'Ghi chú thêm (tuỳ chọn)' },
          },
          required: ['customer_id', 'items'],
        },
      },
    },
    handler: async (args) => {
      try {
        const customer = await prisma.customer.findUnique({
          where: { id: String(args.customer_id) },
          select: { company_name: true, contact_name: true, phone: true, address: true },
        });
        if (!customer) return '❌ Không tìm thấy KH với id đã cho.';
        const items: Array<{ product_name: string; quantity: number; unit?: string; unit_price: number }> =
          Array.isArray(args.items) ? args.items : [];
        if (!items.length) return '❌ items rỗng.';

        const total = items.reduce((s, it) => s + Number(it.quantity || 0) * Number(it.unit_price || 0), 0);
        const validityDays = Number(args.validity_days) || 7;
        const validUntil = dayjs().add(validityDays, 'day').format('DD/MM/YYYY');

        const blocks: PdfBlock[] = [
          {
            type: 'kv_list',
            items: [
              { label: 'Khách hàng', value: customer.company_name || customer.contact_name || '' },
              { label: 'SĐT', value: customer.phone || '—' },
              { label: 'Địa chỉ', value: customer.address || '—' },
              { label: 'Ngày báo giá', value: fmtDate(new Date()) },
              { label: 'Hiệu lực đến', value: validUntil },
            ],
          },
          { type: 'heading', level: 2, text: 'Chi tiết báo giá' },
          {
            type: 'table',
            headers: ['#', 'Sản phẩm', 'SL', 'ĐVT', 'Đơn giá (VND)', 'Thành tiền (VND)'],
            align: ['center', 'left', 'right', 'center', 'right', 'right'],
            rows: items.map((it, i) => [
              i + 1,
              it.product_name,
              it.quantity,
              it.unit || 'cái',
              fmtVND(it.unit_price),
              fmtVND(Number(it.quantity || 0) * Number(it.unit_price || 0)),
            ]),
          },
          {
            type: 'summary',
            items: [{ label: 'Tổng cộng', value: `${fmtVND(total)} VND`, highlight: true }],
          },
        ];
        if (args.note) {
          blocks.push({ type: 'heading', level: 3, text: 'Ghi chú' });
          blocks.push({ type: 'text', content: String(args.note) });
        }
        blocks.push({ type: 'spacer', height: 24 });
        blocks.push({
          type: 'signature',
          left: { label: 'Khách hàng' },
          right: { label: 'Người báo giá', name: 'UNIKI' },
        });

        const buffer = await renderPdf({
          title: 'BÁO GIÁ',
          subtitle: customer.company_name || customer.contact_name || '',
          blocks,
        });
        const slug = safeFileName(`bao-gia-${customer.company_name || customer.contact_name || 'kh'}`);
        const fileName = `${slug}-${dayjs().format('YYYYMMDD-HHmmss')}.pdf`;
        const url = await uploadExport(buffer, fileName, 'packflow/exports/pdf');
        return `✅ Đã xuất báo giá ${customer.company_name || ''} — ${items.length} SP, tổng ${fmtVND(total)} VND.\n📎 ${url}\n[action:${url}|Tải PDF]`;
      } catch (err: any) {
        logger.error('pdf_quote error:', err);
        return `❌ Lỗi tạo báo giá: ${err?.message || 'unknown'}`;
      }
    },
  },
];
