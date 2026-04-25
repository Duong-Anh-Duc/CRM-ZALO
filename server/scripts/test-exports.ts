/**
 * Smoke test: gọi trực tiếp service export, dump buffer ra file tmp, kiểm tra hợp lệ.
 */
import fs from 'fs';
import { CustomerService } from '../src/modules/customer/customer.service';
import { SupplierService } from '../src/modules/supplier/supplier.service';
import { ProductService } from '../src/modules/product/product.service';

function sizeKB(buf: Buffer): string {
  return (buf.length / 1024).toFixed(1) + ' KB';
}

async function main() {
  console.log('━━━ CUSTOMER EXPORT ━━━');
  const cBuf = await CustomerService.exportExcel({});
  fs.writeFileSync('/tmp/export_customers.xlsx', cBuf);
  console.log(`  size: ${sizeKB(cBuf)} → /tmp/export_customers.xlsx`);
  console.log(`  header: ${cBuf.slice(0, 4).toString('hex')} (valid xlsx = 504b0304)`);

  console.log('\n━━━ SUPPLIER EXPORT ━━━');
  const sBuf = await SupplierService.exportExcel({});
  fs.writeFileSync('/tmp/export_suppliers.xlsx', sBuf);
  console.log(`  size: ${sizeKB(sBuf)} → /tmp/export_suppliers.xlsx`);
  console.log(`  header: ${sBuf.slice(0, 4).toString('hex')}`);

  console.log('\n━━━ PRODUCT EXPORT ━━━');
  const pBuf = await ProductService.exportExcel({});
  fs.writeFileSync('/tmp/export_products.xlsx', pBuf);
  console.log(`  size: ${sizeKB(pBuf)} → /tmp/export_products.xlsx`);
  console.log(`  header: ${pBuf.slice(0, 4).toString('hex')}`);

  console.log('\n━━━ FILTERS (customers BUSINESS + debt) ━━━');
  const fBuf = await CustomerService.exportExcel({ customer_type: 'BUSINESS', has_debt: true });
  console.log(`  size: ${sizeKB(fBuf)}`);
  console.log('\n━━━ FILTERS (products material=PET active) ━━━');
  const fBuf2 = await ProductService.exportExcel({ material: 'PET', is_active: true });
  console.log(`  size: ${sizeKB(fBuf2)}`);

  console.log('\n✅ All exports produced valid xlsx buffers.');
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
