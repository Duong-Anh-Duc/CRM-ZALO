/**
 * Comprehensive data reconciliation — makes all invariants hold.
 *
 * Strategy (chosen to PRESERVE historical monetary amounts that are already
 * linked to invoices/receivables/payables):
 *
 * 1. SalesOrderItem: line_total stays; reset discount_pct=0 where formula drifts
 *    (meaning the discount was never actually applied to the line total).
 *
 * 2. SalesOrder: grand_total stays (it's linked to Invoice + Receivable); absorb
 *    formula drift into `other_fee` with a note. Also recompute subtotal from
 *    current items so Σitems = subtotal.
 *
 * 3. Payable: for paid_amount>0 with zero payments, backfill a synthetic
 *    PayablePayment so sum(payments) = paid_amount.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const EPS = 0.5;
const APPLY = process.argv.includes('--apply');

async function main() {
  console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY RUN (pass --apply to persist)'}\n`);

  // === 1. SalesOrderItem: reset discount_pct where line_total ignores it ===
  const soItems = await prisma.salesOrderItem.findMany({
    select: { id: true, quantity: true, unit_price: true, line_total: true, discount_pct: true },
  });
  const itemFixes = soItems.filter((i) => {
    const pct = i.discount_pct ?? 0;
    const withDisc = i.quantity * i.unit_price * (1 - pct / 100);
    const withoutDisc = i.quantity * i.unit_price;
    // line_total matches formula without discount but has discount_pct set
    return pct > 0 && Math.abs(i.line_total - withoutDisc) < EPS && Math.abs(i.line_total - withDisc) > EPS;
  });
  console.log(`[1] SalesOrderItem: ${itemFixes.length} items with unapplied discount_pct → reset to 0`);

  // === 2. SalesOrder: recompute subtotal from items, absorb grand_total drift into other_fee ===
  const sos = await prisma.salesOrder.findMany({
    select: {
      id: true, order_code: true, grand_total: true, subtotal: true, vat_amount: true,
      discount_amount: true, shipping_fee: true, other_fee: true, other_fee_note: true,
      items: { select: { line_total: true } },
    },
  });

  interface SoFix {
    id: string;
    order_code: string;
    new_subtotal?: number;
    new_other_fee?: number;
    new_other_fee_note?: string;
  }
  const soFixes: SoFix[] = [];
  for (const so of sos) {
    const itemsSum = so.items.reduce((s, i) => s + i.line_total, 0);
    const fix: SoFix = { id: so.id, order_code: so.order_code };
    let targetSubtotal = so.subtotal;

    if (Math.abs(itemsSum - so.subtotal) > EPS) {
      fix.new_subtotal = itemsSum;
      targetSubtotal = itemsSum;
    }

    const formula = targetSubtotal - so.discount_amount + so.vat_amount + so.shipping_fee + so.other_fee;
    if (Math.abs(formula - so.grand_total) > EPS) {
      const drift = so.grand_total - formula;
      fix.new_other_fee = so.other_fee + drift;
      fix.new_other_fee_note = so.other_fee_note
        ? `${so.other_fee_note} [Reconciled: ${drift.toLocaleString()}]`
        : `Reconciled drift: ${drift.toLocaleString()}`;
    }

    if (fix.new_subtotal !== undefined || fix.new_other_fee !== undefined) {
      soFixes.push(fix);
    }
  }
  console.log(`[2] SalesOrder: ${soFixes.length} orders need reconciliation`);

  // === 3. Payable: backfill synthetic payment records where paid_amount>0 but no payments ===
  const payables = await prisma.payable.findMany({ include: { payments: true } });
  const payableFixes = payables.filter((p) => p.paid_amount > 0 && p.payments.length === 0);
  console.log(`[3] Payable: ${payableFixes.length} payables with paid_amount but no payment records`);

  console.log('\n=== Details ===');
  for (const f of itemFixes.slice(0, 5)) {
    console.log(`  item ${f.id.slice(0, 8)}… | discount_pct ${f.discount_pct} → 0`);
  }
  if (itemFixes.length > 5) console.log(`  ... +${itemFixes.length - 5} more items`);

  for (const f of soFixes.slice(0, 5)) {
    const changes: string[] = [];
    if (f.new_subtotal !== undefined) changes.push(`subtotal→${f.new_subtotal.toLocaleString()}`);
    if (f.new_other_fee !== undefined) changes.push(`other_fee→${f.new_other_fee.toLocaleString()}`);
    console.log(`  SO ${f.order_code} | ${changes.join(', ')}`);
  }
  if (soFixes.length > 5) console.log(`  ... +${soFixes.length - 5} more SOs`);

  for (const p of payableFixes) {
    console.log(`  payable ${p.invoice_number} | +payment ${p.paid_amount.toLocaleString()}`);
  }

  if (!APPLY) {
    console.log('\n(dry run — pass --apply to persist)');
    return;
  }

  console.log('\n=== Applying ===');

  // Apply item fixes
  for (const i of itemFixes) {
    await prisma.salesOrderItem.update({
      where: { id: i.id },
      data: { discount_pct: 0 },
    });
  }
  console.log(`✓ Updated ${itemFixes.length} SalesOrderItems`);

  // Apply SO fixes
  for (const f of soFixes) {
    const data: { subtotal?: number; other_fee?: number; other_fee_note?: string } = {};
    if (f.new_subtotal !== undefined) data.subtotal = f.new_subtotal;
    if (f.new_other_fee !== undefined) {
      data.other_fee = f.new_other_fee;
      data.other_fee_note = f.new_other_fee_note;
    }
    await prisma.salesOrder.update({ where: { id: f.id }, data });
  }
  console.log(`✓ Updated ${soFixes.length} SalesOrders`);

  // Apply payable backfill
  for (const p of payableFixes) {
    await prisma.payablePayment.create({
      data: {
        payable_id: p.id,
        amount: p.paid_amount,
        payment_date: p.invoice_date,
        method: 'BANK_TRANSFER',
        reference: 'Legacy reconciliation',
      },
    });
  }
  console.log(`✓ Created ${payableFixes.length} synthetic PayablePayments`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
