import { PrismaClient, Customer } from '@prisma/client';

const customersData = [
  { company_name: 'Công ty TNHH Mỹ Phẩm Sài Gòn Beauty', tax_code: '0301111111', contact_name: 'Nguyễn Thị Mai', phone: '028 38001234', email: 'mai@sgbeauty.vn', customer_type: 'BUSINESS' as const, debt_limit: 500000000, address: '15 Lê Lợi, Q1, TP HCM' },
  { company_name: 'Công ty CP Thực phẩm Việt Hưng', tax_code: '0100222222', contact_name: 'Trần Văn Hưng', phone: '024 36001234', email: 'hung@viethung.com', customer_type: 'BUSINESS' as const, debt_limit: 1000000000, address: '88 Hoàng Quốc Việt, HN' },
  { company_name: 'DNTN Hóa Chất Tân Bình', tax_code: '0302333333', contact_name: 'Lê Thành Công', phone: '028 38445566', email: 'cong@hcotanbinh.vn', customer_type: 'BUSINESS' as const, debt_limit: 300000000, address: '200 Cộng Hòa, Tân Bình, TP HCM' },
  { company_name: 'Shop Mỹ Phẩm Online Hana', tax_code: '0301444444', contact_name: 'Phạm Thị Hana', phone: '0901234567', email: 'hana@shopmp.vn', customer_type: 'INDIVIDUAL' as const, debt_limit: 50000000, address: '10 Nguyễn Huệ, Q1, TP HCM' },
  { company_name: 'Công ty TNHH Dược phẩm Minh Tâm', tax_code: '3700555555', contact_name: 'Bùi Minh Tâm', phone: '0274 3112233', email: 'tam@duocminhtam.com', customer_type: 'BUSINESS' as const, debt_limit: 800000000, address: 'KCN VSIP, Bình Dương' },
  { company_name: 'Cửa hàng Gia Dụng Bảo Ngọc', tax_code: '0301666666', contact_name: 'Đặng Bảo Ngọc', phone: '0912345678', email: 'ngoc@giadungbn.vn', customer_type: 'INDIVIDUAL' as const, debt_limit: 30000000, address: '55 Lý Thường Kiệt, Q10, TP HCM' },
  { company_name: 'Công ty TNHH SX Nước Giải Khát Fresh', tax_code: '0302777777', contact_name: 'Hoàng Văn Tươi', phone: '028 39112233', email: 'fresh@ngkfresh.com', customer_type: 'BUSINESS' as const, debt_limit: 700000000, address: '45 Trường Chinh, Q12, TP HCM' },
  { company_name: 'Công ty CP Hóa Mỹ Phẩm Sạch', tax_code: '0100888888', contact_name: 'Võ Thị Sạch', phone: '024 38112233', email: 'sach@hmpsach.vn', customer_type: 'BUSINESS' as const, debt_limit: 400000000, address: '120 Giảng Võ, Đống Đa, HN' },
  { company_name: 'DNTN Bao Bì Thực Phẩm An Toàn', tax_code: '0301999999', contact_name: 'Lý Văn An', phone: '0933456789', email: 'an@baobiantoan.vn', customer_type: 'BUSINESS' as const, debt_limit: 600000000, address: '78 Nguyễn Văn Linh, Q7, TP HCM' },
  { company_name: 'Tiệm Tạp Hóa Phương Nam', tax_code: '0302000001', contact_name: 'Nguyễn Phương Nam', phone: '0945678901', email: 'nam@taphoaPN.vn', customer_type: 'INDIVIDUAL' as const, debt_limit: 20000000, address: '333 CMT8, Q3, TP HCM' },
];

export async function seedCustomers(prisma: PrismaClient): Promise<Customer[]> {
  const results: Customer[] = [];

  for (const data of customersData) {
    const customer = await prisma.customer.upsert({
      where: { id: data.company_name.toLowerCase().replace(/\s/g, '-').slice(0, 36) },
      update: {},
      create: {
        id: data.company_name.toLowerCase().replace(/\s/g, '-').slice(0, 36),
        ...data,
      },
    });
    results.push(customer);
  }

  return results;
}
