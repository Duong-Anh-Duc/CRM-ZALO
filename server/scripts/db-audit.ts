import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface CheckResult {
  check: string;
  category: string;
  count: number;
  examples: string[];
}

const results: CheckResult[] = [];

function add(category: string, check: string, count: number, examples: string[]) {
  results.push({ category, check, count, examples: examples.slice(0, 3) });
}

async function auditReceivables() {
  const all = await prisma.receivable.findMany({
    include: { payments: true },
  });

  // 1. remaining != original_amount - paid_amount
  const c1 = all.filter(r => Math.abs(r.remaining - (r.original_amount - r.paid_amount)) > 0.01);
  add('Receivables', '1. remaining != original - paid', c1.length, c1.map(r => r.id));

  // 2. paid_amount > original_amount
  const c2 = all.filter(r => r.paid_amount > r.original_amount + 0.01);
  add('Receivables', '2. paid > original', c2.length, c2.map(r => r.id));

  // 3. status=PAID but remaining > 0
  const c3 = all.filter(r => r.status === 'PAID' && r.remaining > 0.01);
  add('Receivables', '3. PAID but remaining > 0', c3.length, c3.map(r => r.id));

  // 4. status=UNPAID but paid_amount > 0
  const c4 = all.filter(r => r.status === 'UNPAID' && r.paid_amount > 0.01);
  add('Receivables', '4. UNPAID but paid > 0', c4.length, c4.map(r => r.id));

  // 5. status=OVERDUE but due_date > now
  const now = new Date();
  const c5 = all.filter(r => r.status === 'OVERDUE' && r.due_date > now);
  add('Receivables', '5. OVERDUE but due_date future', c5.length, c5.map(r => r.id));

  // 6. sum(payments) != paid_amount
  const c6 = all.filter(r => {
    const sum = r.payments.reduce((s, p) => s + p.amount, 0);
    return Math.abs(sum - r.paid_amount) > 0.01;
  });
  add('Receivables', '6. sum(payments) != paid_amount', c6.length, c6.map(r => r.id));
}

async function auditPayables() {
  const all = await prisma.payable.findMany({
    include: { payments: true },
  });

  const c7 = all.filter(r => Math.abs(r.remaining - (r.original_amount - r.paid_amount)) > 0.01);
  add('Payables', '7. remaining != original - paid', c7.length, c7.map(r => r.id));

  const c8 = all.filter(r => r.paid_amount > r.original_amount + 0.01);
  add('Payables', '8. paid > original', c8.length, c8.map(r => r.id));

  const c9 = all.filter(r => r.status === 'PAID' && r.remaining > 0.01);
  add('Payables', '9. PAID but remaining > 0', c9.length, c9.map(r => r.id));

  const c10 = all.filter(r => r.status === 'UNPAID' && r.paid_amount > 0.01);
  add('Payables', '10. UNPAID but paid > 0', c10.length, c10.map(r => r.id));

  const now = new Date();
  const c11 = all.filter(r => r.status === 'OVERDUE' && r.due_date > now);
  add('Payables', '11. OVERDUE but due_date future', c11.length, c11.map(r => r.id));

  const c12 = all.filter(r => {
    const sum = r.payments.reduce((s, p) => s + p.amount, 0);
    return Math.abs(sum - r.paid_amount) > 0.01;
  });
  add('Payables', '12. sum(payments) != paid_amount', c12.length, c12.map(r => r.id));
}

async function auditInvoices() {
  // 13. APPROVED sales invoices without matching receivable
  const salesInvoices = await prisma.invoice.findMany({
    where: { type: 'SALES', status: 'APPROVED' },
  });
  const recvSoIds = new Set(
    (await prisma.receivable.findMany({ select: { sales_order_id: true } })).map(r => r.sales_order_id)
  );
  const c13 = salesInvoices.filter(i => i.sales_order_id && !recvSoIds.has(i.sales_order_id));
  add('Invoices', '13. APPROVED sales inv w/o receivable', c13.length, c13.map(i => i.id));

  // 14. APPROVED purchase invoices without matching payable
  const purchInvoices = await prisma.invoice.findMany({
    where: { type: 'PURCHASE', status: 'APPROVED' },
  });
  const payPoIds = new Set(
    (await prisma.payable.findMany({ select: { purchase_order_id: true } })).map(p => p.purchase_order_id)
  );
  const c14 = purchInvoices.filter(i => i.purchase_order_id && !payPoIds.has(i.purchase_order_id));
  add('Invoices', '14. APPROVED purch inv w/o payable', c14.length, c14.map(i => i.id));

  // 15. Sales invoice total != SO grand_total
  const salesInvWithSO = await prisma.invoice.findMany({
    where: { type: 'SALES', status: 'APPROVED', sales_order_id: { not: null } },
    include: { sales_order: true },
  });
  const c15 = salesInvWithSO.filter(i => {
    if (!i.sales_order || i.total == null) return false;
    return Math.abs(i.total - i.sales_order.grand_total) > 1;
  });
  add('Invoices', '15. Sales inv total != SO grand_total', c15.length, c15.map(i => i.id));
}

