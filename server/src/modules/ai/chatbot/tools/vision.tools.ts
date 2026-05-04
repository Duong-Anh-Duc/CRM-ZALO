import prisma from '../../../../lib/prisma';
import { ToolDefinition } from '../types';
import { identifyProductFromImage } from '../vision';

export const visionTools: ToolDefinition[] = [
  {
    schema: {
      type: 'function',
      function: {
        name: 'find_product_by_image',
        description: 'Tìm SP từ ảnh. Có thể truyền nhiều ảnh cùng 1 SP để tổng hợp chính xác hơn. Trích xuất thuộc tính (loại, chất liệu, dung tích, màu, SKU/brand trên nhãn) rồi fuzzy-match catalog. LUÔN dùng tool này thay vì đoán keyword cho search_product.',
        parameters: {
          type: 'object',
          properties: {
            image_urls: {
              type: 'array',
              items: { type: 'string' },
              minItems: 1,
              description: 'Mảng URL ảnh (1 hoặc nhiều ảnh của CÙNG 1 sản phẩm).',
            },
          },
          required: ['image_urls'],
        },
      },
    },
    handler: async (args) => {
      let imageUrls: string[] = [];
      if (Array.isArray(args.image_urls)) {
        imageUrls = args.image_urls.filter((u: unknown): u is string => typeof u === 'string' && u.length > 0);
      } else if (typeof args.image_url === 'string' && args.image_url) {
        imageUrls = [args.image_url];
      }
      if (imageUrls.length === 0) return '⚠️ Thiếu image_urls.';
      const attrs = await identifyProductFromImage(imageUrls);
      const { ProductService } = await import('../../../product/product.service');

      const toCard = (p: any) => ({
        id: p.id,
        sku: p.sku,
        name: p.name,
        material: p.material ?? undefined,
        capacity_ml: p.capacity_ml ?? undefined,
        price: p.retail_price != null ? Number(p.retail_price) : undefined,
        image: p.images?.[0]?.url ?? undefined,
        moq: p.moq ?? undefined,
      });

      if (attrs.sku_tu_nhan && attrs.sku_tu_nhan.trim()) {
        const skuRaw = attrs.sku_tu_nhan.trim();
        const skuMatch = await prisma.product.findFirst({
          where: {
            OR: [
              { sku: { equals: skuRaw, mode: 'insensitive' } },
              { sku: { contains: skuRaw, mode: 'insensitive' } },
            ],
          },
          include: { images: { where: { is_primary: true }, take: 1 } },
        });
        if (skuMatch) {
          const specs: string[] = [];
          if ((skuMatch as any).capacity_ml) specs.push(`${(skuMatch as any).capacity_ml}ml`);
          if ((skuMatch as any).material) specs.push((skuMatch as any).material);
          const specStr = specs.length ? ` (${specs.join(', ')})` : '';
          const price = (skuMatch as any).retail_price ? ` | ~${Number((skuMatch as any).retail_price).toLocaleString()}đ` : '';
          const header = `Nhận diện ảnh → SKU trên nhãn: ${skuRaw} (match trực tiếp)`;
          const cardBlock = `<product-cards>\n${JSON.stringify([toCard(skuMatch)])}\n</product-cards>`;
          return [cardBlock, header, 'Top match:', `1. ${skuMatch.name}${specStr} · SKU ${skuMatch.sku} [id:${skuMatch.id}]${price}`].join('\n');
        }
      }

      const products = await ProductService.fuzzyMatchByAttributes(attrs);
      if (products.length === 0) return `Nhận diện: ${JSON.stringify(attrs)}\nKhông có sản phẩm match trong DB.`;
      const header = `Nhận diện ảnh → loại=${attrs.loai ?? '?'} chất_liệu=${attrs.chat_lieu ?? '?'} dung_tích=${attrs.dung_tich_ml ?? '?'}ml${attrs.brand ? ` brand=${attrs.brand}` : ''}${attrs.sku_tu_nhan ? ` sku_nhãn=${attrs.sku_tu_nhan}` : ''} (confidence ${attrs.confidence})`;
      const rows = products.map((p: any, i: number) => {
        const specs: string[] = [];
        if (p.capacity_ml) specs.push(`${p.capacity_ml}ml`);
        if (p.material) specs.push(p.material);
        const specStr = specs.length ? ` (${specs.join(', ')})` : '';
        const price = p.retail_price ? ` | ~${Number(p.retail_price).toLocaleString()}đ` : '';
        return `${i + 1}. ${p.name}${specStr} · SKU ${p.sku} [id:${p.id}]${price}`;
      });
      const cards = products.slice(0, 5).map(toCard);
      const cardBlock = `<product-cards>\n${JSON.stringify(cards)}\n</product-cards>`;
      return [cardBlock, header, 'Top match:', ...rows].join('\n');
    },
  },
];
