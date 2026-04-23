/**
 * Backfill customer_product_prices from sales_order_items.
 * For each (customer, product) pair seen in SO items, create a
 * customer_product_prices record if one doesn't already exist.
 * Uses the most recent unit_price as the seed price.
 */
import prisma from '../src/lib/prisma';

async function main() {
  const items = await prisma.salesOrderItem.findMany({
    select: {
      product_id: true,
      unit_price: true,
      sales_order: { select: { customer_id: true, order_date: true } },
    },
    orderBy: { sales_order: { order_date: 'desc' } },
  });

  const latest = new Map<string, { customer_id: string; product_id: string; unit_price: number }>();
  for (const it of items) {
    const customerId = it.sales_order?.customer_id;
    if (!customerId || !it.product_id) continue;
    const key = `${customerId}::${it.product_id}`;
    if (!latest.has(key)) {
      latest.set(key, {
        customer_id: customerId,
        product_id: it.product_id,
        unit_price: it.unit_price,
      });
    }
  }

  console.log(`Found ${latest.size} unique (customer, product) pairs from ${items.length} SO items`);

  if (latest.size === 0) {
    console.log('Nothing to backfill.');
    return;
  }

  const existing = await prisma.customerProductPrice.findMany({
    where: {
      OR: [...latest.values()].map((v) => ({
        customer_id: v.customer_id,
        product_id: v.product_id,
      })),
    },
    select: { customer_id: true, product_id: true },
  });
  const existingSet = new Set(existing.map((e) => `${e.customer_id}::${e.product_id}`));

  const toCreate = [...latest.entries()]
    .filter(([k]) => !existingSet.has(k))
    .map(([, v]) => ({
      customer_id: v.customer_id,
      product_id: v.product_id,
      price: v.unit_price,
    }));

  console.log(`Existing customer_product_prices: ${existing.length}`);
  console.log(`New records to create: ${toCreate.length}`);

  if (toCreate.length > 0) {
    const result = await prisma.customerProductPrice.createMany({ data: toCreate, skipDuplicates: true });
    console.log(`✔ Created ${result.count} customer_product_prices`);
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