async function auditOrders() {
  // 16. COMPLETED/SHIPPING SO without any invoice
  const soStatuses = ['COMPLETED', 'SHIPPING'];
  const sosWithInv = new Set(
    (await prisma.invoice.findMany({
      where: { type: 'SALES', sales_order_id: { not: null } },
      select: { sales_order_id: true },
    })).map(i => i.sales_order_id)
  );
  const soNoInv = await prisma.salesOrder.findMany({
    where: { status: { in: soStatuses as any } },
  });
  const c16 = soNoInv.filter(so => !sosWithInv.has(so.id));
  add('Orders', '16. COMPLETED/SHIPPING SO w/o invoice', c16.length, c16.map(s => s.order_code));

  // 17. COMPLETED/SHIPPING PO without any invoice
  const poStatuses = ['COMPLETED', 'SHIPPING'];
  const posWithInv = new Set(
    (await prisma.invoice.findMany({
      where: { type: 'PURCHASE', purchase_order_id: { not: null } },
      select: { purchase_order_id: true },
    })).map(i => i.purchase_order_id)
  );
  const poNoInv = await prisma.purchaseOrder.findMany({
    where: { status: { in: poStatuses as any } },
  });
  const c17 = poNoInv.filter(po => !posWithInv.has(po.id));
  add('Orders', '17. COMPLETED/SHIPPING PO w/o invoice', c17.length, c17.map(p => p.order_code));

  // 18. SO items line_total != quantity * unit_price (tolerance 1)
  const soItems = await prisma.salesOrderItem.findMany();
  const c18 = soItems.filter(i => {
    const expected = i.quantity * i.unit_price * (1 - (i.discount_pct || 0) / 100);
    return Math.abs(i.line_total - expected) > 1;
  });
  add('Orders', '18. SO item line_total mismatch', c18.length, c18.map(i => i.id));

  // 19. PO items line_total != quantity * unit_price (tolerance 1)
  const poItems = await prisma.purchaseOrderItem.findMany();
  const c19 = poItems.filter(i => Math.abs(i.line_total - i.quantity * i.unit_price) > 1);
  add('Orders', '19. PO item line_total mismatch', c19.length, c19.map(i => i.id));
}

async function auditCashBookSync() {
  // 20. ReceivablePayments without matching auto INCOME cash transaction
  const recvPayments = await prisma.receivablePayment.findMany();
  const autoIncome = await prisma.cashTransaction.findMany({
    where: { is_auto: true, type: 'INCOME' },
  });

  // Match by amount and date (same day)
  const incomeUsed = new Set<string>();
  const c20: string[] = [];
  for (const rp of recvPayments) {
    const rpDate = rp.payment_date.toISOString().slice(0, 10);
    const match = autoIncome.find(ct => {
      if (incomeUsed.has(ct.id)) return false;
      const ctDate = ct.date.toISOString().slice(0, 10);
      return Math.abs(ct.amount - rp.amount) < 0.01 && ctDate === rpDate;
    });
    if (match) {
      incomeUsed.add(match.id);
    } else {
      c20.push(rp.id);
    }
  }
  add('Cash Sync', '20. RecvPayment w/o auto INCOME txn', c20.length, c20);

  // 21. PayablePayments without matching auto EXPENSE cash transaction
  const payPayments = await prisma.payablePayment.findMany();
  const autoExpense = await prisma.cashTransaction.findMany({
    where: { is_auto: true, type: 'EXPENSE' },
  });

  const expenseUsed = new Set<string>();
  const c21: string[] = [];
  for (const pp of payPayments) {
    const ppDate = pp.payment_date.toISOString().slice(0, 10);
    const match = autoExpense.find(ct => {
      if (expenseUsed.has(ct.id)) return false;
      const ctDate = ct.date.toISOString().slice(0, 10);
      return Math.abs(ct.amount - pp.amount) < 0.01 && ctDate === ppDate;
    });
    if (match) {
      expenseUsed.add(match.id);
    } else {
      c21.push(pp.id);
    }
  }
  add('Cash Sync', '21. PayPayment w/o auto EXPENSE txn', c21.length, c21);

  // 22. Orphaned auto cash transactions without matching payment
  const allAuto = await prisma.cashTransaction.findMany({ where: { is_auto: true } });
  const orphaned = allAuto.filter(ct => !incomeUsed.has(ct.id) && !expenseUsed.has(ct.id));
  add('Cash Sync', '22. Orphaned auto cash txn', orphaned.length, orphaned.map(c => c.id));
}

