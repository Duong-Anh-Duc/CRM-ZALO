/**
 * Comprehensive data consistency audit.
 * Checks logical relationships across SalesOrder, PurchaseOrder, Invoice,
 * Receivable, Payable, items, and amount totals.
 *
 * Read-only — no DB writes. Run with: tsx server/scripts/audit-data-consistency.ts
 */
import prisma from '../src/lib/prisma';

const issues: { category: string; severity: 'error' | 'warn'; entity: string; message: string }[] = [];
const log = (category: string, severity: 'error' | 'warn', entity: string, message: string) => {
  issues.push({ category, severity, entity, message });
};

const close = (a: number, b: number, tolerance = 1) => Math.abs(a - b) <= tolerance;

async function checkSalesOrders() {
  const orders = await prisma.salesOrder.findMany({
    include: { items: true, purchase_orders: true, invoices: true, customer: true },
  });
  for (const o of orders) {
    const code = o.order_code;
    // 1) Item totals vs grand_total
    const itemSubtotal = o.items.reduce((s, i) => s + Number(i.line_total), 0);
    const itemVat = o.items.reduce((s, i) => s + Number(i.vat_amount || 0), 0);
    const expectedGrand = itemSubtotal + itemVat + Number(o.shipping_fee || 0) + Number(o.other_fee || 0);
    if (!close(Number(o.grand_total), expectedGrand)) {
      log('SO_TOTAL', 'error', code, `grand_total=${o.grand_total} ≠ computed ${expectedGrand} (items+vat+ship+other)`);
    }
    if (!close(Number(o.subtotal), itemSubtotal)) {
      log('SO_TOTAL', 'warn', code, `subtotal=${o.subtotal} ≠ items sum ${itemSubtotal}`);
    }
    // 2) CONFIRMED+ orders should have all items with supplier
    if (['CONFIRMED', 'PREPARING', 'SHIPPING', 'INVOICED', 'COMPLETED'].includes(o.status)) {
      const noSup = o.items.filter((i) => !i.supplier_id);
      if (noSup.length > 0) {
        log('SO_SUPPLIER', 'error', code, `status=${o.status} but ${noSup.length}/${o.items.length} items have no supplier_id`);
      }
      // 3) CONFIRMED+ orders should have at least 1 PO
      if (o.purchase_orders.length === 0) {
        log('SO_PO', 'error', code, `status=${o.status} but no purchase_orders linked`);
      }
    }
    // 4) Empty orders
    if (o.items.length === 0) {
      log('SO_EMPTY', 'warn', code, `has no items`);
    }
    // 5) COMPLETED orders should have invoice
    if (o.status === 'COMPLETED' && o.invoices.filter((i: any) => i.type === 'SALES' && i.status !== 'CANCELLED').length === 0) {
      log('SO_INVOICE', 'warn', code, `COMPLETED but no active sales invoice`);
    }
    // 6) Customer exists
    if (!o.customer) {
      log('SO_CUSTOMER', 'error', code, `has no customer record`);
    }
  }
  return orders.length;
}

async function checkPurchaseOrders() {
  const orders = await prisma.purchaseOrder.findMany({
    include: { items: true, supplier: true, sales_order: true, invoices: true },
  });
  for (const o of orders) {
    const code = o.order_code;
    const itemSubtotal = o.items.reduce((s, i) => s + Number(i.line_total), 0);
    const expectedTotal = itemSubtotal + Number(o.shipping_fee || 0) + Number(o.other_fee || 0);
    if (!close(Number(o.total), expectedTotal)) {
      log('PO_TOTAL', 'error', code, `total=${o.total} ≠ computed ${expectedTotal}`);
    }
    if (o.items.length === 0) {
      log('PO_EMPTY', 'warn', code, `has no items`);
    }
    if (!o.supplier) {
      log('PO_SUPPLIER', 'error', code, `has no supplier record`);
    }
    // PO should be linked to a SO (intermediary model)
    if (!o.sales_order_id) {
      log('PO_LINK', 'warn', code, `not linked to any sales order (intermediary model expects link)`);
    }
    if (o.status === 'COMPLETED' && o.invoices.filter((i: any) => i.type === 'PURCHASE' && i.status !== 'CANCELLED').length === 0) {
      log('PO_INVOICE', 'warn', code, `COMPLETED but no active purchase invoice`);
    }
  }
  return orders.length;
}

async function checkReceivables() {
  const recs = await prisma.receivable.findMany({ include: { payments: true, sales_order: true, customer: true } });
  for (const r of recs) {
    const inv = r.invoice_number || `REC-${String(r.id).slice(0, 6)}`;
    const paymentsSum = r.payments.reduce((s, p) => s + Number(p.amount), 0);
    if (!close(Number(r.paid_amount), paymentsSum)) {
      log('REC_PAID', 'error', inv, `paid_amount=${r.paid_amount} ≠ payments sum ${paymentsSum}`);
    }
    const expectedRem = Number(r.original_amount) - Number(r.paid_amount);
    if (!close(Number(r.remaining), expectedRem)) {
      log('REC_REMAIN', 'error', inv, `remaining=${r.remaining} ≠ original-paid=${expectedRem}`);
    }
    // Status logic
    if (Number(r.remaining) <= 0 && r.status !== 'PAID') {
      log('REC_STATUS', 'error', inv, `remaining=0 but status=${r.status} (expected PAID)`);
    }
    if (Number(r.remaining) > 0 && r.status === 'PAID') {
      log('REC_STATUS', 'error', inv, `status=PAID but remaining=${r.remaining}`);
    }
    if (r.status === 'OVERDUE' && r.due_date && new Date(r.due_date) > new Date()) {
      log('REC_STATUS', 'warn', inv, `status=OVERDUE but due_date=${r.due_date.toISOString().slice(0, 10)} not yet passed`);
    }
    // Linked to SO?
    if (!r.sales_order) {
      log('REC_LINK', 'warn', inv, `not linked to any sales_order`);
    } else if (Number(r.original_amount) !== Number(r.sales_order.grand_total) && r.sales_order.status !== 'CANCELLED') {
      log('REC_AMOUNT', 'warn', inv, `original_amount=${r.original_amount} ≠ SO grand_total=${r.sales_order.grand_total}`);
    }
    if (!r.customer) {
      log('REC_CUSTOMER', 'error', inv, `has no customer`);
    }
  }
  return recs.length;
}

