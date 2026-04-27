/**
 * Fix data consistency issues found by audit-data-consistency.ts.
 *
 * Steps (in order):
 *  1. Recompute SO grand_total from items + vat + shipping + other_fee
 *  2. Recompute PO total from items + shipping + other_fee
 *  3. Auto-assign supplier_id to SO items missing it (uses preferred supplier_price, else first)
 *  4. Auto-create PurchaseOrders for CONFIRMED+ SOs that have no PO (groups items by supplier)
 *  5. Recompute Receivable/Payable: paid_amount = sum(payments), remaining = original - paid, status from remaining
 *  6. Issue DRAFT sales invoices for COMPLETED SOs that have no active invoice
 *  7. Issue DRAFT purchase invoices for COMPLETED POs that have no active invoice
 *
 * Usage:
 *   tsx server/scripts/fix-data-consistency.ts            # dry-run
 *   tsx server/scripts/fix-data-consistency.ts --apply    # commit
 */
import prisma from '../src/lib/prisma';

const apply = process.argv.includes('--apply');
const stats = {
  soTotalsFixed: 0, poTotalsFixed: 0,
  itemsAssignedSupplier: 0, itemsNoSupplierAvailable: 0,
  posCreated: 0, soSkippedNoSupplier: 0,
  receivablesFixed: 0, payablesFixed: 0,
  invoicesIssued: 0, invoicesSkipped: 0,
};

async function step1_recomputeSOTotals() {
  console.log('\n[1] Recomputing SalesOrder totals...');
  const sos = await prisma.salesOrder.findMany({ include: { items: true } });
  for (const so of sos) {
    const subtotal = so.items.reduce((s, i) => s + Number(i.line_total), 0);
    const vat = so.items.reduce((s, i) => s + Number(i.vat_amount || 0), 0);
    const grand = subtotal + vat + Number(so.shipping_fee || 0) + Number(so.other_fee || 0);
    if (Math.abs(Number(so.grand_total) - grand) > 1 || Math.abs(Number(so.subtotal) - subtotal) > 1 || Math.abs(Number(so.vat_amount) - vat) > 1) {
      stats.soTotalsFixed++;
      if (apply) {
        await prisma.salesOrder.update({ where: { id: so.id }, data: { subtotal, vat_amount: vat, grand_total: grand } });
      }
    }
  }
  console.log(`  ${stats.soTotalsFixed}/${sos.length} SOs ${apply ? 'updated' : 'would be updated'}`);
}

async function step2_recomputePOTotals() {
  console.log('\n[2] Recomputing PurchaseOrder totals...');
  const pos = await prisma.purchaseOrder.findMany({ include: { items: true } });
  for (const po of pos) {
    const itemsTotal = po.items.reduce((s, i) => s + Number(i.line_total), 0);
    const total = itemsTotal + Number(po.shipping_fee || 0) + Number(po.other_fee || 0);
    if (Math.abs(Number(po.total) - total) > 1) {
      stats.poTotalsFixed++;
      if (apply) await prisma.purchaseOrder.update({ where: { id: po.id }, data: { total } });
    }
  }
  console.log(`  ${stats.poTotalsFixed}/${pos.length} POs ${apply ? 'updated' : 'would be updated'}`);
}

async function step3_assignSuppliers() {
  console.log('\n[3] Assigning suppliers to SO items missing supplier_id...');
  const items = await prisma.salesOrderItem.findMany({
    where: { supplier_id: null, product_id: { not: null } },
    include: { product: { include: { supplier_prices: { orderBy: [{ is_preferred: 'desc' }] } } } },
  });
  for (const item of items) {
    const sps = item.product?.supplier_prices || [];
    if (sps.length === 0) {
      stats.itemsNoSupplierAvailable++;
      continue;
    }
    const preferred = sps.find((sp) => sp.is_preferred) || sps[0];
    stats.itemsAssignedSupplier++;
    if (apply) {
      await prisma.salesOrderItem.update({
        where: { id: item.id },
        data: { supplier_id: preferred.supplier_id, purchase_price: preferred.purchase_price },
      });
    }
  }
  console.log(`  ${stats.itemsAssignedSupplier} items ${apply ? 'assigned' : 'would be assigned'}, ${stats.itemsNoSupplierAvailable} have no supplier_price available (manual fix needed)`);
}

