import prisma from '../../lib/prisma';
import { AppError } from '../../middleware/error.middleware';
import { t } from '../../locales';

export class SupplierPriceService {
  static async create(data: { supplier_id: string; product_id: string; purchase_price: number; moq?: number | null; lead_time_days?: number | null; is_preferred?: boolean }) {
    const existing = await prisma.supplierPrice.findUnique({
      where: { supplier_id_product_id: { supplier_id: data.supplier_id, product_id: data.product_id } },
    });
    if (existing) throw new AppError(t('supplierPrice.alreadyExists'), 400);

    if (data.is_preferred) {
      await prisma.supplierPrice.updateMany({
        where: { product_id: data.product_id, is_preferred: true },
        data: { is_preferred: false },
      });
    }

    return prisma.supplierPrice.create({
      data: {
        supplier_id: data.supplier_id,
        product_id: data.product_id,
        purchase_price: data.purchase_price,
        moq: data.moq ?? null,
        lead_time_days: data.lead_time_days ?? null,
        is_preferred: data.is_preferred ?? false,
      },
      include: { supplier: true },
    });
  }

  static async update(id: string, data: { purchase_price?: number; moq?: number | null; lead_time_days?: number | null; is_preferred?: boolean }) {
    const current = await prisma.supplierPrice.findUnique({ where: { id } });
    if (!current) throw new AppError(t('supplierPrice.notFound'), 404);

    if (data.is_preferred) {
      await prisma.supplierPrice.updateMany({
        where: { product_id: current.product_id, is_preferred: true, NOT: { id } },
        data: { is_preferred: false },
      });
    }

    return prisma.supplierPrice.update({
      where: { id },
      data,
      include: { supplier: true },
    });
  }

  static async delete(id: string) {
    await prisma.supplierPrice.delete({ where: { id } });
    return { id };
  }
}
