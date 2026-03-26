import cron from 'node-cron';
import prisma from '../lib/prisma';
import { AlertService } from '../modules/alert/alert.service';
import logger from '../utils/logger';

/**
 * Daily job at 7:00 AM to:
 * 1. Mark overdue receivables/payables
 * 2. Generate delivery alerts for purchase orders
 */
export function startOverdueChecker() {
  cron.schedule('0 7 * * *', async () => {
    logger.info('Running daily overdue checker...');

    try {
      // Mark overdue receivables
      const overdueReceivables = await prisma.receivable.updateMany({
        where: {
          due_date: { lt: new Date() },
          status: { in: ['UNPAID', 'PARTIAL'] },
        },
        data: { status: 'OVERDUE' },
      });
      logger.info(`Marked ${overdueReceivables.count} receivables as overdue`);

      // Mark overdue payables
      const overduePayables = await prisma.payable.updateMany({
        where: {
          due_date: { lt: new Date() },
          status: { in: ['UNPAID', 'PARTIAL'] },
        },
        data: { status: 'OVERDUE' },
      });
      logger.info(`Marked ${overduePayables.count} payables as overdue`);

      // Generate delivery alerts
      const alertCount = await AlertService.generateDeliveryAlerts();
      logger.info(`Generated ${alertCount} delivery alerts`);
    } catch (error) {
      logger.error('Overdue checker failed:', error);
    }
  });

  logger.info('Overdue checker scheduled (daily at 7:00 AM)');
}