async function auditReferentialIntegrity() {
  // 23. Receivables referencing non-existent sales_order
  const recvAll = await prisma.receivable.findMany({ select: { id: true, sales_order_id: true } });
  const soIds = new Set((await prisma.salesOrder.findMany({ select: { id: true } })).map(s => s.id));
  const c23 = recvAll.filter(r => !soIds.has(r.sales_order_id));
  add('Referential', '23. Receivable -> missing SO', c23.length, c23.map(r => r.id));

  // 24. Payables referencing non-existent purchase_order
  const payAll = await prisma.payable.findMany({ select: { id: true, purchase_order_id: true } });
  const poIds = new Set((await prisma.purchaseOrder.findMany({ select: { id: true } })).map(p => p.id));
  const c24 = payAll.filter(p => !poIds.has(p.purchase_order_id));
  add('Referential', '24. Payable -> missing PO', c24.length, c24.map(p => p.id));

  // 25. Payments referencing non-existent receivable/payable
  const rpAll = await prisma.receivablePayment.findMany({ select: { id: true, receivable_id: true } });
  const recvIds = new Set(recvAll.map(r => r.id));
  const c25a = rpAll.filter(rp => !recvIds.has(rp.receivable_id));

  const ppAll = await prisma.payablePayment.findMany({ select: { id: true, payable_id: true } });
  const payIds = new Set(payAll.map(p => p.id));
  const c25b = ppAll.filter(pp => !payIds.has(pp.payable_id));

  add('Referential', '25. Payment -> missing recv/payable', c25a.length + c25b.length, [...c25a.map(r => r.id), ...c25b.map(p => p.id)]);
}

async function auditCrossEntity() {
  // 26. Customer with receivables but customer doesn't exist
  const custIds = new Set((await prisma.customer.findMany({ select: { id: true } })).map(c => c.id));
  const recvCusts = await prisma.receivable.findMany({ select: { id: true, customer_id: true } });
  const c26 = recvCusts.filter(r => !custIds.has(r.customer_id));
  add('Cross-Entity', '26. Receivable -> missing customer', c26.length, c26.map(r => r.id));

  // 27. Supplier with payables but supplier doesn't exist
  const suppIds = new Set((await prisma.supplier.findMany({ select: { id: true } })).map(s => s.id));
  const paySups = await prisma.payable.findMany({ select: { id: true, supplier_id: true } });
  const c27 = paySups.filter(p => !suppIds.has(p.supplier_id));
  add('Cross-Entity', '27. Payable -> missing supplier', c27.length, c27.map(p => p.id));
}

async function main() {
  console.log('\n=== PackFlow CRM - Database Integrity Audit ===');
  console.log(`Run at: ${new Date().toISOString()}\n`);

  await auditReceivables();
  await auditPayables();
  await auditInvoices();
  await auditOrders();
  await auditCashBookSync();
  await auditReferentialIntegrity();
  await auditCrossEntity();

  // Print table
  const catWidth = 14;
  const checkWidth = 42;
  const countWidth = 7;
  const exWidth = 50;

  const sep = '-'.repeat(catWidth + checkWidth + countWidth + exWidth + 7);
  console.log(sep);
  console.log(
    `| ${'Category'.padEnd(catWidth)}| ${'Check'.padEnd(checkWidth)}| ${'Count'.padStart(countWidth - 2).padEnd(countWidth - 1)}| ${'Example IDs (up to 3)'.padEnd(exWidth - 1)}|`
  );
  console.log(sep);

  let totalIssues = 0;
  for (const r of results) {
    const status = r.count === 0 ? 'PASS' : `${r.count}`;
    totalIssues += r.count;
    const exStr = r.count === 0 ? '-' : r.examples.map(e => e.slice(0, 15) + '..').join(', ');
    console.log(
      `| ${r.category.padEnd(catWidth)}| ${r.check.padEnd(checkWidth)}| ${status.padStart(countWidth - 2).padEnd(countWidth - 1)}| ${exStr.padEnd(exWidth - 1)}|`
    );
  }
  console.log(sep);
  console.log(`\nTotal checks: ${results.length}`);
  console.log(`Total issues: ${totalIssues}`);
  console.log(totalIssues === 0 ? '\nAll checks PASSED.' : `\n${totalIssues} issue(s) found. Review above for details.`);

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error('Audit failed:', e);
  await prisma.$disconnect();
  process.exit(1);
});
