import { PrismaClient } from '@prisma/client';
import dayjs from 'dayjs';

const costCategories = [
  'Vận chuyển',
  'Xăng xe',
  'Văn phòng phẩm',
  'Lương nhân viên',
  'Thuê mặt bằng',
  'Khác',
];

export async function seedOperatingCosts(prisma: PrismaClient) {
  // Create categories
  const cats: Record<string, string> = {};
  for (const name of costCategories) {
    const cat = await prisma.operatingCostCategory.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    cats[name] = cat.id;
  }

  // 3 months of costs
  const costEntries = [
    // Month 1 (2 months ago)
    { offset: -2, category: 'Vận chuyển', desc: 'Giao hàng đợt 1', amount: 5500000 },
    { offset: -2, category: 'Vận chuyển', desc: 'Giao hàng đợt 2', amount: 4200000 },
    { offset: -2, category: 'Xăng xe', desc: 'Xăng tháng', amount: 3000000 },
    { offset: -2, category: 'Văn phòng phẩm', desc: 'Mực in, giấy A4', amount: 800000 },
    { offset: -2, category: 'Lương nhân viên', desc: 'Lương T1', amount: 45000000 },
    { offset: -2, category: 'Thuê mặt bằng', desc: 'Tiền thuê kho', amount: 15000000 },
    { offset: -2, category: 'Khác', desc: 'Bảo trì máy', amount: 2000000 },
    // Month 2 (1 month ago)
    { offset: -1, category: 'Vận chuyển', desc: 'Giao hàng HCM', amount: 6000000 },
    { offset: -1, category: 'Vận chuyển', desc: 'Giao hàng miền Bắc', amount: 8500000 },
    { offset: -1, category: 'Xăng xe', desc: 'Xăng tháng', amount: 3200000 },
    { offset: -1, category: 'Văn phòng phẩm', desc: 'Văn phòng phẩm', amount: 650000 },
    { offset: -1, category: 'Lương nhân viên', desc: 'Lương T2', amount: 45000000 },
    { offset: -1, category: 'Thuê mặt bằng', desc: 'Tiền thuê kho', amount: 15000000 },
    // Current month
    { offset: 0, category: 'Vận chuyển', desc: 'Giao hàng đợt 1', amount: 4800000 },
    { offset: 0, category: 'Xăng xe', desc: 'Xăng nửa tháng đầu', amount: 1500000 },
    { offset: 0, category: 'Lương nhân viên', desc: 'Lương T3', amount: 45000000 },
    { offset: 0, category: 'Thuê mặt bằng', desc: 'Tiền thuê kho', amount: 15000000 },
    { offset: 0, category: 'Khác', desc: 'Tiếp khách', amount: 1200000 },
  ];

  for (const entry of costEntries) {
    const date = dayjs().add(entry.offset, 'month').date(Math.floor(Math.random() * 25) + 1);
    await prisma.operatingCost.create({
      data: {
        date: date.toDate(),
        category_id: cats[entry.category],
        description: entry.desc,
        amount: entry.amount,
      },
    });
  }
}
