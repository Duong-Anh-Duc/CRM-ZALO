import prisma from '../../lib/prisma';

export class CustomerProductPriceService {
  static async listByCustomer(customer_id: string) {
    return prisma.customerProductPrice.findMany({
      where: { customer_id },
      include: { product: { select: { id: true, sku: true, name: true } } },
      orderBy: { updated_at: 'desc' },
    });
  }

  static async upsert(data: { customer_id: string; product_id: string; price: number }) {
    return prisma.customerProductPrice.upsert({
      where: { customer_id_product_id: { customer_id: data.customer_id, product_id: data.product_id } },
      update: { price: data.price },
      create: { customer_id: data.customer_id, product_id: data.product_id, price: data.price },
      include: { product: { select: { id: true, sku: true, name: true } } },
    });
  }

  static async delete(id: string) {
    await prisma.customerProductPrice.delete({ where: { id } });
    return { id };
  }
}
