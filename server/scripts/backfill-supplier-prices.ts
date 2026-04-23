/**
 * Backfill supplier_prices from purchase_order_items.
 * For each (supplier, product) pair seen in PO items, create a supplier_prices
 * record if one doesn't already exist. Uses the most recent unit_price as the
 * seed purchase_price. Does not touch manually-entered rows.
 *
 * Usage: yarn ts-node scripts/backfill-supplier-prices.ts
 */
import prisma from '../src/lib/prisma';

async function main() {
  const items = await prisma.purchaseOrderItem.findMany({
    select: {
      product_id: true,
      unit_price: true,
      quantity: true,
      purchase_order: { select: { supplier_id: true, order_date: true } },
    },
    orderBy: { purchase_order: { order_date: 'desc' } },
  });

  // Group by (supplier_id, product_id) — keep latest (first in sorted result)
  const latest = new Map<string, { supplier_id: string; product_id: string; unit_price: number; quantity: number }>();
  for (const it of items) {
    const supplierId = it.purchase_order?.supplier_id;
    if (!supplierId || !it.product_id) continue;
    const key = `${supplierId}::${it.product_id}`;
    if (!latest.has(key)) {
      latest.set(key, {
        supplier_id: supplierId,
        product_id: it.product_id,
        unit_price: it.unit_price,
        quantity: it.quantity,
      });
    }
  }

  console.log(`Found ${latest.size} unique (supplier, product) pairs from ${items.length} PO items`);

  const keys = [...latest.keys()];
  const existing = await prisma.supplierPrice.findMany({
    where: {
      OR: [...latest.values()].map((v) => ({
        supplier_id: v.supplier_id,
        product_id: v.product_id,
      })),
    },
    select: { supplier_id: true, product_id: true },
  });
  const existingSet = new Set(existing.map((e) => `${e.supplier_id}::${e.product_id}`));

  const toCreate = keys
    .filter((k) => !existingSet.has(k))
    .map((k) => {
      const v = latest.get(k)!;
      return {
        supplier_id: v.supplier_id,
        product_id: v.product_id,
        purchase_price: v.unit_price,
        moq: v.quantity > 0 ? v.quantity : null,
        is_preferred: false,
      };
    });

  console.log(`Existing supplier_prices records: ${existing.length}`);
  console.log(`New records to create: ${toCreate.length}`);

  if (toCreate.length > 0) {
    const result = await prisma.supplierPrice.createMany({ data: toCreate, skipDuplicates: true });
    console.log(`✔ Created ${result.count} supplier_prices`);
  } else {
    console.log('Nothing to backfill.');
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
