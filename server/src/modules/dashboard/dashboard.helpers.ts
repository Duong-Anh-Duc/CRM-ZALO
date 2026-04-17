import { DebtStatus } from '@prisma/client';
import prisma from '../../lib/prisma';
import dayjs from 'dayjs';

export interface AgingBucket {
  count: number;
  total: number;
}

export interface AgingResult {
  current: AgingBucket;
  '1_30': AgingBucket;
  '31_60': AgingBucket;
  '60_plus': AgingBucket;
}

type DebtModel = 'receivable' | 'payable';

/**
 * Compute overdue aging buckets for receivables or payables.
 * - current: not yet past due_date
 * - 1_30: 1-30 days overdue
 * - 31_60: 31-60 days overdue
 * - 60_plus: 60+ days overdue
 */
export async function getAgingBuckets(model: DebtModel): Promise<AgingResult> {
  const today = dayjs().startOf('day');
  const activeStatuses: DebtStatus[] = ['UNPAID', 'PARTIAL', 'OVERDUE'];

  const records = model === 'receivable'
    ? await prisma.receivable.findMany({
        where: { status: { in: activeStatuses } },
        select: { due_date: true, remaining: true },
      })
    : await prisma.payable.findMany({
        where: { status: { in: activeStatuses } },
        select: { due_date: true, remaining: true },
      });

  const result: AgingResult = {
    current: { count: 0, total: 0 },
    '1_30': { count: 0, total: 0 },
    '31_60': { count: 0, total: 0 },
    '60_plus': { count: 0, total: 0 },
  };

  for (const record of records) {
    const daysOverdue = today.diff(dayjs(record.due_date), 'day');
    let bucket: keyof AgingResult;

    if (daysOverdue <= 0) {
      bucket = 'current';
    } else if (daysOverdue <= 30) {
      bucket = '1_30';
    } else if (daysOverdue <= 60) {
      bucket = '31_60';
    } else {
      bucket = '60_plus';
    }

    result[bucket].count += 1;
    result[bucket].total += record.remaining;
  }

  return result;
}
