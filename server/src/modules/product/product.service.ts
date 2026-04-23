import prisma from '../../lib/prisma';
import { AppError } from '../../middleware/error.middleware';
import { PlasticMaterial, Prisma } from '@prisma/client';
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
  color?: string;
  shape?: string;
  neck_type?: string;
  capacity_ml_min?: number;
  capacity_ml_max?: number;
  price_min?: number;
  price_max?: number;
  industry?: string;
}

export class ProductService {
  static async listCategories() {
    return prisma.category.findMany({ where: { is_active: true }, orderBy: { sort_order: 'asc' } });
  }

  static async list(filters: ProductFilters) {
    const page = Number(filters.page) || 1;
    const limit = Number(filters.limit) || 20;
    const { search, category_id, material, supplier_id, is_active = true, color, shape, neck_type, capacity_ml_min, capacity_ml_max, price_min, price_max, industry } = filters;

    const capMin = capacity_ml_min != null ? Number(capacity_ml_min) : undefined;
    const capMax = capacity_ml_max != null ? Number(capacity_ml_max) : undefined;
    const priceMin = price_min != null ? Number(price_min) : undefined;
    const priceMax = price_max != null ? Number(price_max) : undefined;

    const where: any = {
      is_active,
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { sku: { contains: search, mode: 'insensitive' as const } },
          { aliases: { some: { alias: { contains: search, mode: 'insensitive' as const } } } },
        ],
      }),
      ...(category_id && { category_id }),
      ...(material && { material }),
      ...(color && { color }),
      ...(shape && { shape }),
      ...(neck_type && { neck_type }),
      ...(supplier_id && { supplier_prices: { some: { supplier_id } } }),
      ...((capMin != null || capMax != null) && {
        capacity_ml: {
          ...(capMin != null && { gte: capMin }),
          ...(capMax != null && { lte: capMax }),
        },
      }),
      ...((priceMin != null || priceMax != null) && {
        retail_price: {
          ...(priceMin != null && { gte: priceMin }),
          ...(priceMax != null && { lte: priceMax }),
        },
      }),
      ...(industry && { industries: { has: industry } }),
    };

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: {
          category: { select: { id: true, name: true } },
          images: { orderBy: { sort_order: 'asc' }, take: 1 },
          aliases: { select: { alias: true }, take: 5 },
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
        sales_order_items: {
          include: { sales_order: { select: { id: true, order_code: true, order_date: true, status: true, customer: { select: { id: true, company_name: true, contact_name: true } } } } },
          orderBy: { sales_order: { order_date: 'desc' } },
          take: 20,
        },
        purchase_order_items: {
          include: { purchase_order: { select: { id: true, order_code: true, order_date: true, status: true, supplier: { select: { id: true, company_name: true } } } } },
          orderBy: { purchase_order: { order_date: 'desc' } },
          take: 20,
        },
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

    const { price_tiers, supplier_prices, images: _images, ...productData } = data as Record<string, unknown>;

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
    // Fire-and-forget embedding generation (don't block create response)
    this.updateProductEmbedding(product.id).catch(() => { /* silent — embed is optional */ });
    return product;
  }

  /** Generate + save embedding for a product (used on create/update). */
  private static async updateProductEmbedding(id: string) {
    const p = await prisma.product.findUnique({
      where: { id },
      select: {
        id: true, name: true, description: true,
        material: true, capacity_ml: true, shape: true, color: true, custom_color: true,
        neck_type: true, neck_spec: true, industries: true,
      },
    });
    if (!p) return;
    const { embedText, hashText, buildProductEmbeddingText } = await import('../../lib/embedding');
    const text = buildProductEmbeddingText(p as never);
    const hash = hashText(text);
    const existing = await prisma.$queryRaw<{ embedding_hash: string | null }[]>`
      SELECT embedding_hash FROM products WHERE id = ${p.id}
    `;
    if (existing[0]?.embedding_hash === hash) return;
    const vector = await embedText(text);
    if (!vector) return;
    const vectorStr = `[${vector.join(',')}]`;
    await prisma.$executeRaw(Prisma.sql`
      UPDATE products SET embedding = ${vectorStr}::vector, embedding_hash = ${hash} WHERE id = ${p.id}
    `);
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
    this.updateProductEmbedding(id).catch(() => { /* silent */ });
    return updated;
  }

  static async softDelete(id: string) {
    const result = await prisma.product.update({ where: { id }, data: { is_active: false } });
    await delCache('cache:/api/products*');
    return result;
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

  // ── Product Aliases (tên khách gọi) ──
  static async addAlias(productId: string, alias: string) {
    const trimmed = alias.trim();
    if (!trimmed) return null;
    return prisma.productAlias.upsert({
      where: { product_id_alias: { product_id: productId, alias: trimmed } },
      create: { product_id: productId, alias: trimmed },
      update: {},
    });
  }

  static async searchByAlias(query: string) {
    if (!query.trim()) return [];
    return prisma.productAlias.findMany({
      where: { alias: { contains: query.trim(), mode: 'insensitive' } },
      include: { product: { select: { id: true, sku: true, name: true, retail_price: true, images: { take: 1 } } } },
      take: 10,
    });
  }

  /**
   * Fuzzy-match products by packaging attributes extracted from customer image.
   * Strategy: fetch candidates by loosest possible criteria, then rank by closeness.
   * Always returns up to 5 results, even if match is imperfect (tư vấn gần nhất).
   */
  static async fuzzyMatchByAttributes(attrs: {
    loai?: string | null;
    chat_lieu?: string | null;
    dung_tich_ml?: number | null;
    mau?: string | null;
    hinh_dang?: string | null;
  }) {
    // Map loai keyword → Vietnamese name variants in DB (handle diacritics).
    // Product names in DB use full diacritics ("Chai", "Hũ", "Túi"...) but LLM
    // may return either "chai" (no diacritic) or "túi" (with) — match both.
    const LOAI_VARIANTS: Record<string, string[]> = {
      chai: ['chai'],
      hu: ['hũ', 'hu'],
      nap: ['nắp', 'nap'],
      can: ['can'],
      thung: ['thùng', 'thung'],
      tui: ['túi', 'tui'],
      mang: ['màng', 'mang'],
      hop: ['hộp', 'hop'],
    };
    const loaiKey = attrs.loai?.toLowerCase().replace(/[àáảãạăắằẳẵặâấầẩẫậ]/g, 'a').replace(/[èéẻẽẹêếềểễệ]/g, 'e').replace(/[ìíỉĩị]/g, 'i').replace(/[òóỏõọôốồổỗộơớờởỡợ]/g, 'o').replace(/[ùúủũụưứừửữự]/g, 'u').replace(/[ỳýỷỹỵ]/g, 'y').replace(/đ/g, 'd');
    const nameVariants = loaiKey ? (LOAI_VARIANTS[loaiKey] ?? [attrs.loai!]) : [];
    const nameFilter: Prisma.ProductWhereInput | undefined = nameVariants.length > 0
      ? { OR: nameVariants.map((v) => ({ name: { contains: v, mode: 'insensitive' as const } })) }
      : undefined;

    // Map AI-returned materials (OPP/PE/LDPE) to closest enum value in DB
    const MATERIAL_MAP: Record<string, PlasticMaterial | undefined> = {
      PET: 'PET', HDPE: 'HDPE', PP: 'PP', PVC: 'PVC', PS: 'PS', ABS: 'ABS',
      // Soft plastics commonly grouped under HDPE/PP in bag products
      PE: 'HDPE', LDPE: 'HDPE', OPP: 'PP',
    };
    const material = attrs.chat_lieu ? MATERIAL_MAP[attrs.chat_lieu.toUpperCase()] : undefined;
    const baseWhere: Prisma.ProductWhereInput = { is_active: true };
    if (material) baseWhere.material = material;
    if (nameFilter) Object.assign(baseWhere, nameFilter);

    const INCLUDE = { images: { where: { is_primary: true }, take: 1 } };

    // Fetch up to 50 candidates matching material + type
    let candidates = await prisma.product.findMany({ where: baseWhere, take: 50, include: INCLUDE });

    // Fallback 1: if no material+type match, drop MATERIAL (keep type — more important to user)
    if (candidates.length === 0 && nameFilter) {
      candidates = await prisma.product.findMany({
        where: { is_active: true, ...nameFilter },
        take: 50, include: INCLUDE,
      });
    }

    // Fallback 2: if still empty, drop TYPE — just filter by material
    if (candidates.length === 0 && material) {
      candidates = await prisma.product.findMany({
        where: { is_active: true, material },
        take: 50, include: INCLUDE,
      });
    }

    // Fallback 3: last resort — return recent active products
    if (candidates.length === 0) {
      candidates = await prisma.product.findMany({
        where: { is_active: true },
        take: 20, include: INCLUDE,
        orderBy: { updated_at: 'desc' },
      });
    }

    // Helper: strip diacritics for comparison
    const strip = (s: string) => s.toLowerCase()
      .replace(/[àáảãạăắằẳẵặâấầẩẫậ]/g, 'a').replace(/[èéẻẽẹêếềểễệ]/g, 'e')
      .replace(/[ìíỉĩị]/g, 'i').replace(/[òóỏõọôốồổỗộơớờởỡợ]/g, 'o')
      .replace(/[ùúủũụưứừửữự]/g, 'u').replace(/[ỳýỷỹỵ]/g, 'y').replace(/đ/g, 'd');

    // Semantic similarity via pgvector (optional — gracefully skip if embedding unavailable)
    const semanticScores = new Map<string, number>();
    try {
      const { embedText, buildQueryEmbeddingText } = await import('../../lib/embedding');
      const queryText = buildQueryEmbeddingText(attrs);
      if (queryText.length > 0) {
        const queryVector = await embedText(queryText);
        if (queryVector) {
          const candidateIds = candidates.map((c) => c.id);
          const vectorStr = `[${queryVector.join(',')}]`;
          // Cosine distance (<=>), convert to similarity (1 - distance)
          const uuidArr = `{${candidateIds.join(',')}}`;
          const results = await prisma.$queryRaw<{ id: string; similarity: number }[]>(Prisma.sql`
            SELECT id::text AS id, 1 - (embedding <=> ${vectorStr}::vector) AS similarity
            FROM products
            WHERE id::text = ANY(${uuidArr}::text[])
              AND embedding IS NOT NULL
          `);
          for (const r of results) semanticScores.set(r.id, Number(r.similarity));
        }
      }
    } catch {
      // Semantic search is a nice-to-have; fall through to attribute-only scoring.
    }

    // Score + rank candidates by attribute match + semantic similarity
    const scored = candidates.map((p) => {
      let score = 0;
      // Material match: +3
      if (attrs.chat_lieu && p.material === attrs.chat_lieu.toUpperCase()) score += 3;
      // Type (name contains): +2 — diacritic-insensitive
      if (loaiKey && strip(p.name).includes(loaiKey)) score += 2;
      // Capacity closeness: up to +3 (closer = higher)
      if (attrs.dung_tich_ml && attrs.dung_tich_ml > 0 && p.capacity_ml) {
        const ratio = Math.min(p.capacity_ml, attrs.dung_tich_ml) / Math.max(p.capacity_ml, attrs.dung_tich_ml);
        score += ratio * 3;
      }
      // Color match: +1
      if (attrs.mau && p.color === attrs.mau.toUpperCase()) score += 1;
      // Shape match: +1
      if (attrs.hinh_dang && p.shape === attrs.hinh_dang.toUpperCase()) score += 1;
      // Semantic similarity: up to +4 (cosine similarity scaled)
      const sim = semanticScores.get(p.id);
      if (sim !== undefined) score += sim * 4;
      return { product: p, score };
    });

    scored.sort((a, b) => b.score - a.score);
    const products = scored.slice(0, 5).map((s) => s.product);

    return products;
  }
}
