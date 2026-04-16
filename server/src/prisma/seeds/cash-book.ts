import prisma from '../../lib/prisma';

const incomeCategories = [
  'Thu từ khách hàng',
  'Nạp tiền vốn',
  'Thu khác',
];

const expenseCategories = [
  'Chi lương nhân viên',
  'Chi phí vận chuyển',
  'Rút tiền',
  'Chi phí văn phòng',
  'Chi phí xăng xe',
  'Thanh toán NCC',
  'Chi khác',
];

export async function seedCashBook() {
  console.log('  Seeding cash categories...');

  const existing = await prisma.cashCategory.count();
  if (existing > 0) {
    console.log('  Cash categories already exist, skipping.');
    return;
  }

  // Create income categories
  for (const name of incomeCategories) {
    await prisma.cashCategory.create({ data: { name, type: 'INCOME' } });
  }

  // Create expense categories
  for (const name of expenseCategories) {
    await prisma.cashCategory.create({ data: { name, type: 'EXPENSE' } });
  }

  // Seed sample transactions
  const categories = await prisma.cashCategory.findMany();
  const incomeCats = categories.filter((c) => c.type === 'INCOME');
  const expenseCats = categories.filter((c) => c.type === 'EXPENSE');

  const transactions = [
    // Thu
    { type: 'INCOME' as const, category_id: incomeCats.find((c) => c.name === 'Nạp tiền vốn')!.id, date: new Date('2025-10-01'), amount: 100000000, description: 'Nạp vốn ban đầu', payment_method: 'BANK_TRANSFER' as const },
    { type: 'INCOME' as const, category_id: incomeCats.find((c) => c.name === 'Thu từ khách hàng')!.id, date: new Date('2025-10-15'), amount: 25000000, description: 'KH Công ty ABC thanh toán', reference: 'CK-20251015', payment_method: 'BANK_TRANSFER' as const },
    { type: 'INCOME' as const, category_id: incomeCats.find((c) => c.name === 'Thu từ khách hàng')!.id, date: new Date('2025-11-05'), amount: 15000000, description: 'KH Minh Phát thanh toán tiền mặt', payment_method: 'CASH' as const },
    { type: 'INCOME' as const, category_id: incomeCats.find((c) => c.name === 'Thu khác')!.id, date: new Date('2025-11-20'), amount: 2000000, description: 'Thu phí hỗ trợ vận chuyển', payment_method: 'CASH' as const },
    // Chi
    { type: 'EXPENSE' as const, category_id: expenseCats.find((c) => c.name === 'Chi lương nhân viên')!.id, date: new Date('2025-10-30'), amount: 45000000, description: 'Lương tháng 10/2025', payment_method: 'BANK_TRANSFER' as const },
    { type: 'EXPENSE' as const, category_id: expenseCats.find((c) => c.name === 'Thanh toán NCC')!.id, date: new Date('2025-10-20'), amount: 30000000, description: 'TT NCC Nhựa Đại Phát', reference: 'CK-NCC-001', payment_method: 'BANK_TRANSFER' as const },
    { type: 'EXPENSE' as const, category_id: expenseCats.find((c) => c.name === 'Chi phí vận chuyển')!.id, date: new Date('2025-11-10'), amount: 3500000, description: 'Ship hàng đi HCM', payment_method: 'CASH' as const },
    { type: 'EXPENSE' as const, category_id: expenseCats.find((c) => c.name === 'Rút tiền')!.id, date: new Date('2025-11-15'), amount: 10000000, description: 'Rút tiền quỹ', payment_method: 'CASH' as const },
    { type: 'EXPENSE' as const, category_id: expenseCats.find((c) => c.name === 'Chi phí xăng xe')!.id, date: new Date('2025-11-18'), amount: 1500000, description: 'Xăng xe giao hàng', payment_method: 'CASH' as const },
    { type: 'EXPENSE' as const, category_id: expenseCats.find((c) => c.name === 'Chi lương nhân viên')!.id, date: new Date('2025-11-30'), amount: 45000000, description: 'Lương tháng 11/2025', payment_method: 'BANK_TRANSFER' as const },
  ];

  for (const tx of transactions) {
    await prisma.cashTransaction.create({ data: tx });
  }

  console.log(`  Created ${incomeCategories.length + expenseCategories.length} categories and ${transactions.length} transactions`);
}
