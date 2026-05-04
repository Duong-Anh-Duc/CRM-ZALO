import dayjs from 'dayjs';
import { ToolDefinition } from '../types';

export const exportTools: ToolDefinition[] = [
  {
    schema: {
      type: 'function',
      function: {
        name: 'export_customers_excel',
        description: 'Xuất danh sách khách hàng ra file Excel. Dùng khi user ra lệnh "xuất danh sách KH", "export khách hàng", "in danh sách khách". Có thể kèm bộ lọc.',
        parameters: {
          type: 'object',
          properties: {
            search: { type: 'string', description: 'Tìm theo tên/SĐT (optional)' },
            customer_type: { type: 'string', enum: ['BUSINESS', 'INDIVIDUAL'], description: 'Lọc loại KH' },
            city: { type: 'string', description: 'Lọc theo thành phố/khu vực' },
            has_debt: { type: 'boolean', description: 'true = chỉ KH còn công nợ' },
          },
        },
      },
    },
    handler: async (args) => {
      const { CustomerService } = await import('../../../customer/customer.service');
      const buffer = await CustomerService.exportExcel({
        search: args.search,
        customer_type: args.customer_type,
        city: args.city,
        has_debt: args.has_debt,
      });
      const { uploadExport } = await import('../../../../lib/cloudinary-export');
      const fileName = `danh-sach-khach-hang-${dayjs().format('YYYYMMDD-HHmmss')}.xlsx`;
      const url = await uploadExport(buffer, fileName);
      const count = Math.max(0, Math.floor((buffer.length - 2000) / 200));
      return `✅ Đã xuất Excel danh sách khách hàng (~${count > 0 ? count : '?'} dòng).\n📎 Link tải: ${url}\n[action:${url}|Tải file Excel]`;
    },
  },
  {
    schema: {
      type: 'function',
      function: {
        name: 'export_suppliers_excel',
        description: 'Xuất danh sách nhà cung cấp ra Excel. Dùng khi user ra lệnh "xuất danh sách NCC", "export nhà cung cấp".',
        parameters: {
          type: 'object',
          properties: {
            search: { type: 'string' },
            city: { type: 'string' },
            has_payable: { type: 'boolean', description: 'true = chỉ NCC còn nợ phải trả' },
          },
        },
      },
    },
    handler: async (args) => {
      const { SupplierService } = await import('../../../supplier/supplier.service');
      const buffer = await SupplierService.exportExcel({
        search: args.search,
        city: args.city,
        has_payable: args.has_payable,
      });
      const { uploadExport } = await import('../../../../lib/cloudinary-export');
      const fileName = `danh-sach-ncc-${dayjs().format('YYYYMMDD-HHmmss')}.xlsx`;
      const url = await uploadExport(buffer, fileName);
      return `✅ Đã xuất Excel danh sách nhà cung cấp.\n📎 Link tải: ${url}\n[action:${url}|Tải file Excel]`;
    },
  },
  {
    schema: {
      type: 'function',
      function: {
        name: 'export_products_excel',
        description: 'Xuất danh sách sản phẩm ra Excel. Dùng khi user ra lệnh "xuất SP", "export sản phẩm", "in catalog". Có thể lọc theo category/chất liệu/trạng thái.',
        parameters: {
          type: 'object',
          properties: {
            search: { type: 'string' },
            category_id: { type: 'string', description: 'ID danh mục SP' },
            material: { type: 'string', description: 'Chất liệu: PET, HDPE, PP, LDPE, OPP, PE, PVC' },
            is_active: { type: 'boolean', description: 'true = chỉ SP đang hoạt động' },
          },
        },
      },
    },
    handler: async (args) => {
      const { ProductService } = await import('../../../product/product.service');
      const buffer = await ProductService.exportExcel({
        search: args.search,
        category_id: args.category_id,
        material: args.material,
        is_active: args.is_active,
      });
      const { uploadExport } = await import('../../../../lib/cloudinary-export');
      const fileName = `danh-sach-san-pham-${dayjs().format('YYYYMMDD-HHmmss')}.xlsx`;
      const url = await uploadExport(buffer, fileName);
      return `✅ Đã xuất Excel danh sách sản phẩm.\n📎 Link tải: ${url}\n[action:${url}|Tải file Excel]`;
    },
  },
];
