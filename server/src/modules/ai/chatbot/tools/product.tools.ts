import prisma from '../../../../lib/prisma';
import { ToolDefinition } from '../types';

export const productTools: ToolDefinition[] = [
  {
    schema: {
      type: 'function',
      function: {
        name: 'create_product',
        description: 'Tạo sản phẩm mới. SKU tự gen nếu không cung cấp.',
        parameters: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            sku: { type: 'string' },
            retail_price: { type: 'number', description: 'Giá tham khảo' },
            material: { type: 'string', enum: ['PET', 'HDPE', 'LDPE', 'PP', 'PVC', 'PS', 'PC', 'OTHER'] },
            capacity_ml: { type: 'number' }, moq: { type: 'number' },
            category_id: { type: 'string' },
            description: { type: 'string' },
          },
          required: ['name'],
        },
      },
    },
    handler: async (args) => {
      const sku = args.sku || `SP-${Date.now().toString(36).toUpperCase()}`;
      const p = await prisma.product.create({
        data: {
          name: args.name, sku,
          material: args.material || null, capacity_ml: args.capacity_ml || null,
          retail_price: args.retail_price || null,
          moq: args.moq || null, category_id: args.category_id || null,
          description: args.description || null,
        },
      });
      return `✅ Đã tạo SP "${p.name}" (${p.sku}) [id:${p.id}]`;
    },
  },
  {
    schema: {
      type: 'function',
      function: {
        name: 'update_product',
        description: 'Cập nhật sản phẩm (id UUID)',
        parameters: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' }, retail_price: { type: 'number' },
            moq: { type: 'number' }, description: { type: 'string' }, is_active: { type: 'boolean' },
          },
          required: ['id'],
        },
      },
    },
    handler: async (args) => {
      const { id, ...data } = args;
      const p = await prisma.product.update({ where: { id }, data });
      return `✅ Đã cập nhật SP "${p.name}" [id:${p.id}]`;
    },
  },
  {
    schema: {
      type: 'function',
      function: {
        name: 'delete_product',
        description: 'Xóa sản phẩm (soft delete)',
        parameters: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
      },
    },
    handler: async (args) => {
      const { ProductService } = await import('../../../product/product.service');
      await ProductService.softDelete(args.id);
      return `✅ Đã xóa sản phẩm [id:${args.id}]`;
    },
  },
  {
    schema: {
      type: 'function',
      function: {
        name: 'create_product_category',
        description: 'Tạo danh mục sản phẩm mới',
        parameters: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] },
      },
    },
    handler: async (args) => {
      const c = await prisma.category.create({ data: { name: args.name } });
      return `✅ Đã tạo danh mục SP "${c.name}" [id:${c.id}]`;
    },
  },
  {
    schema: {
      type: 'function',
      function: {
        name: 'update_product_category',
        description: 'Sửa danh mục sản phẩm (chỉ đổi tên)',
        parameters: {
          type: 'object',
          properties: { id: { type: 'string' }, name: { type: 'string' } },
          required: ['id', 'name'],
        },
      },
    },
    handler: async (args) => {
      const c = await prisma.category.update({ where: { id: args.id }, data: { name: args.name } });
      return `✅ Đã đổi tên danh mục SP → "${c.name}" [id:${c.id}]`;
    },
  },
  {
    schema: {
      type: 'function',
      function: {
        name: 'delete_product_category',
        description: 'Xoá danh mục sản phẩm (soft delete, is_active=false)',
        parameters: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
      },
    },
    handler: async (args) => {
      const c = await prisma.category.update({ where: { id: args.id }, data: { is_active: false } });
      return `✅ Đã xoá danh mục SP "${c.name}" [id:${c.id}]`;
    },
  },
  {
    schema: {
      type: 'function',
      function: {
        name: 'upsert_customer_product_price',
        description: 'Lưu/cập nhật giá bán riêng cho 1 KH + 1 SP',
        parameters: {
          type: 'object',
          properties: { customer_id: { type: 'string' }, product_id: { type: 'string' }, price: { type: 'number' } },
          required: ['customer_id', 'product_id', 'price'],
        },
      },
    },
    handler: async (args) => {
      const p = await prisma.customerProductPrice.upsert({
        where: { customer_id_product_id: { customer_id: args.customer_id, product_id: args.product_id } },
        update: { price: args.price },
        create: { customer_id: args.customer_id, product_id: args.product_id, price: args.price },
      });
      return `✅ Đã lưu giá ${Number(args.price).toLocaleString()} VND cho KH này + SP này [id:${p.id}]`;
    },
  },
  {
    schema: {
      type: 'function',
      function: {
        name: 'upsert_supplier_price',
        description: 'Tạo/sửa giá NCC cho 1 sản phẩm',
        parameters: {
          type: 'object',
          properties: {
            supplier_id: { type: 'string' }, product_id: { type: 'string' },
            purchase_price: { type: 'number' }, moq: { type: 'number' },
            lead_time_days: { type: 'number' }, is_preferred: { type: 'boolean' },
          },
          required: ['supplier_id', 'product_id', 'purchase_price'],
        },
      },
    },
    handler: async (args) => {
      const existing = await prisma.supplierPrice.findUnique({
        where: { supplier_id_product_id: { supplier_id: args.supplier_id, product_id: args.product_id } },
      });
      if (args.is_preferred) {
        await prisma.supplierPrice.updateMany({ where: { product_id: args.product_id, is_preferred: true }, data: { is_preferred: false } });
      }
      const p = existing
        ? await prisma.supplierPrice.update({ where: { id: existing.id }, data: { purchase_price: args.purchase_price, moq: args.moq, lead_time_days: args.lead_time_days, is_preferred: args.is_preferred } })
        : await prisma.supplierPrice.create({ data: { supplier_id: args.supplier_id, product_id: args.product_id, purchase_price: args.purchase_price, moq: args.moq, lead_time_days: args.lead_time_days, is_preferred: args.is_preferred || false } });
      return `✅ Đã lưu giá NCC ${Number(args.purchase_price).toLocaleString()} VND [id:${p.id}]`;
    },
  },
  {
    schema: {
      type: 'function',
      function: {
        name: 'delete_customer_product_price',
        description: 'Xoá giá riêng của 1 KH cho 1 SP (id UUID của bản ghi customer_product_price)',
        parameters: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
      },
    },
    handler: async (args) => {
      const { CustomerProductPriceService } = await import('../../../customer-product-price/customer-product-price.service');
      await CustomerProductPriceService.delete(args.id);
      return `✓ Đã xoá giá KH cho SP [id:${args.id}]`;
    },
  },
  {
    schema: {
      type: 'function',
      function: {
        name: 'delete_supplier_price',
        description: 'Xoá giá NCC cho 1 sản phẩm (id UUID của bản ghi supplier_price)',
        parameters: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
      },
    },
    handler: async (args) => {
      const { SupplierPriceService } = await import('../../../supplier-price/supplier-price.service');
      await SupplierPriceService.delete(args.id);
      return `✓ Đã xoá giá NCC cho SP [id:${args.id}]`;
    },
  },
];
