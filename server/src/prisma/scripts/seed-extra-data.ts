/**
 * Seed extra data:
 * 1. More INCOME cash transactions (matching receivable payments)
 * 2. Sample Sales Returns + Purchase Returns
 */
import prisma from '../../lib/prisma';
import dayjs from 'dayjs';

async function main() {
  console.log('🌱 Seeding extra data...\n');

  // ── 1. Add more INCOME transactions ──
  console.log('Step 1: Adding income transactions...');
  const incomeCategory = await prisma.cashCategory.findFirst({ where: { type: 'INCOME', name: { contains: 'khách' } } });
  const capitalCategory = await prisma.cashCategory.findFirst({ where: { type: 'INCOME', name: { contains: 'vốn' } } });
  const otherIncomeCategory = await prisma.cashCategory.findFirst({ where: { type: 'INCOME', name: { contains: 'khác' } } });

  if (!incomeCategory || !capitalCategory) {
    console.log('  Income categories not found, skipping.');
  } else {
    // Check if we already have enough income records
    const existingIncome = await prisma.cashTransaction.count({ where: { type: 'INCOME' } });
    if (existingIncome < 10) {
      const incomeRecords = [
        { category_id: capitalCategory.id, date: new Date('2025-09-01'), amount: 200000000, description: 'Nạp vốn ban đầu', payment_method: 'BANK_TRANSFER' as const, reference: 'CK-VON-001' },
        { category_id: incomeCategory.id, date: new Date('2025-10-08'), amount: 15000000, description: 'KH Công ty Nhựa Minh Phát thanh toán', payment_method: 'BANK_TRANSFER' as const, reference: 'CK-20251008-001' },
        { category_id: incomeCategory.id, date: new Date('2025-10-22'), amount: 8500000, description: 'KH Đại Phát Plastic thanh toán tiền mặt', payment_method: 'CASH' as const },
        { category_id: incomeCategory.id, date: new Date('2025-11-12'), amount: 32000000, description: 'KH Công ty TNHH Bao Bì Xanh thanh toán', payment_method: 'BANK_TRANSFER' as const, reference: 'CK-20251112-002' },
        { category_id: incomeCategory.id, date: new Date('2025-11-28'), amount: 12000000, description: 'KH Hóa Chất Việt Nam thanh toán', payment_method: 'BANK_TRANSFER' as const, reference: 'CK-20251128-003' },
        { category_id: incomeCategory.id, date: new Date('2025-12-05'), amount: 45000000, description: 'KH Công ty ABC thanh toán đợt 2', payment_method: 'BANK_TRANSFER' as const, reference: 'CK-20251205-001' },
        { category_id: incomeCategory.id, date: new Date('2025-12-18'), amount: 7500000, description: 'KH Nhựa Tân Tiến thanh toán tiền mặt', payment_method: 'CASH' as const },
        { category_id: incomeCategory.id, date: new Date('2026-01-10'), amount: 18000000, description: 'KH Bình Minh Plastic thanh toán', payment_method: 'BANK_TRANSFER' as const, reference: 'CK-20260110-001' },
        { category_id: incomeCategory.id, date: new Date('2026-01-25'), amount: 25000000, description: 'KH Đông Á Packaging thanh toán', payment_method: 'BANK_TRANSFER' as const, reference: 'CK-20260125-002' },
        { category_id: incomeCategory.id, date: new Date('2026-02-08'), amount: 9800000, description: 'KH Công ty Sáng Tạo thanh toán', payment_method: 'CASH' as const },
        { category_id: capitalCategory.id, date: new Date('2026-02-15'), amount: 50000000, description: 'Nạp thêm vốn kinh doanh', payment_method: 'BANK_TRANSFER' as const, reference: 'CK-VON-002' },
        { category_id: incomeCategory.id, date: new Date('2026-03-05'), amount: 38000000, description: 'KH Công ty TNHH Bao Bì Xanh thanh toán đợt 2', payment_method: 'BANK_TRANSFER' as const, reference: 'CK-20260305-001' },
        { category_id: incomeCategory.id, date: new Date('2026-03-20'), amount: 15500000, description: 'KH Nhựa Hoàng Gia thanh toán', payment_method: 'BANK_TRANSFER' as const, reference: 'CK-20260320-003' },
        { category_id: otherIncomeCategory!.id, date: new Date('2026-03-28'), amount: 3500000, description: 'Thu phí hỗ trợ vận chuyển + đóng gói', payment_method: 'CASH' as const },
        { category_id: incomeCategory.id, date: new Date('2026-04-02'), amount: 22000000, description: 'KH Minh Phát thanh toán tháng 3', payment_method: 'BANK_TRANSFER' as const, reference: 'CK-20260402-001' },
        { category_id: incomeCategory.id, date: new Date('2026-04-10'), amount: 11000000, description: 'KH Hóa Chất Việt Nam thanh toán đợt 2', payment_method: 'BANK_TRANSFER' as const, reference: 'CK-20260410-002' },
      ];

      for (const rec of incomeRecords) {
        await prisma.cashTransaction.create({ data: { type: 'INCOME', ...rec } });
      }
      console.log(`  Created ${incomeRecords.length} income transactions.`);
    } else {
      console.log(`  Already have ${existingIncome} income records, skipping.`);
    }
  }

  // ── 2. Add more EXPENSE transactions ──
  console.log('\nStep 2: Adding more expense transactions...');
  const nccCategory = await prisma.cashCategory.findFirst({ where: { type: 'EXPENSE', name: { contains: 'NCC' } } });
  const salaryCategory = await prisma.cashCategory.findFirst({ where: { type: 'EXPENSE', name: { contains: 'lương' } } });
  const shippingCategory = await prisma.cashCategory.findFirst({ where: { type: 'EXPENSE', name: { contains: 'vận chuyển' } } });
  const withdrawCategory = await prisma.cashCategory.findFirst({ where: { type: 'EXPENSE', name: { contains: 'Rút' } } });

  if (nccCategory && salaryCategory && shippingCategory) {
    const existingExpenseAfterMarch = await prisma.cashTransaction.count({
      where: { type: 'EXPENSE', date: { gte: new Date('2026-03-01') } }
    });

    if (existingExpenseAfterMarch < 10) {
      const expenseRecords = [
        { category_id: nccCategory.id, date: new Date('2026-03-05'), amount: 28000000, description: 'TT NCC Nhựa Đại Phát đơn PO-0001', payment_method: 'BANK_TRANSFER' as const, reference: 'CK-NCC-20260305' },
        { category_id: salaryCategory.id, date: new Date('2026-03-30'), amount: 48000000, description: 'Lương tháng 3/2026', payment_method: 'BANK_TRANSFER' as const },
        { category_id: shippingCategory.id, date: new Date('2026-03-15'), amount: 4200000, description: 'Ship hàng đi Đà Nẵng + HCM', payment_method: 'CASH' as const },
        { category_id: nccCategory.id, date: new Date('2026-03-22'), amount: 15000000, description: 'TT NCC Bao Bì Thành Công', payment_method: 'BANK_TRANSFER' as const, reference: 'CK-NCC-20260322' },
        { category_id: withdrawCategory!.id, date: new Date('2026-03-25'), amount: 5000000, description: 'Rút tiền quỹ', payment_method: 'CASH' as const },
        { category_id: nccCategory.id, date: new Date('2026-04-05'), amount: 35000000, description: 'TT NCC Nhựa Tân Phát đơn tháng 3', payment_method: 'BANK_TRANSFER' as const, reference: 'CK-NCC-20260405' },
        { category_id: salaryCategory.id, date: new Date('2026-04-05'), amount: 48000000, description: 'Lương tháng 4/2026', payment_method: 'BANK_TRANSFER' as const },
        { category_id: shippingCategory.id, date: new Date('2026-04-08'), amount: 2800000, description: 'Ship hàng nội thành HN', payment_method: 'CASH' as const },
      ];

      for (const rec of expenseRecords) {
        await prisma.cashTransaction.create({ data: { type: 'EXPENSE', ...rec } });
      }
      console.log(`  Created ${expenseRecords.length} expense transactions.`);
    } else {
      console.log(`  Already have recent expense data, skipping.`);
    }
  }

  // ── 3. Create sample Sales Returns ──
  console.log('\nStep 3: Creating sample Sales Returns...');
  const existingReturns = await prisma.salesReturn.count();
  if (existingReturns === 0) {
    // Find completed sales orders with items
    const completedSOs = await prisma.salesOrder.findMany({
      where: { status: { in: ['COMPLETED', 'SHIPPING', 'INVOICED'] } },
      include: { items: { include: { product: true } }, customer: true },
      take: 5,
    });

    let salesReturnCount = 0;
    for (const so of completedSOs.slice(0, 3)) {
      if (so.items.length === 0) continue;
      const item = so.items[0]; // Return first item partially
      const returnQty = Math.max(1, Math.floor(item.quantity / 3));
      const returnCode = `SR-${dayjs(so.order_date).format('YYYYMMDD')}-${String(salesReturnCount + 1).padStart(3, '0')}`;
      const lineTotal = returnQty * Number(item.unit_price);

      const statuses: ('PENDING' | 'APPROVED' | 'COMPLETED')[] = ['PENDING', 'APPROVED', 'COMPLETED'];
      const status = statuses[salesReturnCount % 3];
      const reasons = ['Sản phẩm bị lỗi nắp', 'Sai quy cách đóng gói', 'Khách đổi ý, trả bớt'];

      await prisma.salesReturn.create({
        data: {
          return_code: returnCode,
          sales_order_id: so.id,
          customer_id: so.customer_id,
          return_date: dayjs(so.order_date).add(10, 'day').toDate(),
          total_amount: lineTotal,
          reason: reasons[salesReturnCount % 3],
          status,
          items: {
            create: [{
              product_id: item.product_id!,
              quantity: returnQty,
              unit_price: Number(item.unit_price),
              line_total: lineTotal,
              reason: reasons[salesReturnCount % 3],
            }],
          },
        },
      });
      salesReturnCount++;
    }
    console.log(`  Created ${salesReturnCount} sales returns.`);
  } else {
    console.log(`  Already have ${existingReturns} sales returns.`);
  }

  // ── 4. Create sample Purchase Returns ──
  console.log('\nStep 4: Creating sample Purchase Returns...');
  const existingPurchaseReturns = await prisma.purchaseReturn.count();
  if (existingPurchaseReturns === 0) {
    const completedPOs = await prisma.purchaseOrder.findMany({
      where: { status: { in: ['COMPLETED', 'SHIPPING', 'INVOICED'] } },
      include: { items: { include: { product: true } }, supplier: true },
      take: 5,
    });

    let purchaseReturnCount = 0;
    for (const po of completedPOs.slice(0, 3)) {
      if (po.items.length === 0) continue;
      const item = po.items[0];
      const returnQty = Math.max(1, Math.floor(item.quantity / 4));
      const returnCode = `PR-${dayjs(po.order_date).format('YYYYMMDD')}-${String(purchaseReturnCount + 1).padStart(3, '0')}`;
      const lineTotal = returnQty * Number(item.unit_price);

      const statuses: ('PENDING' | 'APPROVED' | 'COMPLETED')[] = ['PENDING', 'APPROVED', 'COMPLETED'];
      const status = statuses[purchaseReturnCount % 3];
      const reasons = ['Hàng bị nứt khi vận chuyển', 'Sai chất liệu so với đơn', 'Thừa hàng không đặt'];

      await prisma.purchaseReturn.create({
        data: {
          return_code: returnCode,
          purchase_order_id: po.id,
          supplier_id: po.supplier_id,
          return_date: dayjs(po.order_date).add(7, 'day').toDate(),
          total_amount: lineTotal,
          reason: reasons[purchaseReturnCount % 3],
          status,
          items: {
            create: [{
              product_id: item.product_id,
              quantity: returnQty,
              unit_price: Number(item.unit_price),
              line_total: lineTotal,
              reason: reasons[purchaseReturnCount % 3],
            }],
          },
        },
      });
      purchaseReturnCount++;
    }
    console.log(`  Created ${purchaseReturnCount} purchase returns.`);
  } else {
    console.log(`  Already have ${existingPurchaseReturns} purchase returns.`);
  }

  console.log('\n✅ Extra data seeding complete!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
