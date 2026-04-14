import prisma from '../../lib/prisma';
import logger from '../../utils/logger';

export class AiTrainingService {
  // Lấy tất cả categories đang có trong DB (dynamic, không hardcode)
  static async getCategories() {
    const entries = await prisma.aiTraining.findMany({
      where: { is_active: true },
      select: { category: true },
      distinct: ['category'],
      orderBy: { category: 'asc' },
    });
    return entries.map((e) => e.category);
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
   * Dynamic: tự group theo category, không hardcode.
   */
  static async buildTrainingContext(): Promise<string> {
    const entries = await prisma.aiTraining.findMany({
      where: { is_active: true },
      orderBy: { category: 'asc' },
    });

    if (entries.length === 0) return '';

    // Group by category
    const grouped: Record<string, typeof entries> = {};
    for (const e of entries) {
      if (!grouped[e.category]) grouped[e.category] = [];
      grouped[e.category].push(e);
    }

    // Build context — mỗi category thành 1 section
    const sections: string[] = [];
    for (const [category, items] of Object.entries(grouped)) {
      sections.push(`\n[${category}]`);
      for (const item of items) {
        sections.push(`  - ${item.title}: ${item.content}`);
      }
    }

    return '\n\n--- KIẾN THỨC ĐÃ ĐƯỢC HUẤN LUYỆN ---' + sections.join('\n') + '\n--- HẾT KIẾN THỨC ---';
  }
}
