import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface Issue {
  check: string;
  count: number;
  ids: string[];
  details?: string;
}

const issues: Issue[] = [];
const clean: string[] = [];

function report(check: string, count: number, ids: string[], details?: string) {
  if (count > 0) {
    issues.push({ check, count, ids, details });
  } else {
    clean.push(check);
  }
}

async function main() {
  console.log('=== PackFlow CRM Data Integrity Audit ===');
  console.log(`Run at: ${new Date().toISOString()}\n`);

  // ─── TABLE COUNTS ───────────────────────────────
  const counts = {
    salesOrders: await prisma.salesOrder.count(),
    purchaseOrders: await prisma.purchaseOrder.count(),
    invoices: await prisma.invoice.count(),
    receivables: await prisma.receivable.count(),
    payables: await prisma.payable.count(),
    receivablePayments: await prisma.receivablePayment.count(),
    payablePayments: await prisma.payablePayment.count(),
    cashTransactions: await prisma.cashTransaction.count(),
    customers: await prisma.customer.count(),
    suppliers: await prisma.supplier.count(),
  };
  console.log('--- Table Counts ---');
  for (const [k, v] of Object.entries(counts)) console.log(`  ${k}: ${v}`);
  console.log('');

  // ═══════════════════════════════════════════════════
  // ORDERS
  // ═══════════════════════════════════════════════════

  // 1. SalesOrder COMPLETED but no invoice
  const soCompletedNoInv = await prisma.salesOrder.findMany({
    where: { status: 'COMPLETED', invoices: { none: {} } },
    select: { id: true, order_code: true },
  });
  report('SO status=COMPLETED but no invoice', soCompletedNoInv.length, soCompletedNoInv.map(r => r.order_code));

  // 2. SalesOrder CONFIRMED+ but no invoice
  const soConfirmedStatuses = ['CONFIRMED', 'PREPARING', 'SHIPPING', 'INVOICED', 'COMPLETED'] as const;
  const soConfirmedNoInv = await prisma.salesOrder.findMany({
    where: { status: { in: [...soConfirmedStatuses] }, invoices: { none: {} } },
    select: { id: true, order_code: true, status: true },
  });
  report('SO status>=CONFIRMED but no invoice', soConfirmedNoInv.length,
    soConfirmedNoInv.map(r => `${r.order_code} (${r.status})`));

  // 3. PurchaseOrder CONFIRMED+ but no invoice
  const poConfirmedStatuses = ['CONFIRMED', 'PROCESSING', 'SHIPPING', 'INVOICED', 'COMPLETED'] as const;
  const poConfirmedNoInv = await prisma.purchaseOrder.findMany({
    where: { status: { in: [...poConfirmedStatuses] }, invoices: { none: {} } },
    select: { id: true, order_code: true, status: true },
  });
  report('PO status>=CONFIRMED but no invoice', poConfirmedNoInv.length,
    poConfirmedNoInv.map(r => `${r.order_code} (${r.status})`));

  // 4. SO items sum vs grand_total (check subtotal mismatch)
  const allSOs = await prisma.salesOrder.findMany({
    select: { id: true, order_code: true, subtotal: true, grand_total: true, items: { select: { line_total: true } } },
  });
  const soItemMismatch = allSOs.filter(so => {
    const itemSum = so.items.reduce((s, i) => s + i.line_total, 0);
    return Math.abs(itemSum - so.subtotal) > 0.01;
  });
  report('SO subtotal != sum of item line_totals', soItemMismatch.length,
    soItemMismatch.map(so => `${so.order_code} (items_sum=${so.items.reduce((s,i)=>s+i.line_total,0).toFixed(2)}, subtotal=${so.subtotal})`));

  // 5. PO items sum vs total
  const allPOs = await prisma.purchaseOrder.findMany({
    select: { id: true, order_code: true, total: true, shipping_fee: true, other_fee: true, items: { select: { line_total: true } } },
  });
  const poItemMismatch = allPOs.filter(po => {
    const itemSum = po.items.reduce((s, i) => s + i.line_total, 0);
    // PO total = items sum + shipping_fee + other_fee
    const expected = itemSum + po.shipping_fee + po.other_fee;
    return Math.abs(expected - po.total) > 0.01;
  });
  report('PO total != sum(items) + fees', poItemMismatch.length,
    poItemMismatch.map(po => {
      const itemSum = po.items.reduce((s,i)=>s+i.line_total,0);
      return `${po.order_code} (items=${itemSum}, fees=${po.shipping_fee+po.other_fee}, total=${po.total})`;
    }));

  // ═══════════════════════════════════════════════════
  // INVOICES
  // ═══════════════════════════════════════════════════

  // 6. SALES invoices APPROVED with no Receivable for that SO
  const salesInvApproved = await prisma.invoice.findMany({
    where: { type: 'SALES', status: 'APPROVED', sales_order_id: { not: null } },
    select: { id: true, invoice_number: true, sales_order_id: true },
  });
  const soIdsWithReceivable = new Set(
    (await prisma.receivable.findMany({ select: { sales_order_id: true } })).map(r => r.sales_order_id)
  );
  const salesInvNoReceivable = salesInvApproved.filter(inv => !soIdsWithReceivable.has(inv.sales_order_id!));
  report('SALES invoice APPROVED but no Receivable for its SO', salesInvNoReceivable.length,
    salesInvNoReceivable.map(i => `Invoice#${i.invoice_number} (SO: ${i.sales_order_id})`));

  // 7. PURCHASE invoices APPROVED with no Payable for that PO
  const purchaseInvApproved = await prisma.invoice.findMany({
    where: { type: 'PURCHASE', status: 'APPROVED', purchase_order_id: { not: null } },
    select: { id: true, invoice_number: true, purchase_order_id: true },
  });
  const poIdsWithPayable = new Set(
    (await prisma.payable.findMany({ select: { purchase_order_id: true } })).map(r => r.purchase_order_id)
  );
  const purchaseInvNoPayable = purchaseInvApproved.filter(inv => !poIdsWithPayable.has(inv.purchase_order_id!));
  report('PURCHASE invoice APPROVED but no Payable for its PO', purchaseInvNoPayable.length,
    purchaseInvNoPayable.map(i => `Invoice#${i.invoice_number} (PO: ${i.purchase_order_id})`));

  // 8. Invoices linked to non-existent orders
  const allInvoices = await prisma.invoice.findMany({
    select: { id: true, invoice_number: true, type: true, sales_order_id: true, purchase_order_id: true },
  });
  const allSOIds = new Set(allSOs.map(s => s.id));
  const allPOIds = new Set(allPOs.map(p => p.id));
  const orphanedInvoices = allInvoices.filter(inv => {
    if (inv.type === 'SALES' && inv.sales_order_id && !allSOIds.has(inv.sales_order_id)) return true;
    if (inv.type === 'PURCHASE' && inv.purchase_order_id && !allPOIds.has(inv.purchase_order_id)) return true;
    return false;
  });
  report('Invoices referencing non-existent orders', orphanedInvoices.length,
    orphanedInvoices.map(i => `Invoice#${i.invoice_number} type=${i.type}`));

  // 9. Invoice total vs order grand_total mismatch (SALES)
  const salesInvWithOrder = await prisma.invoice.findMany({
    where: { type: 'SALES', sales_order_id: { not: null }, status: { not: 'CANCELLED' } },
    select: { id: true, invoice_number: true, total: true, sales_order_id: true },
  });
  const soMap = new Map(allSOs.map(s => [s.id, s]));
  const invTotalMismatch = salesInvWithOrder.filter(inv => {
    const so = soMap.get(inv.sales_order_id!);
    if (!so || inv.total === null) return false;
    return Math.abs(inv.total - so.grand_total) > 0.01;
  });
  report('SALES invoice total != SO grand_total', invTotalMismatch.length,
    invTotalMismatch.map(i => {
      const so = soMap.get(i.sales_order_id!);
      return `Invoice#${i.invoice_number} (inv=${i.total}, SO=${so?.grand_total})`;
    }));

  // ═══════════════════════════════════════════════════
  // RECEIVABLES
  // ═══════════════════════════════════════════════════

  const allReceivables = await prisma.receivable.findMany({
    include: { payments: true },
  });

  // 10. paid_amount > original_amount
  const recOverpaid = allReceivables.filter(r => r.paid_amount > r.original_amount + 0.01);
  report('Receivable: paid_amount > original_amount', recOverpaid.length,
    recOverpaid.map(r => `${r.id} (paid=${r.paid_amount}, original=${r.original_amount})`));

  // 11. remaining != original - paid
  const recRemainingBad = allReceivables.filter(r => Math.abs(r.remaining - (r.original_amount - r.paid_amount)) > 0.01);
  report('Receivable: remaining != original - paid', recRemainingBad.length,
    recRemainingBad.map(r => `${r.id} (remaining=${r.remaining}, expected=${r.original_amount - r.paid_amount})`));

  // 12. status PAID but remaining > 0
  const recPaidButRemaining = allReceivables.filter(r => r.status === 'PAID' && r.remaining > 0.01);
  report('Receivable: status=PAID but remaining > 0', recPaidButRemaining.length,
    recPaidButRemaining.map(r => `${r.id} (remaining=${r.remaining})`));

  // 13. status UNPAID but paid_amount > 0
  const recUnpaidButPaid = allReceivables.filter(r => r.status === 'UNPAID' && r.paid_amount > 0.01);
  report('Receivable: status=UNPAID but paid_amount > 0', recUnpaidButPaid.length,
    recUnpaidButPaid.map(r => `${r.id} (paid=${r.paid_amount})`));

  // 14. status OVERDUE but due_date in future
  const now = new Date();
  const recOverdueFuture = allReceivables.filter(r => r.status === 'OVERDUE' && r.due_date > now);
  report('Receivable: status=OVERDUE but due_date in future', recOverdueFuture.length,
    recOverdueFuture.map(r => `${r.id} (due=${r.due_date.toISOString()})`));

  // 15. Receivable references non-existent SO
  const recOrphanSO = allReceivables.filter(r => !allSOIds.has(r.sales_order_id));
  report('Receivable: references non-existent SO', recOrphanSO.length,
    recOrphanSO.map(r => `${r.id} (SO: ${r.sales_order_id})`));

  // 16. Sum of payments vs paid_amount
  const recPaymentMismatch = allReceivables.filter(r => {
    const paySum = r.payments.reduce((s, p) => s + p.amount, 0);
    return Math.abs(paySum - r.paid_amount) > 0.01;
  });
  report('Receivable: sum(payments) != paid_amount', recPaymentMismatch.length,
    recPaymentMismatch.map(r => {
      const paySum = r.payments.reduce((s, p) => s + p.amount, 0);
      return `${r.id} (payments_sum=${paySum}, paid_amount=${r.paid_amount})`;
    }));

  // ═══════════════════════════════════════════════════
  // PAYABLES
  // ═══════════════════════════════════════════════════

  const allPayables = await prisma.payable.findMany({
    include: { payments: true },
  });

  // 17. paid_amount > original_amount
  const payOverpaid = allPayables.filter(r => r.paid_amount > r.original_amount + 0.01);
  report('Payable: paid_amount > original_amount', payOverpaid.length,
    payOverpaid.map(r => `${r.id} (paid=${r.paid_amount}, original=${r.original_amount})`));

  // 18. remaining != original - paid
  const payRemainingBad = allPayables.filter(r => Math.abs(r.remaining - (r.original_amount - r.paid_amount)) > 0.01);
  report('Payable: remaining != original - paid', payRemainingBad.length,
    payRemainingBad.map(r => `${r.id} (remaining=${r.remaining}, expected=${r.original_amount - r.paid_amount})`));

  // 19. status PAID but remaining > 0
  const payPaidButRemaining = allPayables.filter(r => r.status === 'PAID' && r.remaining > 0.01);
  report('Payable: status=PAID but remaining > 0', payPaidButRemaining.length,
    payPaidButRemaining.map(r => `${r.id} (remaining=${r.remaining})`));

  // 20. status UNPAID but paid_amount > 0
  const payUnpaidButPaid = allPayables.filter(r => r.status === 'UNPAID' && r.paid_amount > 0.01);
  report('Payable: status=UNPAID but paid_amount > 0', payUnpaidButPaid.length,
    payUnpaidButPaid.map(r => `${r.id} (paid=${r.paid_amount})`));

  // 21. status OVERDUE but due_date in future
  const payOverdueFuture = allPayables.filter(r => r.status === 'OVERDUE' && r.due_date > now);
  report('Payable: status=OVERDUE but due_date in future', payOverdueFuture.length,
    payOverdueFuture.map(r => `${r.id} (due=${r.due_date.toISOString()})`));

  // 22. Payable references non-existent PO
  const payOrphanPO = allPayables.filter(r => !allPOIds.has(r.purchase_order_id));
  report('Payable: references non-existent PO', payOrphanPO.length,
    payOrphanPO.map(r => `${r.id} (PO: ${r.purchase_order_id})`));

  // 23. Sum of payments vs paid_amount
  const payPaymentMismatch = allPayables.filter(r => {
    const paySum = r.payments.reduce((s, p) => s + p.amount, 0);
    return Math.abs(paySum - r.paid_amount) > 0.01;
  });
  report('Payable: sum(payments) != paid_amount', payPaymentMismatch.length,
    payPaymentMismatch.map(r => {
      const paySum = r.payments.reduce((s, p) => s + p.amount, 0);
      return `${r.id} (payments_sum=${paySum}, paid_amount=${r.paid_amount})`;
    }));

  // ═══════════════════════════════════════════════════
  // PAYMENTS
  // ═══════════════════════════════════════════════════

  // 24. ReceivablePayments with amount <= 0
  const recPayZero = await prisma.receivablePayment.findMany({ where: { amount: { lte: 0 } } });
  report('ReceivablePayment: amount <= 0', recPayZero.length, recPayZero.map(p => p.id));

  // 25. PayablePayments with amount <= 0
  const payPayZero = await prisma.payablePayment.findMany({ where: { amount: { lte: 0 } } });
  report('PayablePayment: amount <= 0', payPayZero.length, payPayZero.map(p => p.id));

  // 26. ReceivablePayments referencing non-existent receivable
  const allRecPayments = await prisma.receivablePayment.findMany({ select: { id: true, receivable_id: true } });
  const recIds = new Set(allReceivables.map(r => r.id));
  const orphanRecPay = allRecPayments.filter(p => !recIds.has(p.receivable_id));
  report('ReceivablePayment: references non-existent Receivable', orphanRecPay.length,
    orphanRecPay.map(p => `${p.id} (rec: ${p.receivable_id})`));

  // 27. PayablePayments referencing non-existent payable
  const allPayPayments = await prisma.payablePayment.findMany({ select: { id: true, payable_id: true } });
  const payIds = new Set(allPayables.map(r => r.id));
  const orphanPayPay = allPayPayments.filter(p => !payIds.has(p.payable_id));
  report('PayablePayment: references non-existent Payable', orphanPayPay.length,
    orphanPayPay.map(p => `${p.id} (pay: ${p.payable_id})`));

  // ═══════════════════════════════════════════════════
  // CASH BOOK SYNC
  // ═══════════════════════════════════════════════════

  const autoCashTx = await prisma.cashTransaction.findMany({ where: { is_auto: true } });
  const allRecPayFull = await prisma.receivablePayment.findMany();
  const allPayPayFull = await prisma.payablePayment.findMany();

  // 28. ReceivablePayment without matching auto INCOME CashTransaction
  const incomeTx = autoCashTx.filter(t => t.type === 'INCOME');
  const recPayMissingCash: string[] = [];
  for (const rp of allRecPayFull) {
    const match = incomeTx.find(t =>
      Math.abs(t.amount - rp.amount) < 0.01 &&
      t.date.toISOString().slice(0, 10) === rp.payment_date.toISOString().slice(0, 10)
    );
    if (!match) recPayMissingCash.push(`RecPay ${rp.id} (amount=${rp.amount}, date=${rp.payment_date.toISOString().slice(0,10)})`);
  }
  report('ReceivablePayment without matching auto INCOME CashTransaction', recPayMissingCash.length, recPayMissingCash);

  // 29. PayablePayment without matching auto EXPENSE CashTransaction
  const expenseTx = autoCashTx.filter(t => t.type === 'EXPENSE');
  const payPayMissingCash: string[] = [];
  for (const pp of allPayPayFull) {
    const match = expenseTx.find(t =>
      Math.abs(t.amount - pp.amount) < 0.01 &&
      t.date.toISOString().slice(0, 10) === pp.payment_date.toISOString().slice(0, 10)
    );
    if (!match) payPayMissingCash.push(`PayPay ${pp.id} (amount=${pp.amount}, date=${pp.payment_date.toISOString().slice(0,10)})`);
  }
  report('PayablePayment without matching auto EXPENSE CashTransaction', payPayMissingCash.length, payPayMissingCash);

  // 30. Orphaned auto cash transactions (no matching payment)
  const orphanedAutoCash: string[] = [];
  for (const tx of autoCashTx) {
    if (tx.type === 'INCOME') {
      const match = allRecPayFull.find(rp =>
        Math.abs(rp.amount - tx.amount) < 0.01 &&
        rp.payment_date.toISOString().slice(0, 10) === tx.date.toISOString().slice(0, 10)
      );
      if (!match) orphanedAutoCash.push(`CashTx ${tx.id} INCOME amount=${tx.amount} date=${tx.date.toISOString().slice(0,10)}`);
    } else {
      const match = allPayPayFull.find(pp =>
        Math.abs(pp.amount - tx.amount) < 0.01 &&
        pp.payment_date.toISOString().slice(0, 10) === tx.date.toISOString().slice(0, 10)
      );
      if (!match) orphanedAutoCash.push(`CashTx ${tx.id} EXPENSE amount=${tx.amount} date=${tx.date.toISOString().slice(0,10)}`);
    }
  }
  report('Orphaned auto CashTransactions (no matching payment)', orphanedAutoCash.length, orphanedAutoCash);

  // ═══════════════════════════════════════════════════
  // CUSTOMERS & SUPPLIERS - soft delete consistency
  // ═══════════════════════════════════════════════════

  // 31. Inactive customers with active (non-cancelled, non-completed) orders
  const inactiveCustomers = await prisma.customer.findMany({
    where: { is_active: false },
    select: {
      id: true, company_name: true,
      sales_orders: {
        where: { status: { notIn: ['CANCELLED', 'COMPLETED'] } },
        select: { order_code: true, status: true },
      },
    },
  });
  const inactiveCustWithOrders = inactiveCustomers.filter(c => c.sales_orders.length > 0);
  report('Inactive customers with active orders', inactiveCustWithOrders.length,
    inactiveCustWithOrders.map(c => `${c.company_name}: ${c.sales_orders.map(o => o.order_code).join(', ')}`));

  // 32. Inactive suppliers with active orders
  const inactiveSuppliers = await prisma.supplier.findMany({
    where: { is_active: false },
    select: {
      id: true, company_name: true,
      purchase_orders: {
        where: { status: { notIn: ['CANCELLED', 'COMPLETED'] } },
        select: { order_code: true, status: true },
      },
    },
  });
  const inactiveSuppWithOrders = inactiveSuppliers.filter(s => s.purchase_orders.length > 0);
  report('Inactive suppliers with active orders', inactiveSuppWithOrders.length,
    inactiveSuppWithOrders.map(s => `${s.company_name}: ${s.purchase_orders.map(o => o.order_code).join(', ')}`));

  // ═══════════════════════════════════════════════════
  // REPORT
  // ═══════════════════════════════════════════════════

  console.log('\n========================================');
  console.log('         AUDIT RESULTS SUMMARY');
  console.log('========================================\n');

  if (issues.length === 0) {
    console.log('ALL CHECKS PASSED - No data integrity issues found.');
  } else {
    console.log(`ISSUES FOUND: ${issues.length} check(s) with problems\n`);
    for (const issue of issues) {
      console.log(`[ISSUE] ${issue.check}`);
      console.log(`  Count: ${issue.count}`);
      if (issue.ids.length <= 20) {
        for (const id of issue.ids) console.log(`    - ${id}`);
      } else {
        for (const id of issue.ids.slice(0, 20)) console.log(`    - ${id}`);
        console.log(`    ... and ${issue.ids.length - 20} more`);
      }
      console.log('');
    }
  }

  console.log(`\nCLEAN CHECKS (${clean.length}):`);
  for (const c of clean) console.log(`  [OK] ${c}`);

  console.log(`\n--- Audit complete: ${issues.length} issues, ${clean.length} clean checks ---`);

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error('Audit failed:', e);
  await prisma.$disconnect();
  process.exit(1);
});
