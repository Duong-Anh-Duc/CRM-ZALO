import prisma from '../../lib/prisma';
import { AppError } from '../../middleware/error.middleware';
import { PlasticMaterial } from '@prisma/client';
import { t } from '../../locales';
import { delCache } from '../../lib/redis';
import { uploadImage, deleteImage, deleteImages } from '../../lib/cloudinary';

interface ProductFilters {
  page?: number;
  limit?: number;
  search?: string;
  category_id?: string;
  material?: PlasticMaterial;
  supplier_id?: string;
  is_active?: boolean;
}

export class ProductService {
  static async list(filters: ProductFilters) {
    const page = Number(filters.page) || 1;
    const limit = Number(filters.limit) || 20;
    const { search, category_id, material, supplier_id, is_active = true } = filters;

    const where = {
      is_active,
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { sku: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
      ...(category_id && { category_id }),
      ...(material && { material }),
      ...(supplier_id && { supplier_prices: { some: { supplier_id } } }),
    };

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: {
          category: { select: { id: true, name: true } },
          images: { orderBy: { sort_order: 'asc' } },
          price_tiers: { orderBy: { min_qty: 'asc' } },
          supplier_prices: { include: { supplier: { select: { id: true, company_name: true } } } },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
      prisma.product.count({ where }),
    ]);

    return { products, total, page, limit, total_pages: Math.ceil(total / limit) };
  }

  static async getById(id: string) {
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
        images: { orderBy: { sort_order: 'asc' } },
        price_tiers: { orderBy: { min_qty: 'asc' } },
        supplier_prices: { include: { supplier: { select: { id: true, company_name: true } } } },
        cap_compatibles: { include: { cap: { select: { id: true, sku: true, name: true } } } },
        compatible_with: { include: { bottle: { select: { id: true, sku: true, name: true } } } },
      },
    });
    if (!product) throw new AppError(t('product.notFound'), 404);
    return product;
  }

  static async generateSku(material: PlasticMaterial): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `PLB-${material}-${year}-`;
    const lastProduct = await prisma.product.findFirst({
      where: { sku: { startsWith: prefix } },
      orderBy: { sku: 'desc' },
    });

    const seq = lastProduct ? parseInt(lastProduct.sku.split('-').pop() || '0', 10) + 1 : 1;
    return `${prefix}${seq.toString().padStart(4, '0')}`;
  }

  static async create(data: Record<string, unknown>, files?: Express.Multer.File[]) {
    const material = data.material as PlasticMaterial;
    const sku = data.sku as string || await this.generateSku(material);

    const existing = await prisma.product.findUnique({ where: { sku } });
    if (existing) throw new AppError(t('product.skuExists'), 400);

    const { price_tiers, supplier_prices, images: _images, cap_compatible_ids, ...productData } = data as Record<string, unknown>;

    // Upload images to Cloudinary
    let imageRecords: Array<{ url: string; public_id: string; is_primary: boolean; sort_order: number }> = [];
    if (files?.length) {
      const uploads = await Promise.all(
        files.map((file, index) => uploadImage(file.buffer, 'packflow/products')),
      );
      imageRecords = uploads.map((result, index) => ({
        url: result.secure_url,
        public_id: result.public_id,
        is_primary: index === 0,
        sort_order: index,
      }));
    }

    const product = await prisma.product.create({
      data: {
        ...productData as Record<string, unknown>,
        sku,
        price_tiers: price_tiers ? {
          create: (price_tiers as Array<{ min_qty: number; price: number }>),
        } : undefined,
        images: imageRecords.length > 0 ? {
          create: imageRecords,
        } : undefined,
      } as never,
      include: { category: true, images: true, price_tiers: true },
    });

    await delCache('cache:/api/products*');
    return product;
  }

  static async update(id: string, data: Record<string, unknown>) {
    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) throw new AppError(t('product.notFound'), 404);

    const { price_tiers, supplier_prices, images, ...productData } = data;

    const updated = await prisma.$transaction(async (tx) => {
      if (price_tiers) {
        await tx.priceTier.deleteMany({ where: { product_id: id } });
        await tx.priceTier.createMany({
          data: (price_tiers as Array<{ min_qty: number; price: number }>).map((tier) => ({
            product_id: id,
            ...tier,
          })),
        });
      }

      return tx.product.update({
        where: { id },
        data: productData as never,
        include: { category: true, images: true, price_tiers: true },
      });
    });

    await delCache('cache:/api/products*');
    return updated;
  }

  static async softDelete(id: string) {
    const result = await prisma.product.update({ where: { id }, data: { is_active: false } });
    await delCache('cache:/api/products*');
    return result;
  }

  static async getCompatibleCaps(productId: string) {
    const product = await prisma.product.findUnique({ where: { id: productId }, select: { neck_spec: true } });
    if (!product?.neck_spec) return [];

    return prisma.product.findMany({
      where: {
        neck_spec: product.neck_spec,
        id: { not: productId },
        is_active: true,
      },
      select: { id: true, sku: true, name: true, retail_price: true },
    });
  }

  // ──── Image management ────

  static async uploadImages(productId: string, files: Express.Multer.File[]) {
    const product = await prisma.product.findUnique({ where: { id: productId }, select: { id: true } });
    if (!product) throw new AppError(t('product.notFound'), 404);

    const existingCount = await prisma.productImage.count({ where: { product_id: productId } });

    const uploads = await Promise.all(
      files.map((file) => uploadImage(file.buffer, 'packflow/products')),
    );

    const images = await prisma.productImage.createManyAndReturn({
      data: uploads.map((result, index) => ({
        product_id: productId,
        url: result.secure_url,
        public_id: result.public_id,
        is_primary: existingCount === 0 && index === 0,
        sort_order: existingCount + index,
      })),
    });

    await delCache('cache:/api/products*');
    return images;
  }

  static async deleteImage(productId: string, imageId: string) {
    const image = await prisma.productImage.findFirst({
      where: { id: imageId, product_id: productId },
    });
    if (!image) throw new AppError(t('upload.imageNotFound'), 404);

    // Delete from Cloudinary
    if (image.public_id) {
      await deleteImage(image.public_id);
    }

    await prisma.productImage.delete({ where: { id: imageId } });

    // If deleted image was primary, set next image as primary
    if (image.is_primary) {
      const nextImage = await prisma.productImage.findFirst({
        where: { product_id: productId },
        orderBy: { sort_order: 'asc' },
      });
      if (nextImage) {
        await prisma.productImage.update({
          where: { id: nextImage.id },
          data: { is_primary: true },
        });
      }
    }

    await delCache('cache:/api/products*');
  }

  static async setPrimaryImage(productId: string, imageId: string) {
    const image = await prisma.productImage.findFirst({
      where: { id: imageId, product_id: productId },
    });
    if (!image) throw new AppError(t('upload.imageNotFound'), 404);

    await prisma.$transaction([
      prisma.productImage.updateMany({
        where: { product_id: productId },
        data: { is_primary: false },
      }),
      prisma.productImage.update({
        where: { id: imageId },
        data: { is_primary: true },
      }),
    ]);

    await delCache('cache:/api/products*');
    return image;
  }
}
