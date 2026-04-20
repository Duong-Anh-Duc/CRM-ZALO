import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const receivables = await prisma.receivable.findMany({
    where: { paid_amount: { gt: 0 } },
    include: {
      payments: { orderBy: { payment_date: 'asc' } },
      sales_order: { select: { order_code: true } },
    },
  });
  const drift = receivables
    .map((r) => ({
      r,
      sum: r.payments.reduce((s, p) => s + p.amount, 0),
    }))
    .filter((x) => Math.abs(x.sum - x.r.paid_amount) > 0.01);

  console.log(`Drift records: ${drift.length}\n`);

  for (const { r, sum } of drift.slice(0, 5)) {
    console.log(`\n═══ ${r.invoice_number} (SO: ${r.sales_order?.order_code}) ═══`);
    console.log(`  original_amount: ${r.original_amount.toLocaleString()}`);
    console.log(`  paid_amount:     ${r.paid_amount.toLocaleString()}`);
    console.log(`  remaining:       ${r.remaining.toLocaleString()}`);
    console.log(`  sum(payments):   ${sum.toLocaleString()}`);
    console.log(`  diff:            ${(r.paid_amount - sum).toLocaleString()}`);
    console.log(`  status:          ${r.status}`);
    console.log(`  Payments (${r.payments.length}):`);
    for (const p of r.payments) {
      console.log(`    - ${p.payment_date.toISOString().slice(0, 10)} | ${p.amount.toLocaleString()} | ${p.method} | ref: ${p.reference || '—'} | created_at: ${p.created_at.toISOString().slice(0, 16)}`);
    }
  }

  // Check if drift correlates with SalesReturn
  console.log('\n\n=== Check SalesReturn correlation ===');
  for (const { r } of drift.slice(0, 10)) {
    const so = await prisma.salesOrder.findFirst({ where: { order_code: r.sales_order?.order_code }, select: { id: true } });
    if (!so) continue;
    const returns = await prisma.salesReturn.findMany({
      where: { sales_order_id: so.id },
      select: { return_code: true, total_amount: true, status: true },
    });
    if (returns.length > 0) {
      console.log(`  ${r.invoice_number}: ${returns.length} returns → ${returns.map((x) => `${x.return_code}=${x.total_amount.toLocaleString()}(${x.status})`).join(', ')}`);
    } else {
      console.log(`  ${r.invoice_number}: NO returns`);
    }
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