async function step4_autoCreatePOs() {
  console.log('\n[4] Auto-creating PurchaseOrders for CONFIRMED+ SOs without PO...');
  const sos = await prisma.salesOrder.findMany({
    where: {
      status: { in: ['CONFIRMED', 'PREPARING', 'SHIPPING', 'INVOICED', 'COMPLETED'] },
      purchase_orders: { none: {} },
    },
    include: { items: { include: { product: true } } },
  });
  for (const so of sos) {
    const itemsWithSupplier = so.items.filter((i) => i.supplier_id && i.product_id);
    if (itemsWithSupplier.length === 0) {
      stats.soSkippedNoSupplier++;
      console.log(`  ⚠ skip ${so.order_code} — no items with supplier_id`);
      continue;
    }
    const groups = new Map<string, typeof itemsWithSupplier>();
    for (const item of itemsWithSupplier) {
      const sid = item.supplier_id!;
      if (!groups.has(sid)) groups.set(sid, []);
      groups.get(sid)!.push(item);
    }
    for (const [supplierId, groupItems] of groups) {
      const total = groupItems.reduce((s, i) => s + (Number(i.purchase_price || i.unit_price) * Number(i.quantity)), 0);
      const lastPO = await prisma.purchaseOrder.findFirst({ where: { order_code: { startsWith: 'PO-' } }, orderBy: { created_at: 'desc' } });
      const seq = lastPO ? parseInt(lastPO.order_code.split('-').pop() || '0') + 1 : 1;
      const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const code = `PO-${today}-${String(seq).padStart(3, '0')}`;
      stats.posCreated++;
      if (apply) {
        await prisma.purchaseOrder.create({
          data: {
            order_code: code, supplier_id: supplierId, sales_order_id: so.id,
            order_date: so.order_date, expected_delivery: so.expected_delivery,
            total, status: 'DRAFT',
            items: { create: groupItems.map((i) => ({
              product_id: i.product_id!, quantity: i.quantity,
              unit_price: Number(i.purchase_price || i.unit_price),
              line_total: Number(i.purchase_price || i.unit_price) * Number(i.quantity),
            })) },
          },
        });
      }
    }
  }
  console.log(`  ${stats.posCreated} POs ${apply ? 'created' : 'would be created'}, ${stats.soSkippedNoSupplier} SOs skipped (still no supplier on items)`);
}

async function step5_recomputeDebts() {
  console.log('\n[5] Recomputing Receivable/Payable totals...');
  const recs = await prisma.receivable.findMany({ include: { payments: true } });
  for (const r of recs) {
    const paid = r.payments.reduce((s, p) => s + Number(p.amount), 0);
    const remaining = Number(r.original_amount) - paid;
    let status = r.status;
    if (remaining <= 0) status = 'PAID';
    else if (paid > 0) status = 'PARTIAL';
    else if (r.due_date && new Date(r.due_date) < new Date()) status = 'OVERDUE';
    else status = 'UNPAID';
    if (Math.abs(Number(r.paid_amount) - paid) > 1 || Math.abs(Number(r.remaining) - remaining) > 1 || r.status !== status) {
      stats.receivablesFixed++;
      if (apply) await prisma.receivable.update({ where: { id: r.id }, data: { paid_amount: paid, remaining, status } });
    }
  }
  const pays = await prisma.payable.findMany({ include: { payments: true } });
  for (const p of pays) {
    const paid = p.payments.reduce((s, pmt) => s + Number(pmt.amount), 0);
    const remaining = Number(p.original_amount) - paid;
    let status = p.status;
    if (remaining <= 0) status = 'PAID';
    else if (paid > 0) status = 'PARTIAL';
    else if (p.due_date && new Date(p.due_date) < new Date()) status = 'OVERDUE';
    else status = 'UNPAID';
    if (Math.abs(Number(p.paid_amount) - paid) > 1 || Math.abs(Number(p.remaining) - remaining) > 1 || p.status !== status) {
      stats.payablesFixed++;
      if (apply) await prisma.payable.update({ where: { id: p.id }, data: { paid_amount: paid, remaining, status } });
    }
  }
  console.log(`  ${stats.receivablesFixed} receivables, ${stats.payablesFixed} payables ${apply ? 'fixed' : 'would be fixed'}`);
}

