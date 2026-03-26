import { PrismaClient, Supplier } from '@prisma/client';

const suppliersData = [
  {
    company_name: 'Công ty TNHH Nhựa Bình Dương',
    tax_code: '3700123456',
    address: '123 Đại lộ Bình Dương, TX Dĩ An, Bình Dương',
    contact_name: 'Nguyễn Văn Bình',
    phone: '0274 3123456',
    email: 'contact@nhuabinhduong.vn',
    payment_terms: 'NET_30' as const,
  },
  {
    company_name: 'Công ty CP Bao Bì Thiên Long',
    tax_code: '0301234567',
    address: '456 Quốc lộ 1A, Quận 12, TP HCM',
    contact_name: 'Trần Thị Lan',
    phone: '028 38123456',
    email: 'sales@thienlong-pack.com',
    payment_terms: 'NET_60' as const,
  },
  {
    company_name: 'Công ty TNHH Tân Phú Container',
    tax_code: '0312345678',
    address: '78 Hòa Bình, Q. Tân Phú, TP HCM',
    contact_name: 'Lê Minh Tuấn',
    phone: '028 39876543',
    email: 'order@tanphucontainer.vn',
    payment_terms: 'NET_30' as const,
  },
  {
    company_name: 'Công ty TNHH SX Nhựa Đại Phát',
    tax_code: '3600987654',
    address: 'KCN Mỹ Phước 3, Bến Cát, Bình Dương',
    contact_name: 'Phạm Văn Đại',
    phone: '0274 3654321',
    email: 'info@nhuadaiphat.com',
    payment_terms: 'NET_90' as const,
  },
  {
    company_name: 'Công ty CP Nhựa và Môi Trường Xanh',
    tax_code: '0100123789',
    address: '99 Nguyễn Trãi, Thanh Xuân, Hà Nội',
    contact_name: 'Vũ Thị Hương',
    phone: '024 35678901',
    email: 'green@nhuaxanh.vn',
    payment_terms: 'IMMEDIATE' as const,
  },
];

export async function seedSuppliers(prisma: PrismaClient): Promise<Supplier[]> {
  const results: Supplier[] = [];

  for (const data of suppliersData) {
    const supplier = await prisma.supplier.upsert({
      where: { id: data.company_name.toLowerCase().replace(/\s/g, '-').slice(0, 36) },
      update: {},
      create: {
        id: data.company_name.toLowerCase().replace(/\s/g, '-').slice(0, 36),
        ...data,
      },
    });
    results.push(supplier);
  }

  return results;
}
