import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { seedCategories } from './seeds/categories';
import { seedProducts } from './seeds/products';
import { seedCustomers } from './seeds/customers';
import { seedSuppliers } from './seeds/suppliers';
import { seedOrders } from './seeds/orders';
import { seedOperatingCosts } from './seeds/operating-costs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Users
  const adminHash = await bcrypt.hash('Admin@123456', 12);
  const staffHash = await bcrypt.hash('Staff@123456', 12);
  const viewerHash = await bcrypt.hash('Viewer@123456', 12);

  await prisma.user.upsert({
    where: { email: 'admin@packflow.vn' },
    update: {},
    create: { email: 'admin@packflow.vn', password_hash: adminHash, full_name: 'Nguyễn Văn Admin', role: 'ADMIN' },
  });

  await prisma.user.upsert({
    where: { email: 'admin2@packflow.vn' },
    update: {},
    create: { email: 'admin2@packflow.vn', password_hash: adminHash, full_name: 'Trần Thị Quản Lý', role: 'ADMIN' },
  });

  await prisma.user.upsert({
    where: { email: 'staff1@packflow.vn' },
    update: {},
    create: { email: 'staff1@packflow.vn', password_hash: staffHash, full_name: 'Lê Văn Nhân Viên', role: 'STAFF' },
  });

  await prisma.user.upsert({
    where: { email: 'staff2@packflow.vn' },
    update: {},
    create: { email: 'staff2@packflow.vn', password_hash: staffHash, full_name: 'Phạm Thị Bán Hàng', role: 'STAFF' },
  });

  await prisma.user.upsert({
    where: { email: 'viewer@packflow.vn' },
    update: {},
    create: { email: 'viewer@packflow.vn', password_hash: viewerHash, full_name: 'Hoàng Văn Xem', role: 'VIEWER' },
  });

  console.log('✅ Users seeded');

  // Categories
  await seedCategories(prisma);
  console.log('✅ Categories seeded');

  // Suppliers (before products, as products reference suppliers)
  const suppliers = await seedSuppliers(prisma);
  console.log('✅ Suppliers seeded');

  // Products
  await seedProducts(prisma, suppliers);
  console.log('✅ Products seeded');

  // Customers
  const customers = await seedCustomers(prisma);
  console.log('✅ Customers seeded');

  // Operating cost categories
  await seedOperatingCosts(prisma);
  console.log('✅ Operating costs seeded');

  // Orders, receivables, payables
  await seedOrders(prisma, customers, suppliers);
  console.log('✅ Orders seeded');

  console.log('🎉 Seeding complete!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
