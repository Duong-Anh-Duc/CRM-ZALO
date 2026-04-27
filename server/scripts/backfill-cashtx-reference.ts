/**
 * Backfill cash_transactions.reference_id from legacy notes marker `pay_ids:<csv>`.
 * Strategy:
 *  - For each cash_tx with is_auto=true AND notes LIKE 'pay_ids:%' AND reference_id IS NULL:
 *    - Parse payment id list from notes
 *    - If exactly 1 id → populate reference_id + reference_type
 *    - If >1 ids → split: keep first id on existing tx (with prorated amount),
 *      then create N-1 new tx for the others. Keeps historical audit consistent.
 *  - reference_type inferred from cash_tx.type (INCOME → RECEIVABLE_PAYMENT, EXPENSE → PAYABLE_PAYMENT)
 */
import prisma from '../src/lib/prisma';

async function main() {
  const legacyTxs = await prisma.cashTransaction.findMany({
    where: {
      is_auto: true,
      reference_id: null,
      notes: { startsWith: 'pay_ids:' },
    },
    orderBy: { created_at: 'asc' },
  });

  console.log(`Found ${legacyTxs.length} legacy auto cash_transactions to backfill`);

  let updated = 0;
  let split = 0;
  let skipped = 0;

  for (const tx of legacyTxs) {
    const csv = (tx.notes || '').replace('pay_ids:', '');
    const ids = csv.split(',').map((s) => s.trim()).filter(Boolean);
    if (ids.length === 0) {
      skipped++;
      continue;
    }
    const refType = tx.type === 'INCOME' ? 'RECEIVABLE_PAYMENT' : 'PAYABLE_PAYMENT';

    if (ids.length === 1) {
      await prisma.cashTransaction.update({
        where: { id: tx.id },
        data: { reference_id: ids[0], reference_type: refType, notes: null },
      });
      updated++;
      continue;
    }

    // Multi-id case: lookup actual amounts per payment to split correctly
    const payments = refType === 'RECEIVABLE_PAYMENT'
      ? await prisma.receivablePayment.findMany({ where: { id: { in: ids } }, select: { id: true, amount: true } })
      : await prisma.payablePayment.findMany({ where: { id: { in: ids } }, select: { id: true, amount: true } });

    const found = new Map(payments.map((p) => [p.id, Number(p.amount)]));
    const missing = ids.filter((id) => !found.has(id));
    if (missing.length === ids.length) {
      // No payments found (orphan tx) — clear notes only
      await prisma.cashTransaction.update({
        where: { id: tx.id },
        data: { notes: null },
      });
      skipped++;
      continue;
    }

    // Update existing tx for first found id
    const firstId = ids.find((id) => found.has(id))!;
    await prisma.cashTransaction.update({
      where: { id: tx.id },
      data: {
        reference_id: firstId,
        reference_type: refType,
        amount: found.get(firstId)!,
        notes: null,
      },
    });

    // Create new tx for the rest
    const rest = ids.filter((id) => id !== firstId && found.has(id));
    for (const id of rest) {
      await prisma.cashTransaction.create({
        data: {
          type: tx.type,
          category_id: tx.category_id,
          date: tx.date,
          amount: found.get(id)!,
          description: tx.description,
          reference: tx.reference,
          payment_method: tx.payment_method,
          is_auto: true,
          reference_id: id,
          reference_type: refType,
        },
      });
    }
    split++;
    updated++;
  }

  console.log(`✔ Updated ${updated}, Split ${split}, Skipped ${skipped}`);
}

main()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
