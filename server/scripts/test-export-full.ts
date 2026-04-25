/**
 * Full test: call Aura tool → service export → upload Cloudinary → return URL.
 */
import { CustomerService } from '../src/modules/customer/customer.service';
import { uploadExport } from '../src/lib/cloudinary-export';
import dayjs from 'dayjs';

async function main() {
  console.log('1. Generating customer Excel...');
  const buffer = await CustomerService.exportExcel({});
  console.log(`   Buffer: ${(buffer.length / 1024).toFixed(1)} KB`);

  console.log('2. Uploading to Cloudinary...');
  const filename = `test-customers-${dayjs().format('YYYYMMDD-HHmmss')}.xlsx`;
  const url = await uploadExport(buffer, filename);
  console.log(`   URL: ${url}`);

  console.log('3. Verifying download...');
  const res = await fetch(url);
  console.log(`   HTTP ${res.status} | Content-Length: ${res.headers.get('content-length')}`);
  const downloaded = await res.arrayBuffer();
  const match = downloaded.byteLength === buffer.length;
  console.log(`   Match original size: ${match ? '✅' : '❌'}`);

  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