async function checkPayables() {
  const pays = await prisma.payable.findMany({ include: { payments: true, purchase_order: true, supplier: true } });
  for (const p of pays) {
    const inv = p.invoice_number || `PAY-${String(p.id).slice(0, 6)}`;
    const paymentsSum = p.payments.reduce((s, pmt) => s + Number(pmt.amount), 0);
    if (!close(Number(p.paid_amount), paymentsSum)) {
      log('PAY_PAID', 'error', inv, `paid_amount=${p.paid_amount} ≠ payments sum ${paymentsSum}`);
    }
    const expectedRem = Number(p.original_amount) - Number(p.paid_amount);
    if (!close(Number(p.remaining), expectedRem)) {
      log('PAY_REMAIN', 'error', inv, `remaining=${p.remaining} ≠ original-paid=${expectedRem}`);
    }
    if (Number(p.remaining) <= 0 && p.status !== 'PAID') {
      log('PAY_STATUS', 'error', inv, `remaining=0 but status=${p.status} (expected PAID)`);
    }
    if (Number(p.remaining) > 0 && p.status === 'PAID') {
      log('PAY_STATUS', 'error', inv, `status=PAID but remaining=${p.remaining}`);
    }
    if (!p.supplier) {
      log('PAY_SUPPLIER', 'error', inv, `has no supplier`);
    }
    if (!p.purchase_order) {
      log('PAY_LINK', 'warn', inv, `not linked to any purchase_order`);
    }
  }
  return pays.length;
}

async function checkOrphans() {
  // Items without product reference
  const soItems = await prisma.salesOrderItem.findMany({ where: { product_id: null } });
  for (const it of soItems) log('ITEM_NO_PRODUCT', 'warn', `SOI-${it.id.slice(0, 6)}`, `sales_order_item has no product_id`);
  // PO items always have product_id (non-nullable in schema)

  // Customers/Suppliers with no orders
  const customers = await prisma.customer.count({ where: { sales_orders: { none: {} } } });
  if (customers > 0) log('CUST_INACTIVE', 'warn', 'customers', `${customers} customers have no sales orders`);
  const suppliers = await prisma.supplier.count({ where: { purchase_orders: { none: {} } } });
  if (suppliers > 0) log('SUPP_INACTIVE', 'warn', 'suppliers', `${suppliers} suppliers have no purchase orders`);
}

async function main() {
  console.log('Running data consistency audit...\n');
  const counts = {
    sales: await checkSalesOrders(),
    purchase: await checkPurchaseOrders(),
    receivables: await checkReceivables(),
    payables: await checkPayables(),
  };
  await checkOrphans();

  console.log(`Scanned: ${counts.sales} SOs, ${counts.purchase} POs, ${counts.receivables} receivables, ${counts.payables} payables\n`);

  const errors = issues.filter((i) => i.severity === 'error');
  const warns = issues.filter((i) => i.severity === 'warn');

  if (errors.length === 0 && warns.length === 0) {
    console.log('✓ No consistency issues found — all good!');
    return;
  }

  if (errors.length > 0) {
    console.log(`━━━ ERRORS (${errors.length}) ━━━`);
    const byCategory: Record<string, typeof errors> = {};
    for (const e of errors) (byCategory[e.category] ||= []).push(e);
    for (const cat of Object.keys(byCategory)) {
      console.log(`\n[${cat}] ${byCategory[cat].length}`);
      for (const e of byCategory[cat].slice(0, 10)) console.log(`  ✗ ${e.entity}: ${e.message}`);
      if (byCategory[cat].length > 10) console.log(`  ... and ${byCategory[cat].length - 10} more`);
    }
  }

  if (warns.length > 0) {
    console.log(`\n━━━ WARNINGS (${warns.length}) ━━━`);
    const byCategory: Record<string, typeof warns> = {};
    for (const w of warns) (byCategory[w.category] ||= []).push(w);
    for (const cat of Object.keys(byCategory)) {
      console.log(`\n[${cat}] ${byCategory[cat].length}`);
      for (const w of byCategory[cat].slice(0, 5)) console.log(`  ⚠ ${w.entity}: ${w.message}`);
      if (byCategory[cat].length > 5) console.log(`  ... and ${byCategory[cat].length - 5} more`);
    }
  }

  console.log(`\n━━━ SUMMARY ━━━`);
  console.log(`Errors: ${errors.length}, Warnings: ${warns.length}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
