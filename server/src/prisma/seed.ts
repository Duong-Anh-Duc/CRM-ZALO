import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { seedCategories } from './seeds/categories';
import { seedProducts } from './seeds/products';
import { seedCustomers } from './seeds/customers';
import { seedSuppliers } from './seeds/suppliers';
import { seedOrders } from './seeds/orders';
import { seedOperatingCosts } from './seeds/operating-costs';
import { seedCashBook } from './seeds/cash-book';
import { seedRBAC } from './seeds/rbac';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // RBAC (roles + permissions) first so users can reference role_id.
  await seedRBAC(prisma);
  console.log('✅ RBAC seeded');

  const adminRole = await prisma.role.findUniqueOrThrow({ where: { slug: 'admin' } });
  const salesRole = await prisma.role.findUniqueOrThrow({ where: { slug: 'sales' } });

  // Users
  const adminHash = await bcrypt.hash('Duckhiem040603@', 12);
  const staffHash = await bcrypt.hash('Staff@123456', 12);

  await prisma.user.upsert({
    where: { email: 'ducytcg123456@gmail.com' },
    update: { role_id: adminRole.id },
    create: {
      email: 'ducytcg123456@gmail.com',
      password_hash: adminHash,
      full_name: 'Nguyễn Văn Admin',
      role_id: adminRole.id,
    },
  });

  await prisma.user.upsert({
    where: { email: 'admin2@packflow.vn' },
    update: { role_id: adminRole.id },
    create: {
      email: 'admin2@packflow.vn',
      password_hash: adminHash,
      full_name: 'Trần Thị Quản Lý',
      role_id: adminRole.id,
    },
  });

  await prisma.user.upsert({
    where: { email: 'staff1@packflow.vn' },
    update: { role_id: salesRole.id },
    create: {
      email: 'staff1@packflow.vn',
      password_hash: staffHash,
      full_name: 'Lê Văn Nhân Viên',
      role_id: salesRole.id,
    },
  });

  await prisma.user.upsert({
    where: { email: 'staff2@packflow.vn' },
    update: { role_id: salesRole.id },
    create: {
      email: 'staff2@packflow.vn',
      password_hash: staffHash,
      full_name: 'Phạm Thị Bán Hàng',
      role_id: salesRole.id,
    },
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

  // Cash book categories + sample transactions
  await seedCashBook();
  console.log('✅ Cash book seeded');

  console.log('🎉 Seeding complete!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