async function step6_issueInvoices() {
  console.log('\n[6] Issuing missing invoices for COMPLETED orders...');
  const lastInv = await prisma.invoice.findFirst({ orderBy: { invoice_number: 'desc' } });
  let nextNum = (lastInv?.invoice_number ?? 0) + 1;

  const sos = await prisma.salesOrder.findMany({
    where: { status: 'COMPLETED', invoices: { none: { status: { not: 'CANCELLED' }, type: 'SALES' } } },
    include: { customer: true, items: { include: { product: true } } },
  });
  for (const so of sos) {
    stats.invoicesIssued++;
    if (apply) {
      try {
        await prisma.invoice.create({
          data: {
            invoice_number: nextNum++, type: 'SALES', sales_order_id: so.id, status: 'DRAFT',
            buyer_company: so.customer?.company_name, buyer_name: so.customer?.contact_name || so.customer?.company_name,
            buyer_address: so.customer?.address, buyer_tax_code: so.customer?.tax_code, buyer_phone: so.customer?.phone, buyer_email: so.customer?.email,
            items: so.items.map((it) => ({ name: it.product?.name || 'N/A', unit: 'cái', quantity: it.quantity, unitPrice: Number(it.unit_price), amount: Number(it.line_total) })) as any,
            subtotal: Number(so.subtotal), vat_amount: Number(so.vat_amount), total: Number(so.grand_total),
            invoice_date: so.order_date, notes: so.notes,
          },
        });
      } catch (e: any) {
        stats.invoicesSkipped++;
        console.log(`  ⚠ skip ${so.order_code}: ${e.message?.slice(0, 80)}`);
        nextNum--;
      }
    }
  }
  const pos = await prisma.purchaseOrder.findMany({
    where: { status: 'COMPLETED', invoices: { none: { status: { not: 'CANCELLED' }, type: 'PURCHASE' } } },
    include: { supplier: true },
  });
  for (const po of pos) {
    stats.invoicesIssued++;
    if (apply) {
      try {
        await prisma.invoice.create({
          data: {
            invoice_number: nextNum++, type: 'PURCHASE', purchase_order_id: po.id, status: 'DRAFT',
            seller_name: po.supplier?.company_name, seller_tax_code: po.supplier?.tax_code, seller_address: po.supplier?.address, seller_phone: po.supplier?.phone, seller_email: po.supplier?.email,
            subtotal: Number(po.total), total: Number(po.total),
            invoice_date: po.order_date, notes: po.notes,
          },
        });
      } catch (e: any) {
        stats.invoicesSkipped++;
        console.log(`  ⚠ skip ${po.order_code}: ${e.message?.slice(0, 80)}`);
        nextNum--;
      }
    }
  }
  console.log(`  ${stats.invoicesIssued} invoices ${apply ? 'issued' : 'would be issued'} (${stats.invoicesSkipped} skipped)`);
}

async function main() {
  console.log(`Mode: ${apply ? 'APPLY (writing to DB)' : 'DRY-RUN'}`);
  await step1_recomputeSOTotals();
  await step2_recomputePOTotals();
  await step3_assignSuppliers();
  await step4_autoCreatePOs();
  await step5_recomputeDebts();
  await step6_issueInvoices();

  console.log('\n━━━ SUMMARY ━━━');
  console.log(JSON.stringify(stats, null, 2));
  if (!apply) console.log('\nDRY-RUN. Re-run with --apply to commit changes.');
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
