import prisma from '../../lib/prisma';
import { t } from '../../locales';
import dayjs from 'dayjs';

export class AlertService {
  static async list(filters: { page?: number; limit?: number; is_read?: string | boolean; type?: string }) {
    const page = Number(filters.page) || 1;
    const limit = Number(filters.limit) || 20;
    const { type } = filters;
    const isRead = filters.is_read === 'true' ? true : filters.is_read === 'false' ? false : typeof filters.is_read === 'boolean' ? filters.is_read : undefined;

    const where = {
      ...(isRead !== undefined && { is_read: isRead }),
      ...(type && { type }),
    };

    const [alerts, total] = await Promise.all([
      prisma.alert.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
      prisma.alert.count({ where }),
    ]);

    return { alerts, total, page, limit, total_pages: Math.ceil(total / limit) };
  }

  static async markAsRead(id: string) {
    return prisma.alert.update({ where: { id }, data: { is_read: true } });
  }

  static async takeAction(id: string, action: string, newExpectedDate?: string) {
    const data: Record<string, unknown> = { action_taken: action, is_read: true };
    if (newExpectedDate) data.new_expected_date = new Date(newExpectedDate);
    return prisma.alert.update({ where: { id }, data: data as never });
  }

  static async getUnreadCount() {
    return prisma.alert.count({ where: { is_read: false } });
  }

  /**
   * Run daily to generate delivery reminder alerts for open purchase orders
   */
  static async generateDeliveryAlerts() {
    const now = dayjs();

    const openPOs = await prisma.purchaseOrder.findMany({
      where: {
        status: { in: ['CONFIRMED', 'PROCESSING', 'SHIPPING'] },
        expected_delivery: { not: null },
      },
      include: { supplier: { select: { company_name: true } } },
    });

    const alerts: Array<{ type: string; title: string; message: string; purchase_order_id: string }> = [];

    for (const po of openPOs) {
      if (!po.expected_delivery) continue;
      const daysUntilDue = dayjs(po.expected_delivery).diff(now, 'day');

      if (daysUntilDue === 3) {
        alerts.push({
          type: 'WARNING',
          title: t('alert.approachingDeadline', { code: po.order_code, days: 3 }),
          message: t('alert.approachingDeadline', { code: po.order_code, days: 3 }),
          purchase_order_id: po.id,
        });
      } else if (daysUntilDue === 0) {
        alerts.push({
          type: 'URGENT',
          title: t('alert.dueToday', { code: po.order_code }),
          message: `${t('alert.dueToday', { code: po.order_code })}. ${t('alert.deliveryNotConfirmed')}`,
          purchase_order_id: po.id,
        });
      } else if (daysUntilDue === -1) {
        alerts.push({
          type: 'CRITICAL',
          title: t('alert.overdueDays', { code: po.order_code, days: 1 }),
          message: t('alert.overdueDays', { code: po.order_code, days: 1 }),
          purchase_order_id: po.id,
        });
      } else if (daysUntilDue <= -3) {
        alerts.push({
          type: 'ESCALATION',
          title: t('alert.overdueDays', { code: po.order_code, days: Math.abs(daysUntilDue) }),
          message: `${t('alert.overdueDays', { code: po.order_code, days: Math.abs(daysUntilDue) })}. ${t('alert.reportToManager')}`,
          purchase_order_id: po.id,
        });
      }
    }

    if (alerts.length > 0) {
      await prisma.alert.createMany({ data: alerts });
    }

    return alerts.length;
  }
}
