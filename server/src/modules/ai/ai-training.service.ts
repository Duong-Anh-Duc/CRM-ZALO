import prisma from '../../lib/prisma';
import logger from '../../utils/logger';
import { t } from '../../locales';

export class AiTrainingService {
  static getCategories() {
    return {
      PRODUCT_ALIAS: t('training.productAlias'),
      ORDER_EXAMPLE: t('training.orderExample'),
      CORRECTION: t('training.correction'),
      BUSINESS_RULE: t('training.businessRule'),
      CUSTOMER_INFO: t('training.customerInfo'),
    };
  }

  static async list(category?: string) {
    return prisma.aiTraining.findMany({
      where: {
        ...(category && { category }),
        is_active: true,
      },
      orderBy: { created_at: 'desc' },
    });
  }

  static async create(data: { category: string; title: string; content: string; created_by?: string }) {
    const entry = await prisma.aiTraining.create({ data });
    logger.info(`AI Training: added "${data.title}" in ${data.category}`);
    return entry;
  }

  static async update(id: string, data: { title?: string; content?: string; category?: string }) {
    return prisma.aiTraining.update({ where: { id }, data });
  }

  static async remove(id: string) {
    return prisma.aiTraining.update({ where: { id }, data: { is_active: false } });
  }

  /**
   * Build training context string to inject into AI prompts.
   * This is the core: all training data gets compiled into prompt context.
   */
  static async buildTrainingContext(): Promise<string> {
    const entries = await prisma.aiTraining.findMany({
      where: { is_active: true },
      orderBy: { category: 'asc' },
    });

    if (entries.length === 0) return '';

    const grouped: Record<string, typeof entries> = {};
    for (const e of entries) {
      if (!grouped[e.category]) grouped[e.category] = [];
      grouped[e.category].push(e);
    }

    const sections: string[] = [];

    if (grouped.PRODUCT_ALIAS?.length) {
      sections.push(
        'TÊN GỌI KHÁC CỦA SẢN PHẨM (khi khách dùng tên này thì hiểu là sản phẩm tương ứng):',
        ...grouped.PRODUCT_ALIAS.map((e) => `  - ${e.title}: ${e.content}`),
      );
    }

    if (grouped.ORDER_EXAMPLE?.length) {
      sections.push(
        '',
        'VÍ DỤ TIN NHẮN ĐẶT HÀNG (học theo các mẫu này để nhận diện đơn hàng chính xác hơn):',
        ...grouped.ORDER_EXAMPLE.map((e) => `  - Tin nhắn: "${e.title}" → ${e.content}`),
      );
    }

    if (grouped.CORRECTION?.length) {
      sections.push(
        '',
        'SỬA LỖI TRƯỚC ĐÓ (tránh lặp lại sai lầm này):',
        ...grouped.CORRECTION.map((e) => `  - ${e.title}: ${e.content}`),
      );
    }

    if (grouped.BUSINESS_RULE?.length) {
      sections.push(
        '',
        'QUY TẮC KINH DOANH (luôn tuân theo):',
        ...grouped.BUSINESS_RULE.map((e) => `  - ${e.title}: ${e.content}`),
      );
    }

    if (grouped.CUSTOMER_INFO?.length) {
      sections.push(
        '',
        'THÔNG TIN KHÁCH HÀNG QUAN TRỌNG:',
        ...grouped.CUSTOMER_INFO.map((e) => `  - ${e.title}: ${e.content}`),
      );
    }

    return '\n\n--- KIẾN THỨC ĐÃ ĐƯỢC HUẤN LUYỆN ---\n' + sections.join('\n') + '\n--- HẾT KIẾN THỨC ---';
  }
}
