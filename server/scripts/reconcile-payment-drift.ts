import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');

async function main() {
  console.log(`Mode: ${APPLY ? 'APPLY (will modify DB)' : 'DRY RUN (use --apply to persist)'}\n`);

  const receivables = await prisma.receivable.findMany({
    where: { paid_amount: { gt: 0 } },
    include: { payments: { orderBy: { payment_date: 'asc' } } },
  });

  const drift = receivables
    .map((r) => ({ r, sum: r.payments.reduce((s, p) => s + p.amount, 0) }))
    .filter((x) => Math.abs(x.sum - x.r.paid_amount) > 0.01);

  console.log(`Found ${drift.length} receivables with payment drift.\n`);

  let totalDiff = 0;
  const updates: { paymentId: string; oldAmount: number; newAmount: number; invoice: string }[] = [];

  for (const { r, sum } of drift) {
    const diff = sum - r.paid_amount;
    totalDiff += diff;

    // Distribute the correction across payments proportionally, truncating from the LAST payment.
    // For single-payment records (the common case), simply set amount = paid_amount.
    if (r.payments.length === 1) {
      const p = r.payments[0];
      updates.push({ paymentId: p.id, oldAmount: p.amount, newAmount: r.paid_amount, invoice: r.invoice_number });
    } else {
      // Multiple payments: reduce the last one by the diff (preserves earlier payment history)
      const lastPayment = r.payments[r.payments.length - 1];
      const newAmount = Math.max(0, lastPayment.amount - diff);
      updates.push({ paymentId: lastPayment.id, oldAmount: lastPayment.amount, newAmount, invoice: r.invoice_number });
    }
  }

  console.log('Planned updates:');
  for (const u of updates) {
    console.log(`  ${u.invoice} | payment ${u.paymentId.slice(0, 8)}… | ${u.oldAmount.toLocaleString()} → ${u.newAmount.toLocaleString()}`);
  }
  console.log(`\nTotal drift to reconcile: ${totalDiff.toLocaleString()}`);

  if (APPLY) {
    console.log('\nApplying updates…');
    for (const u of updates) {
      await prisma.receivablePayment.update({
        where: { id: u.paymentId },
        data: { amount: u.newAmount },
      });
    }
    console.log(`✓ Updated ${updates.length} payment records.`);
  } else {
    console.log('\n(dry run — pass --apply to persist)');
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
