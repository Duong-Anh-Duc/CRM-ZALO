import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== Payment data consistency audit ===\n');

  // 1) Receivables paid>0 but no payment records
  const receivables = await prisma.receivable.findMany({
    where: { paid_amount: { gt: 0 } },
    include: { payments: true, customer: { select: { company_name: true, contact_name: true } } },
  });
  const rBroken = receivables.filter((r) => r.payments.length === 0);
  const rMismatch = receivables.filter((r) => {
    const sum = r.payments.reduce((s, p) => s + p.amount, 0);
    return r.payments.length > 0 && Math.abs(sum - r.paid_amount) > 0.01;
  });

  console.log(`Receivables with paid_amount > 0: ${receivables.length}`);
  console.log(`  → Missing payment records:  ${rBroken.length}`);
  console.log(`  → Sum(payments) ≠ paid_amount: ${rMismatch.length}`);
  if (rBroken.length > 0) {
    console.log('\n  Missing examples (up to 10):');
    for (const r of rBroken.slice(0, 10)) {
      console.log(`    • ${r.invoice_number} | ${r.customer?.company_name || r.customer?.contact_name} | paid=${r.paid_amount} | status=${r.status}`);
    }
  }
  if (rMismatch.length > 0) {
    console.log('\n  Mismatch examples (up to 10):');
    for (const r of rMismatch.slice(0, 10)) {
      const sum = r.payments.reduce((s, p) => s + p.amount, 0);
      console.log(`    • ${r.invoice_number} | paid=${r.paid_amount} | sum(payments)=${sum} | diff=${r.paid_amount - sum}`);
    }
  }

  // 2) Payables paid>0 but no payment records
  const payables = await prisma.payable.findMany({
    where: { paid_amount: { gt: 0 } },
    include: { payments: true, supplier: { select: { company_name: true } } },
  });
  const pBroken = payables.filter((p) => p.payments.length === 0);
  const pMismatch = payables.filter((p) => {
    const sum = p.payments.reduce((s, x) => s + x.amount, 0);
    return p.payments.length > 0 && Math.abs(sum - p.paid_amount) > 0.01;
  });

  console.log(`\nPayables with paid_amount > 0: ${payables.length}`);
  console.log(`  → Missing payment records:  ${pBroken.length}`);
  console.log(`  → Sum(payments) ≠ paid_amount: ${pMismatch.length}`);
  if (pBroken.length > 0) {
    console.log('\n  Missing examples (up to 10):');
    for (const p of pBroken.slice(0, 10)) {
      console.log(`    • ${p.invoice_number} | ${p.supplier?.company_name} | paid=${p.paid_amount} | status=${p.status}`);
    }
  }
  if (pMismatch.length > 0) {
    console.log('\n  Mismatch examples (up to 10):');
    for (const p of pMismatch.slice(0, 10)) {
      const sum = p.payments.reduce((s, x) => s + x.amount, 0);
      console.log(`    • ${p.invoice_number} | paid=${p.paid_amount} | sum(payments)=${sum} | diff=${p.paid_amount - sum}`);
    }
  }

  // 3) Receivables with remaining !== original - paid (invariant check)
  const allR = await prisma.receivable.findMany();
  const rBadInvariant = allR.filter((r) => Math.abs(r.remaining - (r.original_amount - r.paid_amount)) > 0.01);
  console.log(`\nReceivables with remaining ≠ original − paid: ${rBadInvariant.length}`);
  if (rBadInvariant.length > 0) {
    for (const r of rBadInvariant.slice(0, 10)) {
      console.log(`    • ${r.invoice_number} | orig=${r.original_amount} paid=${r.paid_amount} remaining=${r.remaining} expected=${r.original_amount - r.paid_amount}`);
    }
  }

  const allP = await prisma.payable.findMany();
  const pBadInvariant = allP.filter((p) => Math.abs(p.remaining - (p.original_amount - p.paid_amount)) > 0.01);
  console.log(`\nPayables with remaining ≠ original − paid: ${pBadInvariant.length}`);
  if (pBadInvariant.length > 0) {
    for (const p of pBadInvariant.slice(0, 10)) {
      console.log(`    • ${p.invoice_number} | orig=${p.original_amount} paid=${p.paid_amount} remaining=${p.remaining} expected=${p.original_amount - p.paid_amount}`);
    }
  }

  console.log('\n=== Done ===');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
