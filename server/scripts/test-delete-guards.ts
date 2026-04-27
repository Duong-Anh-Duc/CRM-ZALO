/**
 * Verify the new delete methods exist and have proper signatures.
 */
import { SalesOrderService } from '../src/modules/sales-order/sales-order.service';
import { PurchaseOrderService } from '../src/modules/purchase-order/purchase-order.service';
import { ReceivableService } from '../src/modules/receivable/receivable.service';
import { PayableService } from '../src/modules/payable/payable.service';
import { InvoiceService } from '../src/modules/invoice/invoice.service';
import { SalesReturnService } from '../src/modules/return/sales-return.service';
import { PurchaseReturnService } from '../src/modules/return/purchase-return.service';

const checks = [
  { name: 'SalesOrderService.delete', exists: typeof SalesOrderService.delete === 'function' },
  { name: 'PurchaseOrderService.delete', exists: typeof PurchaseOrderService.delete === 'function' },
  { name: 'ReceivableService.delete', exists: typeof ReceivableService.delete === 'function' },
  { name: 'ReceivableService.deletePayment', exists: typeof ReceivableService.deletePayment === 'function' },
  { name: 'ReceivableService.deleteByInvoice', exists: typeof ReceivableService.deleteByInvoice === 'function' },
  { name: 'PayableService.delete', exists: typeof PayableService.delete === 'function' },
  { name: 'PayableService.deletePayment', exists: typeof PayableService.deletePayment === 'function' },
  { name: 'PayableService.deleteByInvoice', exists: typeof PayableService.deleteByInvoice === 'function' },
  { name: 'InvoiceService.cancel', exists: typeof InvoiceService.cancel === 'function' },
  { name: 'SalesReturnService.delete', exists: typeof SalesReturnService.delete === 'function' },
  { name: 'PurchaseReturnService.delete', exists: typeof PurchaseReturnService.delete === 'function' },
];

console.log('Checking new delete methods exist:');
let allOk = true;
for (const c of checks) {
  const icon = c.exists ? '✅' : '❌';
  console.log(`  ${icon} ${c.name}`);
  if (!c.exists) allOk = false;
}
console.log(allOk ? '\n✅ All methods present' : '\n❌ Some methods missing');
process.exit(allOk ? 0 : 1);
