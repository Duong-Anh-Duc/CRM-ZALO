/**
 * Data migration script:
 * 1. Migrate operating_costs → cash_transactions (EXPENSE type)
 * 2. Migrate operating_cost_categories → cash_categories (EXPENSE type)
 * 3. Fix SalesOrderItems: set vat_rate/vat_amount from order-level VAT
 * 4. Recalculate SalesOrder totals (subtotal + per-item VAT + shipping + other)
 */
import prisma from '../../lib/prisma';

async function main() {
  console.log('🔄 Starting data migration...\n');

  // ── 1. Migrate operating cost categories → cash categories ──
  console.log('Step 1: Migrating operating cost categories...');
  const opCategories = await prisma.operatingCostCategory.findMany();
  const categoryMap = new Map<string, string>(); // old_id → new_id

  for (const cat of opCategories) {
    // Check if already exists in cash_categories
    const existing = await prisma.cashCategory.findFirst({
      where: { name: cat.name, type: 'EXPENSE' },
    });
    if (existing) {
      categoryMap.set(cat.id, existing.id);
      console.log(`  Category "${cat.name}" already exists, mapping.`);
    } else {
      const newCat = await prisma.cashCategory.create({
        data: { name: cat.name, type: 'EXPENSE', is_active: cat.is_active },
      });
      categoryMap.set(cat.id, newCat.id);
      console.log(`  Created cash category "${cat.name}"`);
    }
  }

  // ── 2. Migrate operating costs → cash transactions ──
  console.log('\nStep 2: Migrating operating cost records...');
  const opCosts = await prisma.operatingCost.findMany({ orderBy: { date: 'asc' } });
  let migratedCount = 0;

  for (const cost of opCosts) {
    const newCategoryId = categoryMap.get(cost.category_id);
    if (!newCategoryId) {
      console.log(`  WARNING: No category mapping for cost ${cost.id}, skipping.`);
      continue;
    }

    // Check if already migrated (by matching description + date + amount)
    const existing = await prisma.cashTransaction.findFirst({
      where: {
        type: 'EXPENSE',
        amount: cost.amount,
        description: cost.description as string,
        date: cost.date,
      },
    });
    if (existing) continue;

    await prisma.cashTransaction.create({
      data: {
        type: 'EXPENSE',
        category_id: newCategoryId,
        date: cost.date,
        amount: cost.amount,
        description: cost.description as string,
        payment_method: 'CASH',
        notes: cost.receipt_url ? `Receipt: ${cost.receipt_url}` : null,
      },
    });
    migratedCount++;
  }
  console.log(`  Migrated ${migratedCount} operating cost records to cash transactions.`);

  // ── 3. Fix SalesOrderItems: set vat_rate/vat_amount ──
  console.log('\nStep 3: Fixing SalesOrderItem VAT...');
  const salesOrders = await prisma.salesOrder.findMany({
    include: { items: true },
  });

  let itemsFixed = 0;
  for (const so of salesOrders) {
    // Get VAT rate from order level
    const orderVatPct = so.vat_rate === 'VAT_0' ? 0 : so.vat_rate === 'VAT_8' ? 8 : 10;

    for (const item of so.items) {
      // Only fix if item vat_rate is 0 and order has VAT
      if (Number(item.vat_rate) === 0 && orderVatPct > 0) {
        const lineTotal = Number(item.line_total);
        const vatAmount = lineTotal * (orderVatPct / 100);

        await prisma.salesOrderItem.update({
          where: { id: item.id },
          data: {
            vat_rate: orderVatPct,
            vat_amount: vatAmount,
          },
        });
        itemsFixed++;
      }
    }
  }
  console.log(`  Fixed ${itemsFixed} items with per-item VAT.`);

  // ── 4. Recalculate SalesOrder totals ──
  console.log('\nStep 4: Recalculating SalesOrder totals...');
  let ordersFixed = 0;
  for (const so of salesOrders) {
    const items = await prisma.salesOrderItem.findMany({ where: { sales_order_id: so.id } });
    const subtotal = items.reduce((sum, i) => sum + Number(i.line_total), 0);
    const vatAmount = items.reduce((sum, i) => sum + Number(i.vat_amount), 0);
    const shippingFee = Number(so.shipping_fee) || 0;
    const otherFee = Number(so.other_fee) || 0;
    const grandTotal = subtotal + vatAmount + shippingFee + otherFee;

    const currentGrandTotal = Number(so.grand_total);
    if (Math.abs(grandTotal - currentGrandTotal) > 0.01) {
      await prisma.salesOrder.update({
        where: { id: so.id },
        data: { subtotal, vat_amount: vatAmount, grand_total: grandTotal },
      });
      ordersFixed++;
      console.log(`  ${so.order_code}: ${currentGrandTotal.toLocaleString()} → ${grandTotal.toLocaleString()}`);
    }
  }
  console.log(`  Recalculated ${ordersFixed} orders.`);

  // ── 5. Verify receivables match order grand_totals ──
  console.log('\nStep 5: Verifying receivables match...');
  const receivables = await prisma.receivable.findMany({
    include: { sales_order: true },
  });
  let receivablesFixed = 0;
  for (const rec of receivables) {
    if (!rec.sales_order) continue;
    const soGrandTotal = Number(rec.sales_order.grand_total);
    const recOriginal = Number(rec.original_amount);
    if (Math.abs(soGrandTotal - recOriginal) > 0.01) {
      const diff = soGrandTotal - recOriginal;
      await prisma.receivable.update({
        where: { id: rec.id },
        data: {
          original_amount: soGrandTotal,
          remaining: Number(rec.remaining) + diff,
        },
      });
      receivablesFixed++;
      console.log(`  Receivable ${rec.invoice_number}: ${recOriginal.toLocaleString()} → ${soGrandTotal.toLocaleString()}`);
    }
  }
  console.log(`  Fixed ${receivablesFixed} receivables.`);

  console.log('\n✅ Data migration complete!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
