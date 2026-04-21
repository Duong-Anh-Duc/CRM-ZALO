import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const EPS = 0.5; // VND tolerance

type Issue = { model: string; id: string; key: string; expected: number; actual: number; detail?: string };

async function main() {
  const issues: Issue[] = [];

  // 1) SalesOrder.grand_total vs sum(items.line_total) — schema has: subtotal, discount_amount, vat_amount, shipping_fee, other_fee
  const sos = await prisma.salesOrder.findMany({
    select: {
      id: true, order_code: true, grand_total: true, subtotal: true, vat_amount: true,
      discount_amount: true, shipping_fee: true, other_fee: true,
      items: { select: { line_total: true } },
    },
  });
  for (const so of sos) {
    const itemsSum = so.items.reduce((s, i) => s + i.line_total, 0);
    if (Math.abs(itemsSum - so.subtotal) > EPS) {
      issues.push({ model: 'SalesOrder', id: so.order_code, key: 'subtotal vs Σitems', expected: itemsSum, actual: so.subtotal });
    }
    // grand = subtotal - discount + vat + shipping + other
    const expectedGrand = so.subtotal - so.discount_amount + so.vat_amount + so.shipping_fee + so.other_fee;
    if (Math.abs(expectedGrand - so.grand_total) > EPS) {
      issues.push({ model: 'SalesOrder', id: so.order_code, key: 'grand_total formula', expected: expectedGrand, actual: so.grand_total });
    }
  }

  // 2) PurchaseOrder.total vs Σitems.line_total
  const pos = await prisma.purchaseOrder.findMany({
    select: { id: true, order_code: true, total: true, items: { select: { line_total: true } } },
  });
  for (const po of pos) {
    const sum = po.items.reduce((s, i) => s + i.line_total, 0);
    if (Math.abs(sum - po.total) > EPS) {
      issues.push({ model: 'PurchaseOrder', id: po.order_code, key: 'total vs Σitems', expected: sum, actual: po.total });
    }
  }

  // 3) SalesReturn.total_amount vs Σitems.line_total
  const srs = await prisma.salesReturn.findMany({
    select: { id: true, return_code: true, total_amount: true, items: { select: { line_total: true } } },
  });
  for (const sr of srs) {
    const sum = sr.items.reduce((s, i) => s + i.line_total, 0);
    if (Math.abs(sum - sr.total_amount) > EPS) {
      issues.push({ model: 'SalesReturn', id: sr.return_code, key: 'total_amount vs Σitems', expected: sum, actual: sr.total_amount });
    }
  }

  // 4) PurchaseReturn.total_amount vs Σitems.line_total
  const prs = await prisma.purchaseReturn.findMany({
    select: { id: true, return_code: true, total_amount: true, items: { select: { line_total: true } } },
  });
  for (const pr of prs) {
    const sum = pr.items.reduce((s, i) => s + i.line_total, 0);
    if (Math.abs(sum - pr.total_amount) > EPS) {
      issues.push({ model: 'PurchaseReturn', id: pr.return_code, key: 'total_amount vs Σitems', expected: sum, actual: pr.total_amount });
    }
  }

  // 5) Receivable: remaining = original - paid (invariant); paid = Σ payments
  const recvs = await prisma.receivable.findMany({ include: { payments: true } });
  for (const r of recvs) {
    const expectedRemaining = r.original_amount - r.paid_amount;
    if (Math.abs(expectedRemaining - r.remaining) > EPS) {
      issues.push({ model: 'Receivable', id: r.invoice_number, key: 'remaining invariant', expected: expectedRemaining, actual: r.remaining });
    }
    const paySum = r.payments.reduce((s, p) => s + p.amount, 0);
    if (r.paid_amount > 0 && Math.abs(paySum - r.paid_amount) > EPS) {
      issues.push({ model: 'Receivable', id: r.invoice_number, key: 'paid_amount vs Σpayments', expected: paySum, actual: r.paid_amount });
    }
  }

  // 6) Payable: same invariants
  const pays = await prisma.payable.findMany({ include: { payments: true } });
  for (const p of pays) {
    const expectedRemaining = p.original_amount - p.paid_amount;
    if (Math.abs(expectedRemaining - p.remaining) > EPS) {
      issues.push({ model: 'Payable', id: p.invoice_number, key: 'remaining invariant', expected: expectedRemaining, actual: p.remaining });
    }
    const paySum = p.payments.reduce((s, x) => s + x.amount, 0);
    if (p.paid_amount > 0 && Math.abs(paySum - p.paid_amount) > EPS) {
      issues.push({ model: 'Payable', id: p.invoice_number, key: 'paid_amount vs Σpayments', expected: paySum, actual: p.paid_amount });
    }
  }

  // 7) Invoice.total vs underlying order (SalesOrder.grand_total or PurchaseOrder.total)
  const invs = await prisma.invoice.findMany({
    select: {
      id: true, invoice_number: true, type: true, total: true,
      sales_order: { select: { grand_total: true, order_code: true } },
      purchase_order: { select: { total: true, order_code: true } },
    },
  });
  for (const inv of invs) {
    if (inv.type === 'SALES' && inv.sales_order) {
      if (Math.abs(inv.total - inv.sales_order.grand_total) > EPS) {
        issues.push({ model: 'Invoice', id: inv.invoice_number, key: 'SALES total vs SO.grand_total', expected: inv.sales_order.grand_total, actual: inv.total, detail: inv.sales_order.order_code });
      }
    }
    if (inv.type === 'PURCHASE' && inv.purchase_order) {
      if (Math.abs(inv.total - inv.purchase_order.total) > EPS) {
        issues.push({ model: 'Invoice', id: inv.invoice_number, key: 'PURCHASE total vs PO.total', expected: inv.purchase_order.total, actual: inv.total, detail: inv.purchase_order.order_code });
      }
    }
  }

  // 8) SalesOrderItem: line_total vs quantity * unit_price (accounting for discount_pct if exists)
  const soItems = await prisma.salesOrderItem.findMany({ select: { id: true, sales_order_id: true, quantity: true, unit_price: true, line_total: true, discount_pct: true } });
  for (const i of soItems) {
    const pct = (i as any).discount_pct ?? 0;
    const gross = i.quantity * i.unit_price;
    const expected = gross * (1 - pct / 100);
    if (Math.abs(expected - i.line_total) > EPS) {
      issues.push({ model: 'SalesOrderItem', id: i.id.slice(0, 8), key: 'line_total vs qty×price×(1-disc)', expected, actual: i.line_total, detail: `so=${i.sales_order_id.slice(0, 8)}` });
    }
  }

  // 9) PurchaseOrderItem line_total check
  const poItems = await prisma.purchaseOrderItem.findMany({ select: { id: true, purchase_order_id: true, quantity: true, unit_price: true, line_total: true } });
  for (const i of poItems) {
    const expected = i.quantity * i.unit_price;
    if (Math.abs(expected - i.line_total) > EPS) {
      issues.push({ model: 'PurchaseOrderItem', id: i.id.slice(0, 8), key: 'line_total vs qty×price', expected, actual: i.line_total, detail: `po=${i.purchase_order_id.slice(0, 8)}` });
    }
  }

  // === Report ===
  console.log(`\n=== Data consistency audit ===\n`);
  console.log(`SalesOrders:           ${sos.length}`);
  console.log(`PurchaseOrders:        ${pos.length}`);
  console.log(`SalesReturns:          ${srs.length}`);
  console.log(`PurchaseReturns:       ${prs.length}`);
  console.log(`Receivables:           ${recvs.length}`);
  console.log(`Payables:              ${pays.length}`);
  console.log(`Invoices:              ${invs.length}`);
  console.log(`SalesOrderItems:       ${soItems.length}`);
  console.log(`PurchaseOrderItems:    ${poItems.length}`);

  if (issues.length === 0) {
    console.log(`\n✅ No drift found — all invariants hold.\n`);
    return;
  }

  console.log(`\n⚠️  ${issues.length} issues detected:\n`);
  const grouped = new Map<string, Issue[]>();
  for (const is of issues) {
    const k = `${is.model} | ${is.key}`;
    if (!grouped.has(k)) grouped.set(k, []);
    grouped.get(k)!.push(is);
  }
  for (const [k, list] of grouped) {
    console.log(`\n  ${k} (${list.length}):`);
    for (const is of list.slice(0, 5)) {
      const diff = is.actual - is.expected;
      console.log(`    • ${is.id}${is.detail ? ' ('+is.detail+')' : ''}: expected=${is.expected.toLocaleString()}, actual=${is.actual.toLocaleString()}, diff=${diff.toLocaleString()}`);
    }
    if (list.length > 5) console.log(`    ... +${list.length - 5} more`);
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
